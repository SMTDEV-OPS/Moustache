import { Schema, model, Document, Types } from "mongoose";
import { UserRef } from "./common";
import CryptoJS from "crypto-js";

export type EmailProvider = "GMAIL" | "OUTLOOK" | "SMTP_IMAP";
export type SyncStatus = "IDLE" | "SYNCING" | "ERROR";

export interface IOAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string;
}

export interface ISMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string; // Will be encrypted
}

export interface IIMAPConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string; // Will be encrypted
}

export interface IEmailAccount extends Document {
  userId: Types.ObjectId;
  provider: EmailProvider;
  email: string;
  isActive: boolean;
  isPrimary: boolean;
  isLeadCaptureEnabled: boolean; // TRUE for Company emails, FALSE for personal/agent emails

  // OAuth (Gmail/Outlook)
  oauth?: IOAuthCredentials;

  // SMTP/IMAP (Generic)
  smtp?: ISMTPConfig;
  imap?: IIMAPConfig;

  lastSyncAt?: Date;
  syncStatus: SyncStatus;
  syncError?: string;
  createdAt: Date;
  updatedAt: Date;
}

// Encryption key (should be in environment variable in production)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-key-change-in-production";

// Helper functions for encryption/decryption
export const encryptPassword = (password: string): string => {
  return CryptoJS.AES.encrypt(password, ENCRYPTION_KEY).toString();
};

export const decryptPassword = (encryptedPassword: string): string => {
  const bytes = CryptoJS.AES.decrypt(encryptedPassword, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const oauthCredentialsSchema = new Schema<IOAuthCredentials>(
  {
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String, required: true },
  },
  { _id: false }
);

const smtpConfigSchema = new Schema<ISMTPConfig>(
  {
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    username: { type: String, required: true },
    password: {
      type: String,
      required: true,
      set: (value: string) => encryptPassword(value),
    },
  },
  { _id: false }
);

const imapConfigSchema = new Schema<IIMAPConfig>(
  {
    host: { type: String, required: true },
    port: { type: Number, required: true },
    secure: { type: Boolean, default: true },
    username: { type: String, required: true },
    password: {
      type: String,
      required: true,
      set: (value: string) => encryptPassword(value),
    },
  },
  { _id: false }
);

const emailAccountSchema = new Schema<IEmailAccount>(
  {
    userId: { ...UserRef, required: true, index: true },
    provider: {
      type: String,
      enum: ["GMAIL", "OUTLOOK", "SMTP_IMAP"],
      required: true,
    },
    email: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isPrimary: { type: Boolean, default: false },
    isLeadCaptureEnabled: { type: Boolean, default: false },
    oauth: { type: oauthCredentialsSchema },
    smtp: { type: smtpConfigSchema },
    imap: { type: imapConfigSchema },
    lastSyncAt: { type: Date },
    syncStatus: {
      type: String,
      enum: ["IDLE", "SYNCING", "ERROR"],
      default: "IDLE",
    },
    syncError: { type: String },
  },
  { timestamps: true }
);

// Ensure only one primary account per user
emailAccountSchema.index({ userId: 1, isPrimary: 1 }, { unique: true, partialFilterExpression: { isPrimary: true } });

// Ensure unique email per user
emailAccountSchema.index({ userId: 1, email: 1 }, { unique: true });

export const EmailAccountModel = model<IEmailAccount>("EmailAccount", emailAccountSchema);

