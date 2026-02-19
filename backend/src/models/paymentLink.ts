import { Schema, model, Document } from "mongoose";
import { GuestRef, LeadRef } from "./common";

export type PaymentLinkStatus =
  | "CREATED"
  | "SENT"
  | "PARTIALLY_PAID"
  | "PAID"
  | "EXPIRED"
  | "FAILED";

export interface IPaymentBreakup {
  amount: number;
  paidAt?: Date;
}

export interface IPaymentLink extends Document {
  leadId: any;
  guestId: any;
  gateway: "RAZORPAY" | "PAYU" | "HDFC" | "OTHER";
  amount: number;
  currency: string;
  status: PaymentLinkStatus;
  paymentBreakup?: IPaymentBreakup[];
  externalReference?: string;
  createdAt: Date;
  paidAt?: Date;
}

const paymentBreakupSchema = new Schema<IPaymentBreakup>(
  {
    amount: { type: Number, required: true },
    paidAt: Date,
  },
  { _id: false }
);

const paymentLinkSchema = new Schema<IPaymentLink>(
  {
    leadId: { ...LeadRef, required: true },
    guestId: GuestRef,
    gateway: {
      type: String,
      enum: ["RAZORPAY", "PAYU", "HDFC", "OTHER"],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    status: {
      type: String,
      enum: ["CREATED", "SENT", "PARTIALLY_PAID", "PAID", "EXPIRED", "FAILED"],
      default: "CREATED",
      index: true,
    },
    paymentBreakup: [paymentBreakupSchema],
    externalReference: String,
    paidAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

paymentLinkSchema.index({ leadId: 1, createdAt: -1 });

export const PaymentLinkModel = model<IPaymentLink>(
  "PaymentLink",
  paymentLinkSchema
);



