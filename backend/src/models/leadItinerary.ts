import { Schema, model, Document, Types } from "mongoose";

export interface ILeadItinerary extends Document {
    leadId: Types.ObjectId;
    hotelName?: string;
    propertyId?: Types.ObjectId;
    checkInDate?: Date;
    checkOutDate?: Date;
    roomCategory?: string;
    roomsRequested?: {
        roomTypeId?: string;
        roomTypeName?: string;
        quantity?: number;
        adults?: number;
        children?: number;
        notes?: string;
        mealPlanId?: string;
        mealPlanName?: string;
        ratePlanId?: string;
        ratePlanName?: string;
        estimatedRate?: number;
        extraAdultRate?: number;
        extraChildRate?: number;
        rateSource?: "pms" | "manual";
    }[];
    roomPreference?: string;
    numberOfGuests?: string;
    createdAt: Date;
    updatedAt: Date;
}

const roomRequestSchema = new Schema(
    {
        roomTypeId: { type: String },
        roomTypeName: { type: String },
        quantity: { type: Number, min: 1 },
        adults: { type: Number, min: 1 },
        children: { type: Number, min: 0 },
        notes: { type: String },
        mealPlanId: { type: String },
        mealPlanName: { type: String },
        ratePlanId: { type: String },
        ratePlanName: { type: String },
        estimatedRate: { type: Number },
        extraAdultRate: { type: Number },
        extraChildRate: { type: Number },
        rateSource: { type: String, enum: ["pms", "manual"] },
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
        roomsRequested: { type: [roomRequestSchema], default: undefined },
        roomPreference: String,
        numberOfGuests: String,
    },
    { timestamps: { createdAt: true, updatedAt: true } }
);

// Indexes for fast lookup by lead, and querying across dates
leadItinerarySchema.index({ leadId: 1, checkInDate: 1 });

export const LeadItineraryModel = model<ILeadItinerary>("LeadItinerary", leadItinerarySchema);
