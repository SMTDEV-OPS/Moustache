import { Schema, model, Document } from "mongoose";

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "BOOLEAN" | "TEXTAREA" | "MULTI_SELECT" | "PHONE" | "URL";
export type CustomFieldModule = "leads" | "contacts" | "accounts" | "tickets";
export type EntityType = "lead" | "contact" | "deal";

export interface ICustomFieldOptions {
    label: string;
    value: string;
}

export interface ICustomField extends Document {
    module?: CustomFieldModule; // Legacy support
    entity_type: EntityType;
    fieldName?: string; // Legacy support
    name: string; // The backend key/slug
    slug: string;
    label: string; // The display name, e.g., 'Company Size'
    dataType: CustomFieldType;
    options?: ICustomFieldOptions[]; // Only applicable for DROPDOWN types
    isRequired: boolean;
    mandatory_at_stage_id?: Schema.Types.ObjectId; // References PipelineStage
    is_tag: boolean;
    is_unique_identifier: boolean;
    utm_capture: boolean;
    order?: number; // Legacy UI rendering order
    display_order: number;
    isActive: boolean; // Legacy
    is_active: boolean; // New standard
    createdAt: Date;
    updatedAt: Date;
}

const customFieldOptionSchema = new Schema<ICustomFieldOptions>(
    {
        label: { type: String, required: true },
        value: { type: String, required: true },
    },
    { _id: false }
);

const customFieldSchema = new Schema<ICustomField>(
    {
        module: {
            type: String,
            enum: ["leads", "contacts", "accounts", "tickets"],
            required: false, // Made optional to support new entity_type
            index: true,
        },
        entity_type: {
            type: String,
            enum: ["lead", "contact", "deal"],
            default: "lead",
        },
        fieldName: { type: String, required: false }, // Legacy
        name: { type: String, required: true },
        slug: { type: String, required: true },
        label: { type: String, required: true },
        dataType: {
            type: String,
            enum: ["TEXT", "NUMBER", "DATE", "DROPDOWN", "BOOLEAN", "TEXTAREA", "MULTI_SELECT", "PHONE", "URL"],
            required: true,
        },
        options: {
            type: [customFieldOptionSchema],
            default: undefined,
        },
        isRequired: { type: Boolean, default: false },
        mandatory_at_stage_id: { type: Schema.Types.ObjectId, ref: "PipelineStage" },
        is_tag: { type: Boolean, default: false },
        is_unique_identifier: { type: Boolean, default: false },
        utm_capture: { type: Boolean, default: false },
        order: { type: Number, default: 0 },
        display_order: { type: Number, default: 0 },
        isActive: { type: Boolean, default: true },
        is_active: { type: Boolean, default: true },
    },
    { timestamps: true }
);

// A fieldName must be unique within a specific module (Legacy)
customFieldSchema.index({ module: 1, fieldName: 1 }, { unique: true, sparse: true });
customFieldSchema.index({ module: 1, isActive: 1, order: 1 });

// New Standard Indices
customFieldSchema.index({ entity_type: 1, name: 1 }, { unique: true });
customFieldSchema.index({ entity_type: 1, slug: 1 }, { unique: true });
customFieldSchema.index({ entity_type: 1, is_active: 1, display_order: 1 });
customFieldSchema.index({ is_unique_identifier: 1 });
customFieldSchema.index({ utm_capture: 1 });

export const CustomFieldModel = model<ICustomField>("CustomField", customFieldSchema);
