import { Schema, model, Document } from "mongoose";
import { LeadRef, PropertyRef } from "./common";

export interface IQuotation extends Document {
  leadId: any;
  versionNumber: number;
  propertyId: any;
  rooms?: number;
  rate?: number;
  taxes?: number;
  inclusions?: string;
  specialPackages?: string;
  sentVia?: "EMAIL" | "WHATSAPP";
  sentTo?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  sentAt?: Date;
  status: "SENT" | "REVISED" | "ACCEPTED" | "REJECTED";
}

const quotationSchema = new Schema<IQuotation>(
  {
    leadId: { ...LeadRef, required: true },
    versionNumber: { type: Number, default: 1 },
    propertyId: PropertyRef,
    rooms: Number,
    rate: Number,
    taxes: Number,
    inclusions: String,
    specialPackages: String,
    sentVia: { type: String, enum: ["EMAIL", "WHATSAPP"] },
    sentTo: {
      name: String,
      email: String,
      phone: String,
    },
    sentAt: Date,
    status: {
      type: String,
      enum: ["SENT", "REVISED", "ACCEPTED", "REJECTED"],
      default: "SENT",
    },
  },
  { timestamps: true }
);

quotationSchema.index({ leadId: 1, createdAt: -1 });

export const QuotationModel = model<IQuotation>("Quotation", quotationSchema);



