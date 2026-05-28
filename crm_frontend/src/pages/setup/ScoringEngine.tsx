import { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, GripVertical, Star, ChevronDown, ChevronUp, X } from "lucide-react";
import {
  listScoringThresholds,
  createScoringThreshold,
  updateScoringThreshold,
  deleteScoringThreshold,
  type ScoringThreshold,
  type CreateThresholdPayload,
} from "@/services/scoringThresholds";
import {
  getAllCallQualityDimensions,
  createCallQualityDimension,
  updateCallQualityDimension,
  deleteCallQualityDimension,
  type CallQualityDimension,
  type CreateDimensionPayload,
} from "@/services/callQuality";
import {
  ScoringService,
  type ScoringRule,
  type ScoringCondition,
} from "@/services/scoringRules";
import { PageHeader, Button, Input, Select } from "@/components/shared";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type ConditionLogic = "AND" | "OR";

const SYSTEM_FIELDS = [
  { value: "source", label: "Source", type: "text" },
  { value: "score", label: "Score", type: "number" },
  { value: "heat_level", label: "Bucket / Heat Level", type: "text" },
  { value: "stage_id", label: "Stage", type: "text" },
  { value: "first_contact_done", label: "First Contact Done", type: "boolean" },
  { value: "missed_followup_count", label: "Missed Follow-up Count", type: "number" },
  { value: "last_activity_at", label: "Last Activity At", type: "date" },
  { value: "created_at", label: "Created At", type: "date" },
  { value: "assigned_agent_id", label: "Assigned Agent", type: "text" },
  { value: "budget", label: "Budget", type: "number" },
  { value: "leadType", label: "Lead Type", type: "text" },
];

const OPERATOR_LABELS: Record<string, string> = {
  is: "equals",
  is_not: "not equals",
  contains: "contains",
  starts_with: "starts with",
  greater_than: "greater than",
  less_than: "less than",
  is_empty: "is empty",
  is_not_empty: "is not empty",
};

function getOperatorsForType(type: string): string[] {
  if (type === "number" || type === "date") {
    return ["is", "is_not", "greater_than", "less_than", "is_empty", "is_not_empty"];
  }
  if (type === "boolean") {
    return ["is", "is_not"];
  }
  return ["is", "is_not", "contains", "starts_with", "is_empty", "is_not_empty"];
}

function getFieldType(fieldValue: string): string {
  return SYSTEM_FIELDS.find((f) => f.value === fieldValue)?.type ?? "text";
}

function buildConditionSummary(conditions: ScoringCondition[]): string {
  if (!conditions || conditions.length === 0) return "—";
  const c = conditions[0];
  const op = OPERATOR_LABELS[c.operator] ?? c.operator;
  if (c.operator === "is_empty" || c.operator === "is_not_empty") {
    return `${c.field} ${op}`;
  }
  const val = Array.isArray(c.value) ? c.value.join(", ") : String(c.value ?? "");
  return `${c.field} ${op} ${val}`;
}

// ─── Sortable Rule Row ────────────────────────────────────────────────────────

