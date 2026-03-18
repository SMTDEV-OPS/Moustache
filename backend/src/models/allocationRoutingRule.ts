import mongoose, { Schema, Document } from "mongoose";

export type AllocationRoutingOperator = "eq" | "neq" | "in" | "not_in";

export interface IAllocationRoutingRule extends Document {
  orgId: string;
  priority: number;
  condition_field: string;
  condition_operator: AllocationRoutingOperator;
  condition_value: string | string[];
  assign_to_group_id: mongoose.Types.ObjectId;
  assign_to_group_name: string;
  is_active: boolean;
}

const AllocationRoutingRuleSchema = new Schema<IAllocationRoutingRule>(
  {
    orgId: { type: String, required: true },
    priority: { type: Number, required: true, default: 0 },
    condition_field: { type: String, required: true },
    condition_operator: {
      type: String,
      enum: ["eq", "neq", "in", "not_in"],
      required: true,
    },
    condition_value: { type: Schema.Types.Mixed, required: true },
    // We route to EmployeeGroup in this codebase (\"groups\" API uses EmployeeGroupModel)
    assign_to_group_id: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeGroup",
      required: true,
    },
    assign_to_group_name: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

AllocationRoutingRuleSchema.index({ orgId: 1, priority: 1, is_active: 1 });

export const AllocationRoutingRuleModel = mongoose.model<IAllocationRoutingRule>(
  "AllocationRoutingRule",
  AllocationRoutingRuleSchema
);

