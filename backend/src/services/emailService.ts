import { Types } from "mongoose";
import { logger } from "../config/logger";
import { EmailAccountModel, IEmailAccount, EmailProvider } from "../models/emailAccount";
import { EmailMessageModel, IEmailMessage, IEmailAddress } from "../models/emailMessage";
import { IMAPProvider, SendEmailOptions } from "./email/imapProvider";
import { GmailProvider } from "./email/gmailProvider";
import { OutlookProvider } from "./email/outlookProvider";
import { GuestModel } from "../models/guest";
import { LeadModel } from "../models/lead";
import { CommunicationModel } from "../models/communication";
import { CommunicationChannel, CommunicationDirection } from "../models/common";
import { handleClientResponse } from "./clientResponseService";
import { processInboundEmailForLeads } from "./emailLeadParser";
import { normalizeEmail } from "../utils/phoneUtils";
import { emitToUser, getIO } from "../websocket";

/**
 * Get email provider instance based on account type
 */
function getEmailProvider(account: IEmailAccount) {
  switch (account.provider) {
    case "GMAIL":
      return new GmailProvider(account);
    case "OUTLOOK":
      return new OutlookProvider(account);
    case "SMTP_IMAP":
      return new IMAPProvider(account);
    default:
      throw new Error(`Unsupported email provider: ${account.provider}`);
  }
}

/**
 * Link email to lead/guest by email address and create communication record for inbound emails
 */
export async function linkEmailToCRM(email: Partial<IEmailMessage>) {
  // Try to find guest by email
  const guestEmails = [
    email.from?.email,
    ...(email.to?.map((t) => t.email) || []),
    ...(email.cc?.map((c) => c.email) || []),
  ]
    .filter((e): e is string => !!e)
    .map((e) => normalizeEmail(e))
    .filter((e): e is string => !!e);

  let linkedLeadId: Types.ObjectId | undefined;
  let linkedGuestId: Types.ObjectId | undefined;

  for (const emailAddr of guestEmails) {
    const guest = await GuestModel.findOne({
      $or: [{ email: emailAddr }, { secondaryEmails: emailAddr }],
    }).lean();
    if (guest) {
      linkedGuestId = guest._id as Types.ObjectId;
      email.linkedGuestId = linkedGuestId;

      // Find lead for this guest (prefer most recent active lead)
      const lead = await LeadModel.findOne({
        guestId: guest._id,
        status: { $nin: ["LOST", "CLOSED_AUTO"] }
      }).sort({ createdAt: -1 }).lean();

      if (!lead) {
        // Fallback to any lead if no active lead found
        const anyLead = await LeadModel.findOne({ guestId: guest._id }).sort({ createdAt: -1 }).lean();
        if (anyLead) {
          linkedLeadId = anyLead._id as Types.ObjectId;
          email.linkedLeadId = linkedLeadId;
        }
      } else {
        linkedLeadId = lead._id as Types.ObjectId;
        email.linkedLeadId = linkedLeadId;
      }
      break;
    }
  }

  // If this is an inbound email (not in SENT folder) and we have a linked lead, create communication record
  // Note: This only works if the email has been saved (has _id), which is the case during sync
  if (email.folder !== "SENT" && linkedLeadId && email.messageId && email._id) {
    try {
      // Check if communication record already exists for this email
      const existingComm = await CommunicationModel.findOne({
        emailMessageId: email._id,
      }).lean();

      if (!existingComm && email.from?.email) {
        // Check if this is a reply to a sent email by looking at inReplyTo
        const isReply = !!email.inReplyTo;

        const created = await CommunicationModel.create({
          leadId: linkedLeadId,
          guestId: linkedGuestId,
          channel: CommunicationChannel.EMAIL,
          direction: CommunicationDirection.INBOUND,
          summary: email.subject || "Email received",
          messageContent: email.bodyText || email.bodyHtml,
          emailMessageId: email._id as Types.ObjectId,
        });

        const io = getIO();
        if (io) {
          io.to(`lead:${linkedLeadId.toString()}`).emit("lead:email_received", created.toObject());
        }

        logger.info("Created communication record for inbound email", {
          emailMessageId: email.messageId,
          emailId: email._id.toString(),
          leadId: linkedLeadId.toString(),
          isReply,
        });
      }
    } catch (error) {
      logger.error("Failed to create communication record for inbound email", {
        emailMessageId: email.messageId,
        emailId: email._id?.toString(),
        leadId: linkedLeadId?.toString(),
      }, error instanceof Error ? error : new Error(String(error)));
      // Don't fail email linking if communication record creation fails
    }
  }
}

