import { Schema, model, Document, Types } from "mongoose";

export interface IFollowupRule extends Document {
    org_id?: string;
    bucket: string; // 'Hot' | 'Warm' | 'Cold' | 'Inactive'
    followup_number: number;
    offset_hours?: number;
    offset_days?: number;
    description?: string;
    template_id?: Types.ObjectId;
    is_active: boolean;
    display_order: number;
}

const followupRuleSchema = new Schema<IFollowupRule>(
    {
        org_id: { type: String, index: true },
        bucket: { type: String, required: true, index: true },
        followup_number: { type: Number, required: true },
        offset_hours: { type: Number },
        offset_days: { type: Number },
        description: { type: String },
        template_id: { type: Schema.Types.ObjectId, ref: "Template" },
        is_active: { type: Boolean, default: true },
        display_order: { type: Number, required: true },
    },
    { timestamps: true }
);

// We want to fetch by org_id + bucket quickly, ordered by display_order
followupRuleSchema.index({ org_id: 1, bucket: 1, is_active: 1, display_order: 1 });

export const FollowupRuleModel = model<IFollowupRule>("FollowupRule", followupRuleSchema);
