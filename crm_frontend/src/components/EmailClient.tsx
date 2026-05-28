import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getAuthToken, API_BASE_URL } from "@/services/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  listEmails,
  getEmail,
  getEmailThread,
  sendEmail,
  replyToEmail,
  forwardEmail,
  updateEmail,
  deleteEmail,
  listEmailFolders,
  EmailMessage,
  EmailFolder,
  EmailAddress,
  SendEmailPayload,
} from "@/services/email";
import {
  Mail,
  MailOpen,
  Star,
  StarOff,
  Reply,
  Forward,
  Trash2,
  Search,
  Plus,
  RefreshCw,
  ChevronRight,
  Paperclip,
} from "lucide-react";
import { EmailComposer } from "./EmailComposer";

export const EmailClient = () => {
  const { toast } = useToast();
  const [folders, setFolders] = useState<EmailFolder[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string>("INBOX");
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [thread, setThread] = useState<EmailMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [isForwardOpen, setIsForwardOpen] = useState(false);
  const [replyToMessage, setReplyToMessage] = useState<EmailMessage | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    void loadFolders();

    // Set up WebSocket for real-time inbox refresh
    const token = getAuthToken();
    if (token) {
      const wsUrl = API_BASE_URL.replace(/^http/, "ws").replace(/\/api$/, "");
      const socket = io(wsUrl, {
        auth: { token },
        transports: ["websocket", "polling"],
        autoConnect: true,
      });

      socketRef.current = socket;

      socket.on("EMAIL_RECEIVED", () => {
        // Silently reload messages and folders so new emails drop right in!
        void loadFolders();
        void loadMessages();

        toast({
          title: "New Email Received",
          description: "Your inbox just updated with a new message.",
        });
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    void loadMessages();
  }, [selectedFolder, searchQuery]);

  const loadFolders = async () => {
    try {
      const list = await listEmailFolders();
      setFolders(list);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load folders",
        variant: "destructive",
      });
    }
  };

  const loadMessages = async () => {
    try {
      setIsLoading(true);
      const result = await listEmails({
        folder: selectedFolder,
        search: searchQuery || undefined,
        limit: 50,
        offset,
      });
      setMessages(result.messages);
      setTotal(result.total);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load emails",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMessage = async (message: EmailMessage) => {
    setSelectedMessage(message);

    // Mark as read if unread
    if (!message.isRead) {
      try {
        await updateEmail(message.id, { isRead: true });
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? { ...m, isRead: true } : m))
        );
      } catch (err) {
        // Ignore error
      }
    }

    // Load thread
    try {
      const threadData = await getEmailThread(message.threadId);
      setThread(threadData.messages);
    } catch (err) {
      setThread([message]);
    }
  };

  const handleToggleStar = async (message: EmailMessage) => {
    try {
      const updated = await updateEmail(message.id, { isStarred: !message.isStarred });
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? updated : m))
      );
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(updated);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update email",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (message: EmailMessage) => {
    try {
      await deleteEmail(message.id);
      toast({
        title: "Success",
        description: "Email moved to trash",
      });
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
        setThread([]);
      }
      void loadFolders();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete email",
        variant: "destructive",
      });
    }
  };

  const handleReply = (message: EmailMessage) => {
    setReplyToMessage(message);
    setIsReplyOpen(true);
  };

  const handleForward = (message: EmailMessage) => {
    setReplyToMessage(message);
    setIsForwardOpen(true);
  };

  const handleSendReply = async (payload: SendEmailPayload) => {
    if (!replyToMessage) return;

    try {
      await replyToEmail(replyToMessage.id, payload.bodyText, payload.bodyHtml, payload.accountId);
      toast({
        title: "Success",
        description: "Reply sent successfully",
      });
      setIsReplyOpen(false);
      setReplyToMessage(null);
      void loadMessages();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to send reply",
        variant: "destructive",
      });
    }
  };

  const handleSendForward = async (payload: SendEmailPayload) => {
    if (!replyToMessage) return;

    try {
      await forwardEmail(replyToMessage.id, payload.to, payload.bodyText, payload.bodyHtml, payload.accountId);
      toast({
        title: "Success",
        description: "Email forwarded successfully",
      });
      setIsForwardOpen(false);
      setReplyToMessage(null);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to forward email",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const currentFolder = folders.find((f) => f.id === selectedFolder);

  return (
    <div className="flex h-[calc(100vh-10rem)] overflow-hidden rounded-md border border-border bg-surface shadow-sm animate-panel-enter">
      {/* Folder Sidebar */}
      <div className="w-56 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b bg-card">
          <Button
            onClick={() => setIsComposeOpen(true)}
            className="w-full font-medium"
            size="default"
          >
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => {
                  setSelectedFolder(folder.id);
                  setSelectedMessage(null);
                  setThread([]);
                  setOffset(0);
                }}
                className={`
                  w-full flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-all duration-200
                  ${selectedFolder === folder.id
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "hover:bg-muted text-foreground"
                  }
                `}
              >
                <div className="flex items-center gap-3">
                  <Mail className={`h-4 w-4 ${selectedFolder === folder.id ? '' : 'text-muted-foreground'}`} />
                  <span className="truncate">{folder.name}</span>
                </div>
                {folder.unreadCount > 0 && (
                  <Badge
                    variant={selectedFolder === folder.id ? "secondary" : "default"}
                    className="text-xs font-semibold min-w-[20px] justify-center"
                  >
                    {folder.unreadCount}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Email List */}
      <div className="w-80 border-r flex flex-col bg-background">
        <div className="p-3 border-b bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setOffset(0);
              }}
              className="pl-9 h-9 bg-muted/50 border-muted focus:bg-background"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading emails...</div>
          ) : messages.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              <Mail className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No emails in {currentFolder?.name || selectedFolder}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((message) => (
                <div
                  key={message.id}
                  onClick={() => handleSelectMessage(message)}
                  className={`
                    p-4 cursor-pointer transition-all duration-200 border-l-4
                    ${selectedMessage?.id === message.id
                      ? "bg-primary/5 border-l-primary"
                      : "border-l-transparent hover:bg-muted/50"
                    }
                    ${!message.isRead ? "bg-muted/30" : ""}
                  `}
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className={`text-sm truncate ${!message.isRead ? 'font-semibold' : 'font-medium'}`}>
                          {message.from.name || message.from.email}
                        </p>
                        {!message.isRead && (
                          <div className="h-2 w-2 bg-primary rounded-full flex-shrink-0" />
                        )}
                      </div>
                      <p className={`text-sm truncate ${!message.isRead ? 'font-medium' : ''} text-foreground`}>
                        {message.subject || '(No subject)'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {message.isStarred ? (
                        <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      ) : (
                        <Star className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                    {message.snippet}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(message.receivedAt || message.sentAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Email Viewer */}
      <div className="flex-1 flex flex-col bg-background">
        {selectedMessage ? (
          <>
            <div className="p-4 border-b bg-card flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-lg font-semibold truncate">
                    {selectedMessage.subject || '(No subject)'}
                  </h3>
                  {selectedMessage.isStarred && (
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500 flex-shrink-0" />
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div>
                    <span className="font-medium text-foreground">From:</span> {selectedMessage.from.name || selectedMessage.from.email}
                  </div>
                  {selectedMessage.to.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">To:</span> {selectedMessage.to.map((t) => t.email).join(", ")}
                    </div>
                  )}
                  {selectedMessage.cc && selectedMessage.cc.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">CC:</span> {selectedMessage.cc.map((t) => t.email).join(", ")}
                    </div>
                  )}
                  <div className="text-xs">
                    {formatDate(selectedMessage.receivedAt || selectedMessage.sentAt)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleStar(selectedMessage)}
                  className="h-9 w-9 p-0"
                >
                  {selectedMessage.isStarred ? (
                    <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                  ) : (
                    <Star className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleReply(selectedMessage)}
                  className="h-9 w-9 p-0"
                  title="Reply"
                >
                  <Reply className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleForward(selectedMessage)}
                  className="h-9 w-9 p-0"
                  title="Forward"
                >
                  <Forward className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(selectedMessage)}
                  className="h-9 w-9 p-0 text-destructive hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-6 space-y-6">
                {/* Thread */}
                {thread.length > 1 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-foreground mb-3">
                      Conversation ({thread.length} messages)
                    </p>
                    {thread.map((msg, idx) => (
                      <Card
                        key={msg.id}
                        className={`
                          transition-all duration-200
                          ${msg.id === selectedMessage.id
                            ? "ring-2 ring-primary border-primary shadow-sm"
                            : "hover:shadow-sm"
                          }
                        `}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {msg.from.name || msg.from.email}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {formatDate(msg.receivedAt || msg.sentAt)}
                              </p>
                            </div>
                            {msg.id !== selectedMessage.id && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleSelectMessage(msg)}
                                className="h-8"
                              >
                                View
                              </Button>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {msg.snippet}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* Current Message */}
                <div className="prose prose-sm max-w-none">
                  {selectedMessage.bodyHtml ? (
                    <div
                      className="email-body"
                      dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                    />
                  ) : (
                    <div className="whitespace-pre-wrap font-sans text-sm text-foreground leading-relaxed">
                      {selectedMessage.bodyText || selectedMessage.snippet}
                    </div>
                  )}
                </div>

                {/* Attachments */}
                {selectedMessage.attachments && selectedMessage.attachments.length > 0 && (
                  <div className="mt-6 pt-6 border-t">
                    <p className="text-sm font-semibold mb-3 text-foreground">Attachments</p>
                    <div className="space-y-2">
                      {selectedMessage.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{att.filename}</p>
                            <p className="text-xs text-muted-foreground">
                              {att.mimeType} • {(att.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8">
            <Mail className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-sm font-medium">Select an email to view</p>
            <p className="text-xs mt-1">Choose a message from the list to read its contents</p>
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      <EmailComposer
        open={isComposeOpen}
        onOpenChange={setIsComposeOpen}
        onSend={async (payload) => {
          try {
            await sendEmail(payload);
            toast({
              title: "Success",
              description: "Email sent successfully",
            });
            setIsComposeOpen(false);
            void loadMessages();
          } catch (err) {
            toast({
              title: "Error",
              description: err instanceof Error ? err.message : "Failed to send email",
              variant: "destructive",
            });
          }
        }}
      />

      {/* Reply Dialog */}
      <EmailComposer
        open={isReplyOpen}
        onOpenChange={setIsReplyOpen}
        replyTo={replyToMessage}
        onSend={handleSendReply}
      />

      {/* Forward Dialog */}
      <EmailComposer
        open={isForwardOpen}
        onOpenChange={setIsForwardOpen}
        forwardFrom={replyToMessage}
        onSend={handleSendForward}
      />
    </div>
  );
};

