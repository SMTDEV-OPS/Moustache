import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronDown, ChevronRight, ToggleLeft, ToggleRight, ArrowLeft, AlertCircle, GripVertical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import {
    AssignmentRuleV2,
    RuleModule,
    RuleCondition,
    AssignTo,
    ConditionLogic,
    ConditionOperator,
    listAssignmentRulesV2,
    createAssignmentRuleV2,
    updateAssignmentRuleV2,
    deleteAssignmentRuleV2,
} from "@/services/assignmentRulesV2";

// ── Field definitions per module ───────────────────────────────────────────────

const MODULE_FIELDS: Record<RuleModule, { value: string; label: string; type: "string" | "number" | "enum" | "boolean" }[]> = {
    leads: [
        { value: "source", label: "Lead Source", type: "enum" },
        { value: "leadType", label: "Lead Type", type: "enum" },
        { value: "budget", label: "Budget", type: "number" },
        { value: "estimatedBudget", label: "Estimated Budget (alias)", type: "number" },
        { value: "bookingWindow", label: "Booking Window", type: "string" },
        { value: "customerType", label: "Customer Type", type: "string" },
        { value: "status", label: "Lead Status", type: "enum" },
        { value: "country", label: "Country", type: "string" },
        { value: "city", label: "City", type: "string" },
        { value: "name", label: "Lead Name", type: "string" },
        { value: "email", label: "Email", type: "string" },
        { value: "phone", label: "Phone", type: "string" },
    ],
    tickets: [
        { value: "status", label: "Status", type: "enum" },
        { value: "priority", label: "Priority", type: "enum" },
        { value: "category", label: "Category", type: "string" },
        { value: "subject", label: "Subject", type: "string" },
    ],
};

const OPERATORS_FOR_TYPE: Record<string, { value: ConditionOperator; label: string }[]> = {
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
        { value: "greater_than", label: "Greater than" },
        { value: "less_than", label: "Less than" },
        { value: "is_empty", label: "Is empty" },
        { value: "is_not_empty", label: "Is not empty" },
    ],
    enum: [
        { value: "is", label: "Is" },
        { value: "is_not", label: "Is not" },
    ],
    boolean: [
        { value: "is", label: "Is" },
    ],
};

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface Group { _id: string; groupName: string; }
interface User { _id: string; name: string; email: string; }

interface Props {
    module: RuleModule;
}

type ViewState = "list" | "step1" | "step2";

interface RuleFormData {
    name: string;
    description: string;
    module: RuleModule;
    isActive: boolean;
    priority: number;
    applyToAll: boolean;
    conditionLogic: ConditionLogic;
    conditions: RuleCondition[];
    assignTo: AssignTo;
    employeeGroupId: string;
    specificUserId: string;
}

