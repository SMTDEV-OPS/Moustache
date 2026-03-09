import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICallQualityDimension extends Document {
    orgId: Types.ObjectId;
    name: string;
    description?: string;
    weight_percent: number;
    display_order: number;
    is_active: boolean;
}

const callQualityDimensionSchema = new Schema<ICallQualityDimension>(
    {
        orgId: { type: Schema.Types.ObjectId, required: true },
        name: { type: String, required: true },
        description: { type: String },
        weight_percent: { type: Number, required: true, min: 0, max: 100 },
        display_order: { type: Number, default: 0 },
        is_active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

export const CallQualityDimensionModel: Model<ICallQualityDimension> = mongoose.models.CallQualityDimension || mongoose.model<ICallQualityDimension>('CallQualityDimension', callQualityDimensionSchema);
