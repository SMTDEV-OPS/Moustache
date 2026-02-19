import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Calendar } from "@/components/ui/calendar";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import "react-day-picker/dist/style.css";
import "./EmailComposer.css";
import {
  EmailMessage,
  SendEmailPayload,
  EmailAddress,
  listEmailAccounts,
} from "@/services/email";
import { listTemplates, Template } from "@/services/templates";
import {
  X,
  Paperclip,
  Send,
  Clock,
  ChevronDown,
  FileText,
  User,
  Mail,
  Loader2,
  Smile,
  Type,
  Minus,
  Table,
  Undo2,
  Redo2,
} from "lucide-react";
import { format } from "date-fns";

interface EmailComposerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  replyTo?: EmailMessage | null;
  forwardFrom?: EmailMessage | null;
  onSend: (payload: SendEmailPayload) => Promise<void>;
  initialTo?: EmailAddress[];
  initialSubject?: string;
}

export const EmailComposer = ({
  open,
  onOpenChange,
  replyTo,
  forwardFrom,
  onSend,
  initialTo,
  initialSubject,
}: EmailComposerProps) => {
  const { toast } = useToast();
  const quillRef = useRef<ReactQuill>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [to, setTo] = useState<EmailAddress[]>([]);
  const [cc, setCc] = useState<EmailAddress[]>([]);
  const [bcc, setBcc] = useState<EmailAddress[]>([]);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [isPlainText, setIsPlainText] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [accounts, setAccounts] = useState<
    Array<{ id: string; email: string; isPrimary: boolean }>
  >([]);
  const [selectedAccount, setSelectedAccount] = useState<{
    id: string;
    email: string;
  } | null>(null);
  const [toInput, setToInput] = useState("");
  const [ccInput, setCcInput] = useState("");
  const [bccInput, setBccInput] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined);
  const [scheduleTime, setScheduleTime] = useState("");
  const [showSchedulePicker, setShowSchedulePicker] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [showSignature, setShowSignature] = useState(false);
  const [isEditorReady, setIsEditorReady] = useState(false);

  // Suppress ReactQuill findDOMNode deprecation warning ONLY
  useEffect(() => {
    const originalWarn = console.warn;
    
    const shouldSuppress = (...args: unknown[]): boolean => {
      try {
        const fullMessage = args
          .map((arg) => {
            if (typeof arg === "string") return arg;
            if (typeof arg === "object" && arg !== null) {
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }
            return String(arg);
          })
          .join(" ");
        
        // VERY SPECIFIC: Only suppress findDOMNode warnings related to ReactQuill
        return (
          (fullMessage.includes("findDOMNode is deprecated") &&
           (fullMessage.includes("ReactQuill") || fullMessage.includes("ReactQuill2"))) ||
          (fullMessage.includes("Warning: findDOMNode") &&
           (fullMessage.includes("ReactQuill") || fullMessage.includes("ReactQuill2")))
        );
      } catch {
        return false;
      }
    };
    
    // Only patch console.warn, NOT console.error
    Object.defineProperty(console, "warn", {
      value: (...args: unknown[]) => {
        if (!shouldSuppress(...args)) {
          originalWarn.apply(console, args);
        }
      },
      writable: true,
      configurable: true,
    });
    
    return () => {
      // Restore original on unmount
      Object.defineProperty(console, "warn", {
        value: originalWarn,
        writable: true,
        configurable: true,
      });
    };
  }, []);

  useEffect(() => {
    if (open) {
      void loadAccounts();
      void loadTemplates();

      if (replyTo) {
        setTo([replyTo.from]);
        setSubject(
          replyTo.subject.startsWith("Re:")
            ? replyTo.subject
            : `Re: ${replyTo.subject}`
        );
        const originalBody = replyTo.bodyHtml || replyTo.bodyText || "";
        setBodyHtml(
          `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 10px; color: #666;"><p><strong>From:</strong> ${replyTo.from.name || replyTo.from.email}<br><strong>Date:</strong> ${replyTo.receivedAt || replyTo.sentAt}<br><strong>Subject:</strong> ${replyTo.subject}</p>${originalBody}</div>`
        );
      } else if (forwardFrom) {
        setSubject(
          forwardFrom.subject.startsWith("Fwd:")
            ? forwardFrom.subject
            : `Fwd: ${forwardFrom.subject}`
        );
        const originalBody = forwardFrom.bodyHtml || forwardFrom.bodyText || "";
        setBodyHtml(
          `<br><br><div style="border-left: 3px solid #ccc; padding-left: 10px; margin-left: 10px; color: #666;"><p><strong>From:</strong> ${forwardFrom.from.name || forwardFrom.from.email}<br><strong>Date:</strong> ${forwardFrom.receivedAt || forwardFrom.sentAt}<br><strong>Subject:</strong> ${forwardFrom.subject}</p>${originalBody}</div>`
        );
      } else {
        setTo(initialTo || []);
        setCc([]);
        setBcc([]);
        setSubject(initialSubject || "");
        setBodyHtml("");
        setBodyText("");
      }
      setAttachments([]);
      setScheduleDate(undefined);
      setScheduleTime("");
      setShowCc(false);
      setShowBcc(false);
      setIsPlainText(false);
      setCharCount(0);
      setWordCount(0);
    } else {
      // Reset when dialog closes
      setBodyHtml("");
      setBodyText("");
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject("");
      setToInput("");
      setCcInput("");
      setBccInput("");
      setAttachments([]);
      setIsPlainText(false);
      setCharCount(0);
      setWordCount(0);
    }
  }, [open, replyTo, forwardFrom, initialTo, initialSubject]);

  // Initialize editor when dialog opens
  useEffect(() => {
    if (open && !isPlainText) {
      setIsEditorReady(false);
      // Small delay to ensure Quill is fully initialized and Dialog is fully rendered
      const timer = setTimeout(() => {
        const quill = quillRef.current?.getEditor();
        if (quill) {
          // Ensure editor is enabled and ready
          quill.enable(true);
          // Force update to ensure editor is interactive
          quill.root.setAttribute('contenteditable', 'true');
          setIsEditorReady(true);
          
          // Focus the editor safely after it's fully ready
          // Use requestAnimationFrame to ensure DOM is ready and avoid addRange errors
          requestAnimationFrame(() => {
            setTimeout(() => {
              try {
                const editorElement = quill.root as HTMLElement;
                if (editorElement && document.contains(editorElement)) {
                  // Check if element is in document before focusing
                  editorElement.focus();
                }
              } catch (err) {
                // Silently ignore focus errors to prevent addRange warnings
              }
            }, 100);
          });
        }
      }, 500);
      return () => {
        clearTimeout(timer);
        setIsEditorReady(false);
      };
    } else {
      setIsEditorReady(false);
    }
  }, [open, isPlainText]);

  const loadAccounts = async () => {
    try {
      const list = await listEmailAccounts();
      setAccounts(
        list.map((acc) => ({
          id: acc.id,
          email: acc.email,
          isPrimary: acc.isPrimary,
        }))
      );
      if (list.length > 0 && !accountId) {
        const primary = list.find((acc) => acc.isPrimary) || list[0];
        setAccountId(primary.id);
        setSelectedAccount({ id: primary.id, email: primary.email });
      }
    } catch (err) {
      // Ignore error
    }
  };

  const loadTemplates = async () => {
    try {
      const list = await listTemplates("EMAIL");
      setTemplates(list.filter((t) => t.isActive));
    } catch (err) {
      // Ignore error
    }
  };

  const parseEmailAddress = (input: string): EmailAddress | null => {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Try to parse "Name <email>" format
    const match = trimmed.match(/^(.*?)\s*<(.+?)>$|^(.+?)$/);
    if (match) {
      return {
        name: match[1] || match[3] || undefined,
        email: match[2] || match[3] || trimmed,
      };
    }

    // Simple email validation
    if (trimmed.includes("@")) {
      return { email: trimmed };
    }

    return null;
  };

  const addToRecipient = () => {
    const addr = parseEmailAddress(toInput);
    if (addr && !to.find((t) => t.email === addr.email)) {
      setTo([...to, addr]);
      setToInput("");
    } else if (addr) {
      toast({
        title: "Duplicate recipient",
        description: "This email address is already added",
        variant: "destructive",
      });
    }
  };

  const addCcRecipient = () => {
    const addr = parseEmailAddress(ccInput);
    if (addr && !cc.find((c) => c.email === addr.email)) {
      setCc([...cc, addr]);
      setCcInput("");
    } else if (addr) {
      toast({
        title: "Duplicate recipient",
        description: "This email address is already added",
        variant: "destructive",
      });
    }
  };

  const addBccRecipient = () => {
    const addr = parseEmailAddress(bccInput);
    if (addr && !bcc.find((b) => b.email === addr.email)) {
      setBcc([...bcc, addr]);
      setBccInput("");
    } else if (addr) {
      toast({
        title: "Duplicate recipient",
        description: "This email address is already added",
        variant: "destructive",
      });
    }
  };

  const removeRecipient = (email: string, type: "to" | "cc" | "bcc") => {
    if (type === "to") {
      setTo(to.filter((t) => t.email !== email));
    } else if (type === "cc") {
      setCc(cc.filter((c) => c.email !== email));
    } else {
      setBcc(bcc.filter((b) => b.email !== email));
    }
  };

  const handleTemplateSelect = (template: Template) => {
    if (template.subject && !subject) {
      setSubject(template.subject);
    }
    if (template.body) {
      if (isPlainText) {
        setBodyText(template.body);
      } else {
        setBodyHtml(template.body);
      }
    }
    setShowTemplateDropdown(false);
    toast({
      title: "Template inserted",
      description: `Template "${template.name}" has been inserted`,
    });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachments([...attachments, ...files]);
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const handleSend = async () => {
    if (to.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one recipient",
        variant: "destructive",
      });
      return;
    }
    if (!subject.trim()) {
      toast({
        title: "Error",
        description: "Please enter a subject",
        variant: "destructive",
      });
      return;
    }
    if (!bodyHtml.trim() && !bodyText.trim()) {
      toast({
        title: "Error",
        description: "Please enter a message",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSending(true);

      const payload: SendEmailPayload = {
        accountId: accountId || undefined,
        to,
        cc: cc.length > 0 ? cc : undefined,
        bcc: bcc.length > 0 ? bcc : undefined,
        subject,
        bodyHtml: isPlainText ? undefined : bodyHtml,
        bodyText: isPlainText ? bodyText : undefined,
      };

      await onSend(payload);
      onOpenChange(false);
      // Reset form
      setTo([]);
      setCc([]);
      setBcc([]);
      setSubject("");
      setBodyHtml("");
      setBodyText("");
      setToInput("");
      setCcInput("");
      setBccInput("");
      setAttachments([]);
      setScheduleDate(undefined);
      setScheduleTime("");
      setShowCc(false);
      setShowBcc(false);
    } catch (err) {
      // Error handled by parent
    } finally {
      setIsSending(false);
    }
  };

  // Enhanced Gmail-like toolbar for Quill - memoized to prevent re-initialization
  const modules = useMemo(() => ({
    toolbar: {
      container: [
        [{ header: [1, 2, 3, 4, 5, 6, false] }],
        [{ font: [] }],
        [{ size: ["small", false, "large", "huge"] }],
        ["bold", "italic", "underline", "strike"],
        [{ script: "sub" }, { script: "super" }],
        [{ color: [] }, { background: [] }],
        [{ align: [] }],
        [{ indent: "-1" }, { indent: "+1" }],
        [{ list: "ordered" }, { list: "bullet" }],
        ["blockquote", "code-block"],
        ["link", "image"],
        [{ direction: "rtl" }],
        ["clean"],
      ],
      handlers: {
        image: function(this: any) {
          const input = document.createElement("input");
          input.setAttribute("type", "file");
          input.setAttribute("accept", "image/*");
          input.click();
          input.onchange = () => {
            const file = input.files?.[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const quill = quillRef.current?.getEditor();
                if (quill && e.target?.result) {
                  // Use setTimeout to avoid addRange errors
                  setTimeout(() => {
                    const range = quill.getSelection(true);
                    if (range && range.index >= 0) {
                      quill.insertEmbed(range.index, "image", e.target.result as string);
                    } else {
                      const length = quill.getLength();
                      quill.insertEmbed(length - 1, "image", e.target.result as string);
                    }
                  }, 0);
                }
              };
              reader.readAsDataURL(file);
            }
          };
        },
      },
    },
    history: {
      delay: 1000,
      maxStack: 100,
      userOnly: false,
    },
  }), []);

  const formats = useMemo(() => [
    "header",
    "font",
    "size",
    "bold",
    "italic",
    "underline",
    "strike",
    "script",
    "color",
    "background",
    "align",
    "indent",
    "list",
    "bullet",
    "blockquote",
    "code-block",
    "link",
    "image",
    "direction",
  ], []);

  const getAccountInitials = (email: string): string => {
    return email.charAt(0).toUpperCase();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[95vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200 bg-white">
          <DialogTitle className="text-xl font-bold text-slate-900">
            {replyTo ? "Reply" : forwardFrom ? "Forward" : "Compose Email"}
            </DialogTitle>
          <DialogDescription className="text-sm text-slate-500 mt-1">
            {replyTo
              ? "Reply to this message"
              : forwardFrom
              ? "Forward this message"
              : "Create a new email message"}
          </DialogDescription>
        </DialogHeader>

        {/* Main Content */}
        <div 
          className="flex-1 overflow-y-auto bg-slate-50"
          onDrop={(e) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            setAttachments([...attachments, ...files]);
          }}
          onDragOver={(e) => {
            e.preventDefault();
          }}
        >
          <div className="px-6 py-5 space-y-5">
            {/* From Account */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 block">
                From
              </Label>
          <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 bg-slate-900">
                  <AvatarFallback className="text-white font-medium">
                {selectedAccount
                  ? getAccountInitials(selectedAccount.email)
                  : "A"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
                  {accounts.length > 1 ? (
                  <Select
                    value={accountId}
                    onValueChange={(value) => {
                      setAccountId(value);
                      const acc = accounts.find((a) => a.id === value);
                      if (acc) {
                        setSelectedAccount({ id: acc.id, email: acc.email });
                      }
                    }}
                  >
                      <SelectTrigger className="w-full h-auto p-0 border-0 shadow-none hover:bg-transparent font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <span>{selectedAccount?.email || "Select account"}</span>
                          {selectedAccount && accounts.find((a) => a.id === accountId)?.isPrimary && (
                            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                              Primary
                            </Badge>
                          )}
                          <ChevronDown className="h-4 w-4 text-slate-400" />
                        </div>
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 bg-slate-900">
                                <AvatarFallback className="text-white text-xs">
                                {getAccountInitials(acc.email)}
                              </AvatarFallback>
                            </Avatar>
                            <span>{acc.email}</span>
                            {acc.isPrimary && (
                                <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                                Primary
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-900">
                        {selectedAccount?.email || "No account available"}
                      </span>
                      {selectedAccount && accounts.find((a) => a.id === accountId)?.isPrimary && (
                        <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-600 border-emerald-200">
                          Primary
                        </Badge>
                )}
              </div>
                  )}
            </div>
                {templates.length > 0 && (
            <Popover open={showTemplateDropdown} onOpenChange={setShowTemplateDropdown}>
              <PopoverTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-2 border-slate-200">
                  <FileText className="h-4 w-4" />
                        Templates
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                        <Label className="text-sm font-semibold text-slate-900">Email Templates</Label>
                  {templates.length === 0 ? (
                          <p className="text-sm text-slate-500 py-4 text-center">
                      No templates available
                    </p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {templates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                                className="w-full text-left p-3 rounded-md hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                        >
                                <div className="font-medium text-sm text-slate-900">{template.name}</div>
                          {template.subject && (
                                  <div className="text-xs text-slate-500 truncate mt-1">
                              {template.subject}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
                )}
          </div>
                </div>

            {/* Recipients */}
            <div className="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
          {/* To */}
          <div>
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                  To <span className="text-red-500">*</span>
                </Label>
                {to.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {to.map((addr) => (
                <Badge
                  key={addr.email}
                  variant="secondary"
                        className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border-slate-200"
                >
                        <User className="h-3 w-3" />
                  {addr.name || addr.email}
                  <button
                    onClick={() => removeRecipient(addr.email, "to")}
                          className="ml-1 hover:text-red-600 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
                )}
              <Input
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    addToRecipient();
                  }
                }}
                  onBlur={() => {
                    if (toInput.trim()) {
                      addToRecipient();
                    }
                  }}
                  placeholder="Recipient email address"
                  className="h-10 border-slate-200"
              />
          </div>

          {/* CC */}
          {showCc && (
            <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                    CC
                  </Label>
                  {cc.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {cc.map((addr) => (
                  <Badge
                    key={addr.email}
                    variant="secondary"
                          className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border-slate-200"
                  >
                          <User className="h-3 w-3" />
                    {addr.name || addr.email}
                    <button
                      onClick={() => removeRecipient(addr.email, "cc")}
                            className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
                  )}
                <Input
                  value={ccInput}
                  onChange={(e) => setCcInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addCcRecipient();
                    }
                  }}
                    onBlur={() => {
                      if (ccInput.trim()) {
                      addCcRecipient();
                    }
                  }}
                  placeholder="CC recipients"
                    className="h-10 border-slate-200"
                />
            </div>
          )}

          {/* BCC */}
          {showBcc && (
            <div>
                  <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                    BCC
                  </Label>
                  {bcc.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {bcc.map((addr) => (
                  <Badge
                    key={addr.email}
                    variant="secondary"
                          className="flex items-center gap-1 px-3 py-1 bg-slate-100 text-slate-700 border-slate-200"
                  >
                          <User className="h-3 w-3" />
                    {addr.name || addr.email}
                    <button
                      onClick={() => removeRecipient(addr.email, "bcc")}
                            className="ml-1 hover:text-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
                  )}
                <Input
                  value={bccInput}
                  onChange={(e) => setBccInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      addBccRecipient();
                    }
                  }}
                    onBlur={() => {
                      if (bccInput.trim()) {
                      addBccRecipient();
                    }
                  }}
                  placeholder="BCC recipients"
                    className="h-10 border-slate-200"
                />
            </div>
          )}

          {/* Show CC/BCC buttons */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
            {!showCc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCc(true)}
                    className="h-8 text-slate-600 hover:text-slate-900"
              >
                    <Mail className="h-4 w-4 mr-2" />
                Add CC
              </Button>
            )}
            {!showBcc && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowBcc(true)}
                    className="h-8 text-slate-600 hover:text-slate-900"
              >
                    <Mail className="h-4 w-4 mr-2" />
                Add BCC
              </Button>
            )}
              </div>
          </div>

          {/* Subject */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                Subject <span className="text-red-500">*</span>
              </Label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject"
                className="h-10 border-slate-200"
            />
          </div>

            {/* Message Body */}
            <div className="bg-white rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Message <span className="text-red-500">*</span>
                </Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsPlainText(!isPlainText)}
                  className="h-8 text-xs text-slate-600 hover:text-slate-900"
              >
                {isPlainText ? "Rich Text" : "Plain Text"}
              </Button>
            </div>
            {isPlainText ? (
              <div className="space-y-2">
              <Textarea
                value={bodyText}
                  onChange={(e) => {
                    setBodyText(e.target.value);
                    const text = e.target.value;
                    setCharCount(text.length);
                    setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
                  }}
                placeholder="Write your message here..."
                  rows={15}
                  className="font-mono resize-none border-slate-200"
              />
                <div className="flex justify-end text-xs text-slate-500">
                  {wordCount} words, {charCount} characters
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="border border-slate-200 rounded-md email-composer-quill bg-white">
                <ReactQuill
                  key={open ? "quill-open" : "quill-closed"}
                  ref={quillRef}
                  theme="snow"
                    value={bodyHtml || ""}
                    onChange={(content, delta, source, editor) => {
                      setBodyHtml(content);
                      const text = editor.getText();
                      setCharCount(text.length);
                      setWordCount(text.trim() ? text.trim().split(/\s+/).length : 0);
                    }}
                  modules={modules}
                  formats={formats}
                  placeholder="Write your message here..."
                    bounds=".email-composer-quill"
                    preserveWhitespace={true}
                    readOnly={false}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-slate-600 hover:text-slate-900"
                        >
                          <Smile className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80" align="start">
                        <div className="grid grid-cols-8 gap-2">
                          {["😀", "😃", "😄", "😁", "😅", "😂", "🤣", "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰", "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜", "🤪", "🤨", "🧐", "🤓", "😎", "🤩", "🥳", "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️", "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤", "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱", "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫", "🤥", "😶", "😐", "😑", "😬", "🙄", "😯", "😦", "😧", "😮", "😲", "🥱", "😴", "🤤", "😪", "😵", "🤐", "🥴", "🤢", "🤮", "🤧", "😷", "🤒", "🤕", "🤑", "🤠", "😈", "👿", "👹", "👺", "🤡", "💩", "👻", "💀", "☠️", "👽", "👾", "🤖", "🎃", "😺", "😸", "😹", "😻", "😼", "😽", "🙀", "😿", "😾"].map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => {
                                setTimeout(() => {
                                  const quill = quillRef.current?.getEditor();
                                  if (quill) {
                                    try {
                                      const range = quill.getSelection(true);
                                      if (range && range.index >= 0) {
                                        quill.insertText(range.index, emoji);
                                        setTimeout(() => {
                                          try {
                                            quill.setSelection(range.index + 1);
                                          } catch (err) {
                                            // Ignore selection errors
                                          }
                                        }, 0);
                                      } else {
                                        // Fallback: insert at end
                                        const length = quill.getLength();
                                        quill.insertText(length - 1, emoji);
                                      }
                                    } catch (err) {
                                      // Ignore errors to prevent addRange warnings
                                    }
                                  }
                                }, 0);
                                setShowEmojiPicker(false);
                              }}
                              className="text-2xl hover:bg-slate-100 rounded p-1 transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTimeout(() => {
                          const quill = quillRef.current?.getEditor();
                          if (quill) {
                            try {
                              const range = quill.getSelection(true);
                              if (range && range.index >= 0) {
                                quill.insertText(range.index, "\n---\n", "user");
                              } else {
                                const length = quill.getLength();
                                quill.insertText(length - 1, "\n---\n", "user");
                              }
                            } catch (err) {
                              // Ignore errors to prevent addRange warnings
                            }
                          }
                        }, 0);
                      }}
                      className="h-8 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <Minus className="h-4 w-4 mr-1" />
                      Insert divider
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setTimeout(() => {
                          const quill = quillRef.current?.getEditor();
                          if (quill) {
                            try {
                              const range = quill.getSelection(true);
                              const tableHTML = '<table style="border-collapse: collapse; width: 100%;"><tr><th style="border: 1px solid #ccc; padding: 8px;">Header 1</th><th style="border: 1px solid #ccc; padding: 8px;">Header 2</th></tr><tr><td style="border: 1px solid #ccc; padding: 8px;">Cell 1</td><td style="border: 1px solid #ccc; padding: 8px;">Cell 2</td></tr></table>';
                              if (range && range.index >= 0) {
                                quill.clipboard.dangerouslyPasteHTML(range.index, tableHTML);
                              } else {
                                const length = quill.getLength();
                                quill.clipboard.dangerouslyPasteHTML(length - 1, tableHTML);
                              }
                            } catch (err) {
                              // Ignore errors to prevent addRange warnings
                            }
                          }
                        }, 0);
                      }}
                      className="h-8 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <Table className="h-4 w-4 mr-1" />
                      Insert table
                    </Button>
                    {showSignature && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setTimeout(() => {
                            const quill = quillRef.current?.getEditor();
                            if (quill) {
                              try {
                                const range = quill.getSelection(true);
                                const signature = "\n\n--\nBest regards,\n[Your Name]\n[Your Title]";
                                if (range && range.index >= 0) {
                                  quill.insertText(range.index, signature, "user");
                                } else {
                                  const length = quill.getLength();
                                  quill.insertText(length - 1, signature, "user");
                                }
                              } catch (err) {
                                // Ignore errors to prevent addRange warnings
                              }
                            }
                          }, 0);
                        }}
                        className="h-8 text-xs text-slate-600 hover:text-slate-900"
                      >
                        <Type className="h-4 w-4 mr-1" />
                        Insert signature
                      </Button>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div>{wordCount} words</div>
                    <div>{charCount} characters</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-4">
                <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3 block">
                  Attachments ({attachments.length})
                </Label>
              <div className="space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                      className="flex items-center justify-between p-3 border border-slate-200 rounded-md bg-slate-50"
                  >
                      <div className="flex items-center gap-3">
                        <Paperclip className="h-4 w-4 text-slate-500" />
                        <div>
                          <span className="text-sm font-medium text-slate-900">{file.name}</span>
                          <span className="text-xs text-slate-500 ml-2">
                        ({formatFileSize(file.size)})
                      </span>
                        </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                        className="h-7 w-7 text-slate-500 hover:text-red-600"
                      onClick={() => removeAttachment(index)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 border-slate-200 hover:bg-slate-50"
            >
              <Paperclip className="h-4 w-4" />
              Attach
            </Button>
            {!isPlainText && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const quill = quillRef.current?.getEditor();
                    quill?.history.undo();
                  }}
                  className="gap-2 border-slate-200 hover:bg-slate-50"
                  title="Undo"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const quill = quillRef.current?.getEditor();
                    quill?.history.redo();
                  }}
                  className="gap-2 border-slate-200 hover:bg-slate-50"
                  title="Redo"
                >
                  <Redo2 className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSignature(!showSignature)}
              className={`gap-2 border-slate-200 ${showSignature ? "bg-slate-100" : "hover:bg-slate-50"}`}
            >
              <Type className="h-4 w-4" />
              Signature
            </Button>
            <Popover open={showSchedulePicker} onOpenChange={setShowSchedulePicker}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 border-slate-200 hover:bg-slate-50">
                  <Clock className="h-4 w-4" />
                  Schedule
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block text-slate-900">Date</Label>
                    <Calendar
                      mode="single"
                      selected={scheduleDate}
                      onSelect={setScheduleDate}
                      disabled={(date) => date < new Date()}
                      className="rounded-md border border-slate-200"
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium mb-2 block text-slate-900">Time</Label>
                    <Input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="border-slate-200"
                    />
                  </div>
                  {scheduleDate && scheduleTime && (
                    <div className="text-sm text-slate-600 bg-slate-50 p-2 rounded-md">
                      Scheduled for: {format(scheduleDate, "PPP")} at {scheduleTime}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-200 hover:bg-slate-50"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSend}
              disabled={isSending}
              className="bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              {isSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Send
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
