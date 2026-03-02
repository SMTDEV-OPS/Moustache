import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef, RoleRef } from "./common";

export interface IRole extends Document {
  name: string;
  description?: string;
  // Zoho Roles Architecture
  parentRoleId?: ObjectId; // For Role Hierarchy structuring
  shareDataWithPeers: boolean; // Zoho feature: Users in this role can see records of other users in this same role
  isSystemRole: boolean;
  ownerUserIds?: ObjectId[];
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    parentRoleId: RoleRef, // Points to the manager role above this one
    shareDataWithPeers: { type: Boolean, default: false },
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RoleModel = model<IRole>("Role", roleSchema);



