import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IScoringThreshold extends Document {
    orgId: Types.ObjectId;
    label: string;
    min_score: number;
    max_score: number;
    color: string;
    inactive_hours_warning?: number | null;
    inactive_hours_critical?: number | null;
    inactive_color_warning?: string | null;
    inactive_color_critical?: string | null;
    auto_action: 'none' | 'notify_tl' | 'auto_lost';
}

const scoringThresholdSchema = new Schema<IScoringThreshold>(
    {
        orgId: { type: Schema.Types.ObjectId, required: true },
        label: { type: String, required: true },
        min_score: { type: Number, required: true },
        max_score: { type: Number, required: true },
        color: { type: String, required: true },
        inactive_hours_warning: { type: Number, default: null },
        inactive_hours_critical: { type: Number, default: null },
        inactive_color_warning: { type: String, default: null },
        inactive_color_critical: { type: String, default: null },
        auto_action: {
            type: String,
            enum: ['none', 'notify_tl', 'auto_lost'],
            default: 'none'
        },
    },
    { timestamps: true }
);

export const ScoringThresholdModel: Model<IScoringThreshold> = mongoose.models.ScoringThreshold || mongoose.model<IScoringThreshold>('ScoringThreshold', scoringThresholdSchema);
