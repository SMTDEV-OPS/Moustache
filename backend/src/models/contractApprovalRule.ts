import mongoose, { Schema, Document } from "mongoose";

export type ApprovalRuleConditionField =
  | "propertyId"
  | "channel"
  | "contractValue"
  | "accountType"
  | "organisationType";

export type ApprovalRuleOperator = "eq" | "neq" | "in" | "not_in";

export interface IApprovalStep {
  step: number;
  approverType: "specific_user" | "role" | "reports_to_submitter";
  approverUserId?: mongoose.Types.ObjectId;
  approverRoleId?: mongoose.Types.ObjectId;
  label?: string;
}

export interface IContractApprovalRule extends Document {
  name: string;
  description?: string;
  priority: number;
  condition_field: ApprovalRuleConditionField;
  condition_operator: ApprovalRuleOperator;
  condition_value: string | string[];
  applyToAll: boolean;
  approvalSteps: IApprovalStep[];
  is_active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const approvalStepSchema = new Schema<IApprovalStep>(
  {
    step: { type: Number, required: true },
    approverType: {
      type: String,
      enum: ["specific_user", "role", "reports_to_submitter"],
      required: true,
    },
    approverUserId: { type: Schema.Types.ObjectId, ref: "User" },
    approverRoleId: { type: Schema.Types.ObjectId, ref: "Role" },
    label: { type: String },
  },
  { _id: false }
);

const contractApprovalRuleSchema = new Schema<IContractApprovalRule>(
  {
    name: { type: String, required: true },
    description: { type: String },
    priority: { type: Number, required: true, default: 0 },
    condition_field: {
      type: String,
      enum: ["propertyId", "channel", "contractValue", "accountType", "organisationType"],
      required: true,
    },
    condition_operator: {
      type: String,
      enum: ["eq", "neq", "in", "not_in"],
      required: true,
    },
    condition_value: { type: Schema.Types.Mixed, required: true },
    applyToAll: { type: Boolean, default: false },
    approvalSteps: { type: [approvalStepSchema], default: [] },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

contractApprovalRuleSchema.index({ priority: 1, is_active: 1 });

export const ContractApprovalRuleModel = mongoose.model<IContractApprovalRule>(
  "ContractApprovalRule",
  contractApprovalRuleSchema
);