/**
 * Connect Gmail account via OAuth
 */
export async function connectGmail(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  email: string
): Promise<IEmailAccount> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const userObjectId = new Types.ObjectId(userId);

  // Check if account already exists
  let account = await EmailAccountModel.findOne({ userId: userObjectId, email }).exec();

  if (account) {
    account.oauth = {
      accessToken,
      refreshToken,
      expiresAt,
      scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
    };
    account.isActive = true;
    await account.save();
  } else {
    // Set other accounts as non-primary if this is first account
    await EmailAccountModel.updateMany({ userId: userObjectId }, { isPrimary: false });

    account = await EmailAccountModel.create({
      userId: userObjectId,
      provider: "GMAIL",
      email,
      isActive: true,
      isPrimary: true,
      oauth: {
        accessToken,
        refreshToken,
        expiresAt,
        scope: "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly",
      },
      syncStatus: "IDLE",
    });
  }

  try {
    const provider = new GmailProvider(account);
    await provider.setupWatch(process.env.GMAIL_PUBSUB_TOPIC!);
  } catch (error) {
    logger.error("Failed to setup Gmail watch after connect", {
      userId,
      email,
      accountId: account._id.toString(),
    }, error instanceof Error ? error : new Error(String(error)));
  }

  return account;
}

/**
 * Connect Outlook account via OAuth
 */
export async function connectOutlook(
  userId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number,
  email: string
): Promise<IEmailAccount> {
  const expiresAt = new Date(Date.now() + expiresIn * 1000);
  const userObjectId = new Types.ObjectId(userId);

  let account = await EmailAccountModel.findOne({ userId: userObjectId, email }).exec();

  if (account) {
    account.oauth = {
      accessToken,
      refreshToken,
      expiresAt,
      scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read",
    };
    account.isActive = true;
    await account.save();
  } else {
    await EmailAccountModel.updateMany({ userId: userObjectId }, { isPrimary: false });

    account = await EmailAccountModel.create({
      userId: userObjectId,
      provider: "OUTLOOK",
      email,
      isActive: true,
      isPrimary: true,
      oauth: {
        accessToken,
        refreshToken,
        expiresAt,
        scope: "https://graph.microsoft.com/Mail.Send https://graph.microsoft.com/Mail.Read",
      },
      syncStatus: "IDLE",
    });
  }

  return account;
}

/**
 * Connect SMTP/IMAP account
 */
export async function connectSMTP(
  userId: string,
  email: string,
  smtpConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  },
  imapConfig: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  }
): Promise<IEmailAccount> {
  const userObjectId = new Types.ObjectId(userId);
  let account = await EmailAccountModel.findOne({ userId: userObjectId, email }).exec();

  if (account) {
    account.smtp = smtpConfig;
    account.imap = imapConfig;
    account.isActive = true;
    await account.save();
  } else {
    await EmailAccountModel.updateMany({ userId: userObjectId }, { isPrimary: false });

    account = await EmailAccountModel.create({
      userId: userObjectId,
      provider: "SMTP_IMAP",
      email,
      isActive: true,
      isPrimary: true,
      smtp: smtpConfig,
      imap: imapConfig,
      syncStatus: "IDLE",
    });
  }

  return account;
}

/**
 * Send email through specified account
 */
export async function sendEmail(
  accountId: string,
  options: SendEmailOptions
): Promise<IEmailMessage> {
  const account = await EmailAccountModel.findById(accountId).exec();
  if (!account || !account.isActive) {
    throw new Error("Email account not found or inactive");
  }

  const provider = getEmailProvider(account);
  const messageId = await provider.sendEmail(options);

  // Save sent email
  const emailMessage: Partial<IEmailMessage> = {
    emailAccountId: account._id as Types.ObjectId,
    threadId: options.threadId || options.inReplyTo || `thread-${Date.now()}`,
    messageId,
    inReplyTo: options.inReplyTo,
    from: { email: account.email },
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    bodyText: options.bodyText,
    bodyHtml: options.bodyHtml,
    snippet: options.bodyText?.substring(0, 200) || options.bodyHtml?.substring(0, 200) || "",
    folder: "SENT",
    isRead: true,
    isStarred: false,
    isDraft: false,
    isArchived: false,
    sentAt: new Date(),
  };

  const savedEmail = await EmailMessageModel.create(emailMessage);
  return savedEmail;
}

