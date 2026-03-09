import { Schema, model, Document } from "mongoose";
import { ObjectId } from "./common";

export interface IAllocationConfig extends Document {
    orgId: ObjectId;
    key: string;
    value: string;
    description: string;
    createdAt: Date;
    updatedAt: Date;
}

const allocationConfigSchema = new Schema<IAllocationConfig>(
    {
        orgId: { type: Schema.Types.ObjectId, required: true, index: true },
        key: { type: String, required: true },
        value: { type: String, required: true },
        description: { type: String },
    },
    { timestamps: true }
);

allocationConfigSchema.index({ orgId: 1, key: 1 }, { unique: true });

export const AllocationConfigModel = model<IAllocationConfig>(
    "AllocationConfig",
    allocationConfigSchema
);
