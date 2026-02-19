import { Schema, model, Document, Types } from "mongoose";
import { LeadRef, GuestRef } from "./common";

export interface IEmailAddress {
  name?: string;
  email: string;
}

export interface IEmailAttachment {
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  storagePath?: string; // Path to stored file if saved
}

export interface IEmailMessage extends Document {
  emailAccountId: Types.ObjectId;
  threadId: string; // Thread/conversation ID
  messageId: string; // RFC 822 Message-ID (unique)
  inReplyTo?: string; // Message-ID this is replying to

  from: IEmailAddress;
  to: IEmailAddress[];
  cc?: IEmailAddress[];
  bcc?: IEmailAddress[];
  replyTo?: IEmailAddress;

  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  snippet: string; // Short preview text

  folder: string; // INBOX, SENT, DRAFTS, TRASH, etc.
  labels?: string[]; // Gmail labels or custom labels
  isRead: boolean;
  isStarred: boolean;
  isDraft: boolean;
  isArchived: boolean;

  attachments?: IEmailAttachment[];

  // CRM linking
  linkedLeadId?: Types.ObjectId;
  linkedGuestId?: Types.ObjectId;

  sentAt?: Date;
  receivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const emailAddressSchema = new Schema<IEmailAddress>(
  {
    name: String,
    email: { type: String, required: true },
  },
  { _id: false }
);

const emailAttachmentSchema = new Schema<IEmailAttachment>(
  {
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    contentId: String,
    storagePath: String,
  },
  { _id: false }
);

const emailMessageSchema = new Schema<IEmailMessage>(
  {
    emailAccountId: {
      type: Schema.Types.ObjectId,
      ref: "EmailAccount",
      required: true,
      index: true,
    },
    threadId: { type: String, required: true, index: true },
    messageId: { type: String, required: true, unique: true, index: true },
    inReplyTo: { type: String, index: true },
    from: { type: emailAddressSchema, required: true },
    to: { type: [emailAddressSchema], required: true, default: [] },
    cc: { type: [emailAddressSchema], default: [] },
    bcc: { type: [emailAddressSchema], default: [] },
    replyTo: { type: emailAddressSchema },
    subject: { type: String, required: true, index: true },
    bodyText: String,
    bodyHtml: String,
    snippet: { type: String, required: true },
    folder: { type: String, required: true, default: "INBOX", index: true },
    labels: { type: [String], default: [] },
    isRead: { type: Boolean, default: false, index: true },
    isStarred: { type: Boolean, default: false },
    isDraft: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    attachments: { type: [emailAttachmentSchema], default: [] },
    linkedLeadId: LeadRef,
    linkedGuestId: GuestRef,
    sentAt: { type: Date, index: true },
    receivedAt: { type: Date, index: true },
  },
  { timestamps: true }
);

// Indexes for efficient querying
emailMessageSchema.index({ emailAccountId: 1, folder: 1, receivedAt: -1 });
emailMessageSchema.index({ emailAccountId: 1, isRead: 1, receivedAt: -1 });
emailMessageSchema.index({ threadId: 1, receivedAt: 1 });
// Note: linkedLeadId and linkedGuestId are already indexed via LeadRef and GuestRef (index: true)
emailMessageSchema.index({ "from.email": 1 });
emailMessageSchema.index({ "to.email": 1 });

export const EmailMessageModel = model<IEmailMessage>("EmailMessage", emailMessageSchema);

