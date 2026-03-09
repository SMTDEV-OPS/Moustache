import mongoose, { Schema, Document } from "mongoose";

export interface IPipeline extends Document {
    name: string;
    description?: string;
    module: string; // e.g., 'leads'
    isActive: boolean;
    isDefault: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const pipelineSchema = new Schema<IPipeline>({
    name: { type: String, required: true },
    description: { type: String },
    module: { type: String, required: true, default: "leads" },
    isActive: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
}, {
    timestamps: true,
});

// Avoid multiple default pipelines per module
pipelineSchema.pre("save", async function (next) {
    if (this.isDefault) {
        await mongoose.models.Pipeline.updateMany(
            { module: this.module, _id: { $ne: this._id } },
            { $set: { isDefault: false } }
        );
    }
    next();
});

export const PipelineModel = mongoose.model<IPipeline>("Pipeline", pipelineSchema);
