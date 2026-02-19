import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef } from "./common";

export interface IRole extends Document {
  name: string;
  permissions: string[]; // Main permissions array (Resource:Action:Scope)

  // Legacy
  memberPermissions?: string[];
  ownerPermissions?: string[];
  description?: string;
  ownerUserId?: ObjectId; // Legacy single owner - kept for backward compatibility
  ownerUserIds?: ObjectId[]; // Multiple owners (SPOCs)
  isSystemRole: boolean;
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    // Standardized permissions array (Resource:Action:Scope)
    permissions: [{ type: String, required: true }],

    // Deprecated / Legacy Support
    memberPermissions: [{ type: String }],
    ownerPermissions: [{ type: String }],
    ownerUserId: UserRef,
    ownerUserIds: [UserRef],
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RoleModel = model<IRole>("Role", roleSchema);



