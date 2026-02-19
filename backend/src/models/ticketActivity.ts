import { Schema, model, Document } from "mongoose";
import { TicketRef, UserRef } from "./common";

export enum TicketActivityType {
  STATUS_CHANGE = "STATUS_CHANGE",
  PRIORITY_CHANGE = "PRIORITY_CHANGE",
  AUTO_ASSIGNED = "AUTO_ASSIGNED",
  MANUAL_ASSIGNED = "MANUAL_ASSIGNED",
  ASSIGNED = "ASSIGNED",
  REASSIGNED = "REASSIGNED",
  NOTE = "NOTE",
  RESOLVED = "RESOLVED",
  REOPENED = "REOPENED",
  TICKET_CREATED = "TICKET_CREATED",
}

export interface ITicketActivity extends Document {
  ticketId: any;
  type: TicketActivityType;
  fromStatus?: string;
  toStatus?: string;
  fromPriority?: string;
  toPriority?: string;
  note?: string;
  performedByUserId?: any;
  performedAt: Date;
  // Assignment tracking fields
  fromUserId?: any;
  toUserId?: any;
  assignedByUserId?: any;
}

const ticketActivitySchema = new Schema<ITicketActivity>(
  {
    ticketId: TicketRef,
    type: {
      type: String,
      enum: Object.values(TicketActivityType),
      required: true,
      index: true,
    },
    fromStatus: String,
    toStatus: String,
    fromPriority: String,
    toPriority: String,
    note: String,
    performedByUserId: UserRef,
    performedAt: { type: Date, default: Date.now, index: true },
    // Assignment tracking fields
    fromUserId: UserRef,
    toUserId: UserRef,
    assignedByUserId: UserRef,
  },
  { timestamps: true }
);

ticketActivitySchema.index({ ticketId: 1, performedAt: -1 });

export const TicketActivityModel = model<ITicketActivity>(
  "TicketActivity",
  ticketActivitySchema
);

