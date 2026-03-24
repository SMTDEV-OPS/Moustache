import { Schema, model, Document, Types } from "mongoose";

export interface IAccountPotential extends Document {
    accountId: Types.ObjectId;

    // City & Location
    city: string;
    location: "CBD" | "MICRO_MARKET" | "INDUSTRIAL_BELT" | "NORTH_GEO" | "SOUTH_GEO" | "COMMERCIAL_BUSINESS_DISTRICT" | "CUSTOM";
    customLocation?: string;

    // Segment
    segment: "LUXURY" | "UPPER_UPSCALE" | "UPSCALE" | "MID_SEGMENT" | "BUDGET" | "GUEST_HOUSE";

    // FIT Potential
    fitPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };

    // Group Potential
    groupPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };

    // Long Stay Potential
    longStayPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };

    // Banquet Potential
    banquetPotential: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };

    // F&B Potential (segment-specific: LUXURY, UPPER_UPSCALE)
    fbPotential?: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };

    // Spa/Wellness Potential (segment-specific: LUXURY, UPPER_UPSCALE)
    spaPotential?: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };

    // Competition Analysis
    competitors: Array<{
        brandId?: Types.ObjectId; // Reference to hotel brands
        brandName: string;
        rate?: number;
        inclusion?: string;
        roomNightSharePercent?: number; // Percentage
        remarks?: string;
    }>;

    remarks?: string;
    autoCalculatedRN?: number | null;

    year: number; // Fiscal year for this potential data
    createdAt: Date;
    updatedAt: Date;
}

const accountPotentialSchema = new Schema<IAccountPotential>(
    {
        accountId: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true,
            index: true,
        },

        // City & Location
        city: {
            type: String,
            required: true,
            index: true,
        },
        location: {
            type: String,
            enum: ["CBD", "MICRO_MARKET", "INDUSTRIAL_BELT", "NORTH_GEO", "SOUTH_GEO", "COMMERCIAL_BUSINESS_DISTRICT", "CUSTOM"],
            required: true,
        },
        customLocation: String,

        // Segment
        segment: {
            type: String,
            enum: ["LUXURY", "UPPER_UPSCALE", "UPSCALE", "MID_SEGMENT", "BUDGET", "GUEST_HOUSE"],
            required: true,
        },

        // FIT Potential
        fitPotential: {
            roomNights: { type: Number, default: 0 },
            roomRevenue: { type: Number, default: 0 },
            actualRoomNights: Number,
            actualRoomRevenue: Number,
        },

        // Group Potential
        groupPotential: {
            roomNights: { type: Number, default: 0 },
            roomRevenue: { type: Number, default: 0 },
            actualRoomNights: Number,
            actualRoomRevenue: Number,
        },

        // Long Stay Potential
        longStayPotential: {
            roomNights: { type: Number, default: 0 },
            roomRevenue: { type: Number, default: 0 },
            actualRoomNights: Number,
            actualRoomRevenue: Number,
        },

        // Banquet Potential
        banquetPotential: {
            events: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
            actualEvents: Number,
            actualRevenue: Number,
        },

        // F&B Potential
        fbPotential: {
            events: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
            actualEvents: Number,
            actualRevenue: Number,
        },

        // Spa/Wellness Potential
        spaPotential: {
            events: { type: Number, default: 0 },
            revenue: { type: Number, default: 0 },
            actualEvents: Number,
            actualRevenue: Number,
        },

        // Competition Analysis
        competitors: [
            {
                brandId: {
                    type: Schema.Types.ObjectId,
                    ref: "HotelBrand", // Will create this model later
                },
                brandName: { type: String, required: true },
                rate: Number,
                inclusion: String,
                roomNightSharePercent: Number,
                remarks: String,
            },
        ],

        remarks: String,
        autoCalculatedRN: { type: Number, default: null },

        year: {
            type: Number,
            required: true,
            default: () => new Date().getFullYear(),
            index: true,
        },
    },
    { timestamps: true }
);

// Indexes for search and filtering - unique per (accountId, city, year, location, segment)
accountPotentialSchema.index({ accountId: 1, city: 1, year: 1, location: 1, segment: 1 }, { unique: true });
accountPotentialSchema.index({ accountId: 1, year: 1 });
accountPotentialSchema.index({ accountId: 1, city: 1, year: 1 });
accountPotentialSchema.index({ city: 1, segment: 1 });

export const AccountPotentialModel = model<IAccountPotential>("AccountPotential", accountPotentialSchema);
