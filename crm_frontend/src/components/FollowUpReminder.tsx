import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Task, listTasks, updateTask, dismissTaskPopup } from "@/services/tasks";
import {
  Bell,
  Phone,
  Mail,
  MessageCircle,
  FileText,
  Clock,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface FollowUpReminderProps {
  className?: string;
  onViewLead?: (leadId: string) => void;
  onNavigateToFollowUps?: () => void;
}

export const FollowUpReminder = ({
  className,
  onViewLead,
  onNavigateToFollowUps,
}: FollowUpReminderProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  // Fetch pending reminders
  const fetchPendingReminders = useCallback(async () => {
    try {
      setIsLoading(true);
      // Get all open tasks that are due
      const now = new Date();
      const allTasks = await listTasks({
        status: "OPEN",
        toDue: now.toISOString(),
      });

      // Filter to tasks not dismissed in the last 5 minutes
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const pendingTasks = allTasks.filter((task) => {
        if (!task.popupState?.dismissedAt) return true;
        return new Date(task.popupState.dismissedAt) < fiveMinutesAgo;
      });

      setTasks(pendingTasks);
      setLastFetch(new Date());
    } catch (err) {
      console.error("Failed to fetch reminders:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    void fetchPendingReminders();

    // Poll every minute
    const interval = setInterval(() => {
      void fetchPendingReminders();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchPendingReminders]);

  // Show toast when new reminders appear
  useEffect(() => {
    if (tasks.length > 0 && lastFetch) {
      const latestTask = tasks[0];
      const taskDue = new Date(latestTask.dueAt);
      const now = new Date();

      // If task is due within the last minute, show a toast notification
      if (now.getTime() - taskDue.getTime() < 60000) {
        toast({
          title: "⏰ Follow-up Reminder",
          description: latestTask.title,
          duration: 10000,
        });
      }
    }
  }, [tasks, lastFetch, toast]);

  const handleComplete = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateTask(taskId, { status: "COMPLETED" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({
        title: "Success",
        description: "Follow-up marked as completed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to complete",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await dismissTaskPopup(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      toast({
        title: "Snoozed",
        description: "Reminder will appear again in 5 minutes",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to snooze",
        variant: "destructive",
      });
    }
  };

  const handleDismissAll = async () => {
    try {
      await Promise.all(tasks.map((t) => dismissTaskPopup(t.id)));
      setTasks([]);
      toast({
        title: "All snoozed",
        description: "Reminders will appear again in 5 minutes",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to snooze some reminders",
        variant: "destructive",
      });
    }
  };

  const getTaskIcon = (title: string) => {
    const lower = title.toLowerCase();
    if (lower.includes("call")) return <Phone className="h-4 w-4 text-green-600" />;
    if (lower.includes("email")) return <Mail className="h-4 w-4 text-blue-600" />;
    if (lower.includes("whatsapp")) return <MessageCircle className="h-4 w-4 text-emerald-600" />;
    return <FileText className="h-4 w-4 text-purple-600" />;
  };

  const displayedTasks = showAll ? tasks : tasks.slice(0, 5);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative",
            tasks.length > 0 && "animate-pulse",
            className
          )}
        >
          <Bell className="h-5 w-5" />
          {tasks.length > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-bounce"
            >
              {tasks.length > 9 ? "9+" : tasks.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3 bg-amber-50 dark:bg-amber-950/30">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <h4 className="font-semibold text-amber-900 dark:text-amber-100">
              Follow-up Reminders
            </h4>
          </div>
          {tasks.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={handleDismissAll}
            >
              Snooze All
            </Button>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="max-h-[400px]">
          {isLoading && tasks.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-sm text-muted-foreground">Loading...</p>
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <Bell className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-sm font-medium text-muted-foreground">
                No pending reminders
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {displayedTasks.map((task) => {
                const isOverdue = isPast(new Date(task.dueAt));
                return (
                  <div
                    key={task.id}
                    className={cn(
                      "flex gap-3 p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                      isOverdue && "bg-red-50/50 dark:bg-red-950/20"
                    )}
                    onClick={() => {
                      if (task.lead) {
                        onViewLead?.(task.lead.id);
                        setIsOpen(false);
                      }
                    }}
                  >
                    {getTaskIcon(task.title)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium truncate">
                          {task.title}
                        </p>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            onClick={(e) => handleDismiss(task.id, e)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-green-600 hover:text-green-700"
                            onClick={(e) => handleComplete(task.id, e)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge
                          variant={isOverdue ? "destructive" : "outline"}
                          className="text-xs"
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          {formatDistanceToNow(new Date(task.dueAt), {
                            addSuffix: true,
                          })}
                        </Badge>
                        {task.lead && (
                          <Badge variant="secondary" className="text-xs">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            #{task.lead.leadNumber}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Show more/less */}
              {tasks.length > 5 && (
                <button
                  className="w-full flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                  onClick={() => setShowAll(!showAll)}
                >
                  {showAll ? (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-4 w-4" />
                      Show all ({tasks.length - 5} more)
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t p-3">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              onNavigateToFollowUps?.();
              setIsOpen(false);
            }}
          >
            View All Follow-ups
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FollowUpReminder;

