import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ArrowLeft, ToggleLeft, ToggleRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listGroups, type Group } from "@/services/groups";
import {
  AssignmentRuleV2,
  RuleCondition,
  AssignTo,
  ConditionLogic,
  ConditionOperator,
  listAssignmentRulesV2,
  createAssignmentRuleV2,
  updateAssignmentRuleV2,
  deleteAssignmentRuleV2,
} from "@/services/assignmentRulesV2";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

const LEAD_SOURCES: { value: string; label: string }[] = [
  { value: "BRAND_WEBSITE", label: "Brand Website" },
  { value: "DIRECT_CALL", label: "Direct Call" },
  { value: "IVR", label: "IVR" },
  { value: "IVR_LIVE", label: "IVR Live" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "SOCIAL", label: "Social" },
  { value: "WALK_IN", label: "Walk-in" },
  { value: "REFERRAL", label: "Referral" },
  { value: "TRAVEL_AGENT", label: "Travel Agent" },
  { value: "EVENT_MICE", label: "Event / MICE" },
  { value: "REPEAT_GUEST", label: "Repeat Guest" },
  { value: "MANUAL", label: "Manual" },
  { value: "CSV_UPLOAD", label: "CSV Upload" },
];

const LEAD_TYPES: { value: string; label: string }[] = [
  { value: "STAY", label: "Stay" },
  { value: "DINING", label: "Dining" },
  { value: "INFORMATION", label: "Information" },
  { value: "MICE", label: "MICE" },
  { value: "WEDDING", label: "Wedding" },
];

const LEAD_STATUSES: { value: string; label: string }[] = [
  { value: "NEW", label: "New" },
  { value: "CONTACTED", label: "Contacted" },
  { value: "QUOTATION_SHARED", label: "Quotation Shared" },
  { value: "PAYMENT_PENDING", label: "Payment Pending" },
  { value: "ON_HOLD", label: "On Hold" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "LOST", label: "Lost" },
];

const MODULE_FIELDS: { value: string; label: string; type: "string" | "number" | "enum"; options?: { value: string; label: string }[] }[] = [
  { value: "source", label: "Lead Source", type: "enum", options: LEAD_SOURCES },
  { value: "leadType", label: "Lead Type", type: "enum", options: LEAD_TYPES },
  { value: "budget", label: "Budget", type: "number" },
  { value: "bookingWindow", label: "Booking Window", type: "string" },
  { value: "customerType", label: "Customer Type", type: "string" },
  { value: "status", label: "Lead Status", type: "enum", options: LEAD_STATUSES },
  { value: "country", label: "Country", type: "string" },
  { value: "city", label: "City", type: "string" },
];

const OPERATORS: Record<string, { value: ConditionOperator; label: string }[]> = {
  string: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
    { value: "contains", label: "Contains" },
    { value: "starts_with", label: "Starts with" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ],
  number: [
    { value: "is", label: "Equals" },
    { value: "is_not", label: "Does not equal" },
    { value: "in", label: "In list" },
    { value: "not_in", label: "Not in list" },
    { value: "greater_than", label: "Greater than" },
    { value: "less_than", label: "Less than" },
    { value: "is_empty", label: "Is empty" },
    { value: "is_not_empty", label: "Is not empty" },
  ],
  enum: [
    { value: "is", label: "Is" },
    { value: "is_not", label: "Is not" },
    { value: "in", label: "In list" },
    { value: "not_in", label: "Not in list" },
  ],
};

type ViewState = "list" | "form";

interface RuleFormData {
  name: string;
  description: string;
  module: "leads";
  isActive: boolean;
  priority: number;
  applyToAll: boolean;
  conditionLogic: ConditionLogic;
  conditions: RuleCondition[];
  assignTo: AssignTo;
  employeeGroupId: string;
  specificUserId: string;
}

