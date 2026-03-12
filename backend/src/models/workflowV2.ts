import { Schema, model, Document, Types } from "mongoose";

export const TRIGGER_EVENTS = [
  "lead_created",
  "lead_stage_moved",
  "lead_rescored",
  "lead_field_changed",
  "lead_unattended",
  "followup_missed",
  "followup_missed_count",
  "agent_capacity_warning",
  "lead_overflow_queued",
  "lead_inactive_warning",
  "lead_inactive_critical",
  "scheduled",
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

export const ACTION_TYPES = [
  "send_whatsapp",
  "send_email",
  "create_task",
  "move_stage",
  "assign_lead",
  "notify_user",
  "update_field",
  "escalate",
  "generate_report",
  "cancel_pending_tasks",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const CONDITION_OPERATORS = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "not_in",
  "is_empty",
  "is_not_empty",
  "contains",
] as const;
export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export interface IWorkflowV2 extends Document {
  orgId: Types.ObjectId;
  name: string;
  description?: string;
  trigger_event: TriggerEvent;
  trigger_params_json?: Record<string, any>;
  is_active: boolean;
  run_once_per_lead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workflowV2Schema = new Schema<IWorkflowV2>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String },
    trigger_event: { type: String, enum: TRIGGER_EVENTS, required: true },
    trigger_params_json: { type: Schema.Types.Mixed },
    is_active: { type: Boolean, default: true },
    run_once_per_lead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workflowV2Schema.index({ orgId: 1, trigger_event: 1, is_active: 1 });
workflowV2Schema.index({ orgId: 1, name: 1 }, { unique: true });

export const WorkflowV2Model = model<IWorkflowV2>("WorkflowV2", workflowV2Schema);

// --- WorkflowCondition ---

export interface IWorkflowCondition extends Document {
  workflowId: Types.ObjectId;
  orgId: Types.ObjectId;
  field_slug: string;
  operator: ConditionOperator;
  value: string;
  logical_group: number;
  createdAt: Date;
  updatedAt: Date;
}

const workflowConditionSchema = new Schema<IWorkflowCondition>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowV2",
      required: true,
      index: true,
    },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    field_slug: { type: String, required: true },
    operator: {
      type: String,
      enum: CONDITION_OPERATORS,
      required: true,
    },
    value: { type: String, default: "" },
    logical_group: { type: Number, default: 1 },
  },
  { timestamps: true }
);

export const WorkflowConditionModel = model<IWorkflowCondition>(
  "WorkflowCondition",
  workflowConditionSchema
);

// --- WorkflowAction ---

export interface IWorkflowAction extends Document {
  workflowId: Types.ObjectId;
  orgId: Types.ObjectId;
  action_type: ActionType;
  params_json: Record<string, any>;
  delay_minutes: number;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const workflowActionSchema = new Schema<IWorkflowAction>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowV2",
      required: true,
      index: true,
    },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    action_type: {
      type: String,
      enum: ACTION_TYPES,
      required: true,
    },
    params_json: { type: Schema.Types.Mixed, default: {} },
    delay_minutes: { type: Number, default: 0 },
    order: { type: Number, required: true },
  },
  { timestamps: true }
);

workflowActionSchema.index({ workflowId: 1, order: 1 });

export const WorkflowActionModel = model<IWorkflowAction>(
  "WorkflowAction",
  workflowActionSchema
);
