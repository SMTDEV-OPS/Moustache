import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import {
  createContractApprovalRule,
  deleteContractApprovalRule,
  listContractApprovalRules,
  reorderContractApprovalRules,
  type ApprovalStep,
  type ContractApprovalRule,
  updateContractApprovalRule,
} from "@/services/contractApprovalRules";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const CONDITION_FIELDS = [
  { value: "propertyId", label: "Property", type: "string" as const },
  {
    value: "channel",
    label: "Channel (B2B / B2C)",
    type: "enum" as const,
    options: [
      { value: "B2B", label: "B2B" },
      { value: "B2C", label: "B2C" },
    ],
  },
  {
    value: "accountType",
    label: "Account Type",
    type: "enum" as const,
    options: [
      { value: "ACQUISITION", label: "Acquisition" },
      { value: "DEVELOPMENT", label: "Development" },
      { value: "RETENTION", label: "Retention" },
    ],
  },
  { value: "organisationType", label: "Organisation Type", type: "string" as const },
];

const FIELD_LABELS: Record<string, string> = {
  propertyId: "Property",
  channel: "Channel",
  accountType: "Account Type",
  organisationType: "Organisation Type",
};

const OP_LABELS: Record<string, string> = {
  eq: "equals",
  neq: "not equals",
  in: "is one of",
  not_in: "is not in",
};

type ViewState = "list" | "form";

interface RuleFormData {
  name: string;
  description: string;
  priority: number;
  condition_field: string;
  condition_operator: "eq" | "neq" | "in" | "not_in";
  condition_value: string;
  applyToAll: boolean;
  approvalSteps: ApprovalStep[];
  is_active: boolean;
}

const DEFAULT_FORM: RuleFormData = {
  name: "",
  description: "",
  priority: 0,
  condition_field: "channel",
  condition_operator: "eq",
  condition_value: "",
  applyToAll: false,
  approvalSteps: [{ step: 1, approverType: "reports_to_submitter", label: "Manager Approval" }],
  is_active: true,
};

