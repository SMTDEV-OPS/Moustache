import { Router } from "express";
import { z } from "zod";
import { Types } from "mongoose";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { EmailAccountModel } from "../models/emailAccount";
import { EmailMessageModel } from "../models/emailMessage";
import { EmailSettingsModel, getEmailSettings } from "../models/emailSettings";
import {
  connectGmail,
  connectOutlook,
  connectSMTP,
  sendEmail,
  syncEmails,
  getPrimaryEmailAccount,
  testSMTPConnection,
} from "../services/emailService";
import { badRequest, notFound } from "../utils/httpError";
import { google } from "googleapis";
import { Client } from "@microsoft/microsoft-graph-client";
import { logger } from "../config/logger";

export const emailRouter = Router();

// In-memory store for OAuth state (in production, use Redis or similar)
const oauthStateStore = new Map<string, { userId: string; timestamp: number }>();

// Clean up old OAuth states (older than 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [state, data] of oauthStateStore.entries()) {
    if (now - data.timestamp > 10 * 60 * 1000) {
      oauthStateStore.delete(state);
    }
  }
}, 5 * 60 * 1000); // Run cleanup every 5 minutes

// Helper function to check if a provider is allowed
async function isProviderAllowed(provider: "GMAIL" | "OUTLOOK" | "SMTP_IMAP"): Promise<boolean> {
  const settings = await getEmailSettings();
  return settings.allowedProviders.includes(provider);
}

// ============================================
// OAuth Callback Routes (Public - called by Google/Microsoft)
// ============================================

// Helper function to send OAuth callback response (popup or redirect)
function sendOAuthCallback(res: any, isPopup: boolean, success: boolean, data: { email?: string; accountId?: string; error?: string; errorCode?: string }) {
  if (isPopup) {
    // Return HTML page that uses postMessage for popup communication
    const message = success
      ? { type: "OAUTH_SUCCESS", email: data.email, accountId: data.accountId }
      : { type: "OAUTH_ERROR", error: data.error, errorCode: data.errorCode };

    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${success ? "Connection Successful" : "Connection Failed"}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 2rem;
          }
          .success { color: #059669; }
          .error { color: #dc2626; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="${success ? "success" : "error"}">${success ? "✓ Connected Successfully" : "✗ Connection Failed"}</h1>
          <p>${success ? "You can close this window." : data.error || "An error occurred"}</p>
        </div>
        <script>
          if (window.opener) {
            window.opener.postMessage(${JSON.stringify(message)}, window.location.origin);
            setTimeout(() => window.close(), 2000);
          } else {
            window.location.href = "${process.env.FRONTEND_URL || "http://localhost:8080"}/email-settings?${success ? `success=gmail_connected&email=${encodeURIComponent(data.email || "")}` : `error=${encodeURIComponent(data.error || "unknown_error")}`}";
          }
        </script>
      </body>
      </html>
    `);
  } else {
    // Fallback to redirect for non-popup scenarios
    if (success) {
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:8080"}/email-settings?success=gmail_connected&email=${encodeURIComponent(data.email || "")}`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:8080"}/email-settings?error=${encodeURIComponent(data.error || "unknown_error")}${data.errorCode ? `&errorCode=${encodeURIComponent(data.errorCode)}` : ""}`);
    }
  }
}

