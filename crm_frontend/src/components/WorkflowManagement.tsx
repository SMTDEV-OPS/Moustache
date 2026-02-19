import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  listWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  Workflow,
  WorkflowStep,
  WorkflowMedium,
  WorkflowExecutionMode,
  CreateWorkflowPayload,
} from "@/services/workflows";
import { listTemplates, Template } from "@/services/templates";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Phone,
  Mail,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Copy,
} from "lucide-react";

const LEAD_TYPES = [
  { value: "STAY", label: "Stay" },
  { value: "DINING", label: "Dining" },
  { value: "INFORMATION", label: "Information" },
  { value: "MICE", label: "MICE" },
  { value: "WEDDING", label: "Wedding" },
];

const LEAD_SOURCES = [
  { value: "DIRECT_CALL", label: "Direct Call" },
  { value: "BRAND_WEBSITE", label: "Brand Website" },
  { value: "EMAIL", label: "Email" },
  { value: "REPEAT_GUEST", label: "Repeat Guest" },
  { value: "REFERRAL", label: "Referral" },
  { value: "CORPORATE_OFFICE", label: "Corporate Office" },
  { value: "SOCIAL", label: "Social Media" },
  { value: "TRAVEL_AGENT", label: "Travel Agent" },
  { value: "WALK_IN", label: "Walk In" },
  { value: "EVENT_MICE", label: "Event/MICE" },
];

const DEFAULT_OUTCOMES = ["No Response", "Interested", "Not Interested", "Callback Requested", "Converted"];

interface StepFormData {
  name: string;
  offsetDays: number;
  offsetHours: number;
  mediums: WorkflowMedium[];
  executionMode: WorkflowExecutionMode;
  emailTemplateId: string;
  emailInlineSubject: string;
  emailInlineBody: string;
  whatsappTemplateId: string;
  whatsappInlineMessage: string;
  possibleOutcomes: string[];
  isActive: boolean;
}

const emptyStep: StepFormData = {
  name: "",
  offsetDays: 0,
  offsetHours: 0,
  mediums: [],
  executionMode: "MANUAL",
  emailTemplateId: "",
  emailInlineSubject: "",
  emailInlineBody: "",
  whatsappTemplateId: "",
  whatsappInlineMessage: "",
  possibleOutcomes: [...DEFAULT_OUTCOMES],
  isActive: true,
};

