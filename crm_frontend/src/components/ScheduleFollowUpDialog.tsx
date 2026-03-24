import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createTask } from "@/services/tasks";
import { listUsers, User } from "@/services/users";
import { pauseLeadWorkflow } from "@/services/leads";
import { Calendar, Clock, User as UserIcon, Phone, Mail, MessageCircle, FileText, Video } from "lucide-react";
import { format, addDays, addHours, setHours, setMinutes } from "date-fns";
import { Switch } from "@/components/ui/switch";

interface ScheduleFollowUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  leadId?: string;
  leadNumber?: string;
  guestName?: string;
  defaultOwnerUserId?: string;
  defaultFollowUpType?:
    | "call"
    | "email"
    | "whatsapp"
    | "meeting"
    | "other"
    | "followup";
  pauseWorkflowOnSchedule?: boolean;
}

const QUICK_TIMES = [
  { label: "In 30 minutes", getValue: () => addHours(new Date(), 0.5) },
  { label: "In 1 hour", getValue: () => addHours(new Date(), 1) },
  { label: "In 2 hours", getValue: () => addHours(new Date(), 2) },
  { label: "Tomorrow morning (10 AM)", getValue: () => setMinutes(setHours(addDays(new Date(), 1), 10), 0) },
  { label: "Tomorrow afternoon (2 PM)", getValue: () => setMinutes(setHours(addDays(new Date(), 1), 14), 0) },
  { label: "Next week", getValue: () => addDays(new Date(), 7) },
];

const FOLLOW_UP_TYPES = [
  { value: "followup", label: "Follow-up", icon: FileText },
  { value: "call", label: "Phone Call", icon: Phone },
  { value: "email", label: "Email", icon: Mail },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { value: "meeting", label: "Meeting", icon: Video },
  { value: "other", label: "Other", icon: FileText },
] as const;