// GET /email/accounts/connect/gmail/callback - OAuth callback (Google redirects here)
emailRouter.get("/accounts/connect/gmail/callback", async (req, res, next) => {
  try {
    const { code, state, error, popup } = req.query;
    const isPopup = popup === "true";

    logger.info("Gmail OAuth callback received", { hasCode: !!code, hasState: !!state, hasError: !!error, isPopup });

    if (error) {
      logger.error("Gmail OAuth error", { error });
      return sendOAuthCallback(res, isPopup, false, { error: error as string, errorCode: "OAUTH_ERROR" });
    }

    if (!code || !state) {
      logger.warn("Gmail OAuth callback missing code or state");
      return sendOAuthCallback(res, isPopup, false, { error: "Missing authorization code or state", errorCode: "MISSING_CODE_OR_STATE" });
    }

    // Verify state
    const stateData = oauthStateStore.get(state as string);
    if (!stateData) {
      logger.warn("Gmail OAuth invalid state", { state });
      return sendOAuthCallback(res, isPopup, false, { error: "Invalid state parameter", errorCode: "INVALID_STATE" });
    }

    const userId = stateData.userId;
    oauthStateStore.delete(state as string); // Clean up used state
    logger.info("Gmail OAuth state verified", { userId });

    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/email/accounts/connect/gmail/callback";

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      redirectUri
    );

    const { tokens } = await oauth2Client.getToken(code as string);

    if (!tokens.access_token || !tokens.refresh_token) {
      return sendOAuthCallback(res, isPopup, false, { error: "Failed to obtain access tokens", errorCode: "TOKEN_FETCH_FAILED" });
    }

    // Get user email
    oauth2Client.setCredentials(tokens);
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      return sendOAuthCallback(res, isPopup, false, { error: "Could not retrieve email address", errorCode: "EMAIL_RETRIEVAL_FAILED" });
    }

    const account = await connectGmail(
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expiry_date ? Math.floor((tokens.expiry_date - Date.now()) / 1000) : 3600,
      email
    );

    logger.info("Gmail account connected successfully", { userId, email, accountId: account._id });
    return sendOAuthCallback(res, isPopup, true, { email, accountId: account._id.toString() });
  } catch (err) {
    logger.error("Gmail OAuth callback error", {}, err instanceof Error ? err : new Error(String(err)));
    const errorMsg = err instanceof Error ? err.message : "unknown_error";
    const errorCode = err instanceof Error && err.message.includes("token") ? "TOKEN_EXPIRED" : "UNKNOWN_ERROR";
    return sendOAuthCallback(res, req.query.popup === "true", false, { error: errorMsg, errorCode });
  }
});

// GET /email/accounts/connect/outlook/callback - OAuth callback (Microsoft redirects here)
emailRouter.get("/accounts/connect/outlook/callback", async (req, res, next) => {
  try {
    const { code, state, error, popup } = req.query;
    const isPopup = popup === "true";

    logger.info("Outlook OAuth callback received", { hasCode: !!code, hasState: !!state, hasError: !!error, isPopup });

    if (error) {
      logger.error("Outlook OAuth error", { error });
      return sendOAuthCallback(res, isPopup, false, { error: error as string, errorCode: "OAUTH_ERROR" });
    }

    if (!code || !state) {
      logger.warn("Outlook OAuth callback missing code or state");
      return sendOAuthCallback(res, isPopup, false, { error: "Missing authorization code or state", errorCode: "MISSING_CODE_OR_STATE" });
    }

    // Verify state
    const stateData = oauthStateStore.get(state as string);
    if (!stateData) {
      logger.warn("Outlook OAuth invalid state", { state });
      return sendOAuthCallback(res, isPopup, false, { error: "Invalid state parameter", errorCode: "INVALID_STATE" });
    }

    const userId = stateData.userId;
    oauthStateStore.delete(state as string); // Clean up used state

    // Exchange code for tokens
    const tokenResponse = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        code: code as string,
        redirect_uri: process.env.MICROSOFT_REDIRECT_URI || "http://localhost:4000/email/accounts/connect/outlook/callback",
        grant_type: "authorization_code",
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read",
      }),
    });

    const tokens = await tokenResponse.json();

    if (!tokens.access_token || !tokens.refresh_token) {
      return sendOAuthCallback(res, isPopup, false, { error: "Failed to obtain access tokens", errorCode: "TOKEN_FETCH_FAILED" });
    }

    // Get user email
    const graphClient = Client.init({
      authProvider: {
        getAccessToken: async () => tokens.access_token,
      } as any, // Type assertion needed due to MS Graph SDK types
    });

    const user = await graphClient.api("/me").get();
    const email = user.mail || user.userPrincipalName;

    if (!email) {
      return sendOAuthCallback(res, isPopup, false, { error: "Could not retrieve email address", errorCode: "EMAIL_RETRIEVAL_FAILED" });
    }

    const account = await connectOutlook(
      userId,
      tokens.access_token,
      tokens.refresh_token,
      tokens.expires_in || 3600,
      email
    );

    logger.info("Outlook account connected successfully", { userId, email, accountId: account._id });
    return sendOAuthCallback(res, isPopup, true, { email, accountId: account._id.toString() });
  } catch (err) {
    logger.error("Outlook OAuth callback error", {}, err instanceof Error ? err : new Error(String(err)));
    const errorMsg = err instanceof Error ? err.message : "unknown_error";
    const errorCode = err instanceof Error && err.message.includes("token") ? "TOKEN_EXPIRED" : "UNKNOWN_ERROR";
    return sendOAuthCallback(res, req.query.popup === "true", false, { error: errorMsg, errorCode });
  }
});

