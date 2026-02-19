import { Schema, model, Document, Types } from "mongoose";

export interface IConglomerate extends Document {
    name: string;
    country: string; // India, USA, China, etc.
    region: string; // Asia, North America, Europe, etc.
    isActive: boolean;
    isGlobal: boolean; // For major multinational conglomerates
    createdBy?: Types.ObjectId; // User who added (for custom entries)
    createdAt: Date;
    updatedAt: Date;
}

const conglomerateSchema = new Schema<IConglomerate>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        country: {
            type: String,
            required: true,
            index: true,
        },
        region: {
            type: String,
            required: true,
            index: true,
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true,
        },
        isGlobal: {
            type: Boolean,
            default: false,
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

// Indexes for search and filtering
conglomerateSchema.index({ name: 'text' });
conglomerateSchema.index({ country: 1, isActive: 1 });
conglomerateSchema.index({ region: 1, isActive: 1 });

export const ConglomerateModel = model<IConglomerate>("Conglomerate", conglomerateSchema);
