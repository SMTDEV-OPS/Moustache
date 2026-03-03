import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef } from "./common";

export interface IEmployeeGroup extends Document {
  name: string;
  description?: string;

  // Zoho Groups Architecture (Mix of Users, Roles, and Subgroups)
  memberUserIds: ObjectId[];
  memberRoleIds: ObjectId[]; // Roles whose users are implicitly in this group
  includeSubordinates: boolean; // Flag to indicate if subordinates of memberRoleIds are also included
  subGroupIds: ObjectId[]; // Nested groups

  // Legacy -> Groups no longer grant roles/permissions
  roleIds?: ObjectId[];

  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeGroupSchema = new Schema<IEmployeeGroup>(
  {
    name: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    memberUserIds: [UserRef],
    memberRoleIds: [{ type: Schema.Types.ObjectId, ref: "Role" }],
    includeSubordinates: { type: Boolean, default: false },
    subGroupIds: [{ type: Schema.Types.ObjectId, ref: "EmployeeGroup" }],
    roleIds: [{ type: Schema.Types.ObjectId, ref: "Role" }], // Kept temporarily for migration backwards-compatibility
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmployeeGroupModel = model<IEmployeeGroup>("EmployeeGroup", employeeGroupSchema);


