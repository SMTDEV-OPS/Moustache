import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  listFollowupRules,
  createFollowupRule,
  updateFollowupRule,
  deleteFollowupRule,
  type FollowupRule,
  type FollowupBucket,
} from "@/services/adminFollowupRules";
import { listTemplates, type Template } from "@/services/templates";
import { PageHeader, Button, Input, Select } from "@/components/shared";
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

const BUCKETS: FollowupBucket[] = ["Hot", "Warm", "Cold", "Inactive"];

const HEAT_STYLES: Record<FollowupBucket, { bg: string; text: string }> = {
  Hot: { bg: "var(--hot-bg)", text: "var(--hot-text)" },
  Warm: { bg: "var(--warm-bg)", text: "var(--warm-text)" },
  Cold: { bg: "var(--cold-bg)", text: "var(--cold-text)" },
  Inactive: { bg: "var(--border-light)", text: "var(--text-muted)" },
};

function formatOffset(rule: FollowupRule): string {
  if (rule.offset_hours != null && rule.offset_hours > 0) {
    return `${rule.offset_hours} hour${rule.offset_hours !== 1 ? "s" : ""}`;
  }
  if (rule.offset_days != null && rule.offset_days > 0) {
    return `${rule.offset_days} day${rule.offset_days !== 1 ? "s" : ""}`;
  }
  return "—";
}

export function FollowupRules() {
  const { toast } = useToast();
  const [grouped, setGrouped] = useState<Record<FollowupBucket, FollowupRule[]>>({
    Hot: [],
    Warm: [],
    Cold: [],
    Inactive: [],
  });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);
  const [selectedBucket, setSelectedBucket] = useState<FollowupBucket | null>(null);
  const [form, setForm] = useState<Partial<FollowupRule>>({});

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [rules, tmpl] = await Promise.all([
        listFollowupRules(),
        listTemplates(),
      ]);
      setGrouped(rules);
      setTemplates(tmpl);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddRule = (bucket: FollowupBucket) => {
    setSelectedBucket(bucket);
    const rules = grouped[bucket];
    const nextNum = rules.length > 0 ? Math.max(...rules.map((r) => r.followup_number)) + 1 : 1;
    setEditingRule(null);
    setForm({
      bucket,
      followup_number: nextNum,
      offset_hours: 2,
      offset_days: undefined,
      description: "",
      template_id: undefined,
      is_active: true,
      display_order: rules.length,
    });
    setModalOpen(true);
  };

  const handleEditRule = (rule: FollowupRule) => {
    setSelectedBucket(rule.bucket);
    setEditingRule(rule);
    setForm({ ...rule });
    setModalOpen(true);
  };

  const handleSaveRule = async () => {
    if (!form.bucket || !form.followup_number) {
      toast({ title: "Bucket and follow-up # required", variant: "destructive" });
      return;
    }
    const hasHours = form.offset_hours != null && form.offset_hours > 0;
    const hasDays = form.offset_days != null && form.offset_days > 0;
    if (hasHours && hasDays) {
      toast({ title: "Use hours OR days, not both", variant: "destructive" });
      return;
    }
    if (!hasHours && !hasDays) {
      toast({ title: "Specify offset (hours or days)", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        bucket: form.bucket,
        followup_number: form.followup_number,
        offset_hours: hasHours ? form.offset_hours : null,
        offset_days: hasDays ? form.offset_days : null,
        description: form.description ?? "",
        template_id: form.template_id ?? undefined,
        is_active: form.is_active ?? true,
        display_order: form.display_order ?? 0,
      };
      if (editingRule) {
        await updateFollowupRule(editingRule._id, payload);
        toast({ title: "Rule updated" });
      } else {
        await createFollowupRule(payload);
        toast({ title: "Rule created" });
      }
      setModalOpen(false);
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDeleteRule = async (rule: FollowupRule) => {
    if (!confirm("Delete this rule?")) return;
    try {
      await deleteFollowupRule(rule._id);
      toast({ title: "Rule deleted" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Follow-up Rules"
        subtitle="Auto-schedule follow-ups by lead quality"
      />

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
          {BUCKETS.map((bucket) => {
            const rules = grouped[bucket] ?? [];
            const style = HEAT_STYLES[bucket];
            return (
              <section key={bucket}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span
                    style={{
                      padding: "6px 12px",
                      borderRadius: "var(--radius)",
                      background: style.bg,
                      color: style.text,
                      fontSize: 14,
                      fontWeight: 600,
                    }}
                  >
                    {bucket}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--border-light)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {rules.length} rules
                  </span>
                </div>
                <div
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    overflow: "hidden",
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--border-light)" }}>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>#</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>OFFSET</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>DESCRIPTION</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>TEMPLATE</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ACTIVE</th>
                        <th style={{ padding: "10px 16px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((rule) => (
                        <tr key={rule._id} style={{ height: 48 }}>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{rule.followup_number}</td>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{formatOffset(rule)}</td>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{rule.description ?? "—"}</td>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14, color: "var(--text-muted)" }}>
                            {rule.template_id ? templates.find((t) => t.id === rule.template_id)?.name ?? "—" : "None"}
                          </td>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", fontSize: 14 }}>{rule.is_active ? "Yes" : "No"}</td>
                          <td style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                            <div style={{ display: "flex", gap: 8 }}>
                              <button type="button" onClick={() => handleEditRule(rule)}>
                                <Pencil size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                              </button>
                              <button type="button" onClick={() => handleDeleteRule(rule)}>
                                <Trash2 size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAddRule(bucket)}
                  style={{ marginTop: 8, fontSize: 13 }}
                >
                  <Plus size={14} style={{ marginRight: 6 }} />
                  Add Rule
                </Button>
              </section>
            );
          })}
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRule ? "Edit Rule" : "Add Rule"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
            <div>
              <Label>Bucket</Label>
              <Select
                value={form.bucket ?? selectedBucket ?? "Hot"}
                onChange={(e) => setForm((p) => ({ ...p, bucket: e.target.value as FollowupBucket }))}
              >
                {BUCKETS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Follow-up #</Label>
              <Input
                type="number"
                value={String(form.followup_number ?? 1)}
                onChange={(e) => setForm((p) => ({ ...p, followup_number: parseInt(e.target.value, 10) || 1 }))}
              />
            </div>
            <div>
              <Label>Offset</Label>
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>Use hours OR days, not both</p>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <Label style={{ fontSize: 12 }}>Hours</Label>
                  <Input
                    type="number"
                    value={form.offset_hours != null ? String(form.offset_hours) : ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        offset_hours: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        offset_days: undefined,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <Label style={{ fontSize: 12 }}>Days</Label>
                  <Input
                    type="number"
                    value={form.offset_days != null ? String(form.offset_days) : ""}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        offset_days: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        offset_hours: undefined,
                      }))
                    }
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={form.description ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <div>
              <Label>Template</Label>
              <Select
                value={form.template_id ?? ""}
                onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value || undefined }))}
              >
                <option value="">None</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Label>Is Active</Label>
              <Switch
                checked={form.is_active ?? true}
                onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSaveRule}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