function SortableRuleRow({
  rule,
  onEdit,
  onToggle,
  onDelete,
}: {
  rule: ScoringRule;
  onEdit: (r: ScoringRule) => void;
  onToggle: (r: ScoringRule) => void;
  onDelete: (r: ScoringRule) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: rule._id });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const extra = rule.conditions.length > 1 ? rule.conditions.length - 1 : 0;
  const summary = buildConditionSummary(rule.conditions);
  const isPositive = rule.points > 0;
  const isNegative = rule.points < 0;
  const pointsColor = isPositive ? "#22c55e" : isNegative ? "#ef4444" : "#9ca3af";
  const pointsLabel = isPositive ? `+${rule.points}` : String(rule.points);
  const hasMultiple = rule.conditions.length > 1;

  return (
    <tr
      ref={setNodeRef}
      style={style}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={isDragging ? "opacity-50" : ""}
    >
      {/* Priority */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", width: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            {...attributes}
            {...listeners}
            style={{ color: "#9ca3af", cursor: "grab", lineHeight: 0 }}
          >
            <GripVertical size={16} strokeWidth={1.5} />
          </button>
          <span style={{ fontSize: 13, fontWeight: 500, color: "#374151" }}>{rule.priority}</span>
        </div>
      </td>

      {/* Condition */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", maxWidth: 280 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "#374151" }}>{summary}</span>
          {extra > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "#9ca3af",
                background: "#f3f4f6",
                borderRadius: 4,
                padding: "1px 6px",
              }}
            >
              +{extra} more
            </span>
          )}
        </div>
      </td>

      {/* Points */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", width: 80 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: pointsColor }}>{pointsLabel}</span>
      </td>

      {/* Logic */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", width: 80 }}>
        {hasMultiple ? (
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              borderRadius: 4,
              padding: "2px 8px",
              background: rule.conditionLogic === "AND" ? "#dbeafe" : "#ede9fe",
              color: rule.conditionLogic === "AND" ? "#1e40af" : "#5b21b6",
            }}
          >
            {rule.conditionLogic}
          </span>
        ) : (
          <span style={{ fontSize: 13, color: "#9ca3af" }}>—</span>
        )}
      </td>

      {/* Active */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", width: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span
            style={{
              display: "inline-block",
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: rule.isActive ? "#22c55e" : "#d1d5db",
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: 12, color: rule.isActive ? "#374151" : "#9ca3af" }}>
            {rule.isActive ? "Active" : "Paused"}
          </span>
        </div>
      </td>

      {/* Actions */}
      <td style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", width: 90 }}>
        <div
          style={{
            display: "flex",
            gap: 10,
            opacity: hovered ? 1 : 0,
            transition: "opacity 120ms ease",
          }}
        >
          <button type="button" onClick={() => onEdit(rule)} title="Edit" style={{ lineHeight: 0 }}>
            <Pencil size={14} strokeWidth={1.5} color="#6b7280" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(rule)}
            title={rule.isActive ? "Pause" : "Activate"}
            style={{ lineHeight: 0 }}
          >
            <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 500 }}>
              {rule.isActive ? "Pause" : "On"}
            </span>
          </button>
          <button type="button" onClick={() => onDelete(rule)} title="Delete" style={{ lineHeight: 0 }}>
            <Trash2 size={14} strokeWidth={1.5} color="#ef4444" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Condition Row ────────────────────────────────────────────────────────────

function ConditionRow({
  condition,
  onChange,
  onRemove,
  index,
}: {
  condition: ScoringCondition;
  onChange: (c: ScoringCondition) => void;
  onRemove: () => void;
  index: number;
}) {
  const fieldType = getFieldType(condition.field);
  const operators = getOperatorsForType(fieldType);
  const hideValue = condition.operator === "is_empty" || condition.operator === "is_not_empty";

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: "8px 0",
        borderBottom: "1px solid #f3f4f6",
      }}
    >
      {/* Field selector */}
      <select
        value={condition.field}
        onChange={(e) => onChange({ ...condition, field: e.target.value, value: "" })}
        style={{
          width: 180,
          fontSize: 13,
          padding: "6px 8px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "#fff",
          color: "#374151",
        }}
      >
        <optgroup label="System Fields">
          {SYSTEM_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </optgroup>
      </select>

      {/* Operator */}
      <select
        value={condition.operator}
        onChange={(e) => onChange({ ...condition, operator: e.target.value as any })}
        style={{
          width: 140,
          fontSize: 13,
          padding: "6px 8px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          background: "#fff",
          color: "#374151",
        }}
      >
        {operators.map((op) => (
          <option key={op} value={op}>{OPERATOR_LABELS[op] ?? op}</option>
        ))}
      </select>

      {/* Value input */}
      {!hideValue && (
        <div style={{ flex: 1 }}>
          {fieldType === "boolean" ? (
            <select
              value={String(condition.value ?? "true")}
              onChange={(e) => onChange({ ...condition, value: e.target.value === "true" })}
              style={{
                width: "100%",
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                background: "#fff",
                color: "#374151",
              }}
            >
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          ) : fieldType === "date" ? (
            <input
              type="date"
              value={String(condition.value ?? "")}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              style={{
                width: "100%",
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
              }}
            />
          ) : fieldType === "number" ? (
            <input
              type="number"
              value={String(condition.value ?? "")}
              onChange={(e) => onChange({ ...condition, value: Number(e.target.value) })}
              placeholder="Value"
              style={{
                width: "100%",
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
              }}
            />
          ) : (
            <input
              type="text"
              value={String(condition.value ?? "")}
              onChange={(e) => onChange({ ...condition, value: e.target.value })}
              placeholder="Value"
              style={{
                width: "100%",
                fontSize: 13,
                padding: "6px 8px",
                border: "1px solid #d1d5db",
                borderRadius: 6,
              }}
            />
          )}
        </div>
      )}
      {hideValue && <div style={{ flex: 1 }} />}

      {/* Remove */}
      <button type="button" onClick={onRemove} style={{ lineHeight: 0, flexShrink: 0 }}>
        <X size={14} strokeWidth={1.5} color="#9ca3af" />
      </button>
    </div>
  );
}

