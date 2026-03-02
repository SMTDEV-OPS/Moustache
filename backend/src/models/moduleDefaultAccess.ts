import { Schema, model, Document } from "mongoose";

export type DataSharingDefaultAccess = 'private' | 'public_read' | 'public_read_write' | 'public_full';

export interface IModuleDefaultAccess extends Document {
    module: string;
    defaultAccess: DataSharingDefaultAccess;
    createdAt: Date;
    updatedAt: Date;
}

const moduleDefaultAccessSchema = new Schema<IModuleDefaultAccess>(
    {
        module: { type: String, required: true, unique: true },
        defaultAccess: {
            type: String,
            enum: ['private', 'public_read', 'public_read_write', 'public_full'],
            required: true,
            default: 'private'
        },
    },
    { timestamps: true }
);

export const ModuleDefaultAccessModel = model<IModuleDefaultAccess>("ModuleDefaultAccess", moduleDefaultAccessSchema);
