import { Schema, model, Document } from "mongoose";
import { LeadRef, UserRef } from "./common";

export enum LeadActivityType {
  STATUS_CHANGE = "STATUS_CHANGE",
  FOLLOW_UP = "FOLLOW_UP",
  NOTE = "NOTE",
  QUOTE_SENT = "QUOTE_SENT",
  PAYMENT_LINK_SENT = "PAYMENT_LINK_SENT",
  PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
  REMINDER_TRIGGERED = "REMINDER_TRIGGERED",
  LEAD_CREATED = "LEAD_CREATED",
  AUTO_ASSIGNED = "AUTO_ASSIGNED",
  MANUAL_ASSIGNED = "MANUAL_ASSIGNED",
  REASSIGNED = "REASSIGNED",
  CLIENT_RESPONSE = "CLIENT_RESPONSE",
}

export interface ILeadActivity extends Document {
  leadId: any;
  type: LeadActivityType;
  fromStatus?: string;
  toStatus?: string;
  note?: string;
  performedByUserId?: any;
  dueAt?: Date;
  performedAt: Date;
  // Assignment tracking fields
  fromUserId?: any;
  toUserId?: any;
  assignedByUserId?: any;
  employeeGroupId?: any;
}

const leadActivitySchema = new Schema<ILeadActivity>(
  {
    leadId: LeadRef,
    type: {
      type: String,
      enum: Object.values(LeadActivityType),
      required: true,
      index: true,
    },
    fromStatus: String,
    toStatus: String,
    note: String,
    performedByUserId: UserRef,
    dueAt: Date,
    performedAt: { type: Date, default: Date.now, index: true },
    // Assignment tracking fields
    fromUserId: UserRef,
    toUserId: UserRef,
    assignedByUserId: UserRef,
    employeeGroupId: { type: Schema.Types.ObjectId, ref: "EmployeeGroup" },
  },
  { timestamps: true }
);

leadActivitySchema.index({ leadId: 1, performedAt: -1 });

export const LeadActivityModel = model<ILeadActivity>(
  "LeadActivity",
  leadActivitySchema
);



