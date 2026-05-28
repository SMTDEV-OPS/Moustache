import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Play } from "lucide-react";
import {
  listAdminWorkflows,
  createAdminWorkflow,
  updateAdminWorkflow,
  deleteAdminWorkflow,
  testAdminWorkflow,
  type AdminWorkflow,
  type TriggerEvent,
  type ActionType,
} from "@/services/adminWorkflows";
import { listAdminFields, type AdminField } from "@/services/adminFields";
import { PipelineService, type PipelineStage } from "@/services/pipelines";
import { listTemplates } from "@/services/templates";
import { listUsers } from "@/services/users";
import { listGroups, type Group } from "@/services/groups";
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

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead Created",
  lead_stage_moved: "Lead Stage Moved",
  lead_rescored: "Lead Re-scored",
  lead_field_changed: "Field Changed",
  lead_unattended: "Lead Unattended",
  followup_missed: "Follow-up Missed",
  followup_missed_count: "After N missed follow-ups",
  agent_capacity_warning: "Agent Capacity Warning",
  lead_overflow_queued: "Lead Overflow Queued",
  lead_inactive_warning: "Lead Inactive Warning",
  lead_inactive_critical: "Lead Inactive Critical",
  scheduled: "Scheduled",
};

const ACTION_LABELS: Record<string, string> = {
  send_whatsapp: "Send WhatsApp",
  send_email: "Send Email",
  create_task: "Create Task",
  move_stage: "Move Stage",
  assign_lead: "Assign Lead",
  notify_user: "Notify User",
  update_field: "Update Field",
  escalate: "Escalate",
  generate_report: "Generate Report",
  cancel_pending_tasks: "Cancel Pending Tasks",
};