// Apply authentication middleware to all other routes
emailRouter.use(requireAuth);

// ============================================
// Email Account Management
// ============================================

// GET /email/accounts - List user's email accounts
emailRouter.get("/accounts", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw badRequest("User not authenticated");
    }

    const accounts = await EmailAccountModel.find({ userId }).sort({ isPrimary: -1, createdAt: -1 }).lean();

    // Don't expose sensitive data
    const sanitized = accounts.map((acc) => ({
      id: acc._id,
      provider: acc.provider,
      email: acc.email,
      isActive: acc.isActive,
      isPrimary: acc.isPrimary,
      isLeadCaptureEnabled: acc.isLeadCaptureEnabled ?? false,
      lastSyncAt: acc.lastSyncAt,
      syncStatus: acc.syncStatus,
      syncError: acc.syncError,
    }));

    res.json(sanitized);
  } catch (err) {
    next(err);
  }
});

// POST /email/accounts/connect/gmail - Start Gmail OAuth flow
emailRouter.post("/accounts/connect/gmail", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw badRequest("User not authenticated");
    }

    // Check if Gmail is allowed
    if (!(await isProviderAllowed("GMAIL"))) {
      throw badRequest("Gmail provider is not enabled by administrator");
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw badRequest("Google OAuth credentials not configured");
    }

    const usePopup = req.body?.popup === true;
    const baseRedirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/email/accounts/connect/gmail/callback";
    const redirectUri = usePopup ? `${baseRedirectUri}?popup=true` : baseRedirectUri;

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      baseRedirectUri // Use base URI for OAuth client, but add popup param to callback
    );

    const scopes = [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ];

    // Generate a random state token
    const state = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    oauthStateStore.set(state, { userId, timestamp: Date.now() });

    // Generate auth URL with explicit redirect_uri to ensure it's included
    let authUrl = oauth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      state: state,
      prompt: "consent", // Force consent screen to get refresh token
      redirect_uri: baseRedirectUri, // Explicitly include to ensure Google receives it
    });

    // Add popup parameter to state so callback knows it's a popup
    if (usePopup) {
      authUrl += `&popup=true`;
    }

    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
});

// POST /email/accounts/connect/outlook - Start Outlook OAuth flow
emailRouter.post("/accounts/connect/outlook", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw badRequest("User not authenticated");
    }

    // Check if Outlook is allowed
    if (!(await isProviderAllowed("OUTLOOK"))) {
      throw badRequest("Outlook provider is not enabled by administrator");
    }

    const usePopup = req.body?.popup === true;
    const baseRedirectUri = process.env.MICROSOFT_REDIRECT_URI || "http://localhost:4000/email/accounts/connect/outlook/callback";
    const redirectUri = usePopup ? `${baseRedirectUri}?popup=true` : baseRedirectUri;

    // Generate a random state token
    const state = `${userId}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    oauthStateStore.set(state, { userId, timestamp: Date.now() });

    let authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?` +
      `client_id=${process.env.MICROSOFT_CLIENT_ID}&` +
      `response_type=code&` +
      `redirect_uri=${encodeURIComponent(baseRedirectUri)}&` +
      `response_mode=query&` +
      `scope=${encodeURIComponent("https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/User.Read")}&` +
      `state=${state}`;

    // Add popup parameter
    if (usePopup) {
      authUrl += `&popup=true`;
    }

    res.json({ authUrl });
  } catch (err) {
    next(err);
  }
});

// POST /email/accounts/test-smtp - Test SMTP/IMAP connection
const testSMTPSchema = z.object({
  smtp: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }),
  imap: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }),
});

