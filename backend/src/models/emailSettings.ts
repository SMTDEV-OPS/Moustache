import { Schema, model, Document, Types } from "mongoose";

export interface IEmailSettings extends Document {
  key: string; // Unique key for singleton pattern
  allowedProviders: ("GMAIL" | "OUTLOOK" | "SMTP_IMAP")[];
  updatedBy: Types.ObjectId | string; // User ID who last updated
  updatedAt: Date;
  createdAt: Date;
}

const SETTINGS_KEY = "email_settings_singleton";

const emailSettingsSchema = new Schema<IEmailSettings>(
  {
    key: { type: String, unique: true, default: SETTINGS_KEY },
    allowedProviders: {
      type: [String],
      enum: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
      default: ["GMAIL", "OUTLOOK", "SMTP_IMAP"], // All providers allowed by default
    },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Helper function to get or create settings
export async function getEmailSettings(): Promise<IEmailSettings> {
  // Explicitly query by key field, not _id
  let settings = await EmailSettingsModel.findOne({ key: SETTINGS_KEY }).exec();
  if (!settings) {
    // Create with a dummy system user ID (you might want to use a real system user)
    settings = await EmailSettingsModel.create({
      key: SETTINGS_KEY,
      allowedProviders: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
      updatedBy: new Types.ObjectId("000000000000000000000000"), // System user
    });
  }
  return settings;
}

export const EmailSettingsModel = model<IEmailSettings>("EmailSettings", emailSettingsSchema);

