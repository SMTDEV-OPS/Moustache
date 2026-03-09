import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef } from "./common";

export interface IAgentDailyWorkload extends Document {
    orgId: ObjectId;
    agentId: ObjectId;
    date: string; // YYYY-MM-DD format
    lead_count: number;
    is_available: boolean;
    alert_sent: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const agentDailyWorkloadSchema = new Schema<IAgentDailyWorkload>(
    {
        orgId: { type: Schema.Types.ObjectId, required: true, index: true },
        agentId: { ...UserRef, required: true },
        date: { type: String, required: true },
        lead_count: { type: Number, default: 0 },
        is_available: { type: Boolean, default: true },
        alert_sent: { type: Boolean, default: false },
    },
    { timestamps: true }
);

agentDailyWorkloadSchema.index({ orgId: 1, agentId: 1, date: 1 }, { unique: true });

export const AgentDailyWorkloadModel = model<IAgentDailyWorkload>(
    "AgentDailyWorkload",
    agentDailyWorkloadSchema
);
