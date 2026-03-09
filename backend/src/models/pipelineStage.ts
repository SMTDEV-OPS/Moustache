import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPipelineStage extends Document {
    name: string;
    pipelineId: Types.ObjectId;
    description?: string;
    order: number;
    color?: string; // hex code for UI
    probability?: number; // 0-100 indicating win likelihood
    isTerminal: boolean; // Is it the end of the line (Won/Lost)?
    terminalType?: "WON" | "LOST"; // Only if isTerminal is true
    mandatory_fields_json: string[]; // array of custom field IDs required to enter this stage
    createdAt: Date;
    updatedAt: Date;
}

const pipelineStageSchema = new Schema<IPipelineStage>({
    name: { type: String, required: true },
    pipelineId: { type: Schema.Types.ObjectId, ref: "Pipeline", required: true },
    description: { type: String },
    order: { type: Number, required: true },
    color: { type: String },
    probability: { type: Number, min: 0, max: 100 },
    isTerminal: { type: Boolean, default: false },
    terminalType: { type: String, enum: ["WON", "LOST"] },
    mandatory_fields_json: [{ type: String }],
}, {
    timestamps: true,
});

pipelineStageSchema.index({ pipelineId: 1, order: 1 });

export const PipelineStageModel = mongoose.model<IPipelineStage>("PipelineStage", pipelineStageSchema);