export function ContractApprovalRules() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewState>("list");
  const [rules, setRules] = useState<ContractApprovalRule[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [roles, setRoles] = useState<{ _id: string; name: string }[]>([]);
  const [form, setForm] = useState<RuleFormData>(DEFAULT_FORM);
  const [editingRule, setEditingRule] = useState<ContractApprovalRule | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isReordering, setIsReordering] = useState(false);

  const selectedField = useMemo(
    () => CONDITION_FIELDS.find((f) => f.value === form.condition_field) ?? CONDITION_FIELDS[0],
    [form.condition_field]
  );

  const stepSummary = useCallback(
    (step: ApprovalStep) => {
      if (step.approverType === "specific_user") {
        return users.find((u) => u._id === step.approverUserId)?.name ?? "Specific User";
      }
      if (step.approverType === "role") {
        return roles.find((r) => r._id === step.approverRoleId)?.name ?? "By Role";
      }
      return "Manager";
    },
    [roles, users]
  );

  const humanCondition = (rule: ContractApprovalRule) => {
    if (rule.applyToAll) return "Applies to all contracts";
    const field = FIELD_LABELS[rule.condition_field] ?? rule.condition_field;
    const op = OP_LABELS[rule.condition_operator] ?? rule.condition_operator;
    const value = Array.isArray(rule.condition_value) ? rule.condition_value.join(", ") : rule.condition_value;
    return `${field} ${op} ${value}`;
  };

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, usersRes, rolesRes] = await Promise.all([
        listContractApprovalRules(),
        fetch(`${API_BASE_URL}/users`, { headers: withAuthHeaders() }),
        fetch(`${API_BASE_URL}/roles`, { headers: withAuthHeaders() }),
      ]);

      setRules(rulesData.sort((a, b) => a.priority - b.priority));

      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(Array.isArray(u) ? u : u.users ?? []);
      }
      if (rolesRes.ok) {
        const r = await rolesRes.json();
        setRoles(Array.isArray(r) ? r : r.roles ?? []);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load rules", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const openCreate = () => {
    setEditingRule(null);
    setForm(DEFAULT_FORM);
    setView("form");
  };

  const openEdit = (rule: ContractApprovalRule) => {
    setEditingRule(rule);
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      priority: rule.priority,
      condition_field: rule.condition_field,
      condition_operator: rule.condition_operator as RuleFormData["condition_operator"],
      condition_value: Array.isArray(rule.condition_value) ? rule.condition_value.join(", ") : String(rule.condition_value ?? ""),
      applyToAll: rule.applyToAll,
      approvalSteps: rule.approvalSteps?.length ? rule.approvalSteps : DEFAULT_FORM.approvalSteps,
      is_active: rule.is_active,
    });
    setView("form");
  };

  const addStep = () => {
    setForm((p) => ({
      ...p,
      approvalSteps: [...p.approvalSteps, { step: p.approvalSteps.length + 1, approverType: "reports_to_submitter", label: "" }],
    }));
  };

  const removeStep = (index: number) => {
    setForm((p) => ({
      ...p,
      approvalSteps: p.approvalSteps.filter((_, i) => i !== index).map((s, idx) => ({ ...s, step: idx + 1 })),
    }));
  };

  const updateStep = (index: number, patch: Partial<ApprovalStep>) => {
    setForm((p) => ({
      ...p,
      approvalSteps: p.approvalSteps.map((s, i) => (i === index ? { ...s, ...patch, step: i + 1 } : s)),
    }));
  };

  const moveRule = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rules.length || isReordering) return;

    const reordered = [...rules];
    const [picked] = reordered.splice(index, 1);
    reordered.splice(target, 0, picked);

    const payload = reordered.map((rule, i) => ({ id: rule._id, priority: i + 1 }));
    setIsReordering(true);
    try {
      const updated = await reorderContractApprovalRules(payload);
      setRules(updated.sort((a, b) => a.priority - b.priority));
      toast({ title: "Rule priority updated" });
    } catch {
      toast({ title: "Failed to reorder rules", variant: "destructive" });
    } finally {
      setIsReordering(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Rule name is required", variant: "destructive" });
      return;
    }
    if (!form.applyToAll && !form.condition_value.trim()) {
      toast({ title: "Condition value is required", variant: "destructive" });
      return;
    }
    if (form.approvalSteps.length === 0) {
      toast({ title: "At least one approval step is required", variant: "destructive" });
      return;
    }
    if (
      form.approvalSteps.some(
        (s) => (s.approverType === "specific_user" && !s.approverUserId) || (s.approverType === "role" && !s.approverRoleId)
      )
    ) {
      toast({ title: "Each step must have required approver details", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const parsedConditionValue =
        form.condition_operator === "in" || form.condition_operator === "not_in"
          ? form.condition_value.split(",").map((s) => s.trim()).filter(Boolean)
          : form.condition_value.trim();

      const payload = {
        name: form.name.trim(),
        description: form.description || undefined,
        priority: form.priority,
        condition_field: form.condition_field as any,
        condition_operator: form.condition_operator,
        condition_value: parsedConditionValue as any,
        applyToAll: form.applyToAll,
        approvalSteps: form.approvalSteps.map((s, idx) => ({
          ...s,
          step: idx + 1,
          approverUserId: s.approverType === "specific_user" ? s.approverUserId : undefined,
          approverRoleId: s.approverType === "role" ? s.approverRoleId : undefined,
        })),
        is_active: form.is_active,
      };

      if (editingRule) {
        await updateContractApprovalRule(editingRule._id, payload);
        toast({ title: "Rule updated" });
      } else {
        await createContractApprovalRule(payload as Omit<ContractApprovalRule, "_id">);
        toast({ title: "Rule created" });
      }
      await loadData();
      setView("list");
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (rule: ContractApprovalRule) => {
    try {
      await updateContractApprovalRule(rule._id, { is_active: !rule.is_active });
      setRules((p) => p.map((r) => (r._id === rule._id ? { ...r, is_active: !r.is_active } : r)));
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteContractApprovalRule(id);
      setRules((p) => p.filter((r) => r._id !== id));
      toast({ title: "Rule deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (view === "form") {
    return (
      <div className="max-w-3xl space-y-6">
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="icon" onClick={() => setView("list")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base font-semibold">{editingRule ? "Edit Contract Approval Rule" : "New Contract Approval Rule"}</h2>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input id="rule-name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-description">Description (optional)</Label>
              <Textarea id="rule-description" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
            </div>

            <div className="space-y-2 max-w-[160px]">
              <Label htmlFor="rule-priority">Priority (lower = first)</Label>
              <Input
                id="rule-priority"
                type="number"
                min={0}
                value={form.priority}
                onChange={(e) => setForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 0 }))}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Condition</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.applyToAll}
                  onCheckedChange={(checked) => setForm((p) => ({ ...p, applyToAll: checked }))}
                />
                <span className="text-sm text-muted-foreground">Apply to all contracts</span>
              </div>
            </div>

            {!form.applyToAll && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Field</Label>
                  <Select
                    value={form.condition_field}
                    onValueChange={(value) =>
                      setForm((p) => ({ ...p, condition_field: value, condition_value: "" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select
                    value={form.condition_operator}
                    onValueChange={(value) =>
                      setForm((p) => ({ ...p, condition_operator: value as RuleFormData["condition_operator"] }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select operator" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="eq">Equals</SelectItem>
                      <SelectItem value="neq">Not equals</SelectItem>
                      <SelectItem value="in">In list</SelectItem>
                      <SelectItem value="not_in">Not in list</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Value</Label>
                  {selectedField.type === "enum" ? (
                    <Select
                      value={form.condition_value}
                      onValueChange={(value) => setForm((p) => ({ ...p, condition_value: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select value" />
                      </SelectTrigger>
                      <SelectContent>
                        {selectedField.options?.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.condition_value}
                      placeholder={
                        form.condition_operator === "in" || form.condition_operator === "not_in"
                          ? "value1, value2"
                          : "Value"
                      }
                      onChange={(e) => setForm((p) => ({ ...p, condition_value: e.target.value }))}
                    />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Approval Steps</Label>
              <Button type="button" variant="outline" size="sm" onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" /> Add Step
              </Button>
            </div>

            {form.approvalSteps.map((step, i) => (
              <Card key={i} className="border-dashed">
                <CardContent className="pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Step {i + 1}</p>
                    {form.approvalSteps.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeStep(i)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Approver Type</Label>
                    <Select
                      value={step.approverType}
                      onValueChange={(value) =>
                        updateStep(i, {
                          approverType: value as ApprovalStep["approverType"],
                          approverUserId: undefined,
                          approverRoleId: undefined,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select approver type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="specific_user">Specific User</SelectItem>
                        <SelectItem value="role">By Role</SelectItem>
                        <SelectItem value="reports_to_submitter">Submitter&apos;s Manager</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {step.approverType === "specific_user" && (
                    <div className="space-y-2">
                      <Label>User</Label>
                      <Select
                        value={step.approverUserId ?? ""}
                        onValueChange={(value) => updateStep(i, { approverUserId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select user" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((u) => (
                            <SelectItem key={u._id} value={u._id}>
                              {u.name} ({u.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {step.approverType === "role" && (
                    <div className="space-y-2">
                      <Label>Role</Label>
                      <Select
                        value={step.approverRoleId ?? ""}
                        onValueChange={(value) => updateStep(i, { approverRoleId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r._id} value={r._id}>
                              {r.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {step.approverType === "reports_to_submitter" && (
                    <p className="text-xs text-muted-foreground">
                      Automatically resolves to the contract creator&apos;s direct manager.
                    </p>
                  )}

                  <div className="space-y-2">
                    <Label>Step Label (optional)</Label>
                    <Input
                      placeholder="e.g. Property Manager Approval"
                      value={step.label ?? ""}
                      onChange={(e) => updateStep(i, { label: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
            />
            <span className="text-sm">Active</span>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setView("list")}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="py-12 text-center text-muted-foreground">Loading rules...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Rules are evaluated top-to-bottom. First match wins.</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Add Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No contract approval rules</p>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create First Rule
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <Card key={rule._id} className={!rule.is_active ? "opacity-60" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground mt-0.5">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{rule.name}</span>
                      <span className="text-xs text-muted-foreground">Priority {rule.priority}</span>
                      {!rule.is_active && <span className="text-xs px-2 py-0.5 rounded bg-muted">Disabled</span>}
                    </div>
                    {rule.description && <p className="text-xs text-muted-foreground mt-1">{rule.description}</p>}
                    <p className="text-xs text-muted-foreground mt-1">{humanCondition(rule)}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {rule.approvalSteps.length} step{rule.approvalSteps.length > 1 ? "s" : ""}:{" "}
                      {rule.approvalSteps.map(stepSummary).join(" → ")}
                    </p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveRule(idx, -1)}
                      disabled={idx === 0 || isReordering}
                      title="Move up"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => moveRule(idx, 1)}
                      disabled={idx === rules.length - 1 || isReordering}
                      title="Move down"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(rule)}>
                      {rule.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(rule)}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(rule._id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
