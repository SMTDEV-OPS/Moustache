import { Schema, model, Document, Types } from "mongoose";

export interface ILeadItinerary extends Document {
    leadId: Types.ObjectId;
    hotelName?: string;
    propertyId?: Types.ObjectId;
    checkInDate?: Date;
    checkOutDate?: Date;
    roomCategory?: string;
    roomPreference?: string;
    numberOfGuests?: string;
    createdAt: Date;
    updatedAt: Date;
}

const leadItinerarySchema = new Schema<ILeadItinerary>(
    {
        leadId: {
            type: Schema.Types.ObjectId,
            ref: "Lead",
            required: true,
            index: true,
        },
        hotelName: String,
        propertyId: {
            type: Schema.Types.ObjectId,
            ref: "Property",
        },
        checkInDate: Date,
        checkOutDate: Date,
        roomCategory: String,
        roomPreference: String,
        numberOfGuests: String,
    },
    { timestamps: { createdAt: true, updatedAt: true } }
);

// Indexes for fast lookup by lead, and querying across dates
leadItinerarySchema.index({ leadId: 1, checkInDate: 1 });

export const LeadItineraryModel = model<ILeadItinerary>("LeadItinerary", leadItinerarySchema);
