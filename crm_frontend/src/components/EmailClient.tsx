import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthToken, API_BASE_URL } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Inbox,
  Send,
  FileText,
  Trash2,
  Mail,
  Reply,
  Forward,
  Star,
  Loader2,
} from "lucide-react";
import {
  listEmails,
  getEmailThread,
  updateEmail,
  deleteEmail,
  listEmailFolders,
  listEmailAccounts,
  ensureWorkspaceEmailAccount,
  getWorkspaceStatus,
  connectGmailWithPopup,
  type EmailFolder,
  type EmailMessage,
  type EmailAccount,
  type GoogleWorkspaceConfigPublic,
} from "@/services/email";
import { SharedEmailComposer } from "@/components/email/SharedEmailComposer";

type ComposerState = {
  open: boolean;
  mode: "compose" | "reply" | "forward";
};

type FolderUi = {
  id: string;
  name: string;
  unreadCount: number;
};

function getRelativeTime(dateStr?: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffHours < 1) return "Just now";
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getFolderIcon(folderId: string) {
  const key = folderId.toUpperCase();
  if (key === "INBOX") return Inbox;
  if (key === "SENT") return Send;
  if (key === "DRAFTS") return FileText;
  if (key === "TRASH") return Trash2;
  return Mail;
}

export const EmailClient = () => {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);
  const [folders, setFolders] = useState<FolderUi[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("INBOX");
  const selectedFolderRef = useRef(selectedFolder);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [threadMessages, setThreadMessages] = useState<EmailMessage[]>([]);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [isFoldersLoading, setIsFoldersLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [composer, setComposer] = useState<ComposerState>({ open: false, mode: "compose" });
  const [workspaceStatus, setWorkspaceStatus] = useState<GoogleWorkspaceConfigPublic | null>(null);
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [inboxBootstrapping, setInboxBootstrapping] = useState(true);
  const [connectingOAuth, setConnectingOAuth] = useState(false);

  const fallbackFolders = useMemo<FolderUi[]>(
    () => [
      { id: "INBOX", name: "Inbox", unreadCount: 0 },
      { id: "SENT", name: "Sent", unreadCount: 0 },
      { id: "DRAFTS", name: "Drafts", unreadCount: 0 },
      { id: "TRASH", name: "Trash", unreadCount: 0 },
    ],
    []
  );

  useEffect(() => {
    selectedFolderRef.current = selectedFolder;
  }, [selectedFolder]);

  const bootstrapInbox = useCallback(async () => {
    try {
      setInboxBootstrapping(true);
      await ensureWorkspaceEmailAccount().catch(() => null);
      const [status, accounts] = await Promise.all([
        getWorkspaceStatus().catch(() => null),
        listEmailAccounts().catch(() => []),
      ]);
      setWorkspaceStatus(status);
      setEmailAccounts(accounts);
    } finally {
      setInboxBootstrapping(false);
    }
  }, []);

  useEffect(() => {
    void bootstrapInbox();
  }, [bootstrapInbox]);

  const hasEmailAccount = emailAccounts.some((a) => a.isActive);
  const workspaceSyncing = emailAccounts.some((a) => a.authMode === "WORKSPACE_DWD" && a.syncStatus === "SYNCING");
  const showWorkspaceLoading = inboxBootstrapping || (workspaceSyncing && !hasEmailAccount);

  const handleOAuthConnect = async () => {
    try {
      setConnectingOAuth(true);
      await connectGmailWithPopup();
      await bootstrapInbox();
      void loadFolders();
      void loadMessages();
      toast({ title: "Gmail connected" });
    } catch (err) {
      toast({
        title: "Connection failed",
        description: err instanceof Error ? err.message : "Unable to connect Gmail",
        variant: "destructive",
      });
    } finally {
      setConnectingOAuth(false);
    }
  };

  const renderInboxGate = () => {
    if (showWorkspaceLoading) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm">Setting up your inbox...</p>
        </div>
      );
    }

    if (hasEmailAccount) return null;

    if (workspaceStatus?.isVerified && workspaceStatus.userInDomain) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-sm font-medium text-foreground">Syncing your Workspace inbox</p>
          <p className="text-sm">Your account was provisioned automatically. Messages will appear shortly.</p>
        </div>
      );
    }

    if (!workspaceStatus?.isConfigured) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <Inbox className="h-10 w-10" />
          <p className="text-sm font-medium text-foreground">Email not configured</p>
          <p className="text-sm max-w-md">
            Ask your admin to configure Gmail in Settings → Integration Hub. Once connected, Workspace users get their inbox automatically.
          </p>
        </div>
      );
    }

    if (workspaceStatus.isConfigured && !workspaceStatus.userInDomain) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
          <Mail className="h-10 w-10" />
          <p className="text-sm font-medium text-foreground">Connect your email</p>
          <p className="text-sm max-w-md">
            Your CRM email is outside the configured Workspace domain ({workspaceStatus.domain}). Connect Gmail with OAuth as a fallback.
          </p>
          <Button onClick={() => void handleOAuthConnect()} disabled={connectingOAuth}>
            {connectingOAuth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Connect Gmail
          </Button>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
        <Inbox className="h-10 w-10" />
        <p className="text-sm font-medium text-foreground">No email account connected</p>
        <Button onClick={() => void handleOAuthConnect()} disabled={connectingOAuth}>
          {connectingOAuth ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Connect Gmail
        </Button>
      </div>
    );
  };

  const inboxGate = renderInboxGate();

  const loadFolders = useCallback(async () => {
    try {
      setIsFoldersLoading(true);
      const result = await listEmailFolders();
      if (!result.length) {
        setFolders(fallbackFolders);
        return;
      }
      const mapped = result.map((folder: EmailFolder) => ({
        id: folder.id,
        name: folder.name,
        unreadCount: folder.unreadCount || 0,
      }));
      setFolders(mapped);
    } catch {
      setFolders(fallbackFolders);
    } finally {
      setIsFoldersLoading(false);
    }
  }, [fallbackFolders]);

  const loadMessages = useCallback(async (folderOverride?: string) => {
    try {
      setIsMessagesLoading(true);
      const folderToLoad = folderOverride || selectedFolderRef.current;
      const result = await listEmails({ folder: folderToLoad, limit: 50 });
      setMessages(result.messages);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load messages",
        variant: "destructive",
      });
      setMessages([]);
    } finally {
      setIsMessagesLoading(false);
    }
  }, [toast]);

  const loadThread = async (message: EmailMessage) => {
    try {
      setIsThreadLoading(true);
      const thread = await getEmailThread(message.threadId);
      setThreadMessages(thread.messages);
      const initialState: Record<string, boolean> = {};
      thread.messages.forEach((msg) => {
        initialState[msg.id] = msg.id === message.id;
      });
      setExpandedIds(initialState);
    } catch {
      setThreadMessages([message]);
      setExpandedIds({ [message.id]: true });
    } finally {
      setIsThreadLoading(false);
    }
  };

  const markReadIfNeeded = async (message: EmailMessage) => {
    if (message.isRead) return;
    try {
      const updated = await updateEmail(message.id, { isRead: true });
      setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      setSelectedMessage(updated);
    } catch {
      // no-op
    }
  };

  const onSelectMessage = async (message: EmailMessage) => {
    setSelectedMessage(message);
    await markReadIfNeeded(message);
    await loadThread(message);
  };

  const onToggleStar = async (message: EmailMessage) => {
    try {
      const updated = await updateEmail(message.id, { isStarred: !message.isStarred });
      setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      setThreadMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
      if (selectedMessage?.id === message.id) setSelectedMessage(updated);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const onDeleteSelected = async () => {
    if (!selectedMessage) return;
    try {
      await deleteEmail(selectedMessage.id);
      setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
      setThreadMessages([]);
      setSelectedMessage(null);
      void loadFolders();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete email",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadMessages(selectedFolder);
  }, [selectedFolder, loadMessages]);

  useEffect(() => {
    const wsUrl = API_BASE_URL.replace(/\/api$/, "");

    const connectIfPossible = () => {
      if (socketRef.current?.connected) return;
      const token = getAuthToken() || window.localStorage.getItem("authToken");
      if (!token) return;

      const socket = io(wsUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
        autoConnect: true,
      });
      socketRef.current = socket;

      socket.on("EMAIL_RECEIVED", () => {
        console.log("[EmailClient] New email received via push");
        void loadFolders();
        void loadMessages();
        toast({ title: "New email received" });
      });
    };

    connectIfPossible();

    const interval = window.setInterval(connectIfPossible, 750);
    const onFocus = () => connectIfPossible();
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
      socketRef.current?.disconnect();
      socketRef.current = null;
    };
  }, [loadFolders, loadMessages, toast]);

  const messageForComposer = selectedMessage || threadMessages[threadMessages.length - 1];

  if (inboxGate) {
    return (
      <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-lg border bg-card">
        {inboxGate}
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-8rem)] overflow-hidden rounded-lg border bg-card">
      <div className="flex h-full">
        <div className="w-56 border-r bg-muted/20">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <span className="text-sm font-medium">Inbox</span>
            <Button size="sm" onClick={() => setComposer({ open: true, mode: "compose" })}>
              Compose
            </Button>
          </div>
          <ScrollArea className="h-[calc(100%-56px)]">
            <div className="space-y-1 p-2">
              {(isFoldersLoading ? fallbackFolders : folders).map((folder) => {
                const Icon = getFolderIcon(folder.id);
                const isActive = selectedFolder === folder.id;
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => {
                      setSelectedFolder(folder.id);
                      setSelectedMessage(null);
                      setThreadMessages([]);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm ${
                      isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      {folder.name}
                    </span>
                    {folder.unreadCount > 0 ? <Badge variant="secondary">{folder.unreadCount}</Badge> : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="w-96 border-r">
          <div className="border-b px-4 py-3 text-sm font-medium">Messages</div>
          <ScrollArea className="h-[calc(100%-49px)]">
            {isMessagesLoading ? (
              <div className="space-y-3 p-3">
                {[1, 2, 3, 4].map((k) => (
                  <div key={k} className="animate-pulse rounded-md border p-3">
                    <div className="mb-2 h-3 w-2/3 rounded bg-muted" />
                    <div className="mb-1 h-3 w-full rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-48 flex-col items-center justify-center gap-2 text-muted-foreground">
                <Inbox className="h-6 w-6" />
                <span className="text-sm">No emails in this folder</span>
              </div>
            ) : (
              <div className="divide-y">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => void onSelectMessage(message)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        void onSelectMessage(message);
                      }
                    }}
                    className={`w-full px-4 py-3 text-left hover:bg-muted/40 ${
                      selectedMessage?.id === message.id ? "bg-muted/40" : ""
                    }`}
                  >
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {!message.isRead ? <span className="h-2 w-2 rounded-full bg-primary" /> : null}
                          <span className={`truncate text-sm ${message.isRead ? "" : "font-semibold"}`}>
                            {message.from.name || message.from.email}
                          </span>
                        </div>
                        <div className={`truncate text-sm ${message.isRead ? "" : "font-semibold"}`}>
                          {message.subject || "(No subject)"}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void onToggleStar(message);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Star className={`h-4 w-4 ${message.isStarred ? "fill-yellow-400 text-yellow-500" : ""}`} />
                      </button>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{message.snippet}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {getRelativeTime(message.receivedAt || message.sentAt)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <div className="min-w-0 flex-1">
          {!selectedMessage ? (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Mail className="mx-auto mb-2 h-8 w-8" />
                <p className="text-sm">Select an email to read</p>
              </div>
            </div>
          ) : (
            <div className="flex h-full flex-col">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold">{selectedMessage.subject || "(No subject)"}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setComposer({ open: true, mode: "reply" })}
                  >
                    <Reply className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setComposer({ open: true, mode: "forward" })}
                  >
                    <Forward className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => void onToggleStar(selectedMessage)}>
                    <Star className={`h-4 w-4 ${selectedMessage.isStarred ? "fill-yellow-400 text-yellow-500" : ""}`} />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => void onDeleteSelected()}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <ScrollArea className="h-[calc(100%-57px)]">
                {isThreadLoading ? (
                  <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading thread...
                  </div>
                ) : (
                  <div className="space-y-3 p-4">
                    {threadMessages.map((msg, index) => {
                      const expanded = expandedIds[msg.id] ?? index === threadMessages.length - 1;
                      return (
                        <div key={msg.id} className="rounded-md border">
                          <div className="flex items-center justify-between border-b px-3 py-2">
                            <div className="text-sm">
                              <div className="font-medium">
                                {msg.from.name || msg.from.email}
                              </div>
                              <div className="text-xs text-muted-foreground">{new Date(msg.receivedAt || msg.sentAt || "").toLocaleString()}</div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedIds((prev) => ({ ...prev, [msg.id]: !expanded }))}
                            >
                              {expanded ? "Collapse" : "Expand"}
                            </Button>
                          </div>
                          {expanded ? (
                            <div
                              className="p-3 text-sm"
                              dangerouslySetInnerHTML={{
                                __html: msg.bodyHtml || `<div>${msg.bodyText || msg.snippet || ""}</div>`,
                              }}
                            />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      <SharedEmailComposer
        isOpen={composer.open}
        mode={composer.mode}
        defaultTo={
          composer.mode === "reply"
            ? messageForComposer?.from?.email
            : composer.mode === "forward"
            ? ""
            : undefined
        }
        defaultSubject={
          messageForComposer?.subject
            ? composer.mode === "reply"
              ? `Re: ${messageForComposer.subject}`
              : composer.mode === "forward"
              ? `Fwd: ${messageForComposer.subject}`
              : ""
            : ""
        }
        defaultBody={composer.mode === "forward" ? messageForComposer?.bodyHtml || messageForComposer?.bodyText : undefined}
        defaultThreadId={composer.mode === "reply" ? messageForComposer?.threadId : undefined}
        defaultInReplyTo={composer.mode === "reply" ? messageForComposer?.messageId : undefined}
        onSent={() => {
          void loadMessages();
          void loadFolders();
        }}
        onClose={() => setComposer((prev) => ({ ...prev, open: false }))}
      />
    </div>
  );
};

