import { Schema, model, Document, Types } from "mongoose";
import crypto from "crypto";

export type ContactActivityType =
  | "SALES_CALL"
  | "TELECALL"
  | "EMAIL"
  | "CLIENT_SITE_INSPECTION";

export type ContactActivityStatus = "ACTIVE" | "CANCELLED";

export type ContactActivityAttendeeKind = "INTERNAL" | "EXTERNAL";

export type ContactActivityResponseStatus =
  | "NEEDS_ACTION"
  | "ACCEPTED"
  | "DECLINED"
  | "TENTATIVE";

export interface IContactActivityAttendee {
  kind: ContactActivityAttendeeKind;
  userId?: Types.ObjectId;
  contactId?: Types.ObjectId;
  name: string;
  email: string;
  responseStatus: ContactActivityResponseStatus;
  respondedAt?: Date;
  rsvpToken?: string;
}

export interface IContactActivityReminderState {
  userId: Types.ObjectId;
  lastShownAt?: Date;
  dismissedAt?: Date;
  emailSentAt?: Date;
}

export interface IContactActivity extends Document {
  accountId: Types.ObjectId;
  contactId: Types.ObjectId;
  activityType: ContactActivityType;
  status: ContactActivityStatus;
  startsAt: Date;
  endsAt: Date;
  category?: string;
  reminderMinutesBefore?: number;
  attendees?: IContactActivityAttendee[];
  reminderState?: IContactActivityReminderState[];
  purpose?: string;
  discussion?: string;
  output?: string;
  followUp?: string;
  performedByUserId?: Types.ObjectId;
  performedAt: Date;
  leadId?: Types.ObjectId;
  latitude?: number;
  longitude?: number;
  createdAt: Date;
  updatedAt: Date;
}

const attendeeSchema = new Schema<IContactActivityAttendee>(
  {
    kind: { type: String, enum: ["INTERNAL", "EXTERNAL"], required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    contactId: { type: Schema.Types.ObjectId, ref: "Contact", index: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    responseStatus: {
      type: String,
      enum: ["NEEDS_ACTION", "ACCEPTED", "DECLINED", "TENTATIVE"],
      default: "NEEDS_ACTION",
      index: true,
    },
    respondedAt: Date,
    rsvpToken: { type: String },
  },
  { _id: false }
);

const reminderStateSchema = new Schema<IContactActivityReminderState>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    lastShownAt: Date,
    dismissedAt: Date,
    emailSentAt: Date,
  },
  { _id: false }
);

const contactActivitySchema = new Schema<IContactActivity>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    contactId: {
      type: Schema.Types.ObjectId,
      ref: "Contact",
      required: true,
      index: true,
    },
    activityType: {
      type: String,
      enum: ["SALES_CALL", "TELECALL", "EMAIL", "CLIENT_SITE_INSPECTION"],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "CANCELLED"],
      default: "ACTIVE",
      index: true,
    },
    startsAt: { type: Date, index: true },
    endsAt: { type: Date, index: true },
    category: { type: String },
    reminderMinutesBefore: { type: Number, min: 0, max: 60 * 24 * 7 },
    attendees: { type: [attendeeSchema], default: [] },
    reminderState: { type: [reminderStateSchema], default: [] },
    purpose: String,
    discussion: String,
    output: String,
    followUp: String,
    performedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    performedAt: { type: Date, default: Date.now, index: true },
    leadId: { type: Schema.Types.ObjectId, ref: "Lead" },
    latitude: Number,
    longitude: Number,
  },
  { timestamps: true }
);

contactActivitySchema.index({ accountId: 1, performedAt: -1 });
contactActivitySchema.index({ contactId: 1, performedAt: -1 });
contactActivitySchema.index({ accountId: 1, startsAt: 1, endsAt: 1 });
contactActivitySchema.index({ "attendees.userId": 1, startsAt: 1, status: 1 });
contactActivitySchema.index({ "attendees.rsvpToken": 1 });

contactActivitySchema.pre("save", function (next) {
  if (!this.startsAt) {
    this.startsAt = this.performedAt ?? new Date();
  }
  if (!this.endsAt) {
    this.endsAt = new Date((this.startsAt as Date).getTime() + 30 * 60 * 1000);
  }
  if (Array.isArray(this.attendees)) {
    for (const a of this.attendees) {
      if (a.kind === "EXTERNAL" && (!a.rsvpToken || a.rsvpToken.length < 16)) {
        a.rsvpToken = crypto.randomBytes(18).toString("base64url");
      }
    }
  }
  next();
});

export const ContactActivityModel = model<IContactActivity>(
  "ContactActivity",
  contactActivitySchema
);
