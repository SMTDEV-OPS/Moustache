import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  Tag,
  Fingerprint,
  Link2,
  Blocks,
  X,
  Lock,
  Unlock,
  Loader2,
} from "lucide-react";
import {
  listAdminFields,
  createAdminField,
  updateAdminField,
  deleteAdminField,
  reorderAdminFields,
  type AdminField,
  type CreateFieldPayload,
  type CustomFieldType,
} from "@/services/adminFields";
import { PipelineService, type PipelineStage } from "@/services/pipelines";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";
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
import { useNavigate } from "react-router-dom";

type EntityType = "lead" | "contact" | "deal";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "TEXT", label: "Text" },
  { value: "NUMBER", label: "Number" },
  { value: "DATE", label: "Date" },
  { value: "DROPDOWN", label: "Dropdown" },
  { value: "MULTI_SELECT", label: "Multi-Select" },
  { value: "PHONE", label: "Phone" },
  { value: "BOOLEAN", label: "Boolean" },
  { value: "URL", label: "URL" },
  { value: "TEXTAREA", label: "Textarea" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        width: 32,
        height: 18,
        borderRadius: 9,
        background: checked ? "#4f46e5" : "#e5e7eb",
        transition: "120ms ease",
        position: "relative",
        border: "none",
        cursor: "pointer",
        padding: 0,
        display: "block"
      }}
    >
      <div
        style={{
          width: 14,
          height: 14,
          borderRadius: "50%",
          background: "#ffffff",
          position: "absolute",
          top: 2,
          left: 2,
          transform: checked ? "translateX(14px)" : "translateX(0)",
          transition: "120ms ease",
        }}
      />
    </button>
  );
}

