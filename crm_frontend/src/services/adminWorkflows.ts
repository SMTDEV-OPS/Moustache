import { API_BASE_URL, withAuthHeaders } from "./api";

export type TriggerEvent =
  | "lead_created"
  | "lead_stage_moved"
  | "lead_rescored"
  | "lead_field_changed"
  | "lead_unattended"
  | "followup_missed"
  | "followup_missed_count"
  | "agent_capacity_warning"
  | "lead_overflow_queued"
  | "lead_inactive_warning"
  | "lead_inactive_critical"
  | "scheduled";

export type ActionType =
  | "send_whatsapp"
  | "send_email"
  | "create_task"
  | "move_stage"
  | "assign_lead"
  | "notify_user"
  | "update_field"
  | "escalate"
  | "generate_report"
  | "cancel_pending_tasks";

export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "in"
  | "not_in"
  | "is_empty"
  | "is_not_empty"
  | "contains";

export interface WorkflowCondition {
  _id?: string;
  field_slug: string;
  operator: ConditionOperator;
  value: string;
  logical_group: number;
}

export interface WorkflowAction {
  _id?: string;
  action_type: ActionType;
  params_json: Record<string, any>;
  delay_minutes: number;
  order: number;
}

export interface AdminWorkflow {
  _id: string;
  orgId: string;
  name: string;
  description?: string;
  trigger_event: TriggerEvent;
  trigger_params_json?: Record<string, any>;
  is_active: boolean;
  run_once_per_lead: boolean;
  conditions: WorkflowCondition[];
  actions: WorkflowAction[];
}

export interface CreateWorkflowPayload {
  orgId?: string;
  name: string;
  description?: string;
  trigger_event: TriggerEvent;
  trigger_params_json?: Record<string, any>;
  is_active?: boolean;
  run_once_per_lead?: boolean;
  conditions?: WorkflowCondition[];
  actions?: WorkflowAction[];
}

export interface UpdateWorkflowPayload extends Partial<CreateWorkflowPayload> {}

export interface WorkflowTestResult {
  conditions_passed?: boolean;
  conditions_result?: any;
  actions_would_run?: any[];
}

const BASE = `${API_BASE_URL}/api/admin/workflows`;

export async function listAdminWorkflows(): Promise<AdminWorkflow[]> {
  const response = await fetch(BASE, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch workflows");
  }
  const raw = (await response.json()) as any[];
  return raw.map(normalizeWorkflow);
}

export async function getAdminWorkflow(id: string): Promise<AdminWorkflow> {
  const response = await fetch(`${BASE}/${id}`, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch workflow");
  }
  return normalizeWorkflow(await response.json());
}

export async function createAdminWorkflow(payload: CreateWorkflowPayload): Promise<AdminWorkflow> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create workflow");
  }
  return normalizeWorkflow(await response.json());
}

export async function updateAdminWorkflow(id: string, payload: UpdateWorkflowPayload): Promise<AdminWorkflow> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update workflow");
  }
  return normalizeWorkflow(await response.json());
}

export async function deleteAdminWorkflow(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to delete workflow");
  }
}

export async function testAdminWorkflow(id: string, leadId: string): Promise<WorkflowTestResult> {
  const response = await fetch(`${BASE}/${id}/test`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ leadId }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Test failed");
  }
  return response.json();
}

function normalizeWorkflow(w: any): AdminWorkflow {
  return {
    _id: w._id,
    orgId: typeof w.orgId === "string" ? w.orgId : w.orgId?.toString?.(),
    name: w.name,
    description: w.description,
    trigger_event: w.trigger_event,
    trigger_params_json: w.trigger_params_json ?? w.triggerParamsJson ?? {},
    is_active: w.is_active ?? w.isActive ?? true,
    run_once_per_lead: w.run_once_per_lead ?? w.runOncePerLead ?? false,
    conditions: (w.conditions ?? []).map((c: any) => ({
      _id: c._id,
      field_slug: c.field_slug,
      operator: c.operator,
      value: c.value ?? "",
      logical_group: c.logical_group ?? 1,
    })),
    actions: (w.actions ?? []).map((a: any) => ({
      _id: a._id,
      action_type: a.action_type,
      params_json: a.params_json ?? a.paramsJson ?? {},
      delay_minutes: a.delay_minutes ?? a.delayMinutes ?? 0,
      order: a.order ?? 0,
    })),
  };
}
