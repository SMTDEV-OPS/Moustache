import { useEffect, useMemo, useState } from "react";
import { endOfWeek, format, setHours, setMinutes, startOfDay, startOfWeek } from "date-fns";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { useToast } from "@/hooks/use-toast";
import {
  createAccountTask,
  getWeekPlannerData,
  type WeekPlannerAccount,
  type WeekPlannerData,
} from "@/services/weekPlanner";
import { WeekPlannerGrid, type WeekPlannerEvent } from "@/components/WeekPlannerGrid";
import { ActivityWizard } from "@/components/activities/ActivityWizard";

interface AddTaskDialogProps {
  open: boolean;
  onClose: () => void;
  defaultDate?: Date;
  defaultHour?: number;
  accounts: WeekPlannerAccount[];
  onSaved: () => void;
}

function AddTaskDialog({ open, onClose, defaultDate, defaultHour, accounts, onSaved }: AddTaskDialogProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [type, setType] = useState("followup");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (defaultDate) setDate(format(defaultDate, "yyyy-MM-dd"));
    if (typeof defaultHour === "number") setTime(`${String(defaultHour).padStart(2, "0")}:00`);
  }, [open, defaultDate, defaultHour]);

  const handleSave = async () => {
    if (!title.trim() || !accountId || !date || !time) {
      toast({ title: "Validation", description: "Title, account, date and time are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await createAccountTask({
        title: title.trim(),
        description: description.trim() || undefined,
        accountId,
        dueAt: new Date(`${date}T${time}`).toISOString(),
        type,
      });
      toast({ title: "Task created", description: "Task added to week planner" });
      onSaved();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to create task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Task</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" />
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a._id} value={a._id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="followup">Follow-up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Time</Label>
            <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Task
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WeekPlanner() {
  const { toast } = useToast();
  const [weekStart, setWeekStart] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [data, setData] = useState<WeekPlannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<{ date: Date; hour: number } | null>(null);
  const [activityAccountId, setActivityAccountId] = useState<string | null>(null);
  const [activityInitialDate, setActivityInitialDate] = useState<Date | undefined>();
  const [activityWizardOpen, setActivityWizardOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [pickerAccountId, setPickerAccountId] = useState("");

  const load = async () => {
    try {
      const from = weekStart;
      const to = endOfWeek(weekStart, { weekStartsOn: 1 });
      setLoading(true);
      const response = await getWeekPlannerData(from, to);
      setData(response);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to fetch week planner", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [weekStart]);

  const events: WeekPlannerEvent[] = useMemo(() => {
    if (!data) return [];
    const result: WeekPlannerEvent[] = [];

    for (const a of data.activities) {
      if (!a.startsAt) continue;
      result.push({
        id: `activity-${a._id}`,
        title: a.activityType.replace(/_/g, " "),
        subtitle: a.contactId?.name || a.accountId?.name,
        startTime: new Date(a.startsAt),
        endTime: a.endsAt ? new Date(a.endsAt) : undefined,
        type: "activity",
        accountName: a.accountId?.name,
      });
    }

    for (const f of data.followUps) {
      const d = new Date(f.followUpDate);
      d.setHours(9, 0, 0, 0);
      result.push({
        id: `followup-${f._id}`,
        title: `Follow-up: ${f.name}`,
        subtitle: f.followUpNote,
        startTime: d,
        endTime: new Date(d.getTime() + 30 * 60 * 1000),
        type: "followup",
        accountName: f.name,
      });
    }

    for (const t of data.tasks) {
      const start = new Date(t.dueAt);
      result.push({
        id: `task-${t._id}`,
        title: t.title,
        subtitle: t.accountId?.name,
        startTime: start,
        endTime: new Date(start.getTime() + 30 * 60 * 1000),
        type: "task",
        accountName: t.accountId?.name,
      });
    }

    return result;
  }, [data]);

  const openActivityForSlot = (date: Date, hour: number) => {
    const slotDate = setMinutes(setHours(startOfDay(date), hour), 0);
    setSelectedSlot({ date: slotDate, hour });
    setActivityInitialDate(slotDate);
    const accounts = data?.accounts ?? [];
    if (accounts.length === 0) {
      toast({ title: "No accounts", description: "Add an account to schedule activities.", variant: "destructive" });
      return;
    }
    if (accounts.length === 1) {
      setActivityAccountId(accounts[0]._id);
      setActivityWizardOpen(true);
      return;
    }
    setPickerAccountId("");
    setAccountPickerOpen(true);
  };

  const confirmAccountPicker = () => {
    if (!pickerAccountId) {
      toast({ title: "Required", description: "Select an account", variant: "destructive" });
      return;
    }
    setActivityAccountId(pickerAccountId);
    setAccountPickerOpen(false);
    setActivityWizardOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Week Planner</h1>
          <p className="text-sm text-muted-foreground">Your account activities, follow-ups and tasks for the week</p>
        </div>
        <Button onClick={() => { setSelectedSlot(null); setAddTaskOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add Task
        </Button>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-blue-400" /><span>Activity</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-amber-400" /><span>Follow-up</span></div>
        <div className="flex items-center gap-1.5"><div className="h-3 w-3 rounded-sm bg-violet-400" /><span>Task</span></div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <WeekPlannerGrid
          events={events}
          weekStart={weekStart}
          onWeekStartChange={setWeekStart}
          onSlotClick={(date, hour) => openActivityForSlot(date, hour)}
        />
      )}

      <AddTaskDialog
        open={addTaskOpen}
        onClose={() => {
          setAddTaskOpen(false);
          setSelectedSlot(null);
        }}
        defaultDate={selectedSlot?.date}
        defaultHour={selectedSlot?.hour}
        accounts={data?.accounts ?? []}
        onSaved={() => {
          setAddTaskOpen(false);
          setSelectedSlot(null);
          void load();
        }}
      />

      <Dialog open={accountPickerOpen} onOpenChange={setAccountPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select account</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Activity for account</Label>
            <Select value={pickerAccountId} onValueChange={setPickerAccountId}>
              <SelectTrigger><SelectValue placeholder="Choose account" /></SelectTrigger>
              <SelectContent>
                {(data?.accounts ?? []).map((a) => (
                  <SelectItem key={a._id} value={a._id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAccountPickerOpen(false)}>Cancel</Button>
            <Button onClick={confirmAccountPicker}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activityAccountId && (
        <ActivityWizard
          open={activityWizardOpen}
          onOpenChange={(open) => {
            setActivityWizardOpen(open);
            if (!open) {
              setActivityAccountId(null);
              setSelectedSlot(null);
            }
          }}
          accountId={activityAccountId}
          initialDate={activityInitialDate}
          onSuccess={() => {
            setActivityWizardOpen(false);
            setActivityAccountId(null);
            setSelectedSlot(null);
            void load();
          }}
        />
      )}
    </div>
  );
}
