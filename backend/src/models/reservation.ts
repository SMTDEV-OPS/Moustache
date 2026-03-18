import { Schema, model, Document } from "mongoose";
import { GuestRef, LeadRef, PropertyRef } from "./common";

export interface IAmendment {
  field: string;
  oldValue?: any;
  newValue?: any;
  changedAt: Date;
}

export interface IReservation extends Document {
  leadId: any;
  guestId: any;
  propertyId: any;
  pmsReservationId?: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomsBooked?: number;
  ratePlan?: string;
  totalAmount?: number;
  status: "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "AMENDED";
  cancellationReason?: string;
  amendmentHistory?: IAmendment[];
}

const amendmentSchema = new Schema<IAmendment>(
  {
    field: { type: String, required: true },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    changedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const reservationSchema = new Schema<IReservation>(
  {
    leadId: LeadRef,
    guestId: GuestRef,
    propertyId: PropertyRef,
    pmsReservationId: { type: String, index: true },
    checkInDate: { type: Date, required: true },
    checkOutDate: { type: Date, required: true },
    roomsBooked: Number,
    ratePlan: String,
    totalAmount: Number,
    status: {
      type: String,
      enum: ["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "AMENDED"],
      default: "CONFIRMED",
      index: true,
    },
    cancellationReason: String,
    amendmentHistory: [amendmentSchema],
  },
  { timestamps: true }
);

reservationSchema.index({ propertyId: 1, checkInDate: 1 });
reservationSchema.index({ guestId: 1, checkInDate: -1 });

export const ReservationModel = model<IReservation>(
  "Reservation",
  reservationSchema
);



