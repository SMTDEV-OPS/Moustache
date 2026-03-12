import { Schema, model, Document, Types } from "mongoose";

export type IntegrationStatus = "connected" | "error" | "pending" | "disconnected";

export interface IIntegrationConfig extends Document {
  orgId: Types.ObjectId;
  provider: string;
  config_json: string; // encrypted at rest
  webhook_url?: string;
  is_active: boolean;
  last_verified_at?: Date;
  status: IntegrationStatus;
  createdAt: Date;
  updatedAt: Date;
}

const integrationConfigSchema = new Schema<IIntegrationConfig>(
  {
    orgId: { type: Schema.Types.ObjectId, required: true, index: true },
    provider: { type: String, required: true },
    config_json: { type: String, required: true }, // encrypted
    webhook_url: { type: String },
    is_active: { type: Boolean, default: true },
    last_verified_at: { type: Date },
    status: {
      type: String,
      enum: ["connected", "error", "pending", "disconnected"],
      default: "pending",
    },
  },
  { timestamps: true }
);

integrationConfigSchema.index({ orgId: 1, provider: 1 }, { unique: true });

export const IntegrationConfigModel = model<IIntegrationConfig>(
  "IntegrationConfig",
  integrationConfigSchema
);