const DEFAULT_FORM = (module: RuleModule): RuleFormData => ({
    name: "",
    description: "",
    module,
    isActive: true,
    priority: 0,
    applyToAll: false,
    conditionLogic: "AND",
    conditions: [{ field: MODULE_FIELDS[module][0].value, operator: "is", value: "" }],
    assignTo: "group",
    employeeGroupId: "",
    specificUserId: "",
});

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AssignmentRulesManager({ module }: Props) {
    const { toast } = useToast();
    const [view, setView] = useState<ViewState>("list");
    const [rules, setRules] = useState<AssignmentRuleV2[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [editingRule, setEditingRule] = useState<AssignmentRuleV2 | null>(null);
    const [form, setForm] = useState<RuleFormData>(DEFAULT_FORM(module));
    const [groups, setGroups] = useState<Group[]>([]);
    const [users, setUsers] = useState<User[]>([]);

    // Load rules, groups, users
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [rulesData, groupsRes, usersRes] = await Promise.all([
                listAssignmentRulesV2(module),
                fetch(`${API_BASE_URL}/groups`, { headers: withAuthHeaders() }),
                fetch(`${API_BASE_URL}/users`, { headers: withAuthHeaders() }),
            ]);
            setRules(rulesData);
            if (groupsRes.ok) {
                const g = await groupsRes.json();
                setGroups(Array.isArray(g) ? g : g.groups ?? []);
            }
            if (usersRes.ok) {
                const u = await usersRes.json();
                setUsers(Array.isArray(u) ? u : u.users ?? []);
            }
        } catch {
            toast({ title: "Error", description: "Failed to load data", variant: "destructive" });
        } finally {
            setIsLoading(false);
        }
    }, [module, toast]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { void loadData(); }, []);

    // ── Form helpers ─────────────────────────────────────────────────────────────

    const openCreate = () => {
        setEditingRule(null);
        setForm(DEFAULT_FORM(module));
        setView("step1");
    };

    const openEdit = (rule: AssignmentRuleV2) => {
        setEditingRule(rule);
        setForm({
            name: rule.name,
            description: rule.description ?? "",
            module: rule.module,
            isActive: rule.isActive,
            priority: rule.priority,
            applyToAll: rule.applyToAll,
            conditionLogic: rule.conditionLogic,
            conditions: rule.conditions.length > 0 ? rule.conditions : [{ field: MODULE_FIELDS[module][0].value, operator: "is", value: "" }],
            assignTo: rule.assignTo,
            employeeGroupId: typeof rule.employeeGroupId === "object" ? rule.employeeGroupId?._id ?? "" : rule.employeeGroupId ?? "",
            specificUserId: typeof rule.specificUserId === "object" ? rule.specificUserId?._id ?? "" : rule.specificUserId ?? "",
        });
        setView("step2");
    };

    const addCondition = () => {
        setForm(prev => ({
            ...prev,
            conditions: [...prev.conditions, { field: MODULE_FIELDS[module][0].value, operator: "is", value: "" }],
        }));
    };

    const updateCondition = (i: number, patch: Partial<RuleCondition>) => {
        setForm(prev => ({
            ...prev,
            conditions: prev.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c),
        }));
    };

    const removeCondition = (i: number) => {
        setForm(prev => ({ ...prev, conditions: prev.conditions.filter((_, idx) => idx !== i) }));
    };

    // ── Save ──────────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!form.name.trim()) { toast({ title: "Name is required", variant: "destructive" }); return; }
        if (form.assignTo === "group" && !form.employeeGroupId) { toast({ title: "Select a group", variant: "destructive" }); return; }
        if (form.assignTo === "user" && !form.specificUserId) { toast({ title: "Select a user", variant: "destructive" }); return; }
        if (!form.applyToAll && form.conditions.some(c => !c.field || !c.operator)) {
            toast({ title: "All conditions must be complete", variant: "destructive" }); return;
        }

        setIsSaving(true);
        const payload = {
            name: form.name,
            description: form.description || undefined,
            module: form.module,
            isActive: form.isActive,
            priority: form.priority,
            applyToAll: form.applyToAll,
            conditionLogic: form.conditionLogic,
            conditions: form.applyToAll ? [] : form.conditions,
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
            const message = err instanceof Error ? err.message : "An unexpected error occurred";
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    // ── Toggle active ─────────────────────────────────────────────────────────────

    const toggleActive = async (rule: AssignmentRuleV2) => {
        try {
            await updateAssignmentRuleV2(rule._id, { isActive: !rule.isActive });
            setRules(prev => prev.map(r => r._id === rule._id ? { ...r, isActive: !r.isActive } : r));
            toast({ title: rule.isActive ? "Rule disabled" : "Rule enabled" });
        } catch {
            toast({ title: "Error", description: "Failed to toggle rule", variant: "destructive" });
        }
    };

    // ── Delete ────────────────────────────────────────────────────────────────────

    const handleDelete = async (id: string) => {
        if (!confirm("Delete this rule? This cannot be undone.")) return;
        try {
            await deleteAssignmentRuleV2(id);
            setRules(prev => prev.filter(r => r._id !== id));
            toast({ title: "Rule deleted" });
        } catch {
            toast({ title: "Error", description: "Failed to delete rule", variant: "destructive" });
        }
    };

    // ── Render: Rule List ─────────────────────────────────────────────────────────

    if (view === "list") {
        return (
            <div className="space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold capitalize">{module} Assignment Rules</h2>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            Rules are evaluated top-to-bottom. The first matching rule wins.
                        </p>
                    </div>
                    <button
                        onClick={openCreate}
                        className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                        Add Rule
                    </button>
                </div>

                {/* Loading */}
                {isLoading && (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
                    </div>
                )}

                {/* Empty */}
                {!isLoading && rules.length === 0 && (
                    <div className="border border-dashed rounded-xl p-12 text-center">
                        <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No assignment rules yet</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            Create a rule to automatically assign {module} to groups or users.
                        </p>
                        <button
                            onClick={openCreate}
                            className="mt-4 inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Create First Rule
                        </button>
                    </div>
                )}

                {/* Rule list */}
                {!isLoading && rules.length > 0 && (
                    <div className="space-y-3">
                        {rules.map((rule, idx) => {
                            const group = typeof rule.employeeGroupId === "object" ? rule.employeeGroupId : null;
                            const user = typeof rule.specificUserId === "object" ? rule.specificUserId : null;
                            const assignLabel =
                                rule.assignTo === "group" ? (group?.groupName ?? "—") :
                                    rule.assignTo === "user" ? (user?.name ?? "—") :
                                        "Round Robin";

                            return (
                                <div
                                    key={rule._id}
                                    className={`
                    border rounded-xl p-4 bg-card flex items-start gap-4
                    transition-all hover:border-primary/30 hover:shadow-sm
                    ${!rule.isActive ? "opacity-60" : ""}
                  `}
                                >
                                    {/* Drag handle placeholder */}
                                    <div className="mt-1 text-muted-foreground cursor-grab">
                                        <GripVertical className="h-4 w-4" />
                                    </div>

                                    {/* Priority badge */}
                                    <div className="mt-0.5 flex-shrink-0 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs font-mono font-semibold text-muted-foreground">
                                        {idx + 1}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-medium text-sm">{rule.name}</span>
                                            {!rule.isActive && (
                                                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Disabled</span>
                                            )}
                                        </div>

                                        {rule.description && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{rule.description}</p>
                                        )}

                                        <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                                            {rule.applyToAll ? (
                                                <span className="bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-medium">Applies to all</span>
                                            ) : (
                                                <span>{rule.conditions.length} condition{rule.conditions.length !== 1 ? "s" : ""} ({rule.conditionLogic})</span>
                                            )}
                                            <span>→</span>
                                            <span className="font-medium text-foreground">
                                                {rule.assignTo === "round_robin_group" ? "Round Robin: " : ""}
                                                {assignLabel}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                            onClick={() => toggleActive(rule)}
                                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                            title={rule.isActive ? "Disable rule" : "Enable rule"}
                                        >
                                            {rule.isActive
                                                ? <ToggleRight className="h-5 w-5 text-primary" />
                                                : <ToggleLeft className="h-5 w-5" />}
                                        </button>
                                        <button
                                            onClick={() => openEdit(rule)}
                                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-xs font-medium text-muted-foreground hover:text-foreground"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(rule._id)}
                                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                        >
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

    // ── Render: Step 1 ────────────────────────────────────────────────────────────

    if (view === "step1") {
        return (
            <div className="max-w-xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setView("list")}
                        className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                    >
                        <ArrowLeft className="h-4 w-4" />
                    </button>
                    <div>
                        <h2 className="text-lg font-semibold">New Assignment Rule</h2>
                        <p className="text-xs text-muted-foreground">Step 1 of 2 — Rule details</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="flex gap-1">
                    <div className="h-1 flex-1 rounded-full bg-primary" />
                    <div className="h-1 flex-1 rounded-full bg-muted" />
                </div>

                {/* Fields */}
                <div className="space-y-4">
                    {/* Name */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Rule Name <span className="text-destructive">*</span></label>
                        <input
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            placeholder="e.g. Assign high-value leads to Enterprise group"
                            value={form.name}
                            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        />
                    </div>

                    {/* Module */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Module</label>
                        <select
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={form.module}
                            onChange={e => setForm(p => ({ ...p, module: e.target.value as RuleModule }))}
                        >
                            <option value="leads">Leads</option>
                            <option value="tickets">Tickets</option>
                        </select>
                    </div>

                    {/* Description */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                        <textarea
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[80px] resize-none"
                            placeholder="Describe what this rule does…"
                            value={form.description}
                            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                        />
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Priority</label>
                        <input
                            type="number"
                            min={0}
                            className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                            value={form.priority}
                            onChange={e => setForm(p => ({ ...p, priority: parseInt(e.target.value) || 0 }))}
                        />
                        <p className="text-xs text-muted-foreground">Lower number = evaluated first.</p>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={() => setView("list")}
                        className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={!form.name.trim()}
                        onClick={() => setView("step2")}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        Next <ChevronRight className="h-4 w-4" />
                    </button>
                </div>
            </div>
        );
    }

    // ── Render: Step 2 ────────────────────────────────────────────────────────────

    const fields = MODULE_FIELDS[form.module];

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => setView("step1")}
                    className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                >
                    <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                    <h2 className="text-lg font-semibold">{form.name || "New Rule"}</h2>
                    <p className="text-xs text-muted-foreground">Step 2 of 2 — Conditions &amp; assignment</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="flex gap-1">
                <div className="h-1 flex-1 rounded-full bg-primary" />
                <div className="h-1 flex-1 rounded-full bg-primary" />
            </div>

            {/* Apply to all toggle */}
            <div className="flex items-center justify-between border rounded-xl p-4 bg-card">
                <div>
                    <p className="text-sm font-medium">Apply to all {form.module}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Match every record — skip condition builder</p>
                </div>
                <button
                    onClick={() => setForm(p => ({ ...p, applyToAll: !p.applyToAll }))}
                    className="relative"
                >
                    {form.applyToAll
                        ? <ToggleRight className="h-7 w-7 text-primary" />
                        : <ToggleLeft className="h-7 w-7 text-muted-foreground" />}
                </button>
            </div>

            {/* Conditions */}
            {!form.applyToAll && (
                <div className="border rounded-xl overflow-hidden bg-card">
                    {/* Condition logic header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
                        <span className="text-sm font-medium">Conditions</span>
                        <div className="flex items-center gap-1 p-0.5 bg-muted rounded-lg">
                            {(["AND", "OR"] as ConditionLogic[]).map(l => (
                                <button
                                    key={l}
                                    onClick={() => setForm(p => ({ ...p, conditionLogic: l }))}
                                    className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${form.conditionLogic === l
                                        ? "bg-background text-foreground shadow-sm"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                >
                                    {l}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="p-4 space-y-3">
                        {form.conditions.map((cond, i) => {
                            const fieldDef = fields.find(f => f.value === cond.field) ?? fields[0];
                            const operators = OPERATORS_FOR_TYPE[fieldDef.type] ?? OPERATORS_FOR_TYPE.string;
                            const noValueOps: ConditionOperator[] = ["is_empty", "is_not_empty"];
                            const needsValue = !noValueOps.includes(cond.operator);

                            return (
                                <div key={i} className="flex items-start gap-2 flex-wrap">
                                    {/* Logic connector */}
                                    {i > 0 && (
                                        <div className="w-10 text-center pt-2">
                                            <span className="text-xs font-semibold text-muted-foreground">{form.conditionLogic}</span>
                                        </div>
                                    )}
                                    {i === 0 && <div className="w-10 text-center pt-2"><span className="text-xs text-muted-foreground">IF</span></div>}

                                    {/* Field */}
                                    <select
                                        className="flex-1 min-w-[140px] px-2 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        value={cond.field}
                                        onChange={e => updateCondition(i, { field: e.target.value, operator: "is", value: "" })}
                                    >
                                        {fields.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                    </select>

                                    {/* Operator */}
                                    <select
                                        className="min-w-[130px] px-2 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                        value={cond.operator}
                                        onChange={e => updateCondition(i, { operator: e.target.value as ConditionOperator })}
                                    >
                                        {operators.map(op => <option key={op.value} value={op.value}>{op.label}</option>)}
                                    </select>

                                    {/* Value */}
                                    {needsValue && (
                                        <input
                                            className="flex-1 min-w-[120px] px-2 py-1.5 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                            placeholder="Value…"
                                            value={String(cond.value ?? "")}
                                            onChange={e => updateCondition(i, { value: e.target.value })}
                                        />
                                    )}

                                    {/* Remove */}
                                    {form.conditions.length > 1 && (
                                        <button
                                            onClick={() => removeCondition(i)}
                                            className="p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-colors mt-0.5"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        <button
                            onClick={addCondition}
                            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors mt-1"
                        >
                            <Plus className="h-3.5 w-3.5" /> Add condition
                        </button>
                    </div>
                </div>
            )}

            {/* Assignment target */}
            <div className="border rounded-xl overflow-hidden bg-card">
                <div className="px-4 py-3 border-b bg-muted/30">
                    <span className="text-sm font-medium">Assign to</span>
                </div>

                <div className="p-4 space-y-4">
                    {/* Assignment type */}
                    <div className="flex gap-2 flex-wrap">
                        {([
                            { value: "group", label: "Group" },
                            { value: "round_robin_group", label: "Round Robin (Group)" },
                            { value: "user", label: "Specific User" },
                        ] as { value: AssignTo; label: string }[]).map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => setForm(p => ({ ...p, assignTo: opt.value }))}
                                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${form.assignTo === opt.value
                                    ? "border-primary bg-primary/10 text-primary font-medium"
                                    : "border-border text-muted-foreground hover:border-primary/50"
                                    }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Group picker */}
                    {form.assignTo !== "user" && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">Group <span className="text-destructive">*</span></label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                value={form.employeeGroupId}
                                onChange={e => setForm(p => ({ ...p, employeeGroupId: e.target.value }))}
                            >
                                <option value="">— Select group —</option>
                                {groups.map(g => <option key={g._id} value={g._id}>{g.groupName}</option>)}
                            </select>
                        </div>
                    )}

                    {/* User picker */}
                    {form.assignTo === "user" && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium">User <span className="text-destructive">*</span></label>
                            <select
                                className="w-full px-3 py-2 border rounded-lg text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                                value={form.specificUserId}
                                onChange={e => setForm(p => ({ ...p, specificUserId: e.target.value }))}
                            >
                                <option value="">— Select user —</option>
                                {users.map(u => <option key={u._id} value={u._id}>{u.name} ({u.email})</option>)}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* Actions */}
            <div className="flex justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setForm(p => ({ ...p, isActive: !p.isActive }))}
                        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        {form.isActive
                            ? <ToggleRight className="h-5 w-5 text-primary" />
                            : <ToggleLeft className="h-5 w-5" />}
                        {form.isActive ? "Active" : "Disabled"}
                    </button>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={() => setView("list")}
                        className="px-4 py-2 border rounded-lg text-sm hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        disabled={isSaving}
                        onClick={handleSave}
                        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        {isSaving ? "Saving…" : editingRule ? "Update Rule" : "Create Rule"}
                    </button>
                </div>
            </div>
        </div>
    );
}
