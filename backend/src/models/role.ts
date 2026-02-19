import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef } from "./common";

export interface IRole extends Document {
  name: string;
  memberPermissions: string[]; // Permissions for group members (users in groups mapped to this role)
  ownerPermissions: string[]; // Permissions for role owners (SPOCs)
  description?: string;
  ownerUserId?: ObjectId; // Legacy single owner - kept for backward compatibility
  ownerUserIds?: ObjectId[]; // Multiple owners (SPOCs)
  isSystemRole: boolean;
  // Legacy field - kept for backward compatibility, will be migrated to memberPermissions
  permissions?: string[];
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String },
    memberPermissions: [{ type: String, required: true }], // Permissions for group members
    ownerPermissions: [{ type: String, required: true }], // Permissions for role owners (SPOCs)
    ownerUserId: UserRef, // Legacy - kept for backward compatibility
    ownerUserIds: [UserRef], // Multiple owners (SPOCs)
    permissions: [{ type: String }], // Legacy field - kept for backward compatibility
    isSystemRole: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const RoleModel = model<IRole>("Role", roleSchema);



