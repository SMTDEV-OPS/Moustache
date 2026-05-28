import { format } from "date-fns";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Task } from "@/services/tasks";

interface TaskCardProps {
  task: Task;
  onOpenLead?: (leadId: string) => void;
  showLead?: boolean;
}

export function TaskCard({ task, onOpenLead, showLead = true }: TaskCardProps) {
  const leadId =
    typeof task.leadId === "object" && task.leadId !== null
      ? (task.leadId as { _id?: string })._id
      : task.leadId;
  const guestName =
    task.lead && typeof task.lead === "object"
      ? (task.lead as { guestId?: { name?: string } }).guestId?.name ||
        (task.lead as { contactDetails?: { name?: string } }).contactDetails?.name
      : null;

  const isOverdue = task.status !== "COMPLETED" && new Date(task.dueAt) < new Date();

  return (
    <div
      role={leadId && onOpenLead ? "button" : undefined}
      tabIndex={leadId && onOpenLead ? 0 : undefined}
      onClick={() => leadId && onOpenLead?.(String(leadId))}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && leadId && onOpenLead) {
          e.preventDefault();
          onOpenLead(String(leadId));
        }
      }}
      className={cn(
        "rounded-md border bg-surface p-4 transition-colors duration-fast",
        isOverdue ? "border-red-200 bg-red-50/50" : "border-border hover:bg-hover",
        leadId && onOpenLead && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-text">{task.title || task.type || "Follow-up"}</p>
          {showLead && guestName && (
            <p className="mt-0.5 truncate text-sm text-text-muted">{guestName}</p>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-text-faint">
            <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
            {format(new Date(task.dueAt), "MMM d, h:mm a")}
            {isOverdue && <span className="font-medium text-red-600">· Overdue</span>}
          </div>
        </div>
        {leadId && onOpenLead && (
          <ChevronRight className="h-4 w-4 shrink-0 text-text-faint" strokeWidth={1.5} />
        )}
      </div>
    </div>
  );
}
