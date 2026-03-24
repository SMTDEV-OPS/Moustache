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
  bookingDetails?: {
    checkInDate?: Date;
    checkOutDate?: Date;
    nights?: number;
    adults?: number;
    children?: number;
    occasion?: string;
    specialRequests?: string;
    bookingSource?: string;
    roomDetails?: Array<{
      roomCategory?: string;
      roomPreference?: string;
      numberOfGuests?: string;
    }>;
    hotels?: Array<{
      hotelName?: string;
      checkInDate?: Date;
      checkOutDate?: Date;
      rooms?: Array<{
        roomCategory?: string;
        roomPreference?: string;
        numberOfGuests?: string;
      }>;
    }>;
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
    bookingDetails: {
      checkInDate: Date,
      checkOutDate: Date,
      nights: Number,
      adults: Number,
      children: Number,
      occasion: String,
      specialRequests: String,
      bookingSource: String,
      roomDetails: [
        {
          roomCategory: String,
          roomPreference: String,
          numberOfGuests: String,
        },
      ],
      hotels: [
        {
          hotelName: String,
          checkInDate: Date,
          checkOutDate: Date,
          rooms: [
            {
              roomCategory: String,
              roomPreference: String,
              numberOfGuests: String,
            },
          ],
        },
      ],
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



