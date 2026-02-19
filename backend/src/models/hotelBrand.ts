import { Schema, model, Document } from "mongoose";

export interface IHotelBrand extends Document {
    name: string;
    category: "LUXURY" | "UPPER_UPSCALE" | "UPSCALE" | "MID_SEGMENT" | "BUDGET" | "GUEST_HOUSE";
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const hotelBrandSchema = new Schema<IHotelBrand>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true,
        },
        category: {
            type: String,
            enum: ["LUXURY", "UPPER_UPSCALE", "UPSCALE", "MID_SEGMENT", "BUDGET", "GUEST_HOUSE"],
            required: true,
        },
        isActive: {
            type: Boolean,
            default: true,
        },
    },
    { timestamps: true }
);

hotelBrandSchema.index({ name: 1 });

export const HotelBrandModel = model<IHotelBrand>("HotelBrand", hotelBrandSchema);
