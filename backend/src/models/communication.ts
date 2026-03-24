import { Schema, model, Document } from "mongoose";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationDisposition,
  GuestRef,
  LeadRef,
  UserRef,
} from "./common";
import { EmailMessageModel } from "./emailMessage";

export interface ICommunication extends Document {
  leadId?: any;
  guestId?: any;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  disposition?: CommunicationDisposition;
  summary?: string;
  rawPayload?: any;
  performedByUserId?: any;
  createdAt: Date;
  // Enhanced fields for email/SMS/WhatsApp linking
  emailMessageId?: any;
  messageContent?: string;
  externalMessageId?: string;
  metadata?: {
    messageId?: string;
    threadId?: string;
    from?: string;
    subject?: string;
    to?: string;
  };
}

const communicationSchema = new Schema<ICommunication>(
  {
    leadId: LeadRef,
    guestId: GuestRef,
    channel: {
      type: String,
      enum: Object.values(CommunicationChannel),
      required: true,
    },
    direction: {
      type: String,
      enum: Object.values(CommunicationDirection),
      required: true,
    },
    disposition: {
      type: String,
      enum: Object.values(CommunicationDisposition),
    },
    summary: String,
    rawPayload: Schema.Types.Mixed,
    performedByUserId: UserRef,
    // Enhanced fields for email/SMS/WhatsApp linking
    emailMessageId: { type: Schema.Types.ObjectId, ref: "EmailMessage" },
    messageContent: String,
    externalMessageId: String,
    metadata: {
      messageId: String,
      threadId: String,
      from: String,
      subject: String,
      to: String,
    },
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

communicationSchema.index({ leadId: 1, createdAt: -1 });
communicationSchema.index({ performedByUserId: 1, createdAt: -1 });
communicationSchema.index({ "metadata.threadId": 1, leadId: 1, createdAt: 1 });

export const CommunicationModel = model<ICommunication>(
  "Communication",
  communicationSchema
);



