import { Schema, model, Document } from "mongoose";

export type TemplateMedium = "EMAIL" | "WHATSAPP";

export interface ITemplate extends Document {
  name: string;
  medium: TemplateMedium;
  subject?: string; // For EMAIL only
  body: string; // Supports placeholders like {{guestName}}, {{propertyName}}, {{checkInDate}}
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const templateSchema = new Schema<ITemplate>(
  {
    name: { type: String, required: true, unique: true },
    medium: {
      type: String,
      enum: ["EMAIL", "WHATSAPP"],
      required: true,
      index: true,
    },
    subject: { type: String }, // Only used for EMAIL
    body: { type: String, required: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export const TemplateModel = model<ITemplate>("Template", templateSchema);