export const WorkflowManagement = () => {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<Workflow | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  // Form state
  const [formName, setFormName] = useState("");
  const [formLeadType, setFormLeadType] = useState("");
  const [formSource, setFormSource] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSteps, setFormSteps] = useState<StepFormData[]>([]);
  const [newOutcome, setNewOutcome] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [wfList, tplList] = await Promise.all([
        listWorkflows(),
        listTemplates(),
      ]);
      setWorkflows(wfList);
      setTemplates(tplList);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateDialog = () => {
    setEditingWorkflow(null);
    setFormName("");
    setFormLeadType("");
    setFormSource("");
    setFormIsActive(true);
    setFormSteps([{ ...emptyStep }]);
    setExpandedSteps(new Set([0]));
    setIsDialogOpen(true);
  };

  const openEditDialog = (workflow: Workflow) => {
    setEditingWorkflow(workflow);
    setFormName(workflow.name);
    setFormLeadType(workflow.appliesTo?.leadType || "");
    setFormSource(workflow.appliesTo?.source || "");
    setFormIsActive(workflow.isActive);
    setFormSteps(
      workflow.steps.map((step) => ({
        name: step.name,
        offsetDays: step.offsetDays,
        offsetHours: step.offsetHours || 0,
        mediums: step.mediums,
        executionMode: step.executionMode,
        emailTemplateId: step.templates?.email?.templateId || "",
        emailInlineSubject: step.templates?.email?.inlineSubject || "",
        emailInlineBody: step.templates?.email?.inlineBody || "",
        whatsappTemplateId: step.templates?.whatsapp?.templateId || "",
        whatsappInlineMessage: step.templates?.whatsapp?.inlineMessage || "",
        possibleOutcomes: step.possibleOutcomes.length > 0 ? step.possibleOutcomes : [...DEFAULT_OUTCOMES],
        isActive: step.isActive,
      }))
    );
    setExpandedSteps(new Set([0]));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Error", description: "Workflow name is required", variant: "destructive" });
      return;
    }

    if (formSteps.length === 0) {
      toast({ title: "Error", description: "At least one step is required", variant: "destructive" });
      return;
    }

    for (let i = 0; i < formSteps.length; i++) {
      const step = formSteps[i];
      if (!step.name.trim()) {
        toast({ title: "Error", description: `Step ${i + 1} name is required`, variant: "destructive" });
        return;
      }
      if (step.mediums.length === 0) {
        toast({ title: "Error", description: `Step ${i + 1} must have at least one medium`, variant: "destructive" });
        return;
      }
    }

    try {
      const steps: WorkflowStep[] = formSteps.map((step, index) => ({
        stepNumber: index + 1,
        name: step.name,
        offsetDays: step.offsetDays,
        offsetHours: step.offsetHours,
        mediums: step.mediums,
        executionMode: step.executionMode,
        templates: {
          email:
            step.mediums.includes("EMAIL")
              ? {
                  templateId: step.emailTemplateId || undefined,
                  inlineSubject: step.emailInlineSubject || undefined,
                  inlineBody: step.emailInlineBody || undefined,
                }
              : undefined,
          whatsapp:
            step.mediums.includes("WHATSAPP")
              ? {
                  templateId: step.whatsappTemplateId || undefined,
                  inlineMessage: step.whatsappInlineMessage || undefined,
                }
              : undefined,
        },
        possibleOutcomes: step.possibleOutcomes,
        isActive: step.isActive,
      }));

      const payload = {
        name: formName,
        appliesTo:
          formLeadType || formSource
            ? {
                leadType: formLeadType || undefined,
                source: formSource || undefined,
              }
            : undefined,
        steps,
        isActive: formIsActive,
      };

      if (editingWorkflow) {
        await updateWorkflow(editingWorkflow.id, payload);
        toast({ title: "Success", description: "Workflow updated successfully" });
      } else {
        await createWorkflow(payload as CreateWorkflowPayload);
        toast({ title: "Success", description: "Workflow created successfully" });
      }

      setIsDialogOpen(false);
      void loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save workflow",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (workflow: Workflow) => {
    if (!confirm(`Are you sure you want to delete "${workflow.name}"?`)) return;

    try {
      await deleteWorkflow(workflow.id);
      toast({ title: "Success", description: "Workflow deleted successfully" });
      void loadData();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete workflow",
        variant: "destructive",
      });
    }
  };

  const addStep = () => {
    const newIndex = formSteps.length;
    setFormSteps([...formSteps, { ...emptyStep, offsetDays: newIndex }]);
    setExpandedSteps(new Set([...expandedSteps, newIndex]));
  };

  const removeStep = (index: number) => {
    setFormSteps(formSteps.filter((_, i) => i !== index));
    const newExpanded = new Set(expandedSteps);
    newExpanded.delete(index);
    setExpandedSteps(newExpanded);
  };

  const duplicateStep = (index: number) => {
    const stepToCopy = formSteps[index];
    const newStep = { ...stepToCopy, name: `${stepToCopy.name} (Copy)` };
    const newSteps = [...formSteps];
    newSteps.splice(index + 1, 0, newStep);
    setFormSteps(newSteps);
  };

  const updateStep = (index: number, updates: Partial<StepFormData>) => {
    const newSteps = [...formSteps];
    newSteps[index] = { ...newSteps[index], ...updates };
    setFormSteps(newSteps);
  };

  const toggleMedium = (index: number, medium: WorkflowMedium) => {
    const step = formSteps[index];
    const newMediums = step.mediums.includes(medium)
      ? step.mediums.filter((m) => m !== medium)
      : [...step.mediums, medium];
    updateStep(index, { mediums: newMediums });
  };

  const addOutcome = (index: number) => {
    if (!newOutcome.trim()) return;
    const step = formSteps[index];
    if (!step.possibleOutcomes.includes(newOutcome.trim())) {
      updateStep(index, { possibleOutcomes: [...step.possibleOutcomes, newOutcome.trim()] });
    }
    setNewOutcome("");
  };

  const removeOutcome = (stepIndex: number, outcome: string) => {
    const step = formSteps[stepIndex];
    updateStep(stepIndex, { possibleOutcomes: step.possibleOutcomes.filter((o) => o !== outcome) });
  };

  const toggleStepExpanded = (index: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedSteps(newExpanded);
  };

  const emailTemplates = templates.filter((t) => t.medium === "EMAIL");
  const whatsappTemplates = templates.filter((t) => t.medium === "WHATSAPP");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Follow-up Workflows</h2>
          <p className="text-muted-foreground">
            Configure automated follow-up sequences for leads
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Create Workflow
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading workflows...</div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No workflows configured yet</p>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CardTitle className="text-lg">{workflow.name}</CardTitle>
                    <Badge variant={workflow.isActive ? "default" : "secondary"}>
                      {workflow.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => openEditDialog(workflow)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(workflow)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2 mb-3">
                  {workflow.appliesTo?.leadType && (
                    <Badge variant="outline">
                      Lead Type: {LEAD_TYPES.find((t) => t.value === workflow.appliesTo?.leadType)?.label || workflow.appliesTo.leadType}
                    </Badge>
                  )}
                  {workflow.appliesTo?.source && (
                    <Badge variant="outline">
                      Source: {LEAD_SOURCES.find((s) => s.value === workflow.appliesTo?.source)?.label || workflow.appliesTo.source}
                    </Badge>
                  )}
                  {!workflow.appliesTo?.leadType && !workflow.appliesTo?.source && (
                    <Badge variant="outline">Applies to all leads</Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>{workflow.steps.length} step{workflow.steps.length !== 1 ? "s" : ""}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    {workflow.steps.some((s) => s.mediums.includes("CALL")) && (
                      <Phone className="h-4 w-4" />
                    )}
                    {workflow.steps.some((s) => s.mediums.includes("EMAIL")) && (
                      <Mail className="h-4 w-4" />
                    )}
                    {workflow.steps.some((s) => s.mediums.includes("WHATSAPP")) && (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle>
              {editingWorkflow ? "Edit Workflow" : "Create Workflow"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6">
            <div className="space-y-6 pb-4">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Workflow Name *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Standard Lead Follow-up"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Applies to Lead Type</Label>
                    <Select value={formLeadType || "_all"} onValueChange={(v) => setFormLeadType(v === "_all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All lead types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All lead types</SelectItem>
                        {LEAD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Applies to Source</Label>
                    <Select value={formSource || "_all"} onValueChange={(v) => setFormSource(v === "_all" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="All sources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_all">All sources</SelectItem>
                        {LEAD_SOURCES.map((source) => (
                          <SelectItem key={source.value} value={source.value}>
                            {source.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="isActive"
                    checked={formIsActive}
                    onCheckedChange={setFormIsActive}
                  />
                  <Label htmlFor="isActive">Workflow is active</Label>
                </div>
              </div>

              {/* Steps */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Workflow Steps</Label>
                  <Button variant="outline" size="sm" onClick={addStep}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Step
                  </Button>
                </div>

                {formSteps.map((step, index) => (
                  <Card key={index} className="border-l-4 border-l-primary/50">
                    <CardHeader className="py-3">
                      <div className="flex items-center justify-between">
                        <div
                          className="flex items-center gap-2 cursor-pointer flex-1"
                          onClick={() => toggleStepExpanded(index)}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">
                            Step {index + 1}: {step.name || "(Unnamed)"}
                          </span>
                          <Badge variant="outline" className="ml-2">
                            Day {step.offsetDays}
                            {step.offsetHours > 0 && ` +${step.offsetHours}h`}
                          </Badge>
                          {expandedSteps.has(index) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => duplicateStep(index)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          {formSteps.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStep(index)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {expandedSteps.has(index) && (
                      <CardContent className="space-y-4 pt-0">
                        <div className="grid grid-cols-3 gap-4">
                          <div>
                            <Label>Step Name *</Label>
                            <Input
                              value={step.name}
                              onChange={(e) => updateStep(index, { name: e.target.value })}
                              placeholder="e.g., First Follow-up"
                            />
                          </div>
                          <div>
                            <Label>Offset Days</Label>
                            <Input
                              type="number"
                              min="0"
                              value={step.offsetDays}
                              onChange={(e) =>
                                updateStep(index, { offsetDays: parseInt(e.target.value) || 0 })
                              }
                            />
                          </div>
                          <div>
                            <Label>Offset Hours</Label>
                            <Input
                              type="number"
                              min="0"
                              max="23"
                              value={step.offsetHours}
                              onChange={(e) =>
                                updateStep(index, { offsetHours: parseInt(e.target.value) || 0 })
                              }
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="mb-2 block">Mediums *</Label>
                          <div className="flex gap-4">
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`call-${index}`}
                                checked={step.mediums.includes("CALL")}
                                onCheckedChange={() => toggleMedium(index, "CALL")}
                              />
                              <Label htmlFor={`call-${index}`} className="flex items-center gap-1">
                                <Phone className="h-4 w-4" /> Call
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`email-${index}`}
                                checked={step.mediums.includes("EMAIL")}
                                onCheckedChange={() => toggleMedium(index, "EMAIL")}
                              />
                              <Label htmlFor={`email-${index}`} className="flex items-center gap-1">
                                <Mail className="h-4 w-4" /> Email
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Checkbox
                                id={`whatsapp-${index}`}
                                checked={step.mediums.includes("WHATSAPP")}
                                onCheckedChange={() => toggleMedium(index, "WHATSAPP")}
                              />
                              <Label htmlFor={`whatsapp-${index}`} className="flex items-center gap-1">
                                <MessageSquare className="h-4 w-4" /> WhatsApp
                              </Label>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label>Execution Mode</Label>
                          <Select
                            value={step.executionMode}
                            onValueChange={(v) =>
                              updateStep(index, { executionMode: v as WorkflowExecutionMode })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MANUAL">Manual (Send reminder to user)</SelectItem>
                              <SelectItem value="AUTO">Auto (Send message automatically)</SelectItem>
                              <SelectItem value="BOTH">Both (Auto send + remind user)</SelectItem>
                            </SelectContent>
                          </Select>
                          <p className="text-xs text-muted-foreground mt-1">
                            {step.executionMode === "MANUAL" &&
                              "User will receive a reminder to perform the follow-up"}
                            {step.executionMode === "AUTO" &&
                              "Messages will be sent automatically (Email/WhatsApp only)"}
                            {step.executionMode === "BOTH" &&
                              "Auto-send messages and also remind user"}
                          </p>
                        </div>

                        {/* Email Template Config */}
                        {step.mediums.includes("EMAIL") &&
                          (step.executionMode === "AUTO" || step.executionMode === "BOTH") && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                              <Label className="text-sm font-medium">Email Template</Label>
                              <Select
                                value={step.emailTemplateId || "_inline"}
                                onValueChange={(v) => updateStep(index, { emailTemplateId: v === "_inline" ? "" : v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select template or use inline" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_inline">Use inline content</SelectItem>
                                  {emailTemplates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!step.emailTemplateId && (
                                <>
                                  <Input
                                    placeholder="Email subject"
                                    value={step.emailInlineSubject}
                                    onChange={(e) =>
                                      updateStep(index, { emailInlineSubject: e.target.value })
                                    }
                                  />
                                  <Textarea
                                    placeholder="Email body (use {{guestName}}, {{propertyName}}, etc.)"
                                    value={step.emailInlineBody}
                                    onChange={(e) =>
                                      updateStep(index, { emailInlineBody: e.target.value })
                                    }
                                    rows={3}
                                  />
                                </>
                              )}
                            </div>
                          )}

                        {/* WhatsApp Template Config */}
                        {step.mediums.includes("WHATSAPP") &&
                          (step.executionMode === "AUTO" || step.executionMode === "BOTH") && (
                            <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
                              <Label className="text-sm font-medium">WhatsApp Template</Label>
                              <Select
                                value={step.whatsappTemplateId || "_inline"}
                                onValueChange={(v) => updateStep(index, { whatsappTemplateId: v === "_inline" ? "" : v })}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select template or use inline" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="_inline">Use inline content</SelectItem>
                                  {whatsappTemplates.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {!step.whatsappTemplateId && (
                                <Textarea
                                  placeholder="WhatsApp message (use {{guestName}}, {{propertyName}}, etc.)"
                                  value={step.whatsappInlineMessage}
                                  onChange={(e) =>
                                    updateStep(index, { whatsappInlineMessage: e.target.value })
                                  }
                                  rows={3}
                                />
                              )}
                            </div>
                          )}

                        {/* Possible Outcomes */}
                        <div>
                          <Label className="mb-2 block">Possible Outcomes</Label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {step.possibleOutcomes.map((outcome) => (
                              <Badge
                                key={outcome}
                                variant="secondary"
                                className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                                onClick={() => removeOutcome(index, outcome)}
                              >
                                {outcome} ×
                              </Badge>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Input
                              placeholder="Add custom outcome"
                              value={newOutcome}
                              onChange={(e) => setNewOutcome(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  addOutcome(index);
                                }
                              }}
                            />
                            <Button variant="outline" onClick={() => addOutcome(index)}>
                              Add
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`step-active-${index}`}
                            checked={step.isActive}
                            onCheckedChange={(checked) => updateStep(index, { isActive: checked })}
                          />
                          <Label htmlFor={`step-active-${index}`}>Step is active</Label>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingWorkflow ? "Update Workflow" : "Create Workflow"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

