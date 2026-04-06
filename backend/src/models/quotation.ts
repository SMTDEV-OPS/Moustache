import { Schema, model, Document, Types } from "mongoose";
import { LeadRef, PropertyRef } from "./common";

export type QuotationPropertyTier = "HOSTEL" | "SELECT" | "LUXURIA";

export interface IQuotation extends Document {
  leadId: any;
  versionNumber: number;
  propertyId: any;
  kbFactsheetId?: Types.ObjectId;
  propertyTier?: QuotationPropertyTier;
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
    kbFactsheetId: { type: Schema.Types.ObjectId, ref: "KnowledgeBase" },
    propertyTier: { type: String, enum: ["HOSTEL", "SELECT", "LUXURIA"] },
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