function SortableRow({
  field,
  stages,
  onEdit,
  onToggleActive,
}: {
  field: AdminField;
  stages: PipelineStage[];
  onEdit: (f: AdminField) => void;
  onToggleActive: (f: AdminField, active: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const stage = field.mandatory_at_stage_id
    ? stages.find((s) => s._id === field.mandatory_at_stage_id)
    : null;

  return (
    <tr
      ref={setNodeRef}
      style={{
        ...style,
        background: "var(--surface)",
        opacity: isDragging ? 0.6 : 1,
      }}
      className="group"
    >
      <td style={{ padding: "12px 14px", borderBottom: "1px solid var(--border)", width: 40 }}>
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none"
          style={{ color: "#9ca3af", background: "none", border: "none" }}
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>{field.label || field.name}</div>
        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#6b7280", marginTop: 2 }}>{field.slug}</div>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <span
          style={{
            background: "#f3f4f6",
            color: "#374151",
            fontSize: 11,
            textTransform: "uppercase",
            borderRadius: 4,
            padding: "3px 8px",
            display: "inline-block",
            fontWeight: 500,
          }}
        >
          {field.dataType.replace("_", " ")}
        </span>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, color: "var(--text-muted)" }}>
        {stage?.name ?? "—"}
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {field.is_tag && (
            <span
              style={{
                fontSize: 11,
                color: "#4f46e5",
                background: "#f0f0ff",
                padding: "2px 6px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Tag size={11} /> Tag
            </span>
          )}
          {field.is_unique_identifier && (
            <span
              style={{
                fontSize: 11,
                color: "#4f46e5",
                background: "#f0f0ff",
                padding: "2px 6px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Fingerprint size={11} /> Dedup
            </span>
          )}
          {field.utm_capture && (
            <span
              style={{
                fontSize: 11,
                color: "#4f46e5",
                background: "#f0f0ff",
                padding: "2px 6px",
                borderRadius: 4,
                display: "inline-flex",
                alignItems: "center",
                gap: 3,
              }}
            >
              <Link2 size={11} /> UTM
            </span>
          )}
          {!field.is_tag && !field.is_unique_identifier && !field.utm_capture && (
            <span style={{ fontSize: 12, color: "#9ca3af" }}>—</span>
          )}
        </div>
      </td>
      <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", textAlign: "right" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={() => onEdit(field)}
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", padding: 4 }}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
          <div
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ display: "flex", alignItems: "center", padding: "0 4px", transform: "scale(0.85)" }}
            title={field.is_active ? "Deactivate field" : "Activate field"}
          >
            <Toggle checked={field.is_active} onChange={(v) => onToggleActive(field, v)} />
          </div>
        </div>
      </td>
    </tr>
  );
}

export function FieldBuilder() {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [entity, setEntity] = useState<EntityType>("lead");
  const [fields, setFields] = useState<AdminField[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [loading, setLoading] = useState(true);

  // Slide-over Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingField, setEditingField] = useState<AdminField | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugLocked, setSlugLocked] = useState(true);
  const [dataType, setDataType] = useState<CustomFieldType>("TEXT");
  const [options, setOptions] = useState<{ label: string; value: string }[]>([]);
  const [mandatoryStageId, setMandatoryStageId] = useState<string | null>(null);
  const [isTag, setIsTag] = useState(false);
  const [isUnique, setIsUnique] = useState(false);
  const [isUtm, setIsUtm] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [validationError, setValidationError] = useState("");

  // Delete Confirm State (Removed)

  const loadFields = useCallback(async () => {
    try {
      setLoading(true);
      const data = await listAdminFields(entity, { includeInactive: true });
      setFields(data);
    } catch (e) {
      toast({ title: "Failed to fetch fields", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [entity, toast]);

  const loadStages = useCallback(async () => {
    try {
      const pipeline = await PipelineService.getDefaultPipeline("leads");
      setStages(pipeline.stages ?? []);
    } catch {
      setStages([]);
    }
  }, []);

  useEffect(() => {
    void loadFields();
  }, [loadFields]);

  useEffect(() => {
    void loadStages();
  }, [loadStages]);

  const handleEntitySwitch = (newEntity: EntityType) => {
    setEntity(newEntity);
  };

  const handleAdd = () => {
    setEditingField(null);
    setName("");
    setSlug("");
    setSlugLocked(true);
    setDataType("TEXT");
    setOptions([]);
    setMandatoryStageId(null);
    setIsTag(false);
    setIsUnique(false);
    setIsUtm(false);
    setIsActive(true);
    setValidationError("");
    setPanelOpen(true);
  };

  const handleEdit = (f: AdminField) => {
    setEditingField(f);
    setName(f.label || f.name);
    setSlug(f.slug);
    setSlugLocked(true); // Always starts locked
    setDataType(f.dataType);
    setOptions(f.options || []);
    setMandatoryStageId(f.mandatory_at_stage_id || null);
    setIsTag(f.is_tag);
    setIsUnique(f.is_unique_identifier);
    setIsUtm(f.utm_capture);
    setIsActive(f.is_active);
    setValidationError("");
    setPanelOpen(true);
  };

  const handleToggleActive = async (f: AdminField, active: boolean) => {
    try {
      await updateAdminField(f._id, {
        name: f.name || f.label,
        dataType: f.dataType,
        options: f.options,
        mandatory_at_stage_id: f.mandatory_at_stage_id,
        is_tag: f.is_tag,
        is_unique_identifier: f.is_unique_identifier,
        utm_capture: f.utm_capture,
        display_order: f.display_order,
        is_active: active,
      });
      toast({ title: active ? "Field activated" : "Field deactivated", variant: "success" });
      void loadFields();
    } catch (e) {
      toast({ title: "Failed to update field status", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setValidationError("Field Name is required");
      return;
    }
    const finalType = dataType;
    if ((finalType === "DROPDOWN" || finalType === "MULTI_SELECT") && options.length === 0) {
      setValidationError("At least one option is required for dropdown/multi-select");
      return;
    }

    setValidationError("");
    setSaving(true);

    try {
      const payload: CreateFieldPayload = {
        name,
        slug: slug || slugify(name),
        dataType: finalType,
        entity_type: entity,
        options: (finalType === "DROPDOWN" || finalType === "MULTI_SELECT") ? options : undefined,
        mandatory_at_stage_id: mandatoryStageId || undefined,
        is_tag: isTag,
        is_unique_identifier: isUnique,
        utm_capture: isUtm,
        is_active: isActive,
        display_order: editingField ? editingField.display_order : fields.length,
      };

      if (editingField) {
        // Safe update
        const { slug: _s, entity_type: _e, ...updatePayload } = payload;
        await updateAdminField(editingField._id, updatePayload);
        toast({ title: "Field saved", variant: "success" });
      } else {
        await createAdminField(payload);
        toast({ title: "Field saved", variant: "success" });
      }
      setPanelOpen(false);
      void loadFields();
    } catch (e) {
      setValidationError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f._id === active.id);
    const newIndex = fields.findIndex((f) => f._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);

    try {
      await reorderAdminFields(
        reordered.map((f, i) => ({ id: f._id, display_order: i }))
      );
      toast({ title: "Order saved", variant: "success" });
    } catch (e) {
      toast({ title: "Reorder failed", description: (e as Error).message, variant: "destructive" });
      void loadFields(); // Revert
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  return (
    <>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <PageHeader
          title="Field Builder"
          subtitle="Define custom fields for leads and contacts"
          actions={
            <Button variant="primary" onClick={handleAdd}>
              <Plus size={16} strokeWidth={2} style={{ marginRight: 6 }} /> Add Field
            </Button>
          }
        />

        <div style={{ display: "flex", borderBottom: "1px solid var(--border)", marginBottom: 24 }}>
          {["lead", "contact", "deal"].map((t) => (
            <button
              key={t}
              onClick={() => handleEntitySwitch(t as EntityType)}
              style={{
                padding: "12px 16px",
                fontSize: 14,
                textTransform: "capitalize",
                fontWeight: entity === t ? 500 : 400,
                color: entity === t ? "var(--primary)" : "var(--text-muted)",
                borderBottom: entity === t ? "2px solid var(--primary)" : "2px solid transparent",
                marginBottom: "-1px",
                background: "none",
                cursor: "pointer",
              }}
            >
              {t}
            </button>
          ))}
        </div>

        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            overflow: "hidden",
            minHeight: 200,
          }}
        >
          {loading ? (
            <div style={{ padding: 48, display: "flex", justifyContent: "center", color: "var(--text-faint)" }}>
              <Loader2 size={24} className="animate-spin" />
            </div>
          ) : fields.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center" }}>
              <Blocks size={40} color="#9ca3af" style={{ margin: "0 auto 16px" }} />
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginBottom: 4 }}>
                No fields configured
              </div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
                Add your first custom field to get started.
              </div>
              <Button variant="primary" onClick={handleAdd}>
                <Plus size={16} strokeWidth={2} style={{ marginRight: 6 }} /> Add Field
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={fields.map((f) => f._id)} strategy={verticalListSortingStrategy}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f9fafb", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ width: 40, padding: "10px 14px" }}></th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase" }}>FIELD NAME</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase" }}>TYPE</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase" }}>MANDATORY AT STAGE</th>
                      <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase" }}>FLAGS</th>
                      <th style={{ padding: "10px 16px", textAlign: "right", fontSize: 12, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase" }}>ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fields.map((field) => (
                      <SortableRow
                        key={field._id}
                        field={field}
                        stages={stages}
                        onEdit={handleEdit}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </tbody>
                </table>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Slide-over Panel Overlay */}
      {panelOpen && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9000 }}>
          {/* Backdrop */}
          <div
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.2)" }}
            onClick={() => setPanelOpen(false)}
          />
          {/* Panel */}
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              width: 400,
              height: "100vh",
              background: "#ffffff",
              borderLeft: "1px solid #e5e7eb",
              boxShadow: "-4px 0 16px rgba(0,0,0,0.06)",
              display: "flex",
              flexDirection: "column",
              animation: "slide-in 200ms ease-out forwards",
            }}
          >
            {/* Header */}
            <div style={{ padding: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f3f4f6" }}>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "var(--text)", margin: 0 }}>
                {editingField ? "Edit Field" : "Add Field"}
              </h2>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>

            {/* Form Scrollable Area */}
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {validationError && (
                <div style={{ color: "#ef4444", fontSize: 13, marginBottom: 16, background: "#fef2f2", padding: "8px 12px", borderRadius: 6 }}>
                  {validationError}
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                    Field Name *
                  </label>
                  <Input
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (slugLocked && !editingField) {
                        setSlug(slugify(e.target.value));
                      }
                    }}
                    placeholder="e.g. Travel Date"
                    style={{ borderColor: (!name && validationError.includes("Name")) ? "#ef4444" : undefined }}
                  />
                </div>

                <div>
                  <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                    <span>Slug</span>
                    <button
                      type="button"
                      onClick={() => setSlugLocked(!slugLocked)}
                      style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                    >
                      {slugLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    </button>
                  </label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    disabled={slugLocked || !!editingField}
                    placeholder="travel_date"
                    style={{ fontFamily: "monospace", fontSize: 13 }}
                  />
                  <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4 }}>
                    Used in API and workflow conditions
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                    Type *
                  </label>
                  <Select
                    value={dataType}
                    onChange={(e) => setDataType((e.target as HTMLSelectElement).value as CustomFieldType)}
                  >
                    {FIELD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </div>

                {(dataType === "DROPDOWN" || dataType === "MULTI_SELECT") && (
                  <div>
                    <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                      Options
                    </label>
                    {options.map((opt, i) => (
                      <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                        <Input
                          value={opt.label}
                          onChange={(e) => {
                            const newOpts = [...options];
                            newOpts[i] = { label: e.target.value, value: slugify(e.target.value) };
                            setOptions(newOpts);
                          }}
                          placeholder="Option label"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => setOptions(options.filter((_, idx) => idx !== i))}
                          style={{ padding: "0 10px" }}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="secondary"
                      onClick={() => setOptions([...options, { label: "", value: "" }])}
                      style={{ fontSize: 13, padding: "4px 12px", height: "auto", minHeight: 32 }}
                    >
                      + Add Option
                    </Button>
                  </div>
                )}

                <div>
                  <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--text)", marginBottom: 6 }}>
                    Mandatory at Stage
                  </label>
                  <Select
                    value={mandatoryStageId || ""}
                    onChange={(e) => setMandatoryStageId((e.target as HTMLSelectElement).value || null)}
                  >
                    <option value="">Not mandatory</option>
                    {stages.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div style={{ marginTop: 16 }}>
                  <h3 style={{ fontSize: 13, fontWeight: 500, color: "#374151", margin: "0 0 8px 0" }}>
                    Field Behaviour
                  </h3>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 40, borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>Tag field</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Displays as badge on headers</div>
                    </div>
                    <Toggle checked={isTag} onChange={setIsTag} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 40, borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>Unique identifier</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Used for deduplication logic</div>
                    </div>
                    <Toggle checked={isUnique} onChange={setIsUnique} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 40, borderBottom: "1px solid #f3f4f6" }}>
                    <div>
                      <div style={{ fontSize: 13, color: "var(--text)" }}>Capture UTM parameter</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>Fills from URL params automatically</div>
                    </div>
                    <Toggle checked={isUtm} onChange={setIsUtm} />
                  </div>
                  {editingField && (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 40, borderBottom: "1px solid #f3f4f6" }}>
                      <div>
                        <div style={{ fontSize: 13, color: "var(--text)" }}>Active field</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>Is visible in forms</div>
                      </div>
                      <Toggle checked={isActive} onChange={setIsActive} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", background: "#f9fafb", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <Button variant="secondary" onClick={() => setPanelOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
          <style>{`
            @keyframes slide-in {
              from { transform: translateX(100%); }
              to { transform: translateX(0); }
            }
          `}</style>
        </div>
      )}


    </>
  );
}
