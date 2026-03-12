import { Schema, model, Document, Types } from "mongoose";

export const PENDING_ACTION_STATUS = [
  "pending",
  "executing",
  "completed",
  "failed",
] as const;
export type PendingActionStatus = (typeof PENDING_ACTION_STATUS)[number];

export interface IPendingWorkflowAction extends Document {
  workflowId: Types.ObjectId;
  leadId: Types.ObjectId;
  orgId: Types.ObjectId;
  workflowActionId: Types.ObjectId;
  lead_context_snapshot: Record<string, any>;
  execute_at: Date;
  status: PendingActionStatus;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const pendingWorkflowActionSchema = new Schema<IPendingWorkflowAction>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowV2",
      required: true,
      index: true,
    },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    workflowActionId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowAction",
      required: true,
    },
    lead_context_snapshot: { type: Schema.Types.Mixed, default: {} },
    execute_at: { type: Date, required: true },
    status: {
      type: String,
      enum: PENDING_ACTION_STATUS,
      default: "pending",
    },
    error: { type: String },
  },
  { timestamps: true }
);

pendingWorkflowActionSchema.index({ status: 1, execute_at: 1 });

export const PendingWorkflowActionModel = model<IPendingWorkflowAction>(
  "PendingWorkflowAction",
  pendingWorkflowActionSchema
);
