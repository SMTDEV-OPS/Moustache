import { Schema, model, type Document, type Types } from "mongoose";

export type LeadBookingStatus = "confirmed" | "cancelled";

export interface ILeadBookingRoom {
  roomTypeId: string;
  roomTypeName: string;
  rateTypeId: string;
  planName: string;
  adults: number;
  children: number;
  baseRate: number;
  totalAmount: number;
}

export interface ILeadBooking extends Document {
  leadId: Types.ObjectId;
  propertyId: Types.ObjectId;
  ezeeBookingRef: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  rooms: ILeadBookingRoom[];
  grandTotal: number;
  status: LeadBookingStatus;
  bookedBy?: Types.ObjectId;
  bookedAt: Date;
  specialRequest?: string;
  /** eZee RoomList promotion_code used when rates were loaded (reporting only). */
  promotionCode?: string;
  /** True after eZee `ProcessBooking` confirms the reservation (InsertBooking alone can leave it pending). */
  processedInPms?: boolean;
}

const leadBookingRoomSchema = new Schema<ILeadBookingRoom>(
  {
    roomTypeId: { type: String, required: true },
    roomTypeName: { type: String, required: true },
    rateTypeId: { type: String, required: true },
    planName: { type: String, required: true },
    adults: { type: Number, required: true },
    children: { type: Number, required: true },
    baseRate: { type: Number, required: true },
    totalAmount: { type: Number, required: true },
  },
  { _id: false }
);

const leadBookingSchema = new Schema<ILeadBooking>(
  {
    leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
    propertyId: { type: Schema.Types.ObjectId, ref: "Property", required: true, index: true },
    ezeeBookingRef: { type: String, required: true, index: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true },
    guestName: { type: String, required: true },
    guestEmail: String,
    guestPhone: String,
    rooms: { type: [leadBookingRoomSchema], required: true },
    grandTotal: { type: Number, required: true },
    status: { type: String, enum: ["confirmed", "cancelled"], default: "confirmed", index: true },
    bookedBy: { type: Schema.Types.ObjectId, ref: "User" },
    bookedAt: { type: Date, default: Date.now, index: true },
    specialRequest: String,
    promotionCode: String,
    processedInPms: { type: Boolean, default: false },
  },
  { timestamps: true }
);

leadBookingSchema.index({ leadId: 1, bookedAt: -1 });

export const LeadBookingModel = model<ILeadBooking>("LeadBooking", leadBookingSchema);