const DEFAULT_FORM: RuleFormData = {
  name: "",
  description: "",
  module: "leads",
  isActive: true,
  priority: 0,
  applyToAll: false,
  conditionLogic: "AND",
  conditions: [{ field: "source", operator: "is", value: "" }],
  assignTo: "group",
  employeeGroupId: "",
  specificUserId: "",
};

export function LeadAllocationRules() {
  const { toast } = useToast();
  const [view, setView] = useState<ViewState>("list");
  const [rules, setRules] = useState<AssignmentRuleV2[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [users, setUsers] = useState<{ _id: string; name: string; email: string }[]>([]);
  const [form, setForm] = useState<RuleFormData>(DEFAULT_FORM);
  const [editingRule, setEditingRule] = useState<AssignmentRuleV2 | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rulesData, groupsData] = await Promise.all([
        listAssignmentRulesV2("leads"),
        listGroups().catch(() => []),
      ]);
      setRules(rulesData);

      const usersRes = await fetch(`${API_BASE_URL}/users`, { headers: withAuthHeaders() });
      if (usersRes.ok) {
        const u = await usersRes.json();
        setUsers(Array.isArray(u) ? u : u.users ?? []);
      }

      setGroups(groupsData);
    } catch {
      toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
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

  const openEdit = (rule: AssignmentRuleV2) => {
    setEditingRule(rule);
    const gid = typeof rule.employeeGroupId === "object" ? rule.employeeGroupId?._id : rule.employeeGroupId;
    const uid = typeof rule.specificUserId === "object" ? rule.specificUserId?._id : rule.specificUserId;
    setForm({
      name: rule.name,
      description: rule.description ?? "",
      module: "leads",
      isActive: rule.isActive,
      priority: rule.priority,
      applyToAll: rule.applyToAll,
      conditionLogic: rule.conditionLogic ?? "AND",
      conditions: rule.conditions?.length ? rule.conditions : [{ field: "source", operator: "is", value: "" }],
      assignTo: rule.assignTo,
      employeeGroupId: gid ?? "",
      specificUserId: uid ?? "",
    });
    setView("form");
  };

  const addCondition = () => {
    setForm((p) => ({
      ...p,
      conditions: [...p.conditions, { field: "source", operator: "is", value: "" }],
    }));
  };

  const updateCondition = (i: number, patch: Partial<RuleCondition>) => {
    setForm((p) => ({
      ...p,
      conditions: p.conditions.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  };

  const removeCondition = (i: number) => {
    setForm((p) => ({ ...p, conditions: p.conditions.filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (form.assignTo !== "user" && !form.employeeGroupId) {
      toast({ title: "Select a group", variant: "destructive" });
      return;
    }
    if (form.assignTo === "user" && !form.specificUserId) {
      toast({ title: "Select a user", variant: "destructive" });
      return;
    }
    if (!form.applyToAll && form.conditions.some((c) => !c.field || !c.operator)) {
      toast({ title: "Complete all conditions", variant: "destructive" });
      return;
    }
    if (!form.applyToAll && form.conditions.some((c) => ["is", "is_not", "in", "not_in"].includes(c.operator) && c.value === "")) {
      toast({ title: "Condition values are required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const payload = {
      name: form.name,
      description: form.description || undefined,
      module: "leads",
      isActive: form.isActive,
      priority: form.priority,
      applyToAll: form.applyToAll,
      conditionLogic: form.conditionLogic,
      conditions: form.applyToAll ? [] : form.conditions.map((c) => ({
        ...c,
        value: c.operator === "in" || c.operator === "not_in"
          ? (typeof c.value === "string" ? c.value.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(c.value) ? c.value : [])
          : c.value,
      })),
      assignTo: form.assignTo,
      employeeGroupId: form.assignTo !== "user" ? form.employeeGroupId : undefined,
      specificUserId: form.assignTo === "user" ? form.specificUserId : undefined,
    };

    try {
      if (editingRule) {
        await updateAssignmentRuleV2(editingRule._id, payload);
        toast({ title: "Rule updated" });
      } else {
        await createAssignmentRuleV2(payload);
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

  const toggleActive = async (rule: AssignmentRuleV2) => {
    try {
      await updateAssignmentRuleV2(rule._id, { isActive: !rule.isActive });
      setRules((p) => p.map((r) => (r._id === rule._id ? { ...r, isActive: !r.isActive } : r)));
      toast({ title: rule.isActive ? "Rule disabled" : "Rule enabled" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteAssignmentRuleV2(id);
      setRules((p) => p.filter((r) => r._id !== id));
      toast({ title: "Rule deleted" });
    } catch {
      toast({ title: "Error", variant: "destructive" });
    }
  };

  if (view === "form") {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setView("list")} className="p-2 rounded-lg border hover:bg-muted text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h2 className="text-base font-semibold">{editingRule ? "Edit Rule" : "New Rule"}</h2>
        </div>

        <div className="space-y-4 border rounded-lg p-4 bg-card">
          <div>
            <label className="text-sm font-medium">Rule Name</label>
            <input
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
              placeholder="e.g. Website leads to Sales"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Description (optional)</label>
            <textarea
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm min-h-[60px]"
              placeholder="What this rule does"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-sm font-medium">Priority (lower = first)</label>
            <input
              type="number"
              min={0}
              className="mt-1 w-full px-3 py-2 border rounded-md text-sm max-w-[100px]"
              value={form.priority}
              onChange={(e) => setForm((p) => ({ ...p, priority: parseInt(e.target.value, 10) || 0 }))}
            />
          </div>
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-medium">Conditions</span>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.applyToAll}
                onChange={(e) => setForm((p) => ({ ...p, applyToAll: e.target.checked }))}
              />
              Apply to all leads
            </label>
          </div>

          {!form.applyToAll && (
            <div className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                {(["AND", "OR"] as ConditionLogic[]).map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, conditionLogic: l }))}
                    className={`px-2 py-1 text-xs rounded border ${form.conditionLogic === l ? "border-primary bg-primary/10" : "border-border"}`}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {form.conditions.map((cond, i) => {
                const fieldDef = MODULE_FIELDS.find((f) => f.value === cond.field) ?? MODULE_FIELDS[0];
                const ops = OPERATORS[fieldDef.type] ?? OPERATORS.string;
                const noVal = ["is_empty", "is_not_empty"].includes(cond.operator);
                const isListOp = ["in", "not_in"].includes(cond.operator);

                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    {i > 0 && <span className="text-xs text-muted-foreground">{form.conditionLogic}</span>}
                    <select
                      className="px-2 py-1.5 border rounded-md text-sm min-w-[120px]"
                      value={cond.field}
                      onChange={(e) => updateCondition(i, { field: e.target.value, operator: "is", value: "" })}
                    >
                      {MODULE_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      className="px-2 py-1.5 border rounded-md text-sm min-w-[100px]"
                      value={cond.operator}
                      onChange={(e) => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                    >
                      {ops.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    {!noVal && (
                      fieldDef.type === "enum" && fieldDef.options ? (
                        isListOp ? (
                          <input
                            className="px-2 py-1.5 border rounded-md text-sm flex-1 min-w-[120px]"
                            placeholder="Comma-separated values"
                            value={Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value ?? "")}
                            onChange={(e) => updateCondition(i, { value: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                          />
                        ) : (
                          <select
                            className="px-2 py-1.5 border rounded-md text-sm min-w-[140px]"
                            value={String(cond.value ?? "")}
                            onChange={(e) => updateCondition(i, { value: e.target.value })}
                          >
                            <option value="">Select...</option>
                            {fieldDef.options.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        )
                      ) : (
                        <input
                          type={fieldDef.type === "number" ? "number" : "text"}
                          className="px-2 py-1.5 border rounded-md text-sm min-w-[120px]"
                          placeholder={isListOp ? "val1, val2, val3" : "Value"}
                          value={Array.isArray(cond.value) ? cond.value.join(", ") : String(cond.value ?? "")}
                          onChange={(e) => updateCondition(i, {
                            value: fieldDef.type === "number"
                              ? (e.target.value ? Number(e.target.value) : "")
                              : (isListOp ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean) : e.target.value),
                          })}
                        />
                      )
                    )}
                    {form.conditions.length > 1 && (
                      <button type="button" onClick={() => removeCondition(i)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button type="button" onClick={addCondition} className="text-sm text-primary hover:underline">
                + Add condition
              </button>
            </div>
          )}
        </div>

        <div className="border rounded-lg p-4 bg-card">
          <span className="text-sm font-medium block mb-3">Assign to</span>
          <div className="flex gap-2 mb-4">
            {[
              { value: "group" as const, label: "Group" },
              { value: "round_robin_group" as const, label: "Round Robin (Group)" },
              { value: "user" as const, label: "Specific User" },
            ].map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setForm((p) => ({ ...p, assignTo: o.value }))}
                className={`px-3 py-1.5 text-sm rounded border ${form.assignTo === o.value ? "border-primary bg-primary/10" : "border-border"}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {form.assignTo !== "user" && (
            <div>
              <label className="text-sm font-medium">Group</label>
              <select
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                value={form.employeeGroupId}
                onChange={(e) => setForm((p) => ({ ...p, employeeGroupId: e.target.value }))}
              >
                <option value="">Select group</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
          )}
          {form.assignTo === "user" && (
            <div>
              <label className="text-sm font-medium">User</label>
              <select
                className="mt-1 w-full px-3 py-2 border rounded-md text-sm"
                value={form.specificUserId}
                onChange={(e) => setForm((p) => ({ ...p, specificUserId: e.target.value }))}
              >
                <option value="">Select user</option>
                {users.map((u) => (
                  <option key={u._id} value={u._id}>{u.name} ({u.email})</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
            />
            Active
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setView("list")} className="px-4 py-2 border rounded-md text-sm hover:bg-muted">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : editingRule ? "Update" : "Create"}
            </button>
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
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">No assignment rules</p>
          <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
            <Plus className="h-4 w-4" />
            Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule, idx) => {
            const group = typeof rule.employeeGroupId === "object" ? rule.employeeGroupId : null;
            const user = typeof rule.specificUserId === "object" ? rule.specificUserId : null;
            const assignLabel =
              rule.assignTo === "user" ? (user?.name ?? "—") :
              rule.assignTo === "group" ? (group?.name ?? group?.groupName ?? "—") :
              `Round Robin: ${group?.name ?? group?.groupName ?? "—"}`;

            return (
              <div
                key={rule._id}
                className={`border rounded-lg p-4 flex items-start gap-4 ${!rule.isActive ? "opacity-60" : ""}`}
              >
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{rule.name}</span>
                    {!rule.isActive && <span className="text-xs px-2 py-0.5 rounded bg-muted">Disabled</span>}
                  </div>
                  {rule.description && <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>}
                  <div className="flex gap-2 mt-2 text-xs text-muted-foreground flex-wrap">
                    {rule.applyToAll ? (
                      <span>Applies to all</span>
                    ) : (
                      <span>{rule.conditions.length} condition(s) ({rule.conditionLogic})</span>
                    )}
                    <span>→</span>
                    <span className="font-medium text-foreground">{assignLabel}</span>
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => toggleActive(rule)} className="p-1.5 rounded hover:bg-muted" title={rule.isActive ? "Disable" : "Enable"}>
                    {rule.isActive ? <ToggleRight className="h-5 w-5 text-primary" /> : <ToggleLeft className="h-5 w-5" />}
                  </button>
                  <button onClick={() => openEdit(rule)} className="p-1.5 rounded hover:bg-muted text-sm">Edit</button>
                  <button onClick={() => handleDelete(rule._id)} className="p-1.5 rounded hover:bg-destructive/10 text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
