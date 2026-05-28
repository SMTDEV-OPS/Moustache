import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import {
  PipelineService,
  type Pipeline,
  type PipelineStage,
} from "@/services/pipelines";
import { listAdminFields, type AdminField } from "@/services/adminFields";
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

const COLOR_PRESETS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
];

function SortableStageCard({
  stage,
  fields,
  onEdit,
  onDelete,
  canDelete,
}: {
  stage: PipelineStage;
  fields: AdminField[];
  onEdit: (s: PipelineStage) => void;
  onDelete: (s: PipelineStage) => void;
  canDelete: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stage._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const mandatorySlugs = stage.mandatory_fields_json ?? [];
  const mandatoryFields = mandatorySlugs
    .map((slug) => fields.find((f) => f.slug === slug))
    .filter(Boolean) as AdminField[];

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-60" : ""}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 16,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "16px 20px",
          marginBottom: 8,
        }}
      >
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none"
          style={{ color: "var(--text-faint)" }}
        >
          <GripVertical size={16} strokeWidth={1.5} />
        </button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text)" }}>
            {stage.name}
          </span>
          {stage.isTerminal && stage.terminalType && (
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                borderRadius: 4,
                background: "var(--border-light)",
                color: "var(--text-muted)",
              }}
            >
              {stage.terminalType}
            </span>
          )}
          {mandatoryFields.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {mandatoryFields.map((f) => (
                <span
                  key={f._id}
                  style={{
                    fontSize: 11,
                    background: "var(--border-light)",
                    color: "var(--text-muted)",
                    padding: "2px 8px",
                    borderRadius: 4,
                  }}
                >
                  {f.label || f.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={() => onEdit(stage)}
            style={{ color: "var(--text-muted)" }}
          >
            <Pencil size={14} strokeWidth={1.5} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={() => onDelete(stage)}
              style={{ color: "var(--text-muted)" }}
            >
              <Trash2 size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PipelineBuilder() {
  const { toast } = useToast();
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [fields, setFields] = useState<AdminField[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<PipelineStage | null>(null);
  const [form, setForm] = useState<Partial<PipelineStage>>({});
  const [saving, setSaving] = useState(false);

  const loadPipelines = useCallback(async () => {
    try {
      setLoading(true);
      const data = await PipelineService.getModulePipelines("leads");
      setPipelines(data);
      if (data.length > 0 && !selectedPipeline) {
        const def = data.find((p) => p.isDefault) ?? data[0];
        setSelectedPipeline(def);
      }
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadFields = useCallback(async () => {
    try {
      const data = await listAdminFields("lead");
      setFields(data);
    } catch {
      setFields([]);
    }
  }, []);

  useEffect(() => {
    void loadPipelines();
    void loadFields();
  }, [loadPipelines, loadFields]);

  useEffect(() => {
    if (selectedPipeline) {
      const s = (selectedPipeline.stages ?? []).sort((a, b) => a.order - b.order);
      setStages(s);
    } else {
      setStages([]);
    }
  }, [selectedPipeline]);

  const handleAddStage = () => {
    setEditingStage(null);
    setForm({
      name: "New Stage",
      order: stages.length,
      isTerminal: false,
      color: COLOR_PRESETS[0],
      mandatory_fields_json: [],
    });
    setModalOpen(true);
  };

  const handleEditStage = (stage: PipelineStage) => {
    setEditingStage(stage);
    setForm({
      ...stage,
      mandatory_fields_json: stage.mandatory_fields_json ?? [],
    });
    setModalOpen(true);
  };

  const handleDeleteStage = (stage: PipelineStage) => {
    if (!selectedPipeline) return;
    const next = stages.filter((s) => s._id !== stage._id).map((s, i) => ({ ...s, order: i }));
    setStages(next);
    saveStages(next);
  };

  const saveStages = async (toSave: PipelineStage[]) => {
    if (!selectedPipeline) return;
    try {
      setSaving(true);
      const payload = toSave.map((s, i) => {
        const item: any = {
          name: s.name,
          description: s.description,
          color: s.color,
          probability: s.probability ?? 0,
          isTerminal: s.isTerminal ?? false,
          terminalType: s.terminalType ?? null,
          mandatory_fields_json: s.mandatory_fields_json ?? [],
        };
        if (s._id && !s._id.startsWith("new-")) item._id = s._id;
        return item;
      });
      await PipelineService.updateStages(selectedPipeline._id, payload);
      toast({ title: "Stages saved" });
      const updated = await PipelineService.getPipeline(selectedPipeline._id);
      setSelectedPipeline(updated);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveStage = () => {
    if (!form.name) {
      toast({ title: "Stage name required", variant: "destructive" });
      return;
    }
    const mandatory = form.mandatory_fields_json ?? [];
    const newStage: PipelineStage = {
      _id: editingStage?._id ?? `new-${Date.now()}`,
      name: form.name,
      description: form.description,
      order: editingStage ? editingStage.order : stages.length,
      color: form.color ?? COLOR_PRESETS[0],
      probability: form.probability ?? 0,
      isTerminal: form.isTerminal ?? false,
      terminalType: form.terminalType,
      mandatory_fields_json: mandatory,
    };
    let next: PipelineStage[];
    if (editingStage) {
      next = stages.map((s) =>
        s._id === editingStage._id ? { ...newStage, _id: s._id } : s
      );
    } else {
      next = [...stages, { ...newStage, _id: `new-${Date.now()}` }].map((s, i) => ({
        ...s,
        order: i,
      }));
    }
    setStages(next);
    setModalOpen(false);
    saveStages(next);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s._id === active.id);
    const newIndex = stages.findIndex((s) => s._id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(stages, oldIndex, newIndex).map((s, i) => ({
      ...s,
      order: i,
    }));
    setStages(reordered);
    saveStages(reordered);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const toggleMandatoryField = (slug: string) => {
    const current = form.mandatory_fields_json ?? [];
    const next = current.includes(slug)
      ? current.filter((x) => x !== slug)
      : [...current, slug];
    setForm((p) => ({ ...p, mandatory_fields_json: next }));
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Pipeline Builder"
        subtitle="Configure your sales pipeline stages"
      />

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading...</div>
      ) : (
        <>
          {pipelines.length > 1 && (
            <div style={{ marginBottom: 16 }}>
              <Label>Pipeline</Label>
              <Select
                value={selectedPipeline?._id ?? ""}
                onChange={(e) => {
                  const p = pipelines.find((x) => x._id === e.target.value);
                  if (p) setSelectedPipeline(p);
                }}
                style={{ width: 240, marginTop: 6 }}
              >
                {pipelines.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          {selectedPipeline && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {stages.map((stage) => (
                    <SortableStageCard
                      key={stage._id}
                      stage={stage}
                      fields={fields}
                      onEdit={handleEditStage}
                      onDelete={handleDeleteStage}
                      canDelete={stages.length > 1}
                    />
                  ))}
                </SortableContext>
              </DndContext>

              <button
                type="button"
                onClick={handleAddStage}
                style={{
                  width: "100%",
                  height: 40,
                  border: "2px dashed var(--border)",
                  borderRadius: "var(--radius-md)",
                  background: "transparent",
                  color: "var(--text-muted)",
                  fontSize: 14,
                  cursor: "pointer",
                }}
                className="hover:border-[var(--primary)] hover:text-[var(--primary)]"
              >
                + Add Stage
              </button>
            </div>
          )}
        </>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ maxWidth: 420 }}>
          <DialogHeader>
            <DialogTitle>{editingStage ? "Edit Stage" : "Add Stage"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            <div>
              <Label>Stage Name</Label>
              <Input
                value={form.name ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Qualified"
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Label>Is Terminal</Label>
              <Switch
                checked={form.isTerminal ?? false}
                onCheckedChange={(v) =>
                  setForm((p) => ({
                    ...p,
                    isTerminal: v,
                    terminalType: v ? (p.terminalType ?? "LOST") : undefined,
                  }))
                }
              />
            </div>
            {form.isTerminal && (
              <div>
                <Label>Terminal Type</Label>
                <Select
                  value={form.terminalType ?? "LOST"}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      terminalType: e.target.value as "WON" | "LOST",
                    }))
                  }
                >
                  <option value="WON">Won</option>
                  <option value="LOST">Lost</option>
                </Select>
              </div>
            )}
            <div>
              <Label>Mandatory Fields</Label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                  marginTop: 8,
                  maxHeight: 120,
                  overflowY: "auto",
                }}
              >
                {fields.map((f) => {
                  const selected = (form.mandatory_fields_json ?? []).includes(f.slug);
                  return (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => toggleMandatoryField(f.slug)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 4,
                        fontSize: 12,
                        border: "1px solid var(--border)",
                        background: selected ? "var(--primary-light)" : "var(--surface)",
                        color: selected ? "var(--primary)" : "var(--text)",
                      }}
                    >
                      {f.label || f.name} {selected && "×"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <Label>Color</Label>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, color: c }))}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background: c,
                      border:
                        (form.color ?? COLOR_PRESETS[0]) === c
                          ? "2px solid var(--primary)"
                          : "1px solid var(--border)",
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveStage} disabled={saving}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
