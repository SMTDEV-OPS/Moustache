import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type CommunicationTimelineItem } from "@/services/communications";
import { Mail } from "lucide-react";
import DOMPurify from "dompurify";

interface EmailThreadViewProps {
  items: CommunicationTimelineItem[];
  onReply: (message: CommunicationTimelineItem) => void;
}

export function EmailThreadView({ items, onReply }: EmailThreadViewProps) {
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, CommunicationTimelineItem[]>();
    for (const item of items) {
      const key = item.metadata?.threadId || item.threadId || "unthreaded";
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }

    return Array.from(map.entries()).map(([threadId, messages]) => ({
      threadId,
      messages: [...messages].sort((a, b) => {
        const dateA = new Date(a.createdAt || a.receivedAt || a.sentAt || 0).getTime();
        const dateB = new Date(b.createdAt || b.receivedAt || b.sentAt || 0).getTime();
        return dateA - dateB;
      }),
    }));
  }, [items]);

  if (grouped.length === 0) {
    return <p className="text-sm text-muted-foreground">No email messages yet.</p>;
  }

  return (
    <div className="space-y-3">
      {grouped.map((thread) => (
        <div key={thread.threadId} className="rounded-md border p-3">
          <div className="mb-2 text-xs text-muted-foreground">Thread: {thread.threadId}</div>
          <div className="space-y-2">
            {thread.messages.map((message) => {
              const itemId = message.id;
              const isExpanded = expandedItemId === itemId;
              return (
                <div key={itemId} className="rounded-md border bg-background p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Mail className="h-4 w-4" />
                        <span>{message.direction === "INBOUND" ? "Guest" : "Agent"}</span>
                      </div>
                      <p className="mt-1 text-sm">{message.summary || "(no subject)"}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(message.createdAt || message.receivedAt || message.sentAt || Date.now()).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {message.direction === "INBOUND" ? (
                        <Button size="sm" variant="outline" onClick={() => onReply(message)}>
                          Reply
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedItemId(isExpanded ? null : itemId)}
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </Button>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div
                      className="mt-2 text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(message.messageContent || "No content"),
                      }}
                    />
                  ) : (
                    <div
                      className="mt-2 line-clamp-2 text-sm text-muted-foreground"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(message.messageContent || "No content"),
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
