import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
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
  getTaskSummary,
} from "@/services/tasks";
import { listLeads, Lead, getLeadContactInfo } from "@/services/leads";
import {
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { format } from "date-fns";

interface TodaysFollowUpsProps {
  userName?: string;
  backendUserId?: string;
  onViewLead?: (leadId: string) => void;
}

export const TodaysFollowUps = ({
  userName,
  backendUserId,
  onViewLead,
}: TodaysFollowUpsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [summary, setSummary] = useState({
    overdue: 0,
    dueToday: 0,
    upcoming: 0,
    completedToday: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionOutcome, setCompletionOutcome] = useState("");
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
    void loadSummary();
  }, [backendUserId]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const allTasks = await listTasks({ status: "OPEN" });
      setTasks(allTasks);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load follow-ups",
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

  const loadSummary = async () => {
    try {
      const data = await getTaskSummary();
      setSummary(data);
    } catch (err) {
      console.error("Failed to load task summary:", err);
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
        description: "Follow-up created",
      });
      setIsCreateOpen(false);
      setNewTask({
        title: "",
        description: "",
        leadId: "none",
        dueAt: "",
        dueTime: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      void loadTasks();
      void loadSummary();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create follow-up",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleComplete = async (task: Task) => {
    if (task.type === "followup") {
      setCompletingTaskId(task.id);
      setCompletionOutcome("");
      return;
    }

    try {
      await updateTask(task.id, { status: "COMPLETED" });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      void loadSummary();
      toast({
        title: "Success",
        description: "Follow-up marked as completed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to complete follow-up",
        variant: "destructive",
      });
    }
  };

  const handleConfirmFollowupComplete = async (taskId: string) => {
    if (!completionOutcome.trim()) {
      toast({
        title: "Error",
        description: "Please enter an outcome before completing follow-up",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateTask(taskId, {
        status: "COMPLETED",
        outcome: completionOutcome.trim(),
      });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setCompletingTaskId(null);
      setCompletionOutcome("");
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      void loadSummary();
      toast({
        title: "Success",
        description: "Follow-up marked as completed",
      });
    } catch (err) {
      toast({
        title: "Error",
        description:
          err instanceof Error ? err.message : "Failed to complete follow-up",
        variant: "destructive",
      });
    }
  };

  const handleCancel = async (taskId: string) => {
    try {
      await updateTask(taskId, { status: "CANCELLED" });
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      void loadSummary();
      toast({
        title: "Success",
        description: "Follow-up cancelled",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to cancel follow-up",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: "bg-blue-50 text-blue-600 border-blue-200",
      COMPLETED: "bg-emerald-50 text-emerald-600 border-emerald-200",
      CANCELLED: "bg-slate-100 text-slate-500 border-slate-200",
    };
    return styles[status] || styles.OPEN;
  };

  const getLeadName = (task: Task): string => {
    if (task.lead) {
      return `Lead #${task.lead.leadNumber || task.lead.id}`;
    }
    return "-";
  };

    return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Follow-ups</h1>
          <p className="text-slate-500 mt-1">Schedule and track guest follow-ups</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-slate-900 hover:bg-slate-800 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Follow-up
        </Button>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule follow-up</DialogTitle>
            <DialogDescription>Create a follow-up task linked to a lead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-2 block">Title *</Label>
              <Input placeholder="Follow up with guest..." value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="h-10 border-slate-200" />
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-2 block">Lead</Label>
              <Select value={newTask.leadId} onValueChange={(value) => setNewTask({ ...newTask, leadId: value })}>
                <SelectTrigger className="h-10 border-slate-200"><SelectValue placeholder="Optional" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {leads.filter((lead) => lead.id).map((lead, index) => {
                    const leadId = String(lead.id);
                    const { name } = getLeadContactInfo(lead);
                    return (<SelectItem key={`${leadId}-${index}`} value={leadId}>{name || `Lead #${lead.leadNumber || lead.id}`}</SelectItem>);
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-2 block">Due date *</Label>
                <Input type="date" value={newTask.dueAt} onChange={(e) => setNewTask({ ...newTask, dueAt: e.target.value })} className="h-10 border-slate-200" />
              </div>
              <div>
                <Label className="text-xs font-semibold text-slate-600 mb-2 block">Due time *</Label>
                <Input type="time" value={newTask.dueTime} onChange={(e) => setNewTask({ ...newTask, dueTime: e.target.value })} className="h-10 border-slate-200" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-semibold text-slate-600 mb-2 block">Description</Label>
              <Textarea placeholder="Additional notes..." value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="border-slate-200" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isCreating} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating...</> : "Save follow-up"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tasks Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="flex gap-6 px-4 py-3 border-b border-gray-200 text-sm text-gray-600">
            <span>
              <span className="font-medium text-gray-900">{summary.overdue}</span>{" "}
              overdue
            </span>
            <span>
              <span className="font-medium text-gray-900">{summary.dueToday}</span>{" "}
              due today
            </span>
            <span>
              <span className="font-medium text-gray-900">{summary.upcoming}</span>{" "}
              upcoming
            </span>
            <span>
              <span className="font-medium text-gray-900">
                {summary.completedToday}
              </span>{" "}
              completed today
            </span>
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Clock className="h-12 w-12 text-slate-300 mb-4" />
              <p className="text-slate-500">No follow-ups found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold text-slate-900">Title</TableHead>
                  <TableHead className="font-semibold text-slate-900">Description</TableHead>
                  <TableHead className="font-semibold text-slate-900">Due</TableHead>
                  <TableHead className="font-semibold text-slate-900">Status</TableHead>
                  <TableHead className="font-semibold text-slate-900">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tasks.map((task) => {
                  const dueDate = task.dueAt ? new Date(task.dueAt) : null;
                  const isOverdue =
                    task.status === "OPEN" &&
                    !!dueDate &&
                    dueDate.getTime() < Date.now();
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
                    <>
                    <TableRow
                      key={task.id}
                      className={`${hasLead ? "cursor-pointer hover:bg-gray-50" : ""} ${isOverdue ? "border-l-2 border-red-400" : ""}`}
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
                            <span>{task.title}</span>
            )}
                          {task.lead && (
                            <span className="text-xs text-slate-400 ml-2">
                              (Lead #{task.lead.leadNumber || task.lead.id})
                            </span>
                          )}
                          {!task.lead && task.leadId && (
                            <span className="text-xs text-slate-400 ml-2">
                              (Lead ID: {task.leadId})
                            </span>
                )}
              </div>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {task.description || "-"}
                      </TableCell>
                      <TableCell
                        className={isOverdue ? "text-red-600 text-xs" : "text-slate-600"}
                      >
                        {dueDate ? format(dueDate, "MMM d, yyyy 'at' h:mm a") : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getStatusBadge(task.status)}>
                          {task.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                          {task.status === "OPEN" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleComplete(task)}
                                className="border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCancel(task.id)}
                                className="border-red-200 text-red-600 hover:bg-red-50"
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </>
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
              </div>
                      </TableCell>
                    </TableRow>
                    {completingTaskId === task.id && (
                      <TableRow>
                        <TableCell colSpan={5} className="bg-white border-b border-gray-100">
                          <div className="py-2">
                            <Textarea
                              placeholder="What happened?"
                              rows={2}
                              value={completionOutcome}
                              onChange={(e) => setCompletionOutcome(e.target.value)}
                              className="text-sm border-gray-200"
                            />
                            <div className="flex items-center gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => handleConfirmFollowupComplete(task.id)}
                                className="rounded-md"
                              >
                                Confirm Complete
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setCompletingTaskId(null);
                                  setCompletionOutcome("");
                                }}
                                className="rounded-md border-gray-200"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                    </>
                  );
                })}
              </TableBody>
            </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TodaysFollowUps;