emailRouter.post("/accounts/test-smtp", async (req, res, next) => {
  try {
    const parsed = testSMTPSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid SMTP/IMAP test configuration");
    }

    const result = await testSMTPConnection(parsed.data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /email/accounts/connect/smtp - Connect SMTP/IMAP account
const smtpConnectSchema = z.object({
  email: z.string().email(),
  smtp: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }),
  imap: z.object({
    host: z.string(),
    port: z.number().int().positive(),
    secure: z.boolean(),
    username: z.string(),
    password: z.string(),
  }),
});

emailRouter.post("/accounts/connect/smtp", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw badRequest("User not authenticated");
    }

    // Check if SMTP/IMAP is allowed
    if (!(await isProviderAllowed("SMTP_IMAP"))) {
      throw badRequest("SMTP/IMAP provider is not enabled by administrator");
    }

    const parsed = smtpConnectSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid SMTP/IMAP configuration");
    }

    const account = await connectSMTP(userId, parsed.data.email, parsed.data.smtp, parsed.data.imap);
    res.json({ account: { id: account._id, email: account.email, provider: account.provider } });
  } catch (err) {
    next(err);
  }
});

// DELETE /email/accounts/:id - Disconnect email account
emailRouter.delete("/accounts/:id", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const accountId = req.params.id;

    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    await EmailAccountModel.deleteOne({ _id: accountId });
    res.json({ message: "Email account disconnected" });
  } catch (err) {
    next(err);
  }
});

// PATCH /email/accounts/:id - Update email account settings
const updateAccountSchema = z.object({
  isLeadCaptureEnabled: z.boolean().optional(),
});

emailRouter.patch("/accounts/:id", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const accountId = req.params.id;
    const parsed = updateAccountSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload");
    }

    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    if (parsed.data.isLeadCaptureEnabled !== undefined) {
      account.isLeadCaptureEnabled = parsed.data.isLeadCaptureEnabled;
    }

    await account.save();
    res.json({ message: "Email account updated", account });
  } catch (err) {
    next(err);
  }
});

// POST /email/accounts/:id/sync - Trigger manual sync
emailRouter.post("/accounts/:id/sync", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const accountId = req.params.id;

    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    const result = await syncEmails(accountId);
    res.json({
      syncedCount: result.syncedCount,
      errorCode: result.errorCode,
      message: `Synced ${result.syncedCount} emails`
    });
  } catch (err) {
    const error = err as any;
    if (error.errorCode) {
      res.status(400).json({
        error: error.message,
        errorCode: error.errorCode,
      });
    } else {
      next(err);
    }
  }
});

// PATCH /email/accounts/:id/primary - Set as primary account
emailRouter.patch("/accounts/:id/primary", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const accountId = req.params.id;

    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    await EmailAccountModel.updateMany({ userId }, { isPrimary: false });
    account.isPrimary = true;
    await account.save();

    res.json({ message: "Primary account updated" });
  } catch (err) {
    next(err);
  }
});

// ============================================
// Email Messages
// ============================================

// GET /email/messages - List emails
emailRouter.get("/messages", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const { folder, accountId, limit = 50, offset = 0, search } = req.query;

    // Get user's email accounts
    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const filter: any = { emailAccountId: { $in: accountIds } };
    if (folder) filter.folder = folder;
    if (accountId) filter.emailAccountId = accountId;
    if (search) {
      filter.$or = [
        { subject: { $regex: search, $options: "i" } },
        { snippet: { $regex: search, $options: "i" } },
        { "from.email": { $regex: search, $options: "i" } },
      ];
    }

    const messages = await EmailMessageModel.find(filter)
      .sort({ receivedAt: -1, sentAt: -1 })
      .limit(Number(limit))
      .skip(Number(offset))
      .lean();

    const total = await EmailMessageModel.countDocuments(filter);

    res.json({ messages, total, limit: Number(limit), offset: Number(offset) });
  } catch (err) {
    next(err);
  }
});

// GET /email/messages/:id - Get single email
emailRouter.get("/messages/:id", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const messageId = req.params.id;

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const message = await EmailMessageModel.findOne({
      _id: messageId,
      emailAccountId: { $in: accountIds },
    }).lean();

    if (!message) {
      throw notFound("Email not found");
    }

    res.json(message);
  } catch (err) {
    next(err);
  }
});

