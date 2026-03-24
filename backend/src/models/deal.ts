import { Schema, model, Document, Types } from "mongoose";

export type DealStage =
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "NA";

export interface IDeal extends Document {
  accountId: Types.ObjectId;
  name: string;
  stage: DealStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: Date;
  ownerUserId?: Types.ObjectId;
  leadId?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dealSchema = new Schema<IDeal>(
  {
    accountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    stage: {
      type: String,
      enum: ["QUALIFICATION", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "NA"],
      required: true,
      default: "QUALIFICATION",
      index: true,
    },
    value: {
      type: Number,
      required: true,
      default: 0,
    },
    currency: {
      type: String,
      // TODO: make configurable from setup
      default: "INR",
    },
    probability: {
      type: Number,
      min: 0,
      max: 100,
    },
    expectedCloseDate: Date,
    ownerUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: "Lead",
      index: true,
    },
    notes: String,
  },
  { timestamps: true }
);

dealSchema.index({ accountId: 1, stage: 1 });
dealSchema.index({ accountId: 1, expectedCloseDate: -1 });

export const DealModel = model<IDeal>("Deal", dealSchema);
