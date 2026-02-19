import { Schema, model, Document } from "mongoose";
import { ObjectId, TeamType, UserRef, RoleRef } from "./common";

export interface IEmployeeGroup extends Document {
  name: string;
  description?: string;
  teamType?: TeamType;
  memberUserIds: ObjectId[];
  roleIds: ObjectId[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeGroupSchema = new Schema<IEmployeeGroup>(
  {
    name: { type: String, required: true, unique: true, index: true },
    description: { type: String },
    teamType: { type: String, enum: Object.values(TeamType) },
    memberUserIds: [UserRef],
    roleIds: [RoleRef],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const EmployeeGroupModel = model<IEmployeeGroup>("EmployeeGroup", employeeGroupSchema);