export async function syncAndStoreEmail(
  account: IEmailAccount,
  msg: any,
  folder: string = "INBOX"
): Promise<{ savedEmail?: IEmailMessage; created: boolean }> {
  let emailData: Partial<IEmailMessage>;

  if (account.provider === "GMAIL") {
    emailData = GmailProvider.gmailMessageToEmailMessage(msg, account._id.toString(), folder);
  } else if (account.provider === "OUTLOOK") {
    emailData = OutlookProvider.outlookMessageToEmailMessage(msg, account._id.toString(), folder);
  } else {
    emailData = IMAPProvider.parsedMailToEmailMessage(msg, account._id.toString(), folder);
  }

  const upsertResult = await EmailMessageModel.findOneAndUpdate(
    { emailAccountId: account._id, messageId: emailData.messageId },
    { $setOnInsert: { ...emailData } },
    { upsert: true, new: true, rawResult: true }
  ).exec();

  const savedEmail = (upsertResult as any)?.value as IEmailMessage | null;
  const created = Boolean((upsertResult as any)?.lastErrorObject?.upserted);
  emailData._id = savedEmail?._id;
  await linkEmailToCRM(emailData);

  if (!savedEmail) {
    return { savedEmail: undefined, created: false };
  }

  if (emailData.linkedLeadId) {
    savedEmail.linkedLeadId = emailData.linkedLeadId as any;
    savedEmail.linkedGuestId = emailData.linkedGuestId as any;
    await EmailMessageModel.updateOne(
      { _id: savedEmail._id },
      { $set: { linkedLeadId: emailData.linkedLeadId, linkedGuestId: emailData.linkedGuestId } }
    );
  }

  if (savedEmail.folder === "INBOX") {
    emitToUser(account.userId.toString(), "EMAIL_RECEIVED", { emailId: savedEmail._id.toString() });
  }

  if (savedEmail.folder !== "SENT" && (emailData.linkedLeadId || savedEmail.linkedLeadId)) {
    const leadId = (emailData.linkedLeadId || savedEmail.linkedLeadId) as any;
    const io = getIO();
    if (io) {
      io.to(`lead:${String(leadId)}`).emit("lead:email_received");
    }
  }

  if (savedEmail.folder !== "SENT" && savedEmail.linkedLeadId) {
    try {
      await handleClientResponse(savedEmail);
    } catch (e) {
      logger.error("Failed to handle client response after linking", {}, e as Error);
    }
  }

  if (savedEmail.folder === "INBOX" && !savedEmail.linkedLeadId) {
    const bodyText = savedEmail.bodyText || savedEmail.bodyHtml?.replace(/<[^>]+>/g, " ") || "";
    await processInboundEmailForLeads({
      fromName: savedEmail.from?.name || null,
      fromEmail: savedEmail.from?.email || null,
      subject: savedEmail.subject || null,
      body: bodyText,
    }, savedEmail._id.toString());
  }

  return { savedEmail, created };
}

/**
 * Get error code from error message
 */
function getErrorCode(error: Error | unknown): string {
  if (!(error instanceof Error)) {
    return "UNKNOWN_ERROR";
  }

  const message = error.message.toLowerCase();

  if (message.includes("token") || message.includes("expired") || message.includes("invalid_grant")) {
    return "TOKEN_EXPIRED";
  }
  if (message.includes("authentication") || message.includes("unauthorized") || message.includes("invalid credentials")) {
    return "INVALID_CREDENTIALS";
  }
  if (message.includes("connection") || message.includes("timeout") || message.includes("econnrefused")) {
    return "CONNECTION_FAILED";
  }
  if (message.includes("rate limit") || message.includes("quota")) {
    return "RATE_LIMIT_EXCEEDED";
  }
  if (message.includes("permission") || message.includes("scope")) {
    return "INSUFFICIENT_PERMISSIONS";
  }
  if (message.includes("not found") || message.includes("inactive")) {
    return "ACCOUNT_NOT_FOUND";
  }

  return "SYNC_ERROR";
}

/**
 * Sync emails for an account
 */
