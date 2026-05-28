import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Bold,
  ChevronDown,
  Italic,
  List,
  Loader2,
  Paperclip,
  Send,
  Trash2,
  Underline,
  X,
} from "lucide-react";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

interface EmailComposerProps {
  leadId: string;
  guestEmail?: string;
  replyTo?: {
    messageId: string;
    threadId: string;
    from: string;
    subject: string;
    bodyHtml?: string;
    sentAt?: string;
  };
  onSent: () => void;
  onClose: () => void;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject?: string;
  body?: string;
}

interface SendingAccount {
  email: string;
  provider: "gmail" | "outlook";
  avatarUrl?: string;
}

type ComposeErrorMode = "general" | "connect_account";

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function splitEmails(raw: string): string[] {
  return raw
    .split(/[,\s;]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function prettyFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function truncateFileName(name: string): string {
  if (name.length <= 20) return name;
  return `${name.slice(0, 17)}...`;
}

function formatReplySubject(subject: string): string {
  return subject.toLowerCase().startsWith("re:") ? subject : `Re: ${subject}`;
}

function GmailGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path d="M2 6.5L12 14l10-7.5V18a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6.5Z" fill="#EA4335" />
      <path d="M2 6l10 7 10-7-2-2H4L2 6Z" fill="#FBBC05" />
      <path d="M2 6v12a2 2 0 0 0 2 2h1V8.3L2 6Z" fill="#34A853" />
      <path d="M22 6v12a2 2 0 0 1-2 2h-1V8.3L22 6Z" fill="#4285F4" />
    </svg>
  );
}

function OutlookGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <rect x="2" y="5" width="10" height="14" rx="1.5" fill="#2563EB" />
      <path d="M12 7h9a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-9V7Z" fill="#3B82F6" />
      <path d="m12 8 5 4-5 4V8Z" fill="#93C5FD" />
    </svg>
  );
}

