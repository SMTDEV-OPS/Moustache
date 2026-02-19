import { Schema, model, Document } from "mongoose";
import { ObjectId, TeamType, RegionRef, UserRef } from "./common";

export interface IUser extends Document {
  name: string;
  email: string;
  phone?: string;
  teamType: TeamType;
  regions: ObjectId[];
  roleId?: ObjectId;
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
    teamType: { type: String, enum: Object.values(TeamType), required: true },
    regions: [RegionRef],
    roleId: { type: Schema.Types.ObjectId, ref: "Role" },
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


