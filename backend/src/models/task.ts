import { Schema, model, Document } from "mongoose";
import { LeadRef, UserRef } from "./common";

export type TaskStatus = "OPEN" | "COMPLETED" | "CANCELLED";

export interface ITask extends Document {
  title: string;
  description?: string;
  ownerUserId: any;
  createdByUserId: any;
  leadId?: any;
  dueAt: Date;
  status: TaskStatus;
  popupState?: {
    lastShownAt?: Date;
    dismissedAt?: Date;
  };
}

const taskSchema = new Schema<ITask>(
  {
    title: { type: String, required: true },
    description: String,
    ownerUserId: { ...UserRef, required: true },
    createdByUserId: UserRef,
    leadId: LeadRef,
    dueAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["OPEN", "COMPLETED", "CANCELLED"],
      default: "OPEN",
      index: true,
    },
    popupState: {
      lastShownAt: Date,
      dismissedAt: Date,
    },
  },
  { timestamps: true }
);

taskSchema.index({ ownerUserId: 1, status: 1, dueAt: 1 });

export const TaskModel = model<ITask>("Task", taskSchema);



