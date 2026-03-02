import { Schema, model, Document } from "mongoose";
import { ObjectId, RoleRef } from "./common";

export interface IDataSharingRule extends Document {
    module: string;            // e.g. "leads", "contacts"
    fromType: 'role' | 'group';
    fromId: ObjectId;          // Role or Group ID
    toType: 'role' | 'group';
    toId: ObjectId;
    accessLevel: 'read' | 'read_write' | 'full';  // read_write excludes delete; full = read+write+delete
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const dataSharingRuleSchema = new Schema<IDataSharingRule>(
    {
        module: { type: String, required: true, index: true },
        fromType: { type: String, enum: ['role', 'group'], required: true },
        fromId: { type: Schema.Types.ObjectId, required: true },
        toType: { type: String, enum: ['role', 'group'], required: true },
        toId: { type: Schema.Types.ObjectId, required: true },
        accessLevel: { type: String, enum: ['read', 'read_write', 'full'], required: true },
        isActive: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// Compound index for efficient querying by module and recipient
dataSharingRuleSchema.index({ module: 1, toType: 1, toId: 1, isActive: 1 });

export const DataSharingRuleModel = model<IDataSharingRule>("DataSharingRule", dataSharingRuleSchema);
