import { Schema, model, Document, Types } from "mongoose";
import { LeadRef, UserRef } from "./common";

export type WorkflowStepStatus = "PENDING" | "EXECUTED" | "SKIPPED";

export interface IStepExecutionDetail {
  medium: "CALL" | "EMAIL" | "WHATSAPP";
  mode: "AUTO" | "MANUAL";
  taskId?: Types.ObjectId; // If reminder task was created
  communicationId?: Types.ObjectId; // If message was sent
}

export interface IStepExecution {
  stepNumber: number;
  scheduledAt: Date;
  executedAt?: Date;
  status: WorkflowStepStatus;
  executionDetails?: IStepExecutionDetail[];
  outcome?: string; // Custom outcome selected by user
  outcomeNote?: string;
  outcomeRecordedAt?: Date;
  outcomeRecordedByUserId?: Types.ObjectId;
}

export interface ILeadWorkflowState extends Document {
  leadId: Types.ObjectId;
  workflowId: Types.ObjectId;
  currentStepNumber: number;
  stepExecutions: IStepExecution[];
  isCompleted: boolean;
  isPaused: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const stepExecutionDetailSchema = new Schema<IStepExecutionDetail>(
  {
    medium: {
      type: String,
      enum: ["CALL", "EMAIL", "WHATSAPP"],
      required: true,
    },
    mode: {
      type: String,
      enum: ["AUTO", "MANUAL"],
      required: true,
    },
    taskId: { type: Schema.Types.ObjectId, ref: "Task" },
    communicationId: { type: Schema.Types.ObjectId, ref: "Communication" },
  },
  { _id: false }
);

const stepExecutionSchema = new Schema<IStepExecution>(
  {
    stepNumber: { type: Number, required: true },
    scheduledAt: { type: Date, required: true },
    executedAt: { type: Date },
    status: {
      type: String,
      enum: ["PENDING", "EXECUTED", "SKIPPED"],
      default: "PENDING",
    },
    executionDetails: { type: [stepExecutionDetailSchema], default: [] },
    outcome: { type: String },
    outcomeNote: { type: String },
    outcomeRecordedAt: { type: Date },
    outcomeRecordedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { _id: false }
);

const leadWorkflowStateSchema = new Schema<ILeadWorkflowState>(
  {
    leadId: { ...LeadRef, required: true, unique: true },
    workflowId: { type: Schema.Types.ObjectId, ref: "Workflow", required: true },
    currentStepNumber: { type: Number, default: 1 },
    stepExecutions: { type: [stepExecutionSchema], default: [] },
    isCompleted: { type: Boolean, default: false, index: true },
    isPaused: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Index for finding pending workflow steps
leadWorkflowStateSchema.index({
  isCompleted: 1,
  isPaused: 1,
  "stepExecutions.status": 1,
  "stepExecutions.scheduledAt": 1,
});

export const LeadWorkflowStateModel = model<ILeadWorkflowState>(
  "LeadWorkflowState",
  leadWorkflowStateSchema
);

