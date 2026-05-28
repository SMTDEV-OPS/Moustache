import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Task,
  listTasks,
  updateTask,
  createTask,
  deleteTask,
} from "@/services/tasks";
import { listLeads, Lead, getLeadContactInfo } from "@/services/leads";
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  CheckCircle2,
  Loader2,
  ExternalLink,
  X,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from "date-fns";

interface PersonalCalendarProps {
  userName?: string;
  backendUserId?: string;
  isAdmin?: boolean;
  permissions?: string[];
  onViewLead?: (leadId: string) => void;
}

export const PersonalCalendar = ({
  userName,
  backendUserId,
  onViewLead,
}: PersonalCalendarProps) => {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    leadId: "none",
    dueAt: "",
    dueTime: "",
  });

  useEffect(() => {
    void loadTasks();
    void loadLeads();
  }, [backendUserId]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await listTasks();
      setTasks(allTasks);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load reminders",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeads = async () => {
    try {
      const allLeads = await listLeads({ scope: "own" });
      setLeads(allLeads);
    } catch (err) {
      console.error("Failed to load leads:", err);
    }
  };

  const handleCreate = async () => {
    if (!newTask.title.trim()) {
      toast({
        title: "Error",
        description: "Title is required",
        variant: "destructive",
      });
      return;
    }

    if (!newTask.dueAt || !newTask.dueTime) {
      toast({
        title: "Error",
        description: "Due date and time are required",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsCreating(true);
      const dueDateTime = new Date(`${newTask.dueAt}T${newTask.dueTime}`);
      
      await createTask({
        title: newTask.title,
        description: newTask.description || undefined,
        ownerUserId: backendUserId || "",
        leadId: newTask.leadId && newTask.leadId !== "none" ? newTask.leadId : undefined,
        dueAt: dueDateTime.toISOString(),
      });

      toast({
        title: "Success",
        description: "Reminder created",
      });
      setIsCreateOpen(false);
      setNewTask({
        title: "",
        description: "",
        leadId: "none",
        dueAt: "",
        dueTime: "",
      });
      void loadTasks();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create reminder",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await updateTask(taskId, { status: "COMPLETED" });
      void loadTasks();
      toast({
        title: "Success",
        description: "Reminder marked as completed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to complete reminder",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!deleteTaskId) return;
    try {
      await deleteTask(deleteTaskId);
      void loadTasks();
      setDeleteTaskId(null);
      toast({
        title: "Success",
        description: "Reminder deleted",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete reminder",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = (taskId: string) => {
    setDeleteTaskId(taskId);
  };

  const selectedDateTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!task.dueAt) return false;
      const taskDate = new Date(task.dueAt);
      return isSameDay(taskDate, selectedDate);
    });
  }, [tasks, selectedDate]);

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getTasksForDay = (day: Date) => {
    return tasks.filter((task) => {
      if (!task.dueAt) return false;
      return isSameDay(new Date(task.dueAt), day);
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: "bg-blue-50 text-blue-600 border-blue-200",
      COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-200",
      CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
    };
    return styles[status] || styles.OPEN;
  };

  const monthStart = startOfMonth(currentMonth);
  const firstDayOfWeek = monthStart.getDay();
  const daysBeforeMonth = Array.from({ length: firstDayOfWeek }, (_, i) => null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Calendar</h1>
          <p className="text-slate-500 mt-1">Manage your scheduled follow-ups and reminders</p>
        </div>
          <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Reminder
          </Button>
      </div>

      {/* Calendar and Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="lg:col-span-1 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">Calendar</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const prevMonth = new Date(currentMonth);
                    prevMonth.setMonth(prevMonth.getMonth() - 1);
                    setCurrentMonth(prevMonth);
                  }}
                >
                  ‹
                </Button>
                <span className="text-sm font-medium text-slate-700 min-w-[100px] text-center">
                  {format(currentMonth, "MMMM yyyy")}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const nextMonth = new Date(currentMonth);
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    setCurrentMonth(nextMonth);
                  }}
                >
                  ›
                </Button>
              </div>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div key={day} className="text-xs font-semibold text-slate-500 text-center py-2">
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {daysBeforeMonth.map((_, idx) => (
                <div key={`empty-${idx}`} className="aspect-square" />
              ))}
              {calendarDays.map((day) => {
                const dayTasks = getTasksForDay(day);
                const isSelected = isSameDay(day, selectedDate);
                const isTodayDate = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`aspect-square rounded-sm text-sm transition-colors ${
                      isSelected
                        ? "bg-slate-900 text-white"
                        : isTodayDate
                        ? "bg-emerald-50 text-emerald-600 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span>{format(day, "d")}</span>
                      {dayTasks.length > 0 && (
                        <span
                          className={`text-[10px] mt-0.5 ${
                            isSelected ? "text-white" : "text-emerald-600"
                          }`}
                        >
                          ●
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Tasks for Selected Date */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-900">
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </h3>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : selectedDateTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <CalendarIcon className="h-12 w-12 text-slate-300 mb-4" />
                <p className="text-slate-500">No reminders for this date</p>
                </div>
              ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-semibold text-slate-900">Title</TableHead>
                    <TableHead className="font-semibold text-slate-900">Description</TableHead>
                    <TableHead className="font-semibold text-slate-900">Time</TableHead>
                    <TableHead className="font-semibold text-slate-900">Status</TableHead>
                    <TableHead className="font-semibold text-slate-900">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedDateTasks.map((task) => {
                  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
                  const isCompleted = task.status === "COMPLETED";
                  // Check if task has a lead (either populated lead object or leadId)
                  const leadId = task.lead?.id || task.leadId;
                  const hasLead = !!leadId && !!onViewLead;

                  const handleRowClick = (e: React.MouseEvent) => {
                    if (hasLead && leadId) {
                      e.preventDefault();
                      e.stopPropagation();
                      onViewLead(leadId);
                    }
                  };

                    return (
                    <TableRow 
                        key={task.id}
                      className={`${isCompleted ? "opacity-60" : ""} ${hasLead ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      onClick={handleRowClick}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {hasLead ? (
                            <span className="text-emerald-600 hover:underline flex items-center gap-1">
                              {task.title}
                              <ExternalLink className="h-3 w-3" />
                            </span>
                          ) : (
                            <span className={isCompleted ? "line-through" : ""}>{task.title}</span>
                          )}
                        </div>
                        {task.lead && (
                          <div className="text-xs text-slate-400 mt-1">
                            {hasLead ? (
                              <span className="text-emerald-600 hover:underline flex items-center gap-1">
                                <ExternalLink className="h-3 w-3" />
                                Lead #{task.lead.leadNumber || task.lead.id}
                              </span>
                            ) : (
                              <span>Lead #{task.lead.leadNumber || task.lead.id}</span>
                            )}
                          </div>
                        )}
                      </TableCell>
                        <TableCell className="text-slate-600">
                          {task.description || "-"}
                        </TableCell>
                        <TableCell className="text-slate-600">
                          {dueDate ? format(dueDate, "h:mm a") : "-"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={getStatusBadge(task.status)}>
                            {task.status}
                              </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            {!isCompleted && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleComplete(task.id)}
                                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                            )}
                            {hasLead && leadId && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onViewLead(leadId);
                                }}
                                className="text-slate-600 hover:text-emerald-600"
                                title="View Lead"
                              >
                                <ExternalLink className="h-3 w-3" />
                              </Button>
                              )}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => confirmDelete(task.id)}
                              className="text-slate-400 hover:text-red-500"
                              title="Delete Reminder"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Create Reminder Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>New Reminder</DialogTitle>
            <DialogDescription>
              Create a new reminder for follow-ups or tasks
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-semibold text-slate-600 mb-2 block">Title *</Label>
              <Input
                placeholder="Follow up with guest..."
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                className="border-slate-200"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-600 mb-2 block">Lead ID</Label>
              <Select
                value={newTask.leadId}
                onValueChange={(value) => setNewTask({ ...newTask, leadId: value })}
              >
                <SelectTrigger className="border-slate-200">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leads
                    .filter((lead) => lead.id && typeof lead.id === "string" && lead.id.trim() !== "")
                    .map((lead, index) => {
                      const leadId = String(lead.id);
                      const { name } = getLeadContactInfo(lead);
                      const displayName = name || `Lead #${lead.leadNumber || lead.id}`;
                      return (
                        <SelectItem key={`${leadId}-${index}`} value={leadId}>
                          {displayName}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-semibold text-slate-600 mb-2 block">Due Date *</Label>
                <Input
                  type="date"
                  value={newTask.dueAt}
                  onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })}
                  className="border-slate-200"
                />
              </div>
                <div>
                <Label className="text-sm font-semibold text-slate-600 mb-2 block">Due Time *</Label>
                <Input
                  type="time"
                  value={newTask.dueTime}
                  onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })}
                  className="border-slate-200"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-600 mb-2 block">Description</Label>
              <Textarea
                placeholder="Additional notes..."
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                className="border-slate-200 min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateOpen(false)}
              className="border-slate-200"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Reminder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteTaskId} onOpenChange={(open) => !open && setDeleteTaskId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTaskId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PersonalCalendar;
