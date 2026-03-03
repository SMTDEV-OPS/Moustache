import { Schema, model, Document, Types } from "mongoose";
import {
  AccountRef,
  GuestRef,
  PropertyRef,
  RegionRef,
  TicketCategory,
  TicketPriority,
  TicketRef,
  TicketStatus,
  UserRef,
} from "./common";

export interface ITicket extends Document {
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  guestId?: Types.ObjectId;
  accountId?: Types.ObjectId;
  propertyId?: Types.ObjectId;
  assignedToUserId?: Types.ObjectId;
  assignedRegionId?: Types.ObjectId;
  createdByUserId?: Types.ObjectId;
  resolvedAt?: Date;
  resolvedByUserId?: Types.ObjectId;
  resolutionNotes?: string;
  tags?: string[];
  attachments?: string[];
  createdAt: Date;
  updatedAt: Date;
}

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(TicketStatus),
      default: TicketStatus.NEW,
    },
    priority: {
      type: String,
      enum: Object.values(TicketPriority),
      default: TicketPriority.MEDIUM,
    },
    category: {
      type: String,
      enum: Object.values(TicketCategory),
      required: true,
    },
    guestId: GuestRef,
    accountId: AccountRef,
    propertyId: PropertyRef,
    assignedToUserId: UserRef,
    assignedRegionId: RegionRef,
    createdByUserId: UserRef,
    resolvedAt: { type: Date },
    resolvedByUserId: UserRef,
    resolutionNotes: String,
    tags: [String],
    attachments: [String],
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

ticketSchema.index({ assignedToUserId: 1, status: 1 });
ticketSchema.index({ createdAt: -1 });
ticketSchema.index({ status: 1 });
ticketSchema.index({ priority: 1 });

export const TicketModel = model<ITicket>("Ticket", ticketSchema);

export { TicketRef };

