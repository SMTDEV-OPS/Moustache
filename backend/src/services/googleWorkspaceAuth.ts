import { google } from "googleapis";
import { getEmailSettings, IGoogleWorkspaceConfig } from "../models/emailSettings";

export const GMAIL_WORKSPACE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/userinfo.email",
];

export async function getGoogleWorkspaceConfig(): Promise<IGoogleWorkspaceConfig | null> {
  const settings = await getEmailSettings();
  const ws = settings.googleWorkspace;
  if (!ws?.enabled) return null;
  if (!ws.domain?.trim() || !ws.serviceAccountClientEmail?.trim() || !ws.serviceAccountPrivateKey?.trim()) {
    return null;
  }
  return ws;
}

export async function createWorkspaceJwt(subjectEmail: string) {
  const ws = await getGoogleWorkspaceConfig();
  if (!ws) throw new Error("Google Workspace is not configured");

  const jwt = new google.auth.JWT({
    email: ws.serviceAccountClientEmail,
    key: ws.serviceAccountPrivateKey.replace(/\\n/g, "\n"),
    scopes: GMAIL_WORKSPACE_SCOPES,
    subject: subjectEmail,
  });

  await jwt.authorize();
  return jwt;
}
