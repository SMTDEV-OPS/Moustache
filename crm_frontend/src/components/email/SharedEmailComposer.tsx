import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X, AlertCircle, FileText, Paperclip } from "lucide-react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "@/components/EmailComposer.css";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { sendEmail, type EmailAddress } from "@/services/email";
import { sendEmailFromLead } from "@/services/communications";

interface SharedEmailComposerProps {
  mode: "compose" | "reply" | "forward";
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  defaultThreadId?: string;
  defaultInReplyTo?: string;
  leadId?: string;
  onSent?: (message: any) => void;
  onClose?: () => void;
  isOpen: boolean;
}

interface AccountMeResponse {
  email: string;
  provider?: string;
  signature?: string;
}

interface EmailTemplate {
  _id?: string;
  id?: string;
  name?: string;
  subject?: string;
  bodyHtml?: string;
  bodyText?: string;
}

export function SharedEmailComposer({
  mode,
  defaultTo,
  defaultSubject,
  defaultBody,
  defaultThreadId,
  defaultInReplyTo,
  leadId,
  onSent,
  onClose,
  isOpen,
}: SharedEmailComposerProps) {
  const [fromEmail, setFromEmail] = useState("");
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [toDraft, setToDraft] = useState(defaultTo || "");
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [ccDraft, setCcDraft] = useState("");
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [bccDraft, setBccDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [signatureHtml, setSignatureHtml] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const signatureInsertedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    const initialTo = (defaultTo || "").trim();
    setToDraft(initialTo);
    setToEmails(initialTo ? splitEmails(initialTo) : []);
    setCcDraft("");
    setCcEmails([]);
    setBccDraft("");
    setBccEmails([]);
    setSelectedFiles([]);
    setShowCcBcc(false);
    setIsTemplatesOpen(false);
    setTemplatesError(null);
    setTemplates([]);
    signatureInsertedRef.current = false;

    setSubject(getInitialSubject(mode, defaultSubject));
    setBodyHtml(defaultBody || "");
    setInlineError(null);
  }, [isOpen, defaultTo, defaultSubject, defaultBody]);

  useEffect(() => {
    if (!isOpen) return;

    const loadAccount = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/email/accounts/me`, {
          headers: withAuthHeaders(),
        });
        if (!response.ok) {
          setFromEmail("");
          setSignatureHtml(null);
          return;
        }
        const data = (await response.json()) as AccountMeResponse;
        setFromEmail(data.email || "");
        setSignatureHtml(typeof data.signature === "string" ? data.signature : null);
      } catch {
        setFromEmail("");
        setSignatureHtml(null);
      }
    };

    void loadAccount();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (signatureInsertedRef.current) return;
    if (!signatureHtml) return;

    const separator = "<p>--</p>";
    const signatureBlock = `<div>${signatureHtml}</div>`;
    const trimmedBody = (bodyHtml || "").trim();

    // In reply mode, keep signature above the quoted block (which is rendered below the editor).
    if (!trimmedBody) {
      const newHtml = `${separator}${signatureBlock}`;
      setBodyHtml(newHtml);
    } else if (!trimmedBody.includes(signatureHtml)) {
      const newHtml = `${trimmedBody}${separator}${signatureBlock}`;
      setBodyHtml(newHtml);
    }

    signatureInsertedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, signatureHtml]);

  const modeTitle = useMemo(() => {
    if (mode === "reply") return "Reply";
    if (mode === "forward") return "Forward";
    return "New Email";
  }, [mode]);

  const attachmentTotalBytes = useMemo(() => {
    return selectedFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  }, [selectedFiles]);

  const isAttachmentWarn = attachmentTotalBytes > 10 * 1024 * 1024;
  const isAttachmentTooLarge = attachmentTotalBytes > 25 * 1024 * 1024;

  const handleClose = () => {
    onClose?.();
  };

  const effectiveTo = useMemo(() => {
    const all = [...toEmails, ...splitEmails(toDraft)];
    const deduped = dedupeEmails(all);
    return deduped.join(", ");
  }, [toEmails, toDraft]);

  const effectiveCc = useMemo(() => {
    const all = [...ccEmails, ...splitEmails(ccDraft)];
    const deduped = dedupeEmails(all);
    return deduped;
  }, [ccEmails, ccDraft]);

  const effectiveBcc = useMemo(() => {
    const all = [...bccEmails, ...splitEmails(bccDraft)];
    const deduped = dedupeEmails(all);
    return deduped;
  }, [bccEmails, bccDraft]);

  const handleSend = async () => {
    setInlineError(null);
    const trimmedSubject = subject.trim();
    const plainTextBody = bodyHtml.replace(/<[^>]*>/g, " ").trim();
    const trimmedTo = effectiveTo.trim();

    if (!trimmedTo) {
      setInlineError("Recipient is required.");
      return;
    }

    if (!trimmedSubject) {
      setInlineError("Subject is required.");
      return;
    }

    if (!plainTextBody) {
      setInlineError("Email body is required.");
      return;
    }

    if (isAttachmentTooLarge) {
      setInlineError("Total attachment size exceeds 25MB. Remove some attachments to send.");
      return;
    }

    setIsSending(true);
    try {
      const attachments = await Promise.all(
        selectedFiles.map(async (file) => {
          const base64WithPrefix = await readFileAsBase64(file);
          const commaIdx = base64WithPrefix.indexOf(",");
          const data = commaIdx >= 0 ? base64WithPrefix.slice(commaIdx + 1) : base64WithPrefix;
          return {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            data,
          };
        })
      );

      let sentMessage: any;
      if (leadId) {
        sentMessage = await sendEmailFromLead(leadId, {
          to: trimmedTo,
          cc: effectiveCc,
          bcc: effectiveBcc,
          subject: trimmedSubject,
          bodyHtml,
          bodyText: plainTextBody,
          attachments,
          threadId: defaultThreadId,
          replyToMessageId: defaultInReplyTo,
        });
      } else {
        const toAddress: EmailAddress[] = splitEmails(trimmedTo).map((email) => ({ email }));
        sentMessage = await sendEmail({
          to: toAddress,
          cc: effectiveCc,
          bcc: effectiveBcc,
          subject: trimmedSubject,
          bodyHtml,
          bodyText: plainTextBody,
          attachments,
        });
      }

      onSent?.(sentMessage);
      onClose?.();
    } catch (err) {
      setInlineError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setIsSending(false);
    }
  };

  const handleAddFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const incoming = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...incoming]);
  };

  const loadTemplates = async () => {
    if (templatesLoading) return;
    setTemplatesLoading(true);
    setTemplatesError(null);
    try {
      const response = await fetch(`${API_BASE_URL}/templates?channel=email`, {
        headers: withAuthHeaders(),
      });
      if (!response.ok) {
        setTemplates([]);
        setTemplatesError("Failed to load templates.");
        return;
      }
      const data = (await response.json()) as any;
      const list = Array.isArray(data) ? data : Array.isArray(data?.templates) ? data.templates : [];
      setTemplates(list as EmailTemplate[]);
    } catch (err) {
      setTemplates([]);
      setTemplatesError(err instanceof Error ? err.message : "Failed to load templates.");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const applyTemplate = (tpl: EmailTemplate) => {
    const tplSubject = typeof tpl.subject === "string" ? tpl.subject : "";
    const tplBodyHtml = typeof tpl.bodyHtml === "string" ? tpl.bodyHtml : "";
    const tplBodyText = typeof tpl.bodyText === "string" ? tpl.bodyText : "";

    if (!subject.trim() && tplSubject.trim()) {
      setSubject(tplSubject);
    }

    if (tplBodyHtml.trim()) {
      setBodyHtml(tplBodyHtml);
    } else if (tplBodyText.trim()) {
      setBodyHtml(`<p>${escapeHtml(tplBodyText).replace(/\n/g, "<br/>")}</p>`);
    } else {
      setBodyHtml("");
    }

    setIsTemplatesOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-3xl p-0 gap-0">
        <DialogHeader className="border-b px-5 py-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base">{modeTitle}</DialogTitle>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-3 px-5 py-4">
          {inlineError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{inlineError}</AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-1">
            <Label>From</Label>
            <Input value={fromEmail || "No connected account"} readOnly />
          </div>

          <div className="space-y-1">
            <Label>To</Label>
            <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-2">
              {toEmails.map((email) => (
                <span
                  key={email}
                  className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
                >
                  <span className="max-w-[240px] truncate">{email}</span>
                  <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                    onClick={() => setToEmails((prev) => prev.filter((e) => e !== email))}
                    aria-label={`Remove ${email}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <Input
                value={toDraft}
                onChange={(e) => setToDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const parts = splitEmails(toDraft);
                    if (parts.length > 0) {
                      setToEmails((prev) => dedupeEmails([...prev, ...parts]));
                      setToDraft("");
                    }
                  }
                  if (e.key === "Backspace" && !toDraft && toEmails.length > 0) {
                    setToEmails((prev) => prev.slice(0, -1));
                  }
                }}
                placeholder="recipient@example.com"
                className="h-7 min-w-[220px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-0 text-xs"
              onClick={() => setShowCcBcc((v) => !v)}
            >
              CC / BCC
            </Button>
          </div>

          {showCcBcc ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>CC</Label>
                <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-2">
                  {ccEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
                    >
                      <span className="max-w-[220px] truncate">{email}</span>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                        onClick={() => setCcEmails((prev) => prev.filter((e) => e !== email))}
                        aria-label={`Remove CC ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    value={ccDraft}
                    onChange={(e) => setCcDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const parts = splitEmails(ccDraft);
                        if (parts.length > 0) {
                          setCcEmails((prev) => dedupeEmails([...prev, ...parts]));
                          setCcDraft("");
                        }
                      }
                      if (e.key === "Backspace" && !ccDraft && ccEmails.length > 0) {
                        setCcEmails((prev) => prev.slice(0, -1));
                      }
                    }}
                    placeholder="cc@example.com"
                    className="h-7 min-w-[180px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>BCC</Label>
                <div className="flex flex-wrap items-center gap-1 rounded-md border bg-background px-2 py-2">
                  {bccEmails.map((email) => (
                    <span
                      key={email}
                      className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs"
                    >
                      <span className="max-w-[220px] truncate">{email}</span>
                      <button
                        type="button"
                        className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                        onClick={() => setBccEmails((prev) => prev.filter((e) => e !== email))}
                        aria-label={`Remove BCC ${email}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <Input
                    value={bccDraft}
                    onChange={(e) => setBccDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        const parts = splitEmails(bccDraft);
                        if (parts.length > 0) {
                          setBccEmails((prev) => dedupeEmails([...prev, ...parts]));
                          setBccDraft("");
                        }
                      }
                      if (e.key === "Backspace" && !bccDraft && bccEmails.length > 0) {
                        setBccEmails((prev) => prev.slice(0, -1));
                      }
                    }}
                    placeholder="bcc@example.com"
                    className="h-7 min-w-[180px] flex-1 border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            </div>
          ) : null}

          <div className="space-y-1">
            <Label>Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>Body</Label>
            <div className="email-composer-quill overflow-visible">
              <ReactQuill
                theme="snow"
                value={bodyHtml}
                onChange={setBodyHtml}
                modules={{
                  toolbar: [
                    ["bold", "italic", "underline", "strike"],
                    [{ list: "ordered" }, { list: "bullet" }],
                    ["link"],
                    ["clean"],
                  ],
                }}
                placeholder="Write your email..."
              />
            </div>
          </div>

          {selectedFiles.length > 0 ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {selectedFiles.map((file, idx) => (
                  <span
                    key={`${file.name}-${file.size}-${idx}`}
                    className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-3 py-1 text-xs"
                  >
                    <span className="max-w-[280px] truncate">{file.name}</span>
                    <button
                      type="button"
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full hover:bg-muted"
                      onClick={() =>
                        setSelectedFiles((prev) => prev.filter((_f, i) => i !== idx))
                      }
                      aria-label={`Remove ${file.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="text-xs text-muted-foreground">
                Total size: {formatBytes(attachmentTotalBytes)}
                {isAttachmentWarn ? (
                  <span className="ml-2 text-orange-600">
                    Large attachments may fail to send above 10MB.
                  </span>
                ) : null}
                {isAttachmentTooLarge ? (
                  <span className="ml-2 text-orange-600">Over 25MB — sending disabled.</span>
                ) : null}
              </div>
            </div>
          ) : null}

          {(mode === "reply" || mode === "forward") && defaultBody ? (
            <div className="mt-1 rounded-md border bg-muted/30 p-3">
              <div className="mb-2 text-xs text-muted-foreground">Quoted message</div>
              <div
                className="prose prose-sm max-w-none text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: defaultBody }}
              />
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-5 py-3">
          <div className="flex items-center gap-2">
            <Button
              onClick={() => void handleSend()}
              disabled={isSending || isAttachmentTooLarge}
            >
              {isSending ? "Sending..." : "Send"}
            </Button>
            <Button variant="outline" onClick={handleClose} disabled={isSending}>
              Discard
            </Button>
          </div>

          <div className="flex items-center gap-1">
            <Popover
              open={isTemplatesOpen}
              onOpenChange={(open) => {
                setIsTemplatesOpen(open);
                if (open && templates.length === 0) {
                  void loadTemplates();
                }
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8"
                  disabled={isSending}
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Templates
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2" onInteractOutside={() => setIsTemplatesOpen(false)}>
                <div className="space-y-1">
                  <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
                    Email templates
                  </div>
                  {templatesLoading ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">Loading…</div>
                  ) : templatesError ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">{templatesError}</div>
                  ) : templates.length === 0 ? (
                    <div className="px-2 py-2 text-sm text-muted-foreground">No templates yet</div>
                  ) : (
                    <div className="max-h-64 overflow-auto">
                      {templates.map((tpl, idx) => {
                        const key = tpl._id || tpl.id || `${idx}`;
                        const name = (tpl.name || "Untitled template").trim() || "Untitled template";
                        return (
                          <button
                            key={key}
                            type="button"
                            className="w-full rounded-md px-2 py-2 text-left text-sm hover:bg-muted"
                            onClick={() => applyTemplate(tpl)}
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              Attach
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                handleAddFiles(e.target.files);
                if (e.currentTarget) e.currentTarget.value = "";
              }}
            />

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={() => setShowCcBcc((v) => !v)}
              disabled={isSending}
            >
              CC/BCC
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function splitEmails(input: string): string[] {
  return input
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function dedupeEmails(emails: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const e of emails) {
    const key = e.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
  }
  return out;
}

function getInitialSubject(mode: "compose" | "reply" | "forward", defaultSubject?: string): string {
  const raw = typeof defaultSubject === "string" ? defaultSubject.trim() : "";
  if (raw) {
    if (mode === "reply") return raw.toLowerCase().startsWith("re:") ? defaultSubject! : `Re: ${raw}`;
    if (mode === "forward") return raw.toLowerCase().startsWith("fwd:") ? defaultSubject! : `Fwd: ${raw}`;
    return defaultSubject!;
  }

  // If no default subject is provided, leave compose empty and still editable.
  return "";
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read attachment."));
    reader.onload = () => resolve(String(reader.result || ""));
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
