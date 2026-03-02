import { Schema, model, Document } from "mongoose";
import { ALL_PERMISSIONS } from "../constants/permissions";

export interface IModulePermission {
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export interface ISetupPermission {
    key: string;
    enabled: boolean;
}

export interface IProfile extends Document {
    name: string;
    description?: string;
    // Zoho-style grouped permissions
    modulePermissions: IModulePermission[];
    setupPermissions: ISetupPermission[];
    clonedFrom?: Schema.Types.ObjectId;
    isSystemProfile: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const modulePermissionSchema = new Schema<IModulePermission>({
    module: { type: String, required: true },
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false }
}, { _id: false });

const setupPermissionSchema = new Schema<ISetupPermission>({
    key: { type: String, required: true },
    enabled: { type: Boolean, default: false }
}, { _id: false });

const profileSchema = new Schema<IProfile>(
    {
        name: { type: String, required: true, unique: true },
        description: { type: String },
        modulePermissions: [modulePermissionSchema],
        setupPermissions: [setupPermissionSchema],
        clonedFrom: { type: Schema.Types.ObjectId, ref: "Profile" },
        isSystemProfile: { type: Boolean, default: false },
    },
    { timestamps: true }
);

export const ProfileModel = model<IProfile>("Profile", profileSchema);
