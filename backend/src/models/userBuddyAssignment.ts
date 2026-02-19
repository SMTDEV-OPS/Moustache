import { Schema, model, Document } from "mongoose";
import { UserRef } from "./common";

export interface IUserBuddyAssignment extends Document {
  userId: any;
  buddyUserId: any;
  effectiveFrom: Date;
  effectiveTo?: Date;
  reason?: string;
  createdByUserId?: any;
}

const userBuddyAssignmentSchema = new Schema<IUserBuddyAssignment>(
  {
    userId: { ...UserRef, required: true },
    buddyUserId: { ...UserRef, required: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: Date,
    reason: String,
    createdByUserId: UserRef,
  },
  { timestamps: true }
);

userBuddyAssignmentSchema.index({ userId: 1, effectiveFrom: -1 });
userBuddyAssignmentSchema.index({ buddyUserId: 1, effectiveFrom: -1 });

export const UserBuddyAssignmentModel = model<IUserBuddyAssignment>(
  "UserBuddyAssignment",
  userBuddyAssignmentSchema
);



