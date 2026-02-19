import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  getLeadWorkflowState,
  recordWorkflowOutcome,
  skipWorkflowStep,
  pauseLeadWorkflow,
  resumeLeadWorkflow,
  LeadWorkflowState,
  StepExecution,
} from "@/services/leads";
import {
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  Pause,
  Play,
  Phone,
  Mail,
  MessageSquare,
  AlertCircle,
  ChevronRight,
  CalendarPlus,
} from "lucide-react";
import { ScheduleFollowUpDialog } from "@/components/ScheduleFollowUpDialog";

interface LeadWorkflowDisplayProps {
  leadId: string;
}

interface WorkflowInfo {
  name: string;
  steps: {
    stepNumber: number;
    name: string;
    mediums: string[];
    executionMode: string;
    possibleOutcomes: string[];
  }[];
}

export const LeadWorkflowDisplay = ({ leadId }: LeadWorkflowDisplayProps) => {
  const { toast } = useToast();
  const [workflowState, setWorkflowState] = useState<LeadWorkflowState | null>(null);
  const [workflowInfo, setWorkflowInfo] = useState<WorkflowInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [noWorkflow, setNoWorkflow] = useState(false);

  // Dialog states
  const [isOutcomeDialogOpen, setIsOutcomeDialogOpen] = useState(false);
  const [isSkipDialogOpen, setIsSkipDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [selectedStep, setSelectedStep] = useState<StepExecution | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState("");
  const [outcomeNote, setOutcomeNote] = useState("");
  const [skipReason, setSkipReason] = useState("");

  useEffect(() => {
    void loadWorkflowState();
  }, [leadId]);

  const loadWorkflowState = async () => {
    try {
      setIsLoading(true);
      const result = await getLeadWorkflowState(leadId);

      if (!result.workflowState) {
        setNoWorkflow(true);
        setWorkflowState(null);
        setWorkflowInfo(null);
        return;
      }

      setNoWorkflow(false);
      setWorkflowState(result.workflowState);

      // Extract workflow info if populated
      const wfId = result.workflowState.workflowId;
      if (typeof wfId === "object" && wfId !== null && "_id" in wfId) {
        setWorkflowInfo({
          name: wfId.name,
          steps: wfId.steps,
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load workflow state",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecordOutcome = async () => {
    if (!selectedStep || !selectedOutcome) return;

    try {
      await recordWorkflowOutcome(leadId, selectedStep.stepNumber, selectedOutcome, outcomeNote);
      toast({ title: "Success", description: "Outcome recorded successfully" });
      setIsOutcomeDialogOpen(false);
      setSelectedOutcome("");
      setOutcomeNote("");
      void loadWorkflowState();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to record outcome",
        variant: "destructive",
      });
    }
  };

  const handleSkipStep = async () => {
    if (!selectedStep) return;

    try {
      await skipWorkflowStep(leadId, selectedStep.stepNumber, skipReason);
      toast({ title: "Success", description: "Step skipped successfully" });
      setIsSkipDialogOpen(false);
      setSkipReason("");
      void loadWorkflowState();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to skip step",
        variant: "destructive",
      });
    }
  };

  const handlePauseResume = async () => {
    if (!workflowState) return;

    try {
      if (workflowState.isPaused) {
        await resumeLeadWorkflow(leadId);
        toast({ title: "Success", description: "Workflow resumed" });
      } else {
        await pauseLeadWorkflow(leadId);
        toast({ title: "Success", description: "Workflow paused" });
      }
      void loadWorkflowState();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update workflow",
        variant: "destructive",
      });
    }
  };

  const openOutcomeDialog = (step: StepExecution) => {
    setSelectedStep(step);
    setSelectedOutcome("");
    setOutcomeNote("");
    setIsOutcomeDialogOpen(true);
  };

  const openSkipDialog = (step: StepExecution) => {
    setSelectedStep(step);
    setSkipReason("");
    setIsSkipDialogOpen(true);
  };

  const getStepInfo = (stepNumber: number) => {
    return workflowInfo?.steps.find((s) => s.stepNumber === stepNumber);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "EXECUTED":
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case "SKIPPED":
        return <SkipForward className="h-5 w-5 text-yellow-500" />;
      case "PENDING":
      default:
        return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getMediumIcon = (medium: string) => {
    switch (medium) {
      case "CALL":
        return <Phone className="h-4 w-4" />;
      case "EMAIL":
        return <Mail className="h-4 w-4" />;
      case "WHATSAPP":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">Loading workflow...</div>
      </div>
    );
  }

  if (noWorkflow) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            No follow-up workflow assigned to this lead
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Workflows are automatically assigned when leads are created and match workflow conditions.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!workflowState) return null;

  const completedSteps = workflowState.stepExecutions.filter(
    (s) => s.status === "EXECUTED" || s.status === "SKIPPED"
  ).length;
  const totalSteps = workflowState.stepExecutions.length;
  const progressPercent = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Header with status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">
                {workflowInfo?.name || "Follow-up Workflow"}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                {workflowState.isCompleted ? (
                  <Badge variant="default" className="bg-green-500">Completed</Badge>
                ) : workflowState.isPaused ? (
                  <Badge variant="secondary">Paused</Badge>
                ) : (
                  <Badge variant="default">In Progress</Badge>
                )}
                <span className="text-sm text-muted-foreground">
                  Step {workflowState.currentStepNumber} of {totalSteps}
                </span>
              </div>
            </div>
            {!workflowState.isCompleted && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsScheduleDialogOpen(true)}
                >
                  <CalendarPlus className="h-4 w-4 mr-1" />
                  Schedule Follow-up
                </Button>
                <Button variant="outline" size="sm" onClick={handlePauseResume}>
                  {workflowState.isPaused ? (
                    <>
                      <Play className="h-4 w-4 mr-1" /> Resume
                    </>
                  ) : (
                    <>
                      <Pause className="h-4 w-4 mr-1" /> Pause
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="w-full bg-muted rounded-full h-2 mb-2">
            <div
              className="bg-primary h-2 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {completedSteps} of {totalSteps} steps completed
          </p>
        </CardContent>
      </Card>

      {/* Step Timeline */}
      <div className="space-y-3">
        {workflowState.stepExecutions.map((stepExec, index) => {
          const stepInfo = getStepInfo(stepExec.stepNumber);
          const isCurrentStep = stepExec.stepNumber === workflowState.currentStepNumber;
          const isPending = stepExec.status === "PENDING";

          return (
            <Card
              key={stepExec.stepNumber}
              className={`${isCurrentStep ? "ring-2 ring-primary" : ""} ${
                stepExec.status === "SKIPPED" ? "opacity-60" : ""
              }`}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-4">
                  {/* Status Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStatusIcon(stepExec.status)}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          Step {stepExec.stepNumber}: {stepInfo?.name || "Follow-up"}
                        </span>
                        {isCurrentStep && !workflowState.isCompleted && (
                          <Badge variant="outline" className="text-xs">Current</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        {stepInfo?.mediums.map((m) => (
                          <span key={m} title={m}>
                            {getMediumIcon(m)}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Timing */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Scheduled: {formatDate(stepExec.scheduledAt)}
                      </div>
                      {stepExec.executedAt && (
                        <div className="flex items-center gap-1">
                          <ChevronRight className="h-3 w-3" />
                          Executed: {formatDate(stepExec.executedAt)}
                        </div>
                      )}
                    </div>

                    {/* Execution Details */}
                    {stepExec.executionDetails && stepExec.executionDetails.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {stepExec.executionDetails.map((detail, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {detail.medium}: {detail.mode === "AUTO" ? "Auto-sent" : "Manual"}
                            {detail.taskId && " (Task created)"}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Outcome */}
                    {stepExec.outcome && (
                      <div className="bg-muted/50 rounded-lg p-2 text-sm">
                        <span className="font-medium">Outcome:</span> {stepExec.outcome}
                        {stepExec.outcomeNote && (
                          <span className="text-muted-foreground"> - {stepExec.outcomeNote}</span>
                        )}
                      </div>
                    )}

                    {/* Actions for pending/executed steps without outcome */}
                    {(isPending || (stepExec.status === "EXECUTED" && !stepExec.outcome)) && (
                      <div className="flex gap-2 mt-2">
                        {stepExec.status === "EXECUTED" && !stepExec.outcome && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => openOutcomeDialog(stepExec)}
                          >
                            Record Outcome
                          </Button>
                        )}
                        {isPending && !workflowState.isPaused && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openSkipDialog(stepExec)}
                          >
                            <SkipForward className="h-4 w-4 mr-1" />
                            Skip Step
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Record Outcome Dialog */}
      <Dialog open={isOutcomeDialogOpen} onOpenChange={setIsOutcomeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Outcome</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Outcome *</Label>
              <Select value={selectedOutcome} onValueChange={setSelectedOutcome}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome" />
                </SelectTrigger>
                <SelectContent>
                  {getStepInfo(selectedStep?.stepNumber || 0)?.possibleOutcomes.map((outcome) => (
                    <SelectItem key={outcome} value={outcome}>
                      {outcome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Notes (optional)</Label>
              <Input
                value={outcomeNote}
                onChange={(e) => setOutcomeNote(e.target.value)}
                placeholder="Add any additional notes..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOutcomeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRecordOutcome} disabled={!selectedOutcome}>
              Save Outcome
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skip Step Dialog */}
      <Dialog open={isSkipDialogOpen} onOpenChange={setIsSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Skip Step</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to skip Step {selectedStep?.stepNumber}? This action cannot be undone.
            </p>

            <div>
              <Label>Reason (optional)</Label>
              <Input
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="Why is this step being skipped?"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSkipDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSkipStep}>
              Skip Step
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <ScheduleFollowUpDialog
        open={isScheduleDialogOpen}
        onOpenChange={setIsScheduleDialogOpen}
        leadId={leadId}
        pauseWorkflowOnSchedule={true}
        onSuccess={() => {
          void loadWorkflowState();
        }}
      />
    </div>
  );
};

