import { google } from "googleapis";
import { Types } from "mongoose";
import { getEmailSettings, EmailSettingsModel, IGoogleWorkspaceConfig } from "../models/emailSettings";
import { EmailAccountModel, IEmailAccount } from "../models/emailAccount";
import { logger } from "../config/logger";
import { createWorkspaceJwt, getGoogleWorkspaceConfig } from "./googleWorkspaceAuth";

export type GoogleWorkspaceConfigPublic = {
  enabled: boolean;
  domain: string;
  serviceAccountClientEmail: string;
  hasPrivateKey: boolean;
  delegatedAdminEmail?: string;
  lastVerifiedAt?: string;
  isConfigured: boolean;
  isVerified: boolean;
};

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^@/, "");
}

function emailDomain(email: string): string {
  const parts = email.trim().toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : "";
}

export function toPublicWorkspaceConfig(ws?: IGoogleWorkspaceConfig | null): GoogleWorkspaceConfigPublic {
  if (!ws) {
    return {
      enabled: false,
      domain: "",
      serviceAccountClientEmail: "",
      hasPrivateKey: false,
      isConfigured: false,
      isVerified: false,
    };
  }
  const hasPrivateKey = Boolean(ws.serviceAccountPrivateKey?.trim());
  const isConfigured = Boolean(
    ws.enabled && ws.domain?.trim() && ws.serviceAccountClientEmail?.trim() && hasPrivateKey
  );
  return {
    enabled: Boolean(ws.enabled),
    domain: ws.domain || "",
    serviceAccountClientEmail: ws.serviceAccountClientEmail || "",
    hasPrivateKey,
    delegatedAdminEmail: ws.delegatedAdminEmail,
    lastVerifiedAt: ws.lastVerifiedAt?.toISOString(),
    isConfigured,
    isVerified: Boolean(isConfigured && ws.lastVerifiedAt),
  };
}

export async function getPublicWorkspaceConfig(): Promise<GoogleWorkspaceConfigPublic> {
  const settings = await getEmailSettings();
  return toPublicWorkspaceConfig(settings.googleWorkspace);
}

export function isEmailInWorkspaceDomain(userEmail: string, domain: string): boolean {
  const d = normalizeDomain(domain);
  if (!d) return false;
  return emailDomain(userEmail) === d;
}

export async function verifyWorkspaceConnection(testEmail: string): Promise<boolean> {
  const gmail = google.gmail({ version: "v1", auth: await createWorkspaceJwt(testEmail) });
  const profile = await gmail.users.getProfile({ userId: "me" });
  return Boolean(profile.data.emailAddress);
}

export async function ensureWorkspaceEmailAccount(
  userId: string,
  userEmail: string
): Promise<IEmailAccount | null> {
  const ws = await getGoogleWorkspaceConfig();
  if (!ws || !ws.lastVerifiedAt) return null;
  if (!isEmailInWorkspaceDomain(userEmail, ws.domain)) return null;

  const userObjectId = new Types.ObjectId(userId);
  const normalizedEmail = userEmail.trim().toLowerCase();

  let account = await EmailAccountModel.findOne({
    userId: userObjectId,
    email: normalizedEmail,
  }).exec();

  if (account) {
    account.authMode = "WORKSPACE_DWD";
    account.provider = "GMAIL";
    account.isActive = true;
    await account.save();
  } else {
    await EmailAccountModel.updateMany({ userId: userObjectId }, { isPrimary: false });
    account = await EmailAccountModel.create({
      userId: userObjectId,
      provider: "GMAIL",
      authMode: "WORKSPACE_DWD",
      email: normalizedEmail,
      isActive: true,
      isPrimary: true,
      isLeadCaptureEnabled: false,
      syncStatus: "IDLE",
    });
  }

  void import("./emailService")
    .then(({ syncEmails }) => syncEmails(account!._id.toString()))
    .catch((err) => {
      logger.warn("Background workspace email sync failed", {
        userId,
        email: normalizedEmail,
        err: err instanceof Error ? err.message : String(err),
      });
    });

  return account;
}

export async function clearWorkspaceConfig(updatedByUserId: string): Promise<void> {
  await EmailSettingsModel.findOneAndUpdate(
    { key: "email_settings_singleton" },
    {
      $set: {
        googleWorkspace: {
          enabled: false,
          domain: "",
          serviceAccountClientEmail: "",
          serviceAccountPrivateKey: "",
          delegatedAdminEmail: "",
        },
        updatedBy: new Types.ObjectId(updatedByUserId),
      },
    },
    { upsert: true }
  ).exec();
}
