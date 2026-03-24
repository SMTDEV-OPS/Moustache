import { Schema, model, Document, Types } from "mongoose";

/** Room line within a hotel stay (multiple rooms per hotel) */
export interface ILeadItineraryRoom {
    roomCategory?: string;
    roomPreference?: string;
    numberOfGuests?: string;
}

export interface ILeadItinerary extends Document {
    leadId: Types.ObjectId;
    hotelName?: string;
    propertyId?: Types.ObjectId;
    checkInDate?: Date;
    checkOutDate?: Date;
    /** Legacy: single room (used when rooms[] is empty for backward compat) */
    roomCategory?: string;
    roomPreference?: string;
    numberOfGuests?: string;
    /** Multiple rooms per hotel stay */
    rooms?: ILeadItineraryRoom[];
    createdAt: Date;
    updatedAt: Date;
}

const roomSubschema = new Schema<ILeadItineraryRoom>(
    {
        roomCategory: String,
        roomPreference: String,
        numberOfGuests: String,
    },
    { _id: false }
);

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
        rooms: {
            type: [roomSubschema],
            default: [],
        },
    },
    { timestamps: { createdAt: true, updatedAt: true } }
);

// Indexes for fast lookup by lead, and querying across dates
leadItinerarySchema.index({ leadId: 1, checkInDate: 1 });

export const LeadItineraryModel = model<ILeadItinerary>("LeadItinerary", leadItinerarySchema);