function RecipientChip({
  email,
  locked,
  invalid,
  onRemove,
}: {
  email: string;
  locked?: boolean;
  invalid?: boolean;
  onRemove: () => void;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${
        invalid
          ? "bg-red-50 text-red-700 ring-1 ring-red-200"
          : "bg-blue-50 text-blue-700 ring-1 ring-blue-200"
      }`}
    >
      <span className="max-w-[180px] truncate">{email}</span>
      {!locked ? (
        <button type="button" className="rounded p-0.5 hover:bg-black/5" onClick={onRemove} aria-label="Remove recipient">
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  );
}

export default function EmailComposer({ leadId, guestEmail, replyTo, onSent, onClose }: EmailComposerProps) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const toInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);

  const [to, setTo] = useState<string[]>([]);
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [account, setAccount] = useState<SendingAccount | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [errorMode, setErrorMode] = useState<ComposeErrorMode>("general");
  const [showQuoted, setShowQuoted] = useState(false);
  const [activeState, setActiveState] = useState({
    bold: false,
    italic: false,
    underline: false,
    ul: false,
  });

  const nonRemovableRecipient = replyTo?.from ?? null;
  const modalTitle = replyTo ? "Reply" : "New Email";
  const quotedTitle = useMemo(() => {
    if (!replyTo) return "";
    const dateLabel = replyTo.sentAt ? new Date(replyTo.sentAt).toLocaleString() : "earlier";
    return `On ${dateLabel}, ${replyTo.from} wrote:`;
  }, [replyTo]);

  useEffect(() => {
    const seedTo = replyTo?.from ? [replyTo.from] : guestEmail ? [guestEmail] : [];
    setTo(seedTo);
    setSubject(replyTo?.subject ? formatReplySubject(replyTo.subject) : "");
    setCc([]);
    setBcc([]);
    setToInput("");
    setCcInput("");
    setBccInput("");
    setAttachmentFiles([]);
    setShowCc(false);
    setShowBcc(false);
    setErrorMessage(null);
    setErrorMode("general");
    setShowQuoted(false);
    if (bodyRef.current) {
      bodyRef.current.innerHTML = "";
    }
  }, [guestEmail, replyTo]);

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      try {
        const response = await fetch(`${API_BASE_URL}/templates?channel=email`, {
          headers: withAuthHeaders(),
        });
        if (!response.ok) {
          setTemplates([]);
          return;
        }
        const data = (await response.json()) as Array<{ id?: string; _id?: string; name: string; subject?: string; body?: string }>;
        setTemplates(
          data.map((t) => ({
            id: t.id || t._id || t.name,
            name: t.name,
            subject: t.subject,
            body: t.body,
          }))
        );
      } finally {
        setLoadingTemplates(false);
      }
    };

    const loadSendingAccount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/email-accounts/me`, {
          headers: withAuthHeaders(),
        });
        if (!response.ok) {
          setAccount(null);
          return;
        }
        const data = (await response.json()) as SendingAccount;
        setAccount(data);
      } catch {
        setAccount(null);
      }
    };

    void loadTemplates();
    void loadSendingAccount();
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!templateMenuRef.current) return;
      const target = event.target as Node;
      if (!templateMenuRef.current.contains(target)) {
        setTemplatesOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const refreshActiveStates = () => {
      setActiveState({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        ul: document.queryCommandState("insertUnorderedList"),
      });
    };

    document.addEventListener("selectionchange", refreshActiveStates);
    return () => document.removeEventListener("selectionchange", refreshActiveStates);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isMeta = navigator.platform.toLowerCase().includes("mac") ? event.metaKey : event.ctrlKey;
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
      if (isMeta && event.key === "Enter") {
        event.preventDefault();
        void handleSend();
      }
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "c") {
        event.preventDefault();
        setShowCc((prev) => !prev);
      }
      if (isMeta && event.shiftKey && event.key.toLowerCase() === "b") {
        event.preventDefault();
        setShowBcc((prev) => !prev);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const exec = (command: "bold" | "italic" | "underline" | "insertUnorderedList") => {
    bodyRef.current?.focus();
    document.execCommand(command, false);
    setActiveState({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      ul: document.queryCommandState("insertUnorderedList"),
    });
  };

  const commitInput = (
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    reset: () => void
  ) => {
    const candidates = splitEmails(value);
    if (candidates.length === 0) return;
    const deduped = [...current];
    for (const email of candidates) {
      if (!deduped.includes(email)) deduped.push(email);
    }
    setter(deduped);
    reset();
  };

  const handleRecipientKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    value: string,
    current: string[],
    setter: (next: string[]) => void,
    reset: () => void
  ) => {
    if (event.key === "Enter" || event.key === "Tab" || event.key === ",") {
      event.preventDefault();
      commitInput(value, current, setter, reset);
      return;
    }
    if (event.key === "Backspace" && value.length === 0 && current.length > 0) {
      event.preventDefault();
      setter(current.slice(0, -1));
    }
  };

  const applyTemplate = (template: EmailTemplate) => {
    if (!subject.trim() && template.subject) {
      setSubject(template.subject);
    }
    if (template.body && bodyRef.current) {
      bodyRef.current.innerHTML = template.body;
    }
    setTemplatesOpen(false);
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files || []);
    if (picked.length === 0) return;
    setAttachmentFiles((prev) => [...prev, ...picked]);
    event.currentTarget.value = "";
  };

  const removeAttachmentAt = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const removeRecipient = (type: "to" | "cc" | "bcc", email: string) => {
    if (type === "to") setTo((prev) => prev.filter((r) => r !== email));
    if (type === "cc") setCc((prev) => prev.filter((r) => r !== email));
    if (type === "bcc") setBcc((prev) => prev.filter((r) => r !== email));
  };

  const getBody = () => {
    const html = bodyRef.current?.innerHTML ?? "";
    const text = bodyRef.current?.innerText ?? "";
    return { html, text };
  };

  const validateRecipients = () => {
    if (to.length === 0) {
      setErrorMode("general");
      setErrorMessage("Add at least one recipient.");
      return false;
    }
    if (!subject.trim()) {
      setErrorMode("general");
      setErrorMessage("Subject is required.");
      return false;
    }
    return true;
  };

  const sendPayload = async (toList: string[], ccList: string[], bccList: string[]) => {
    const body = getBody();
    const basePayload = {
      to: toList,
      cc: ccList,
      bcc: bccList,
      subject,
      bodyHtml: body.html,
      bodyText: body.text,
      threadId: replyTo?.threadId,
      replyToMessageId: replyTo?.messageId,
    };

    let response = await fetch(`${API_BASE_URL}/leads/${leadId}/email/send`, {
      method: "POST",
      headers: withAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(basePayload),
    });

    if (response.status === 400 || response.status === 422) {
      // Backward compatibility with older backend shape.
      response = await fetch(`${API_BASE_URL}/leads/${leadId}/email/send`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          to: toList[0],
          subject,
          bodyHtml: body.html,
          bodyText: body.text,
          threadId: replyTo?.threadId,
          replyToMessageId: replyTo?.messageId,
        }),
      });
    }

    if (!response.ok) {
      const maybeData = (await response.json().catch(() => ({}))) as { message?: string; code?: string };
      const err = new Error(maybeData.message || "Unable to send email.") as Error & { code?: string };
      err.code = maybeData.code;
      throw err;
    }
  };

  const handleSend = async () => {
    if (!validateRecipients()) return;

    setIsSending(true);
    setErrorMessage(null);
    setErrorMode("general");
    try {
      const cleanTo = to.map((value) => value.trim()).filter(Boolean);
      const cleanCc = cc.map((value) => value.trim()).filter(Boolean);
      const cleanBcc = bcc.map((value) => value.trim()).filter(Boolean);
      await sendPayload(cleanTo, cleanCc, cleanBcc);

      if (attachmentFiles.length > 0) {
        // TODO: upload attachments
        console.log("TODO: upload attachments", attachmentFiles);
      }

      onSent();
      onClose();
    } catch (error) {
      const err = error as Error & { code?: string };
      if (err.code === "EMAIL_ACCOUNT_NOT_CONNECTED") {
        setErrorMode("connect_account");
        setErrorMessage("Connect your email account to send emails.");
      } else {
        setErrorMode("general");
        setErrorMessage(err.message || "Unable to send email.");
      }
    } finally {
      setIsSending(false);
    }
  };

  const recipientRow = (
    label: "To" | "Cc" | "Bcc",
    values: string[],
    value: string,
    setValue: (value: string) => void,
    setValues: (next: string[]) => void,
    isHidden?: boolean
  ) => {
    if (isHidden) return null;
    const type = label.toLowerCase() as "to" | "cc" | "bcc";
    return (
      <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-2.5">
        <div className="pt-1 text-sm text-gray-500 w-10 shrink-0">{label}</div>
        <div className="flex min-h-8 flex-1 flex-wrap items-center gap-1.5 rounded-md">
          {values.map((email) => (
            <RecipientChip
              key={`${type}-${email}`}
              email={email}
              invalid={!isValidEmail(email)}
              locked={Boolean(nonRemovableRecipient && type === "to" && email === nonRemovableRecipient)}
              onRemove={() => removeRecipient(type, email)}
            />
          ))}
          <input
            ref={label === "To" ? toInputRef : undefined}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onBlur={() => commitInput(value, values, setValues, () => setValue(""))}
            onKeyDown={(event) =>
              handleRecipientKeyDown(event, value, values, setValues, () => setValue(""))
            }
            className="min-w-[220px] flex-1 bg-transparent py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
            placeholder={values.length === 0 ? "name@example.com" : ""}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-[780px] min-h-[560px] overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black/10">
      <div className="flex items-center justify-between bg-gray-900 px-5 py-3">
        <h3 className="text-sm font-semibold text-white">{modalTitle}</h3>
        <button type="button" className="rounded p-1 text-gray-300 hover:bg-white/10 hover:text-white" onClick={onClose}>
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative border-b border-gray-100 px-4 py-2" ref={templateMenuRef}>
        <div className="flex items-center gap-1">
          {[
            { icon: Bold, active: activeState.bold, cmd: "bold" as const, label: "Bold" },
            { icon: Italic, active: activeState.italic, cmd: "italic" as const, label: "Italic" },
            { icon: Underline, active: activeState.underline, cmd: "underline" as const, label: "Underline" },
            { icon: List, active: activeState.ul, cmd: "insertUnorderedList" as const, label: "Bullet list" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => exec(item.cmd)}
              className={`rounded p-2 text-sm transition ${
                item.active ? "bg-gray-200 text-gray-900" : "text-gray-600 hover:bg-gray-100"
              }`}
              title={item.label}
            >
              <item.icon className="h-4 w-4" />
            </button>
          ))}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="ml-1 rounded p-2 text-gray-600 hover:bg-gray-100"
            title="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelection}
            className="hidden"
          />

          <button
            type="button"
            className="ml-1 inline-flex items-center gap-1 rounded px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-100"
            onClick={() => setTemplatesOpen((prev) => !prev)}
          >
            <span>Templates</span>
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {templatesOpen ? (
          <div className="absolute left-2 top-11 z-50 w-72 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
            {loadingTemplates ? (
              <div className="px-3 py-2 text-sm text-gray-500">Loading templates...</div>
            ) : templates.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">No templates</div>
            ) : (
              templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => applyTemplate(template)}
                  className="block w-full rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  {template.name}
                </button>
              ))
            )}
          </div>
        ) : null}
      </div>

      {errorMessage ? (
        <div className={`mx-4 mt-3 flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
          errorMode === "connect_account"
            ? "border-amber-200 bg-amber-50 text-amber-800"
            : "border-red-200 bg-red-50 text-red-700"
        }`}>
          <span className="inline-flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {errorMessage}
          </span>
          {errorMode === "connect_account" ? (
            <button
              type="button"
              className="rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200"
              onClick={() => {
                window.location.href = "/settings?tab=email-accounts";
              }}
            >
              Connect account
            </button>
          ) : (
            <button
              type="button"
              className="rounded bg-red-100 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
              onClick={() => void handleSend()}
            >
              Retry
            </button>
          )}
        </div>
      ) : null}

      <div className="mt-2">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-2.5">
          <div className="flex flex-1 items-start gap-3">
            <div className="pt-1 text-sm text-gray-500 w-10 shrink-0">To</div>
            <div className="flex min-h-8 flex-1 flex-wrap items-center gap-1.5 rounded-md">
              {to.map((email) => (
                <RecipientChip
                  key={`to-${email}`}
                  email={email}
                  invalid={!isValidEmail(email)}
                  locked={Boolean(nonRemovableRecipient && email === nonRemovableRecipient)}
                  onRemove={() => removeRecipient("to", email)}
                />
              ))}
              <input
                ref={toInputRef}
                value={toInput}
                onChange={(event) => setToInput(event.target.value)}
                onBlur={() => commitInput(toInput, to, setTo, () => setToInput(""))}
                onKeyDown={(event) =>
                  handleRecipientKeyDown(event, toInput, to, setTo, () => setToInput(""))
                }
                className="min-w-[220px] flex-1 bg-transparent py-1 text-sm text-gray-900 outline-none placeholder:text-gray-400"
                placeholder={to.length === 0 ? "name@example.com" : ""}
              />
            </div>
          </div>
          <div className="ml-3 flex items-center gap-2 text-xs">
            {!showCc ? (
              <button type="button" onClick={() => setShowCc(true)} className="rounded px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                Cc
              </button>
            ) : null}
            {!showBcc ? (
              <button type="button" onClick={() => setShowBcc(true)} className="rounded px-1.5 py-1 text-gray-500 hover:bg-gray-100 hover:text-gray-700">
                Bcc
              </button>
            ) : null}
          </div>
        </div>

        {recipientRow("Cc", cc, ccInput, setCcInput, setCc, !showCc)}
        {recipientRow("Bcc", bcc, bccInput, setBccInput, setBcc, !showBcc)}

        <div className="border-b border-gray-100 px-5 py-3">
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            readOnly={Boolean(replyTo)}
            className="w-full bg-transparent text-lg font-medium text-gray-900 outline-none placeholder:text-gray-400"
            placeholder="Subject"
          />
        </div>
      </div>

      <div className="px-5 py-3">
        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Write your email..."
          className="min-h-[240px] w-full text-[15px] leading-6 text-gray-800 outline-none empty:before:pointer-events-none empty:before:text-gray-400 empty:before:content-[attr(data-placeholder)]"
        />

        {replyTo ? (
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              type="button"
              className="text-xs font-medium text-gray-500 hover:text-gray-700"
              onClick={() => setShowQuoted((prev) => !prev)}
            >
              {showQuoted ? "Hide quoted" : "Show quoted"}
            </button>
            {showQuoted ? (
              <div className="mt-2 border-l-2 border-gray-200 pl-3 text-xs italic text-gray-500">
                <p className="mb-1 not-italic text-gray-500">{quotedTitle}</p>
                <div
                  className="prose prose-sm max-w-none text-gray-500"
                  dangerouslySetInnerHTML={{ __html: replyTo.bodyHtml || "" }}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-auto border-t border-gray-200 bg-gray-50 px-5 py-3">
        <div className="mb-2 flex items-center gap-2">
          {account ? (
            <>
              <span className="inline-flex items-center justify-center rounded bg-white p-1 ring-1 ring-gray-200">
                {account.provider === "gmail" ? <GmailGlyph /> : <OutlookGlyph />}
              </span>
              <span className="text-xs text-gray-600">{account.email}</span>
            </>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700">
              <AlertCircle className="h-3.5 w-3.5" />
              No email account connected
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {attachmentFiles.map((file, index) => (
              <span
                key={`${file.name}-${index}`}
                className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs text-gray-700 ring-1 ring-gray-200"
              >
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[140px] truncate">{truncateFileName(file.name)}</span>
                <span className="text-gray-400">{prettyFileSize(file.size)}</span>
                <button
                  type="button"
                  className="rounded p-0.5 hover:bg-gray-100"
                  onClick={() => removeAttachmentAt(index)}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              <Trash2 className="h-4 w-4" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending}
              className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>{isSending ? "Sending..." : "Send"}</span>
              <span className="text-xs text-indigo-200">{String.fromCharCode(8984)}↵</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
