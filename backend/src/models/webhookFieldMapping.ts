import { Schema, model, Document, Types } from "mongoose";

export type WebhookTransform =
  | "none"
  | "uppercase"
  | "lowercase"
  | "phone_normalize"
  | "date_parse";

export interface IWebhookFieldMapping extends Document {
  orgId: Types.ObjectId;
  integrationConfigId: Types.ObjectId;
  source_field: string;
  target_field_slug: string;
  transform: WebhookTransform;
  createdAt: Date;
  updatedAt: Date;
}

const webhookFieldMappingSchema = new Schema<IWebhookFieldMapping>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    integrationConfigId: {
      type: Schema.Types.ObjectId,
      ref: "IntegrationConfig",
      required: true,
      index: true,
    },
    source_field: { type: String, required: true },
    target_field_slug: { type: String, required: true },
    transform: {
      type: String,
      enum: ["none", "uppercase", "lowercase", "phone_normalize", "date_parse"],
      default: "none",
    },
  },
  { timestamps: true }
);

webhookFieldMappingSchema.index({
  integrationConfigId: 1,
  source_field: 1,
});

export const WebhookFieldMappingModel = model<IWebhookFieldMapping>(
  "WebhookFieldMapping",
  webhookFieldMappingSchema
);
