import { Schema, model, Document, Types } from "mongoose";
import { UserRef } from "./common";

export type SavedFilterEntityType = "lead" | "contact" | "deal";

export interface IFilterCondition {
  field: string;
  operator: string;
  value?: any;
}

export interface IFilterJson {
  conditions: IFilterCondition[];
  logic?: "AND" | "OR";
}

export interface ISavedFilter extends Document {
  orgId: Types.ObjectId;
  name: string;
  entity_type: SavedFilterEntityType;
  filter_json: IFilterJson;
  is_system: boolean;
  created_by?: Types.ObjectId;
  is_shared: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const savedFilterSchema = new Schema<ISavedFilter>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true },
    entity_type: {
      type: String,
      enum: ["lead", "contact", "deal"],
      required: true,
    },
    filter_json: { type: Schema.Types.Mixed, required: true },
    is_system: { type: Boolean, default: false },
    created_by: { ...UserRef, required: false },
    is_shared: { type: Boolean, default: false },
  },
  { timestamps: true }
);

savedFilterSchema.index({ orgId: 1, entity_type: 1 });
savedFilterSchema.index({ orgId: 1, created_by: 1 });
savedFilterSchema.index({ orgId: 1, name: 1 }, { unique: true });

export const SavedFilterModel = model<ISavedFilter>("SavedFilter", savedFilterSchema);