export async function syncEmails(accountId: string): Promise<{ syncedCount: number; errorCode?: string }> {
  const account = await EmailAccountModel.findById(accountId).exec();
  if (!account || !account.isActive) {
    const error = new Error("Email account not found or inactive");
    (error as any).errorCode = "ACCOUNT_NOT_FOUND";
    throw error;
  }

  account.syncStatus = "SYNCING";
  account.syncError = undefined;
  await account.save();

  try {
    const provider = getEmailProvider(account);
    let syncedCount = 0;

    // Sync INBOX
    const folders = ["INBOX", "SENT"];
    for (const folder of folders) {
      try {
        const lastSync = account.lastSyncAt || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // Default to 7 days ago

        let messages: any[] = [];
        if (account.provider === "GMAIL") {
          messages = await (provider as GmailProvider).fetchEmails(folder, lastSync);
        } else if (account.provider === "OUTLOOK") {
          messages = await (provider as OutlookProvider).fetchEmails(folder, lastSync);
        } else {
          messages = await (provider as IMAPProvider).fetchEmails(folder, lastSync);
        }

        for (const msg of messages) {
          const result = await syncAndStoreEmail(account, msg, folder);
          if (result.created) {
            syncedCount++;
          }
        }
      } catch (err) {
        const errorCode = getErrorCode(err);
        logger.error("Error syncing email folder", {
          accountId: account._id.toString(),
          email: account.email,
          folder,
          errorCode,
        }, err instanceof Error ? err : new Error(String(err)));
        // Continue with other folders even if one fails
      }
    }

    account.lastSyncAt = new Date();
    account.syncStatus = "IDLE";
    await account.save();

    logger.info("Synced emails for account", {
      accountId: account._id.toString(),
      email: account.email,
      syncedCount,
    });
    return { syncedCount };
  } catch (error) {
    const errorCode = getErrorCode(error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    account.syncStatus = "ERROR";
    account.syncError = `${errorCode}: ${errorMessage}`;
    await account.save();

    logger.error("Email sync failed", {
      accountId: account._id.toString(),
      email: account.email,
      errorCode,
    }, error instanceof Error ? error : new Error(String(error)));

    const syncError = new Error(errorMessage);
    (syncError as any).errorCode = errorCode;
    throw syncError;
  }
}

/**
 * Get primary email account for user
 */
export async function getPrimaryEmailAccount(userId: string): Promise<IEmailAccount | null> {
  const userObjectId = new Types.ObjectId(userId);
  return EmailAccountModel.findOne({ userId: userObjectId, isPrimary: true, isActive: true }).exec();
}

/**
 * Test SMTP/IMAP connection without saving account
 */
export async function testSMTPConnection(config: {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
  imap: {
    host: string;
    port: number;
    secure: boolean;
    username: string;
    password: string;
  };
}): Promise<{ smtp: { success: boolean; error?: string }; imap: { success: boolean; error?: string } }> {
  const results = {
    smtp: { success: false, error: undefined as string | undefined },
    imap: { success: false, error: undefined as string | undefined },
  };

  // Test SMTP connection
  try {
    const nodemailer = await import("nodemailer");
    const transporter = nodemailer.default.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.username,
        pass: config.smtp.password,
      },
      connectionTimeout: 10000, // 10 seconds timeout
    });

    await transporter.verify();
    results.smtp.success = true;
  } catch (error) {
    results.smtp.error = error instanceof Error ? error.message : "SMTP connection failed";
    logger.error("SMTP connection test failed", {
      host: config.smtp.host,
      port: config.smtp.port,
    }, error instanceof Error ? error : new Error(String(error)));
  }

  // Test IMAP connection
  try {
    const Imap = (await import("imap")).default;
    const imap = new Imap({
      user: config.imap.username,
      password: config.imap.password,
      host: config.imap.host,
      port: config.imap.port,
      tls: config.imap.secure,
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 10000, // 10 seconds timeout
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        imap.end();
        reject(new Error("IMAP connection timeout"));
      }, 10000);

      imap.once("ready", () => {
        clearTimeout(timeout);
        imap.end();
        resolve();
      });

      imap.once("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      imap.connect();
    });

    results.imap.success = true;
  } catch (error) {
    results.imap.error = error instanceof Error ? error.message : "IMAP connection failed";
    logger.error("IMAP connection test failed", {
      host: config.imap.host,
      port: config.imap.port,
    }, error instanceof Error ? error : new Error(String(error)));
  }

  return results;
}

