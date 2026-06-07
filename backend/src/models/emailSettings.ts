import { Schema, model, Document, Types } from "mongoose";
import { encryptPassword, decryptPassword } from "./emailAccount";

export interface IGoogleWorkspaceConfig {
  enabled: boolean;
  domain: string;
  serviceAccountClientEmail: string;
  serviceAccountPrivateKey: string;
  delegatedAdminEmail?: string;
  lastVerifiedAt?: Date;
}

export interface IEmailSettings extends Document {
  key: string;
  allowedProviders: ("GMAIL" | "OUTLOOK" | "SMTP_IMAP")[];
  googleWorkspace?: IGoogleWorkspaceConfig;
  updatedBy: Types.ObjectId | string;
  updatedAt: Date;
  createdAt: Date;
}

const SETTINGS_KEY = "email_settings_singleton";

const googleWorkspaceSchema = new Schema<IGoogleWorkspaceConfig>(
  {
    enabled: { type: Boolean, default: false },
    domain: { type: String, default: "" },
    serviceAccountClientEmail: { type: String, default: "" },
    serviceAccountPrivateKey: {
      type: String,
      default: "",
      set: (value: string) => (value ? encryptPassword(value) : ""),
      get: (value: string) => (value ? decryptPassword(value) : ""),
    },
    delegatedAdminEmail: { type: String },
    lastVerifiedAt: { type: Date },
  },
  { _id: false, toJSON: { getters: true }, toObject: { getters: true } }
);

const emailSettingsSchema = new Schema<IEmailSettings>(
  {
    key: { type: String, unique: true, default: SETTINGS_KEY },
    allowedProviders: {
      type: [String],
      enum: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
      default: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
    },
    googleWorkspace: { type: googleWorkspaceSchema },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

export async function getEmailSettings(): Promise<IEmailSettings> {
  let settings = await EmailSettingsModel.findOne({ key: SETTINGS_KEY }).exec();
  if (!settings) {
    settings = await EmailSettingsModel.create({
      key: SETTINGS_KEY,
      allowedProviders: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
      updatedBy: new Types.ObjectId("000000000000000000000000"),
    });
  }
  return settings;
}

export const EmailSettingsModel = model<IEmailSettings>("EmailSettings", emailSettingsSchema);
