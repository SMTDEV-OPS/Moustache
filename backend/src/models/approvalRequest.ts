import { Schema, model, Document, Types } from "mongoose";

export interface IApprovalRequest extends Document {
  entityType: "ACCOUNT" | "CONTACT" | "LEAD";
  entityName: string;
  payload: unknown;
  status: "PENDING" | "APPROVED" | "REJECTED";
  submittedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId;
  reviewerNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const approvalRequestSchema = new Schema<IApprovalRequest>(
  {
    entityType: {
      type: String,
      enum: ["ACCOUNT", "CONTACT", "LEAD"],
      required: true,
    },
    entityName: {
      type: String,
      required: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      required: true,
    },
    submittedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    reviewerNotes: {
      type: String,
    },
  },
  { timestamps: true }
);

approvalRequestSchema.index({ status: 1 });
approvalRequestSchema.index({ entityType: 1, status: 1 });

export const ApprovalRequestModel = model<IApprovalRequest>("ApprovalRequest", approvalRequestSchema);
