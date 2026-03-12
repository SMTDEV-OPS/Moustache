import { Schema, model, Document, Types } from "mongoose";

export const WORKFLOW_EXECUTION_STATUS = [
  "started",
  "completed",
  "failed",
  "skipped",
] as const;
export type WorkflowExecutionStatus = (typeof WORKFLOW_EXECUTION_STATUS)[number];

export interface IWorkflowExecutionLog extends Document {
  workflowId: Types.ObjectId;
  leadId: Types.ObjectId;
  orgId: Types.ObjectId;
  trigger_event: string;
  status: WorkflowExecutionStatus;
  conditions_result: boolean;
  actions_summary_json: Array<{
    action_id: string;
    status: string;
    error?: string;
  }>;
  executed_at: Date;
  dry_run: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const workflowExecutionLogSchema = new Schema<IWorkflowExecutionLog>(
  {
    workflowId: {
      type: Schema.Types.ObjectId,
      ref: "WorkflowV2",
      required: true,
      index: true,
    },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true },
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    trigger_event: { type: String, required: true },
    status: {
      type: String,
      enum: WORKFLOW_EXECUTION_STATUS,
      required: true,
    },
    conditions_result: { type: Boolean },
    actions_summary_json: {
      type: [
        {
          action_id: String,
          status: String,
          error: String,
        },
      ],
      default: [],
    },
    executed_at: { type: Date, default: Date.now },
    dry_run: { type: Boolean, default: false },
  },
  { timestamps: true }
);

workflowExecutionLogSchema.index({ workflowId: 1, leadId: 1, status: 1 });
workflowExecutionLogSchema.index({ leadId: 1 });
workflowExecutionLogSchema.index({ orgId: 1, executed_at: -1 });

export const WorkflowExecutionLogModel = model<IWorkflowExecutionLog>(
  "WorkflowExecutionLog",
  workflowExecutionLogSchema
);
