import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface ICallQualityScore extends Document {
    orgId: Types.ObjectId;
    leadId: Types.ObjectId;
    scored_by: Types.ObjectId;
    scores_json: Record<string, number>;
    weighted_total: number;
    notes?: string;
    createdAt: Date;
    updatedAt: Date;
}

const callQualityScoreSchema = new Schema<ICallQualityScore>(
    {
        orgId: { type: Schema.Types.ObjectId, required: true },
        leadId: { type: Schema.Types.ObjectId, ref: 'Lead', required: true },
        scored_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        scores_json: { type: Map, of: Number, default: {} },
        weighted_total: { type: Number, required: true },
        notes: { type: String },
    },
    { timestamps: true }
);

export const CallQualityScoreModel: Model<ICallQualityScore> = mongoose.models.CallQualityScore || mongoose.model<ICallQualityScore>('CallQualityScore', callQualityScoreSchema);