export const ScheduleFollowUpDialog = ({
  open,
  onOpenChange,
  onSuccess,
  leadId,
  leadNumber,
  guestName,
  defaultOwnerUserId,
  defaultFollowUpType = "call",
  pauseWorkflowOnSchedule = false,
}: ScheduleFollowUpDialogProps) => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [followUpType, setFollowUpType] = useState(defaultFollowUpType);
  const [ownerUserId, setOwnerUserId] = useState(defaultOwnerUserId || "");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [pauseWorkflow, setPauseWorkflow] = useState(pauseWorkflowOnSchedule);

  useEffect(() => {
    if (open) {
      void loadUsers();
      // Set default date/time to tomorrow at 10 AM
      const tomorrow = addDays(new Date(), 1);
      setDueDate(format(tomorrow, "yyyy-MM-dd"));
      setDueTime("10:00");

      // Set the follow-up type from prop
      setFollowUpType(defaultFollowUpType);

      // Generate default title based on context and type
      const typeLabel = FOLLOW_UP_TYPES.find((t) => t.value === defaultFollowUpType)?.label || "Follow-up";
      if (leadNumber && guestName) {
        setTitle(`${typeLabel} with ${guestName} - Lead #${leadNumber}`);
      } else if (leadNumber) {
        setTitle(`${typeLabel} for Lead #${leadNumber}`);
      } else {
        setTitle("");
      }
      
      // Reset pause workflow based on prop
      setPauseWorkflow(pauseWorkflowOnSchedule);
    }
  }, [open, leadNumber, guestName, defaultFollowUpType, pauseWorkflowOnSchedule]);

  useEffect(() => {
    if (defaultOwnerUserId) {
      setOwnerUserId(defaultOwnerUserId);
    }
  }, [defaultOwnerUserId]);

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const allUsers = await listUsers();
      const activeUsers = allUsers.filter((u) => u.status === "ACTIVE");
      setUsers(activeUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handleQuickTime = (getValue: () => Date) => {
    const date = getValue();
    setDueDate(format(date, "yyyy-MM-dd"));
    setDueTime(format(date, "HH:mm"));
  };

  const handleFollowUpTypeChange = (type: string) => {
    setFollowUpType(type);
    // Update title prefix based on type
    const typeLabel = FOLLOW_UP_TYPES.find((t) => t.value === type)?.label || "Follow-up";
    if (leadNumber && guestName) {
      setTitle(`${typeLabel} with ${guestName} - Lead #${leadNumber}`);
    } else if (leadNumber) {
      setTitle(`${typeLabel} for Lead #${leadNumber}`);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter a title for the follow-up",
        variant: "destructive",
      });
      return;
    }

    if (!ownerUserId) {
      toast({
        title: "Validation Error",
        description: "Please select a team member to assign this follow-up to",
        variant: "destructive",
      });
      return;
    }

    if (!dueDate || !dueTime) {
      toast({
        title: "Validation Error",
        description: "Please select a date and time",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsSubmitting(true);

      const dueAt = new Date(`${dueDate}T${dueTime}`);

      await createTask({
        title: title.trim(),
        description: description.trim() || undefined,
        ownerUserId,
        leadId: leadId || undefined,
        dueAt: dueAt.toISOString(),
        type:
          followUpType === "other"
            ? "followup"
            : (followUpType as "followup" | "call" | "email" | "whatsapp" | "meeting"),
      });

      // Pause workflow if requested
      if (pauseWorkflow && leadId) {
        try {
          await pauseLeadWorkflow(leadId);
          toast({
            title: "Workflow Paused",
            description: "Lead workflow has been paused. You will only receive your scheduled follow-up reminder.",
          });
        } catch (err) {
          console.warn("Could not pause workflow:", err);
        }
      }

      toast({
        title: "Success",
        description: "Follow-up scheduled successfully",
      });

      // Reset form
      setTitle("");
      setDescription("");
      setFollowUpType("call");
      setDueDate("");
      setDueTime("");
      setPauseWorkflow(false);

      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to schedule follow-up",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(96vw,760px)] max-w-[760px] overflow-x-hidden rounded-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Schedule Follow-up
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Quick Time Buttons */}
          <div className="space-y-2 min-w-0">
            <Label className="text-xs text-muted-foreground">Quick Schedule</Label>
            <div className="flex flex-wrap gap-2 min-w-0">
              {QUICK_TIMES.map((qt) => (
                <Button
                  key={qt.label}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs rounded-md max-w-full whitespace-normal break-words"
                  onClick={() => handleQuickTime(qt.getValue)}
                >
                  {qt.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Follow-up Type */}
          <div className="space-y-2 min-w-0">
            <Label>Follow-up Type</Label>
            <div className="flex flex-wrap gap-2 min-w-0">
              {FOLLOW_UP_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <Button
                    key={type.value}
                    type="button"
                    variant={followUpType === type.value ? "default" : "outline"}
                    size="sm"
                    className="rounded-md h-9 px-3 shrink-0"
                    onClick={() => handleFollowUpTypeChange(type.value)}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {type.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Call back guest regarding room availability"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Notes (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add any details or context for this follow-up..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">
                <Calendar className="h-3 w-3 inline mr-1" />
                Date *
              </Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dueTime">
                <Clock className="h-3 w-3 inline mr-1" />
                Time *
              </Label>
              <Input
                id="dueTime"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
              />
            </div>
          </div>

          {/* Assign To */}
          <div className="space-y-2">
            <Label>
              <UserIcon className="h-3 w-3 inline mr-1" />
              Assign To *
            </Label>
            <Select
              value={ownerUserId}
              onValueChange={setOwnerUserId}
              disabled={isLoadingUsers}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    isLoadingUsers ? "Loading team members..." : "Select team member"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name || user.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Any team member can schedule follow-ups for others
            </p>
          </div>

          {/* Pause Workflow Toggle */}
          {leadId && (
            <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Pause Workflow Reminders</Label>
                <p className="text-xs text-muted-foreground">
                  Stop automatic workflow reminders. Only this scheduled follow-up will trigger.
                </p>
              </div>
              <Switch
                checked={pauseWorkflow}
                onCheckedChange={setPauseWorkflow}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Scheduling..." : "Schedule Follow-up"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleFollowUpDialog;