// GET /email/threads/:threadId - Get email thread
emailRouter.get("/threads/:threadId", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const threadId = req.params.threadId;

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const messages = await EmailMessageModel.find({
      threadId,
      emailAccountId: { $in: accountIds },
    })
      .sort({ receivedAt: 1, sentAt: 1 })
      .lean();

    res.json({ threadId, messages });
  } catch (err) {
    next(err);
  }
});

// POST /email/send - Send email
const sendEmailSchema = z.object({
  accountId: z.string().optional(), // If not provided, use primary account
  to: z.array(z.object({ name: z.string().optional(), email: z.string().email() })),
  cc: z.array(z.object({ name: z.string().optional(), email: z.string().email() })).optional(),
  bcc: z.array(z.object({ name: z.string().optional(), email: z.string().email() })).optional(),
  subject: z.string().min(1),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
  replyTo: z.string().email().optional(),
});

emailRouter.post("/send", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid email payload");
    }

    let accountId = parsed.data.accountId;
    if (!accountId) {
      const primary = await getPrimaryEmailAccount(userId);
      if (!primary) {
        throw badRequest("No email account connected. Please connect an email account first.");
      }
      accountId = primary._id.toString();
    }

    // Verify account belongs to user
    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    const email = await sendEmail(accountId, parsed.data);
    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
});

// POST /email/reply/:messageId - Reply to email
const replyEmailSchema = z.object({
  accountId: z.string().optional(),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
});

emailRouter.post("/reply/:messageId", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const messageId = req.params.messageId;
    const parsed = replyEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid reply payload");
    }

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const originalMessage = await EmailMessageModel.findOne({
      _id: messageId,
      emailAccountId: { $in: accountIds },
    }).exec();

    if (!originalMessage) {
      throw notFound("Original email not found");
    }

    let accountId = parsed.data.accountId || originalMessage.emailAccountId.toString();
    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    // Build reply
    const replyTo = originalMessage.from.email;
    const subject = originalMessage.subject.startsWith("Re:")
      ? originalMessage.subject
      : `Re: ${originalMessage.subject}`;

    const replyBody = parsed.data.bodyHtml || parsed.data.bodyText || "";

    const email = await sendEmail(accountId, {
      to: [{ email: replyTo, name: originalMessage.from.name }],
      subject,
      bodyText: parsed.data.bodyText,
      bodyHtml: parsed.data.bodyHtml,
      replyTo: originalMessage.messageId,
    });

    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
});

// POST /email/forward/:messageId - Forward email
const forwardEmailSchema = z.object({
  accountId: z.string().optional(),
  to: z.array(z.object({ name: z.string().optional(), email: z.string().email() })),
  bodyText: z.string().optional(),
  bodyHtml: z.string().optional(),
});

emailRouter.post("/forward/:messageId", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const messageId = req.params.messageId;
    const parsed = forwardEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid forward payload");
    }

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const originalMessage = await EmailMessageModel.findOne({
      _id: messageId,
      emailAccountId: { $in: accountIds },
    }).exec();

    if (!originalMessage) {
      throw notFound("Original email not found");
    }

    let accountId = parsed.data.accountId || originalMessage.emailAccountId.toString();
    const account = await EmailAccountModel.findOne({ _id: accountId, userId }).exec();
    if (!account) {
      throw notFound("Email account not found");
    }

    const subject = originalMessage.subject.startsWith("Fwd:")
      ? originalMessage.subject
      : `Fwd: ${originalMessage.subject}`;

    const forwardedBody = (parsed.data.bodyHtml || parsed.data.bodyText || "") +
      `\n\n--- Forwarded Message ---\n` +
      `From: ${originalMessage.from.name || originalMessage.from.email}\n` +
      `Date: ${originalMessage.receivedAt || originalMessage.sentAt}\n` +
      `Subject: ${originalMessage.subject}\n\n` +
      (originalMessage.bodyHtml || originalMessage.bodyText || "");

    const email = await sendEmail(accountId, {
      to: parsed.data.to,
      subject,
      bodyText: parsed.data.bodyText ? parsed.data.bodyText + forwardedBody : undefined,
      bodyHtml: parsed.data.bodyHtml ? parsed.data.bodyHtml + forwardedBody.replace(/\n/g, "<br>") : undefined,
    });

    res.status(201).json(email);
  } catch (err) {
    next(err);
  }
});