// ─── Test Score Calculator ────────────────────────────────────────────────────

function TestScorePanel({
  rules,
  thresholds,
}: {
  rules: ScoringRule[];
  thresholds: ScoringThreshold[];
}) {
  const [open, setOpen] = useState(false);
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [result, setResult] = useState<{ score: number; bucket: string; color: string } | null>(null);

  const uniqueFields = Array.from(
    new Set(
      rules
        .filter((r) => r.isActive)
        .flatMap((r) => r.conditions.map((c) => c.field))
    )
  );

  function evaluate() {
    let total = 0;
    for (const rule of rules) {
      if (!rule.isActive) continue;
      const checks = rule.conditions.map((c) => {
        const inputVal = inputs[c.field];
        const condVal = c.value;
        switch (c.operator) {
          case "is": return String(inputVal ?? "") === String(condVal ?? "");
          case "is_not": return String(inputVal ?? "") !== String(condVal ?? "");
          case "contains": return String(inputVal ?? "").includes(String(condVal ?? ""));
          case "greater_than": return Number(inputVal) > Number(condVal);
          case "less_than": return Number(inputVal) < Number(condVal);
          case "is_empty": return !inputVal;
          case "is_not_empty": return !!inputVal;
          default: return false;
        }
      });
      const match = rule.conditionLogic === "AND" ? checks.every(Boolean) : checks.some(Boolean);
      if (match) total += rule.points;
    }

    let bucket = "Cold";
    let color = "#3b82f6";
    const sorted = [...thresholds].sort((a, b) => b.min_score - a.min_score);
    for (const t of sorted) {
      if (total >= t.min_score && total <= t.max_score) {
        bucket = t.label;
        color = t.color;
        break;
      }
    }
    setResult({ score: total, bucket, color });
  }

  return (
    <div style={{ marginTop: 16, border: "1px solid #e5e7eb", borderRadius: 8 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 500,
          color: "#374151",
        }}
      >
        Test Score Calculator
        {open ? <ChevronUp size={16} color="#9ca3af" /> : <ChevronDown size={16} color="#9ca3af" />}
      </button>

      {open && (
        <div style={{ padding: 16, background: "#f9fafb", borderTop: "1px solid #e5e7eb", borderRadius: "0 0 8px 8px" }}>
          <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 12 }}>
            Enter lead values to preview how rules apply:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
            {uniqueFields.map((field) => {
              const type = getFieldType(field);
              const label = SYSTEM_FIELDS.find((f) => f.value === field)?.label ?? field;
              return (
                <div key={field}>
                  <div style={{ fontSize: 11, fontWeight: 500, color: "#6b7280", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {label}
                  </div>
                  <input
                    type={type === "number" ? "number" : type === "date" ? "date" : "text"}
                    value={String(inputs[field] ?? "")}
                    onChange={(e) => setInputs((p) => ({ ...p, [field]: type === "number" ? Number(e.target.value) : e.target.value }))}
                    style={{
                      width: "100%",
                      fontSize: 13,
                      padding: "6px 8px",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      background: "#fff",
                    }}
                  />
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button
              type="button"
              onClick={evaluate}
              style={{
                fontSize: 13,
                padding: "6px 14px",
                background: "#f3f4f6",
                border: "1px solid #d1d5db",
                borderRadius: 6,
                cursor: "pointer",
                fontWeight: 500,
                color: "#374151",
              }}
            >
              Calculate Score
            </button>
            {result && (
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>{result.score}</span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    padding: "3px 10px",
                    borderRadius: 4,
                    background: result.color + "22",
                    color: result.color,
                    border: `1px solid ${result.color}44`,
                  }}
                >
                  {result.bucket}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Scoring Rules Section ────────────────────────────────────────────────────

function ScoringRulesSection({
  rules,
  thresholds,
  onRulesChange,
}: {
  rules: ScoringRule[];
  thresholds: ScoringThreshold[];
  onRulesChange: () => void;
}) {
  const { toast } = useToast();
  const [ruleModal, setRuleModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [ruleForm, setRuleForm] = useState<{
    name: string;
    points: number;
    conditionLogic: ConditionLogic;
    conditions: ScoringCondition[];
    priority: number;
    isActive: boolean;
  }>({
    name: "",
    points: 1,
    conditionLogic: "AND",
    conditions: [{ field: "source", operator: "is", value: "" }],
    priority: rules.length + 1,
    isActive: true,
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const openAdd = () => {
    setEditingRule(null);
    setApiError(null);
    setRuleForm({
      name: "",
      points: 1,
      conditionLogic: "AND",
      conditions: [{ field: "source", operator: "is", value: "" }],
      priority: (rules[rules.length - 1]?.priority ?? 0) + 1,
      isActive: true,
    });
    setRuleModal(true);
  };

  const openEdit = (r: ScoringRule) => {
    setEditingRule(r);
    setApiError(null);
    setRuleForm({
      name: r.name,
      points: r.points,
      conditionLogic: r.conditionLogic,
      conditions: r.conditions.length > 0 ? [...r.conditions] : [{ field: "source", operator: "is", value: "" }],
      priority: r.priority,
      isActive: r.isActive,
    });
    setRuleModal(true);
  };

  const handleToggle = async (r: ScoringRule) => {
    try {
      await ScoringService.updateRule(r._id, { isActive: !r.isActive });
      toast({ title: r.isActive ? "Rule paused" : "Rule activated" });
      onRulesChange();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (r: ScoringRule) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try {
      await ScoringService.deleteRule(r._id);
      toast({ title: "Rule deleted" });
      onRulesChange();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = rules.findIndex((r) => r._id === active.id);
    const newIndex = rules.findIndex((r) => r._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(rules, oldIndex, newIndex);
    await Promise.all(
      reordered.map((r, i) => ScoringService.updateRule(r._id, { priority: i + 1 }).catch(() => { }))
    );
    onRulesChange();
  };

  const addCondition = () => {
    setRuleForm((p) => ({
      ...p,
      conditions: [...p.conditions, { field: "source", operator: "is", value: "" }],
    }));
  };

  const removeCondition = (index: number) => {
    if (ruleForm.conditions.length <= 1) return;
    setRuleForm((p) => ({ ...p, conditions: p.conditions.filter((_, i) => i !== index) }));
  };

  const updateCondition = (index: number, c: ScoringCondition) => {
    setRuleForm((p) => {
      const next = [...p.conditions];
      next[index] = c;
      return { ...p, conditions: next };
    });
  };

  const handleSave = async () => {
    if (!ruleForm.name.trim()) {
      setApiError("Rule name is required.");
      return;
    }
    if (ruleForm.conditions.length === 0) {
      setApiError("At least one condition is required.");
      return;
    }
    setSaving(true);
    setApiError(null);
    try {
      const payload: Partial<ScoringRule> = {
        name: ruleForm.name.trim(),
        points: ruleForm.points,
        conditionLogic: ruleForm.conditionLogic,
        conditions: ruleForm.conditions,
        priority: ruleForm.priority,
        isActive: ruleForm.isActive,
        module: "leads",
      };
      if (editingRule) {
        await ScoringService.updateRule(editingRule._id, payload);
        toast({ title: "Rule saved" });
      } else {
        await ScoringService.createRule(payload);
        toast({ title: "Rule saved" });
      }
      setRuleModal(false);
      onRulesChange();
    } catch (e: any) {
      setApiError(e?.message ?? "Failed to save rule.");
    } finally {
      setSaving(false);
    }
  };

  const hasMultipleConditions = ruleForm.conditions.length >= 2;

  return (
    <>
      <section style={{ marginBottom: 32 }}>
        {/* Section Header */}
        <div style={{ marginBottom: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: "#111827" }}>Scoring Rules</h2>
            <Button variant="secondary" size="sm" icon={Plus} onClick={openAdd}>
              Add Rule
            </Button>
          </div>
          <p style={{ fontSize: 13, color: "#6b7280", marginTop: 4, marginBottom: 16 }}>
            Define point conditions. Score = sum of all matching rules.
          </p>
        </div>

        {/* Table */}
        <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {rules.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }}>
              <Star size={32} color="#9ca3af" style={{ margin: "0 auto 12px" }} />
              <div style={{ fontSize: 14, fontWeight: 500, color: "#374151", marginBottom: 4 }}>
                No scoring rules configured
              </div>
              <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 12 }}>
                Add rules to define how lead scores are calculated.
              </div>
              <Button variant="secondary" size="sm" icon={Plus} onClick={openAdd}>
                Add First Rule
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f9fafb" }}>
                    {["PRIORITY", "CONDITION", "POINTS", "LOGIC", "ACTIVE", "ACTIONS"].map((col) => (
                      <th
                        key={col}
                        style={{
                          padding: "10px 16px",
                          textAlign: "left",
                          fontSize: 11,
                          fontWeight: 600,
                          color: "#6b7280",
                          letterSpacing: "0.05em",
                          borderBottom: "1px solid #e5e7eb",
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <SortableContext items={rules.map((r) => r._id)} strategy={verticalListSortingStrategy}>
                    {rules.map((rule) => (
                      <SortableRuleRow
                        key={rule._id}
                        rule={rule}
                        onEdit={openEdit}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </tbody>
              </table>
            </DndContext>
          )}
        </div>

        {/* Test Score Calculator */}
        <TestScorePanel rules={rules} thresholds={thresholds} />
      </section>

      {/* Add/Edit Rule Modal */}
      <Dialog open={ruleModal} onOpenChange={setRuleModal}>
        <DialogContent style={{ maxWidth: 560 }}>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Scoring Rule"}</DialogTitle>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, paddingTop: 4 }}>

            {/* Section 1: Rule name + Points */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <Label>Rule Name</Label>
                <input
                  type="text"
                  value={ruleForm.name}
                  onChange={(e) => setRuleForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. IVR source bonus"
                  style={{
                    width: "100%",
                    marginTop: 4,
                    fontSize: 13,
                    padding: "7px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <Label>Points</Label>
                <input
                  type="number"
                  value={ruleForm.points}
                  onChange={(e) => setRuleForm((p) => ({ ...p, points: Number(e.target.value) }))}
                  style={{
                    width: 80,
                    marginTop: 4,
                    fontSize: 13,
                    padding: "7px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                    boxSizing: "border-box",
                  }}
                />
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>Neg = deduct</p>
              </div>
            </div>

            {/* Section 2: Conditions */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <Label style={{ marginBottom: 0 }}>Conditions</Label>
                {hasMultipleConditions && (
                  <div style={{ display: "flex", gap: 0, border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden" }}>
                    {(["AND", "OR"] as ConditionLogic[]).map((logic) => (
                      <button
                        key={logic}
                        type="button"
                        onClick={() => setRuleForm((p) => ({ ...p, conditionLogic: logic }))}
                        style={{
                          padding: "4px 12px",
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: "pointer",
                          border: "none",
                          background: ruleForm.conditionLogic === logic ? "#f0f0ff" : "#fff",
                          color: ruleForm.conditionLogic === logic ? "#4f46e5" : "#9ca3af",
                          borderRight: logic === "AND" ? "1px solid #e5e7eb" : "none",
                        }}
                      >
                        {logic}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                {ruleForm.conditions.map((cond, i) => (
                  <ConditionRow
                    key={i}
                    index={i}
                    condition={cond}
                    onChange={(c) => updateCondition(i, c)}
                    onRemove={() => removeCondition(i)}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={addCondition}
                style={{
                  marginTop: 8,
                  fontSize: 13,
                  color: "#4f46e5",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  fontWeight: 500,
                }}
              >
                + Add Condition
              </button>

              {hasMultipleConditions && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "#fffbeb",
                    border: "1px solid #fde68a",
                    borderRadius: 6,
                    fontSize: 12,
                    color: "#92400e",
                  }}
                >
                  <strong>ALL (AND):</strong> every condition must match to award points.{" "}
                  <strong>ANY (OR):</strong> at least one condition must match.
                </div>
              )}
            </div>

            {/* Section 3: Settings */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
              <div>
                <Label>Priority</Label>
                <input
                  type="number"
                  value={ruleForm.priority}
                  onChange={(e) => setRuleForm((p) => ({ ...p, priority: Number(e.target.value) }))}
                  style={{
                    width: 80,
                    display: "block",
                    marginTop: 4,
                    fontSize: 13,
                    padding: "7px 10px",
                    border: "1px solid #d1d5db",
                    borderRadius: 6,
                  }}
                />
                <p style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>Lower = first</p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, paddingBottom: 4 }}>
                <Switch
                  checked={ruleForm.isActive}
                  onCheckedChange={(v) => setRuleForm((p) => ({ ...p, isActive: v }))}
                />
                <Label style={{ marginBottom: 0 }}>Active</Label>
              </div>
            </div>

            {apiError && (
              <div style={{ fontSize: 13, color: "#ef4444", padding: "8px 12px", background: "#fef2f2", borderRadius: 6, border: "1px solid #fecaca" }}>
                {apiError}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setRuleModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Sortable Dimension Row ────────────────────────────────────────────────────

function SortableDimensionRow({
  dim,
  onEdit,
  onDelete,
}: {
  dim: CallQualityDimension;
  onEdit: (d: CallQualityDimension) => void;
  onDelete: (d: CallQualityDimension) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: dim.id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <tr ref={setNodeRef} style={style} className={isDragging ? "opacity-60" : ""}>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <button type="button" {...attributes} {...listeners} className="cursor-grab" style={{ color: "var(--text-faint)" }}>
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{dim.display_order + 1}</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, fontWeight: 500 }}>{dim.name}</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, color: "var(--text-muted)" }}>{dim.description ?? "—"}</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{dim.weight_percent}%</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{dim.is_active ? "Yes" : "No"}</td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => onEdit(dim)}>
            <Pencil size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          </button>
          <button type="button" onClick={() => onDelete(dim)}>
            <Trash2 size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ScoringEngine() {
  const { toast } = useToast();
  const [thresholds, setThresholds] = useState<ScoringThreshold[]>([]);
  const [dimensions, setDimensions] = useState<CallQualityDimension[]>([]);
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [thresholdModal, setThresholdModal] = useState(false);
  const [dimensionModal, setDimensionModal] = useState(false);
  const [editingThreshold, setEditingThreshold] = useState<ScoringThreshold | null>(null);
  const [editingDimension, setEditingDimension] = useState<CallQualityDimension | null>(null);
  const [thresholdForm, setThresholdForm] = useState<Partial<CreateThresholdPayload>>({});
  const [dimensionForm, setDimensionForm] = useState<Partial<CreateDimensionPayload>>({});

  const loadThresholds = useCallback(async () => {
    try {
      const data = await listScoringThresholds();
      setThresholds(data);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadDimensions = useCallback(async () => {
    try {
      const data = await getAllCallQualityDimensions();
      setDimensions(data);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  const loadRules = useCallback(async () => {
    try {
      const data = await ScoringService.getRules("leads");
      setRules(data);
    } catch (e) {
      toast({ title: "Error loading rules", description: (e as Error).message, variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => { void loadThresholds(); }, [loadThresholds]);
  useEffect(() => { void loadDimensions(); }, [loadDimensions]);
  useEffect(() => { void loadRules(); }, [loadRules]);

  const weightTotal = dimensions.filter((d) => d.is_active).reduce((sum, d) => sum + d.weight_percent, 0);
  const weightValid = weightTotal === 100;

  const handleAddThreshold = () => {
    setEditingThreshold(null);
    setThresholdForm({ label: "", min_score: 0, max_score: 10, color: "#3b82f6", auto_action: "none" });
    setThresholdModal(true);
  };

  const handleEditThreshold = (t: ScoringThreshold) => {
    setEditingThreshold(t);
    setThresholdForm({ ...t });
    setThresholdModal(true);
  };

  const handleSaveThreshold = async () => {
    if (!thresholdForm.label || thresholdForm.min_score === undefined || thresholdForm.max_score === undefined) {
      toast({ title: "Label and score range required", variant: "destructive" });
      return;
    }
    try {
      const payload: CreateThresholdPayload = {
        label: thresholdForm.label,
        min_score: thresholdForm.min_score,
        max_score: thresholdForm.max_score,
        color: thresholdForm.color ?? "#3b82f6",
        inactive_hours_warning: thresholdForm.inactive_hours_warning ?? null,
        inactive_hours_critical: thresholdForm.inactive_hours_critical ?? null,
        inactive_color_warning: thresholdForm.inactive_color_warning ?? null,
        inactive_color_critical: thresholdForm.inactive_color_critical ?? null,
        auto_action: thresholdForm.auto_action ?? "none",
      };
      if (editingThreshold) {
        await updateScoringThreshold(editingThreshold._id, payload);
        toast({ title: "Threshold updated" });
      } else {
        await createScoringThreshold(payload);
        toast({ title: "Threshold created" });
      }
      setThresholdModal(false);
      void loadThresholds();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteThreshold = async (t: ScoringThreshold) => {
    if (!confirm(`Delete threshold "${t.label}"?`)) return;
    try {
      await deleteScoringThreshold(t._id);
      toast({ title: "Threshold deleted" });
      void loadThresholds();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleAddDimension = () => {
    setEditingDimension(null);
    setDimensionForm({ name: "", description: "", weight_percent: 20, display_order: dimensions.length, is_active: true });
    setDimensionModal(true);
  };

  const handleEditDimension = (d: CallQualityDimension) => {
    setEditingDimension(d);
    setDimensionForm({ name: d.name, description: d.description, weight_percent: d.weight_percent, display_order: d.display_order, is_active: d.is_active });
    setDimensionModal(true);
  };

  const handleSaveDimension = async () => {
    if (!dimensionForm.name || dimensionForm.weight_percent === undefined) {
      toast({ title: "Name and weight required", variant: "destructive" });
      return;
    }
    try {
      const payload: CreateDimensionPayload = {
        name: dimensionForm.name,
        description: dimensionForm.description,
        weight_percent: dimensionForm.weight_percent,
        display_order: dimensionForm.display_order ?? dimensions.length,
        is_active: dimensionForm.is_active ?? true,
      };
      if (editingDimension) {
        await updateCallQualityDimension(editingDimension.id, payload);
        toast({ title: "Dimension updated" });
      } else {
        await createCallQualityDimension(payload);
        toast({ title: "Dimension created" });
      }
      setDimensionModal(false);
      void loadDimensions();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteDimension = async (d: CallQualityDimension) => {
    if (!confirm(`Delete dimension "${d.name}"?`)) return;
    try {
      await deleteCallQualityDimension(d.id);
      toast({ title: "Dimension deleted" });
      void loadDimensions();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDimensionDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = dimensions.findIndex((d) => d.id === active.id);
    const newIndex = dimensions.findIndex((d) => d.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(dimensions, oldIndex, newIndex);
    setDimensions(reordered);
    reordered.forEach((d, i) => {
      updateCallQualityDimension(d.id, { display_order: i }).catch(() => { });
    });
    toast({ title: "Order updated" });
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <div style={{ padding: 24 }}>
      <PageHeader title="Scoring Rules" subtitle="Define how leads are scored and bucketed" />

      {/* ── Scoring Rules Builder ── */}
      <ScoringRulesSection rules={rules} thresholds={thresholds} onRulesChange={loadRules} />

      {/* ── Score Thresholds ── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Score Thresholds</h2>
          <Button variant="secondary" size="sm" icon={Plus} onClick={handleAddThreshold}>
            Add Threshold
          </Button>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--border-light)" }}>
                {["LABEL", "SCORE RANGE", "COLOR", "INACTIVE WARNING", "AUTO ACTION", "ACTIONS"].map((col) => (
                  <th key={col} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {thresholds.map((t) => (
                <tr key={t._id} style={{ height: 48 }}>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{t.label}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{t.min_score} – {t.max_score}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <span style={{ display: "inline-block", width: 16, height: 16, borderRadius: "50%", background: t.color }} />
                  </td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, color: "var(--text-muted)" }}>{t.inactive_hours_warning ?? "—"}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{t.auto_action}</td>
                  <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button type="button" onClick={() => handleEditThreshold(t)}>
                        <Pencil size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      </button>
                      <button type="button" onClick={() => handleDeleteThreshold(t)}>
                        <Trash2 size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ── Call Quality Dimensions ── */}
      <section>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Call Quality Dimensions</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <span style={{ fontSize: 12, padding: "4px 10px", borderRadius: 4, background: weightValid ? "#d1fae5" : "#fef2f2", color: weightValid ? "#065f46" : "#ef4444" }}>
              Total: {weightTotal}% {!weightValid && "— must equal 100%"}
            </span>
            <Button variant="secondary" size="sm" icon={Plus} onClick={handleAddDimension}>Add Dimension</Button>
          </div>
        </div>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDimensionDragEnd}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--border-light)" }}>
                  {["", "ORDER", "DIMENSION NAME", "DESCRIPTION", "WEIGHT %", "ACTIVE", "ACTIONS"].map((col) => (
                    <th key={col} style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <SortableContext items={dimensions.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  {dimensions.map((dim) => (
                    <SortableDimensionRow key={dim.id} dim={dim} onEdit={handleEditDimension} onDelete={handleDeleteDimension} />
                  ))}
                </SortableContext>
              </tbody>
            </table>
          </DndContext>
        </div>
      </section>

      {/* Threshold Modal */}
      <Dialog open={thresholdModal} onOpenChange={setThresholdModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingThreshold ? "Edit Threshold" : "Add Threshold"}</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            <div>
              <Label>Label</Label>
              <Input value={thresholdForm.label ?? ""} onChange={(e) => setThresholdForm((p) => ({ ...p, label: e.target.value }))} />
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Label>Min Score</Label>
                <Input type="number" value={String(thresholdForm.min_score ?? 0)} onChange={(e) => setThresholdForm((p) => ({ ...p, min_score: parseInt(e.target.value, 10) || 0 }))} />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Max Score</Label>
                <Input type="number" value={String(thresholdForm.max_score ?? 10)} onChange={(e) => setThresholdForm((p) => ({ ...p, max_score: parseInt(e.target.value, 10) || 0 }))} />
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <input type="color" value={thresholdForm.color ?? "#3b82f6"} onChange={(e) => setThresholdForm((p) => ({ ...p, color: e.target.value }))} style={{ width: 40, height: 34, padding: 2, border: "1px solid var(--border)", borderRadius: "var(--radius)" }} />
              <span style={{ marginLeft: 8, fontSize: 12, color: "var(--text-muted)" }}>{thresholdForm.color ?? "#3b82f6"}</span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <Label>Inactive Hours Warning</Label>
                <Input type="number" value={String(thresholdForm.inactive_hours_warning ?? "")} onChange={(e) => setThresholdForm((p) => ({ ...p, inactive_hours_warning: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="Optional" />
              </div>
              <div style={{ flex: 1 }}>
                <Label>Inactive Hours Critical</Label>
                <Input type="number" value={String(thresholdForm.inactive_hours_critical ?? "")} onChange={(e) => setThresholdForm((p) => ({ ...p, inactive_hours_critical: e.target.value ? parseInt(e.target.value, 10) : undefined }))} placeholder="Optional" />
              </div>
            </div>
            <div>
              <Label>Auto Action</Label>
              <Select value={thresholdForm.auto_action ?? "none"} onChange={(e) => setThresholdForm((p) => ({ ...p, auto_action: e.target.value as any }))}>
                <option value="none">None</option>
                <option value="notify_tl">Notify TL</option>
                <option value="auto_lost">Auto Lost</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setThresholdModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveThreshold}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dimension Modal */}
      <Dialog open={dimensionModal} onOpenChange={setDimensionModal}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingDimension ? "Edit Dimension" : "Add Dimension"}</DialogTitle></DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            <div>
              <Label>Name</Label>
              <Input value={dimensionForm.name ?? ""} onChange={(e) => setDimensionForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={dimensionForm.description ?? ""} onChange={(e) => setDimensionForm((p) => ({ ...p, description: e.target.value }))} placeholder="Optional" />
            </div>
            <div>
              <Label>Weight %</Label>
              <Input type="number" value={String(dimensionForm.weight_percent ?? 20)} onChange={(e) => setDimensionForm((p) => ({ ...p, weight_percent: parseInt(e.target.value, 10) || 0 }))} />
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Weights must total 100% across active dimensions</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Label>Is Active</Label>
              <Switch checked={dimensionForm.is_active ?? true} onCheckedChange={(v) => setDimensionForm((p) => ({ ...p, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDimensionModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveDimension}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
