import { Schema, model, Document } from "mongoose";
import { ObjectId, LeadType } from "./common";

export interface ILeadAssignmentRule extends Document {
  leadType: LeadType;
  employeeGroupId: ObjectId;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

const leadAssignmentRuleSchema = new Schema<ILeadAssignmentRule>(
  {
    leadType: {
      type: String,
      enum: Object.values(LeadType),
      required: true,
      unique: true,
      index: true,
    },
    employeeGroupId: {
      type: Schema.Types.ObjectId,
      ref: "EmployeeGroup",
      required: true,
      index: true,
    },
    isActive: { type: Boolean, default: true },
    priority: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export const LeadAssignmentRuleModel = model<ILeadAssignmentRule>(
  "LeadAssignmentRule",
  leadAssignmentRuleSchema
);

