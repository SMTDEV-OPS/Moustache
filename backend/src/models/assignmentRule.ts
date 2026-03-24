import { Schema, model, Document, Types } from "mongoose";

export type ObjectId = Types.ObjectId;

export interface IRuleCondition {
  field: string;
  operator: "is" | "is_not" | "in" | "not_in" | "contains" | "starts_with" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
  value: string | number | boolean | any[];
}

export interface IAssignmentRule extends Document {
  name: string;
  description?: string;
  module: "leads" | "tickets";
  isActive: boolean;
  priority: number;

  applyToAll: boolean;
  conditionLogic: "AND" | "OR";
  conditions: IRuleCondition[];

  assignTo: "group" | "user" | "round_robin_group";
  employeeGroupId?: ObjectId;
  specificUserId?: ObjectId;

  createdAt: Date;
  updatedAt: Date;
}

const ruleConditionSchema = new Schema<IRuleCondition>({
  field: { type: String, required: true },
  operator: { 
    type: String, 
    enum: ["is", "is_not", "in", "not_in", "contains", "starts_with", "greater_than", "less_than", "is_empty", "is_not_empty"],
    required: true 
  },
  value: { type: Schema.Types.Mixed }
});

const assignmentRuleSchema = new Schema<IAssignmentRule>(
  {
    name: { type: String, required: true },
    description: String,
    module: { type: String, enum: ["leads", "tickets"], required: true, index: true },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0, index: true },

    applyToAll: { type: Boolean, default: false },
    conditionLogic: { type: String, enum: ["AND", "OR"], default: "AND" },
    conditions: [ruleConditionSchema],

    assignTo: { type: String, enum: ["group", "user", "round_robin_group"], required: true },
    employeeGroupId: { type: Schema.Types.ObjectId, ref: "EmployeeGroup" },
    specificUserId: { type: Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export const AssignmentRuleModel = model<IAssignmentRule>("AssignmentRuleV2", assignmentRuleSchema);