export function WorkflowBuilder() {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<AdminWorkflow[]>([]);
  const [fields, setFields] = useState<AdminField[]>([]);
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<AdminWorkflow | null>(null);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<Partial<AdminWorkflow>>({});
  const [testLeadId, setTestLeadId] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [wfList, fList, pipeline, groupList] = await Promise.all([
        listAdminWorkflows(),
        listAdminFields("lead"),
        PipelineService.getDefaultPipeline("leads").catch(() => ({ stages: [] })),
        listGroups().catch(() => []),
      ]);
      setWorkflows(wfList);
      setFields(fList);
      setStages(pipeline.stages ?? []);
      setGroups(groupList);
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleNew = () => {
    setEditingWorkflow(null);
    setStep(1);
    setForm({
      name: "",
      description: "",
      trigger_event: "lead_created",
      trigger_params_json: {},
      is_active: true,
      run_once_per_lead: false,
      conditions: [],
      actions: [],
    });
    setModalOpen(true);
  };

  const handleEdit = (wf: AdminWorkflow) => {
    setEditingWorkflow(wf);
    setStep(1);
    setForm({ ...wf });
    setModalOpen(true);
  };

  const handleToggleActive = async (wf: AdminWorkflow) => {
    try {
      await updateAdminWorkflow(wf._id, { is_active: !wf.is_active });
      toast({ title: wf.is_active ? "Workflow deactivated" : "Workflow activated" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (wf: AdminWorkflow) => {
    if (!confirm(`Deactivate workflow "${wf.name}"?`)) return;
    try {
      await deleteAdminWorkflow(wf._id);
      toast({ title: "Workflow deactivated" });
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleTest = async (wf: AdminWorkflow) => {
    const lid = testLeadId || prompt("Enter lead ID for dry run test:");
    if (!lid) return;
    try {
      const result = await testAdminWorkflow(wf._id, lid);
      setTestResult({ workflow: wf, result });
      setTestLeadId(lid);
    } catch (e) {
      toast({ title: "Test failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }
    try {
      const payload = {
        name: form.name!,
        description: form.description,
        trigger_event: form.trigger_event!,
        trigger_params_json: form.trigger_params_json ?? {},
        is_active: form.is_active ?? true,
        run_once_per_lead: form.run_once_per_lead ?? false,
        conditions: form.conditions ?? [],
        actions: (form.actions ?? []).map((a, i) => ({ ...a, order: i })),
      };
      if (editingWorkflow) {
        await updateAdminWorkflow(editingWorkflow._id, payload);
        toast({ title: "Workflow updated" });
      } else {
        await createAdminWorkflow(payload);
        toast({ title: "Workflow created" });
      }
      setModalOpen(false);
      void load();
    } catch (e) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Workflow Builder"
        subtitle="Automate lead actions with event-driven workflows"
        actions={
          <Button variant="primary" icon={Plus} onClick={handleNew}>
            New Workflow
          </Button>
        }
      />

      <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
        <Input
          placeholder="Lead ID for test"
          value={testLeadId}
          onChange={(e) => setTestLeadId(e.target.value)}
          style={{ width: 200 }}
        />
      </div>

      {loading ? (
        <div style={{ color: "var(--text-muted)", padding: 32 }}>Loading...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {workflows.map((wf) => (
            <div
              key={wf._id}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <Switch
                checked={wf.is_active}
                onCheckedChange={() => handleToggleActive(wf)}
              />
              <span style={{ fontSize: 14, fontWeight: 500, flex: 1, minWidth: 120 }}>
                {wf.name}
              </span>
              <span
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--primary-light)",
                  color: "var(--primary)",
                }}
              >
                {TRIGGER_LABELS[wf.trigger_event] ?? wf.trigger_event}
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
                {wf.conditions?.length ?? 0} conditions
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
                {wf.actions?.length ?? 0} actions
              </span>
              <Button variant="secondary" size="sm" onClick={() => handleTest(wf)}>
                <Play size={14} style={{ marginRight: 6 }} />
                Test
              </Button>
              <button type="button" onClick={() => handleEdit(wf)}>
                <Pencil size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              </button>
              <button type="button" onClick={() => handleDelete(wf)}>
                <Trash2 size={14} strokeWidth={1.5} style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {testResult && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Dry Run Results</h3>
          <pre style={{ fontSize: 13, fontFamily: "monospace", whiteSpace: "pre-wrap", color: "var(--text-muted)" }}>
            {JSON.stringify(testResult.result, null, 2)}
          </pre>
        </div>
      )}

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ maxWidth: 800 }}>
          <DialogHeader>
            <DialogTitle>{editingWorkflow ? "Edit Workflow" : "New Workflow"}</DialogTitle>
          </DialogHeader>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {[1, 2, 3, 4].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStep(s)}
                style={{
                  padding: "6px 12px",
                  borderRadius: 4,
                  border: "1px solid var(--border)",
                  background: step === s ? "var(--primary)" : "transparent",
                  color: step === s ? "white" : "var(--text)",
                  fontSize: 13,
                }}
              >
                Step {s}
              </button>
            ))}
          </div>

          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Name</Label>
                <Input value={form.name ?? ""} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <Label>Description</Label>
                <textarea
                  value={form.description ?? ""}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  style={{
                    width: "100%",
                    padding: 10,
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Label>Is Active</Label>
                <Switch
                  checked={form.is_active ?? true}
                  onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <Label>Trigger Event</Label>
                <Select
                  value={form.trigger_event ?? "lead_created"}
                  onChange={(e) => setForm((p) => ({ ...p, trigger_event: e.target.value as TriggerEvent }))}
                >
                  {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </Select>
              </div>
              {(form.trigger_event === "lead_unattended" || form.trigger_event === "scheduled" || form.trigger_event === "followup_missed_count") && (
                <div>
                  {form.trigger_event === "lead_unattended" && (
                    <>
                      <Label>Idle for (minutes)</Label>
                      <Input
                        type="number"
                        value={String((form.trigger_params_json as any)?.idle_minutes ?? 15)}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            trigger_params_json: { ...(p.trigger_params_json ?? {}), idle_minutes: parseInt(e.target.value, 10) || 15 },
                          }))
                        }
                      />
                    </>
                  )}
                  {form.trigger_event === "scheduled" && (
                    <>
                      <Label>Cron expression</Label>
                      <Input
                        value={(form.trigger_params_json as any)?.cron ?? "0 9 * * *"}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            trigger_params_json: { ...(p.trigger_params_json ?? {}), cron: e.target.value },
                          }))
                        }
                      />
                    </>
                  )}
                  {form.trigger_event === "followup_missed_count" && (
                    <>
                      <Label>After N missed follow-ups</Label>
                      <Input
                        type="number"
                        value={String((form.trigger_params_json as any)?.count ?? 1)}
                        onChange={(e) =>
                          setForm((p) => ({
                            ...p,
                            trigger_params_json: { ...(p.trigger_params_json ?? {}), count: parseInt(e.target.value, 10) || 1 },
                          }))
                        }
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <p style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Conditions in same group = AND. Different groups = OR.
              </p>
              {(form.conditions ?? []).map((c, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <Select
                    value={c.field_slug}
                    onChange={(e) =>
                      setForm((p) => {
                        const cond = [...(p.conditions ?? [])];
                        cond[i] = { ...cond[i], field_slug: e.target.value };
                        return { ...p, conditions: cond };
                      })
                    }
                    style={{ flex: 1 }}
                  >
                    {fields.map((f) => (
                      <option key={f._id} value={f.slug}>{f.label || f.name}</option>
                    ))}
                  </Select>
                  <Select
                    value={c.operator}
                    onChange={(e) =>
                      setForm((p) => {
                        const cond = [...(p.conditions ?? [])];
                        cond[i] = { ...cond[i], operator: e.target.value as any };
                        return { ...p, conditions: cond };
                      })
                    }
                    style={{ width: 120 }}
                  >
                    <option value="eq">equals</option>
                    <option value="neq">not equals</option>
                    <option value="gt">&gt;</option>
                    <option value="gte">≥</option>
                    <option value="lt">&lt;</option>
                    <option value="lte">≤</option>
                    <option value="contains">contains</option>
                    <option value="is_empty">is empty</option>
                  </Select>
                  <Input
                    value={c.value}
                    onChange={(e) =>
                      setForm((p) => {
                        const cond = [...(p.conditions ?? [])];
                        cond[i] = { ...cond[i], value: e.target.value };
                        return { ...p, conditions: cond };
                      })
                    }
                    placeholder="Value"
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setForm((p) => ({
                        ...p,
                        conditions: (p.conditions ?? []).filter((_, j) => j !== i),
                      }))
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    conditions: [...(p.conditions ?? []), { field_slug: fields[0]?.slug ?? "", operator: "eq" as const, value: "", logical_group: 1 }],
                  }))
                }
              >
                Add Condition
              </Button>
            </div>
          )}

          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(form.actions ?? []).map((a, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, border: "1px solid var(--border)", borderRadius: 6 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <Select
                      value={a.action_type}
                      onChange={(e) =>
                        setForm((p) => {
                          const acts = [...(p.actions ?? [])];
                          acts[i] = { ...acts[i], action_type: e.target.value as ActionType, params_json: {} };
                          return { ...p, actions: acts };
                        })
                      }
                      style={{ width: 160 }}
                    >
                      {Object.entries(ACTION_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </Select>
                    <Input
                      type="number"
                      placeholder="Delay (min)"
                      value={String(a.delay_minutes ?? 0)}
                      onChange={(e) =>
                        setForm((p) => {
                          const acts = [...(p.actions ?? [])];
                          acts[i] = { ...acts[i], delay_minutes: parseInt(e.target.value, 10) || 0 };
                          return { ...p, actions: acts };
                        })
                      }
                      style={{ width: 80 }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((p) => ({
                          ...p,
                          actions: (p.actions ?? []).filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                    {a.action_type === "send_whatsapp" && (
                      <>
                        <Input
                          placeholder="Template name or ID"
                          value={a.params_json?.templateId || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, templateId: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        />
                        <Select
                          value={a.params_json?.recipient || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, recipient: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Recipient...</option>
                          <option value="Lead Mobile">Lead Mobile</option>
                          <option value="Agent Mobile">Agent Mobile</option>
                        </Select>
                      </>
                    )}
                    {a.action_type === "send_email" && (
                      <>
                        <Input
                          placeholder="Template ID"
                          value={a.params_json?.templateId || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, templateId: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        />
                        <Select
                          value={a.params_json?.recipient || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, recipient: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Recipient...</option>
                          <option value="Lead Email">Lead Email</option>
                          <option value="Agent Email">Agent Email</option>
                          <option value="TL Email">TL Email</option>
                        </Select>
                      </>
                    )}
                    {a.action_type === "create_task" && (
                      <>
                        <Input
                          placeholder="Title (required)"
                          value={a.params_json?.title || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, title: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        />
                        <Select
                          value={a.params_json?.assignTo || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, assignTo: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Assign To...</option>
                          <option value="Agent">Agent</option>
                          <option value="TL">TL</option>
                          <option value="Manager">Manager</option>
                        </Select>
                        <Input
                          type="number"
                          placeholder="Due in hours"
                          min={1}
                          value={a.params_json?.dueInHours || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, dueInHours: parseInt(e.target.value, 10) } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px", width: 120 }}
                        />
                        <Input
                          placeholder="Description (optional)"
                          value={a.params_json?.description || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, description: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        />
                      </>
                    )}
                    {a.action_type === "move_stage" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <Select
                          value={a.params_json?.stage || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, stage: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Stage...</option>
                          {stages.map(st => <option key={st._id} value={st.name}>{st.name}</option>)}
                        </Select>
                        <span style={{ fontSize: 12, color: "#6b7280" }}>Stage gate validation will apply</span>
                      </div>
                    )}
                    {a.action_type === "notify_user" && (
                      <>
                        <Select
                          value={a.params_json?.recipient || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, recipient: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Recipient...</option>
                          <option value="TL">TL</option>
                          <option value="Manager">Manager</option>
                          <option value="Assigned Agent">Assigned Agent</option>
                        </Select>
                        <Select
                          value={a.params_json?.channel || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, channel: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Channel...</option>
                          <option value="In-App">In-App</option>
                          <option value="Email">Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                        </Select>
                        <textarea
                          placeholder="Message"
                          rows={2}
                          value={a.params_json?.message || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, message: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 14, padding: "6px 10px", width: "100%", resize: "vertical" }}
                        />
                      </>
                    )}
                    {a.action_type === "assign_lead" && (
                      <>
                        <Select
                          value={a.params_json?.strategy || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, strategy: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Strategy...</option>
                          <option value="Min Open Leads">Min Open Leads</option>
                          <option value="Round Robin">Round Robin</option>
                        </Select>
                        <Select
                          value={a.params_json?.team || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, team: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Team...</option>
                          {groups.map((g: any) => <option key={g._id} value={g.name}>{g.name}</option>)}
                        </Select>
                      </>
                    )}
                    {a.action_type === "update_field" && (
                      <>
                        <Select
                          value={a.params_json?.field || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, field: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Field...</option>
                          {fields.map(f => <option key={f._id} value={f.slug}>{f.name}</option>)}
                        </Select>
                        <Input
                          placeholder="Value"
                          value={a.params_json?.value || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, value: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        />
                      </>
                    )}
                    {a.action_type === "escalate" && (
                      <>
                        <Select
                          value={a.params_json?.toRole || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, toRole: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Role...</option>
                          <option value="TL">TL</option>
                          <option value="Manager">Manager</option>
                        </Select>
                        <textarea
                          placeholder="Message"
                          rows={2}
                          value={a.params_json?.message || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, message: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 14, padding: "6px 10px", width: "100%", resize: "vertical" }}
                        />
                      </>
                    )}
                    {a.action_type === "cancel_pending_tasks" && (
                      <>
                        <Select
                          value={a.params_json?.taskType || ""}
                          onChange={(e) => setForm((p) => { const acts = [...(p.actions ?? [])]; acts[i] = { ...acts[i], params_json: { ...acts[i].params_json, taskType: e.target.value } }; return { ...p, actions: acts }; })}
                          style={{ border: "1px solid #e5e7eb", borderRadius: 6, height: 34, fontSize: 14, padding: "0 10px" }}
                        >
                          <option value="">Select Task Type...</option>
                          <option value="Follow-up Tasks">Follow-up Tasks</option>
                          <option value="All Tasks">All Tasks</option>
                        </Select>
                      </>
                    )}
                    {a.action_type === "generate_report" && (
                      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: 12, padding: "8px 12px", borderRadius: 6 }}>
                        Report action is not yet fully implemented.
                      </div>
                    )}
                    {!["send_whatsapp", "send_email", "create_task", "move_stage", "notify_user", "assign_lead", "update_field", "escalate", "cancel_pending_tasks", "generate_report"].includes(a.action_type) && (
                      <div></div>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    actions: [...(p.actions ?? []), { action_type: "create_task" as const, params_json: {}, delay_minutes: 0, order: (p.actions ?? []).length }],
                  }))
                }
              >
                Add Action
              </Button>
            </div>
          )}

          <DialogFooter>
            {step > 1 && (
              <Button variant="ghost" onClick={() => setStep(step - 1)}>
                Back
              </Button>
            )}
            {step < 4 ? (
              <Button variant="primary" onClick={() => setStep(step + 1)}>
                Next
              </Button>
            ) : (
              <Button variant="primary" onClick={handleSave}>
                Save
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
