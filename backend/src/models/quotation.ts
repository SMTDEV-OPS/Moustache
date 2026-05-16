import { Schema, model, Document, Types } from "mongoose";
import { LeadRef, PropertyRef } from "./common";

export type QuotationPropertyTier = "HOSTEL" | "SELECT" | "LUXURIA";

export interface IQuotationRateLine {
  /** Display name (e.g. "Deluxe Room", "6 Bed Dorm") */
  roomTypeName: string;
  /** Number of rooms of this type */
  quantity: number;
  /** Rate per room per night (INR) */
  ratePerNight: number;
  /** Optional: hotel name when quoting multiple itineraries */
  hotelName?: string;
}

export interface IQuotationRoomRow {
  roomTypeId?: string;
  roomTypeName?: string;
  /** eZee: selected RateTypeID (meal plan) */
  mealPlanId?: string;
  mealPlanName?: string;
  /** eZee: resolved RatePlanID for (roomTypeId, mealPlanId) */
  ratePlanId?: string;
  ratePlanName?: string;
  roomNo?: string;
  adults?: number;
  children?: number;
  baseRate: number; // per room / night
  discountPercent: number; // 0-100 (capped by role at validation time)
  discountedRate: number; // per room / night
  taxPercent: number; // effective % on discounted pre-tax night (PMS ratio or GST slab)
  taxAmount: number; // per room / night
  total: number; // (discountedRate + taxAmount) * nights
}

export interface IQuotationHotelQuote {
  propertyId?: string;
  hotelName?: string;
  hotelAddress?: string;
  checkInDate?: Date;
  checkOutDate?: Date;
  nights?: number;
  rows: IQuotationRoomRow[];
  subtotal?: number;
  totalTax?: number;
  grandTotal?: number;
}

export interface IQuotation extends Document {
  leadId: any;
  versionNumber: number;
  propertyId: any;
  kbFactsheetId?: Types.ObjectId;
  propertyTier?: QuotationPropertyTier;
  rooms?: number;
  rate?: number;
  taxes?: number;
  /** Preferred pricing format: multiple room types/rates */
  rateLines?: IQuotationRateLine[];
  /** V2 format: per-hotel, per-room-row breakdown */
  hotelQuotes?: IQuotationHotelQuote[];
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
    rateLines: {
      type: [
        new Schema<IQuotationRateLine>(
          {
            roomTypeName: { type: String, required: true },
            quantity: { type: Number, required: true, min: 1 },
            ratePerNight: { type: Number, required: true, min: 0 },
            hotelName: { type: String },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
    hotelQuotes: {
      type: [
        new Schema<IQuotationHotelQuote>(
          {
            propertyId: { type: String },
            hotelName: { type: String },
            hotelAddress: { type: String },
            checkInDate: { type: Date },
            checkOutDate: { type: Date },
            nights: { type: Number, min: 1 },
            rows: {
              type: [
                new Schema<IQuotationRoomRow>(
                  {
                    roomTypeId: { type: String },
                    roomTypeName: { type: String },
                    mealPlanId: { type: String },
                    mealPlanName: { type: String },
                    ratePlanId: { type: String },
                    ratePlanName: { type: String },
                    roomNo: { type: String },
                    adults: { type: Number, min: 0 },
                    children: { type: Number, min: 0 },
                    baseRate: { type: Number, required: true, min: 0 },
                    discountPercent: { type: Number, required: true, min: 0, max: 100 },
                    discountedRate: { type: Number, required: true, min: 0 },
                    taxPercent: { type: Number, required: true, min: 0, max: 100 },
                    taxAmount: { type: Number, required: true, min: 0 },
                    total: { type: Number, required: true, min: 0 },
                  },
                  { _id: false }
                ),
              ],
              default: [],
            },
            subtotal: { type: Number, min: 0 },
            totalTax: { type: Number, min: 0 },
            grandTotal: { type: Number, min: 0 },
          },
          { _id: false }
        ),
      ],
      default: undefined,
    },
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