// PATCH /email/messages/:id - Update email (read, star, move)
const updateEmailSchema = z.object({
  isRead: z.boolean().optional(),
  isStarred: z.boolean().optional(),
  folder: z.string().optional(),
});

emailRouter.patch("/messages/:id", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const messageId = req.params.id;
    const parsed = updateEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid update payload");
    }

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const message = await EmailMessageModel.findOneAndUpdate(
      { _id: messageId, emailAccountId: { $in: accountIds } },
      { $set: parsed.data },
      { new: true }
    ).lean();

    if (!message) {
      throw notFound("Email not found");
    }

    res.json(message);
  } catch (err) {
    next(err);
  }
});

// DELETE /email/messages/:id - Delete/trash email
emailRouter.delete("/messages/:id", async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    const messageId = req.params.id;

    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    const message = await EmailMessageModel.findOneAndUpdate(
      { _id: messageId, emailAccountId: { $in: accountIds } },
      { $set: { folder: "TRASH" } },
      { new: true }
    ).lean();

    if (!message) {
      throw notFound("Email not found");
    }

    res.json({ message: "Email moved to trash" });
  } catch (err) {
    next(err);
  }
});

// GET /email/folders - List folders
emailRouter.get("/folders", async (req, res, next) => {
  try {
    // Standard folders
    const folders = [
      { id: "INBOX", name: "Inbox", unreadCount: 0 },
      { id: "SENT", name: "Sent", unreadCount: 0 },
      { id: "DRAFTS", name: "Drafts", unreadCount: 0 },
      { id: "TRASH", name: "Trash", unreadCount: 0 },
    ];

    // Get unread counts
    const userId = (req as any).user?.id;
    const accounts = await EmailAccountModel.find({ userId }).select("_id").lean();
    const accountIds = accounts.map((a) => a._id);

    for (const folder of folders) {
      const count = await EmailMessageModel.countDocuments({
        emailAccountId: { $in: accountIds },
        folder: folder.id,
        isRead: false,
      });
      folder.unreadCount = count;
    }

    res.json(folders);
  } catch (err) {
    next(err);
  }
});

// ============================================
// Email Settings (Provider Management)
// ============================================

// GET /email/settings/allowed-providers - Get allowed providers (public for all authenticated users)
emailRouter.get("/settings/allowed-providers", async (req, res, next) => {
  try {
    const settings = await getEmailSettings();
    res.json({ allowedProviders: settings.allowedProviders });
  } catch (err) {
    next(err);
  }
});

// GET /email/settings - Get full email settings (admin only)
emailRouter.get("/settings", requirePermissions(["email.manage"]), async (req, res, next) => {
  try {
    const settings = await getEmailSettings();
    res.json({
      allowedProviders: settings.allowedProviders,
      updatedBy: settings.updatedBy,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

// PATCH /email/settings/allowed-providers - Update allowed providers (admin only)
const updateAllowedProvidersSchema = z.object({
  allowedProviders: z.array(z.enum(["GMAIL", "OUTLOOK", "SMTP_IMAP"])).min(1),
});

emailRouter.patch("/settings/allowed-providers", requirePermissions(["email.manage"]), async (req, res, next) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw badRequest("User not authenticated");
    }

    const parsed = updateAllowedProvidersSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid allowed providers payload");
    }

    // Use findOneAndUpdate with key filter for singleton pattern
    const settings = await EmailSettingsModel.findOneAndUpdate(
      { key: "email_settings_singleton" },
      {
        $set: {
          allowedProviders: parsed.data.allowedProviders,
          updatedBy: userId,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).exec();

    logger.info("Email allowed providers updated", {
      userId,
      allowedProviders: settings.allowedProviders
    });

    res.json({
      allowedProviders: settings.allowedProviders,
      updatedBy: settings.updatedBy,
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

