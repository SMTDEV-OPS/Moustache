import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef, RoleRef } from "./common";

export interface IUserRole extends Document {
  userId: ObjectId;
  roleId: ObjectId;
  assignedBy?: ObjectId;
  assignedAt: Date;
}

const userRoleSchema = new Schema<IUserRole>(
  {
    userId: UserRef,
    roleId: RoleRef,
    assignedBy: UserRef,
    assignedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

userRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export const UserRoleModel = model<IUserRole>("UserRole", userRoleSchema);


