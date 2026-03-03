import { Schema, model, Document } from "mongoose";
import { ObjectId, RegionRef, UserRef, RoleRef, ProfileRef } from "./common";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  regions: ObjectId[];
  roleId?: ObjectId;     // Now purely represents Org Hierarchy position
  profileId?: ObjectId;  // Represents Feature Permissions (Actions)
  reportsTo?: ObjectId;
  hierarchyPath?: string;
  groupIds?: ObjectId[];
  buddyUserId?: ObjectId;
  status: "ACTIVE" | "INACTIVE";
  passwordHash: string;
  lastLoginAt?: Date;
  isOnline: boolean;
  lastHeartbeatAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    regions: [RegionRef],
    roleId: RoleRef,
    profileId: ProfileRef,
    reportsTo: { type: Schema.Types.ObjectId, ref: "User", index: true },
    hierarchyPath: { type: String, index: true }, // Materialized path: /CEO_ID/VP_ID/MANAGER_ID/
    groupIds: [{ type: Schema.Types.ObjectId, ref: "EmployeeGroup", index: true }],
    buddyUserId: UserRef,
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    passwordHash: { type: String, required: true },
    lastLoginAt: { type: Date },
    isOnline: { type: Boolean, default: false, index: true },
    lastHeartbeatAt: { type: Date },
  },
  { timestamps: true }
);

export const UserModel = model<IUser>("User", userSchema);
