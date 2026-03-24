import { google } from "googleapis";
import { logger } from "../../config/logger";
import { IEmailAccount } from "../../models/emailAccount";
import { IEmailMessage, IEmailAddress, EmailMessageModel } from "../../models/emailMessage";
import { SendEmailOptions } from "./imapProvider";

export class GmailProvider {
  private account: IEmailAccount;
  private gmail: any;

  constructor(account: IEmailAccount) {
    this.account = account;
    this.initializeGmail();
  }

  private initializeGmail() {
    if (!this.account.oauth) {
      throw new Error("OAuth credentials not found for Gmail account");
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: this.account.oauth.accessToken,
      refresh_token: this.account.oauth.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
  }

  /**
   * Refresh OAuth token if expired
   */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.account.oauth) return;

    if (this.account.oauth.expiresAt > new Date()) {
      return; // Token still valid
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      refresh_token: this.account.oauth.refreshToken,
    });

    const { credentials } = await oauth2Client.refreshAccessToken();

    // Update account with new tokens (should be saved to DB)
    this.account.oauth.accessToken = credentials.access_token || this.account.oauth.accessToken;
    if (credentials.expiry_date) {
      this.account.oauth.expiresAt = new Date(credentials.expiry_date);
    }
  }

  /**
   * Send an email via Gmail API
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    await this.refreshTokenIfNeeded();

    // Build email message
    const to = options.to.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", ");
    const cc = options.cc?.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", ");
    const bcc = options.bcc?.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", ");

    let emailBody = `To: ${to}\r\n`;
    if (cc) emailBody += `Cc: ${cc}\r\n`;
    if (bcc) emailBody += `Bcc: ${bcc}\r\n`;
    emailBody += `Subject: ${options.subject}\r\n`;
    if (options.replyTo) emailBody += `Reply-To: ${options.replyTo}\r\n`;
    if (options.inReplyTo) emailBody += `In-Reply-To: ${options.inReplyTo}\r\n`;
    if (options.references) emailBody += `References: ${options.references}\r\n`;
    emailBody += `Content-Type: text/html; charset=utf-8\r\n\r\n`;
    emailBody += options.bodyHtml || options.bodyText || "";

    const encodedMessage = Buffer.from(emailBody).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const response = await this.gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedMessage,
        threadId: options.threadId,
      },
    });

    return response.data.id;
  }

  /**
   * Fetch new emails from Gmail
   */
  async fetchEmails(folder: string = "INBOX", since?: Date): Promise<any[]> {
    await this.refreshTokenIfNeeded();

    const query: string[] = [];
    
    // Map folder to Gmail label
    if (folder === "INBOX") {
      query.push("in:inbox");
    } else if (folder === "SENT") {
      query.push("in:sent");
    } else if (folder === "DRAFTS") {
      query.push("in:drafts");
    } else if (folder === "TRASH") {
      query.push("in:trash");
    }

    if (since) {
      const timestamp = Math.floor(since.getTime() / 1000);
      query.push(`after:${timestamp}`);
    }

    // Get list of messages
    const listResponse = await this.gmail.users.messages.list({
      userId: "me",
      q: query.join(" "),
      maxResults: 50,
    });

    if (!listResponse.data.messages || listResponse.data.messages.length === 0) {
      return [];
    }

    // Fetch full message details
    const messages = await Promise.all(
      listResponse.data.messages.map(async (msg: any) => {
        const messageResponse = await this.gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });
        return messageResponse.data;
      })
    );

    return messages;
  }

  /**
   * Convert Gmail message to IEmailMessage format
   */
  static gmailMessageToEmailMessage(
    gmailMsg: any,
    accountId: string,
    folder: string
  ): Partial<IEmailMessage> {
    const headers = gmailMsg.payload?.headers || [];
    const getHeader = (name: string) => headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value || "";

    const fromHeader = getHeader("from");
    const fromMatch = fromHeader.match(/^(.*?)\s*<(.+?)>$|^(.+?)$/);
    const from: IEmailAddress = {
      name: fromMatch?.[1] || fromMatch?.[3] || undefined,
      email: fromMatch?.[2] || fromMatch?.[3] || fromHeader,
    };

    const parseAddressList = (header: string): IEmailAddress[] => {
      if (!header) return [];
      return header.split(",").map((addr) => {
        const match = addr.trim().match(/^(.*?)\s*<(.+?)>$|^(.+?)$/);
        return {
          name: match?.[1] || match?.[3] || undefined,
          email: match?.[2] || match?.[3] || addr.trim(),
        };
      });
    };

    const to = parseAddressList(getHeader("to"));
    const cc = parseAddressList(getHeader("cc"));
    const bcc = parseAddressList(getHeader("bcc"));

    const subject = getHeader("subject") || "(No Subject)";
    const messageId = getHeader("message-id") || `gmail-${gmailMsg.id}`;
    const inReplyTo = getHeader("in-reply-to");

    // Extract body
    let bodyText = "";
    let bodyHtml = "";
    const extractBody = (part: any) => {
      if (part.body?.data) {
        const content = Buffer.from(part.body.data, "base64").toString();
        if (part.mimeType === "text/plain") {
          bodyText = content;
        } else if (part.mimeType === "text/html") {
          bodyHtml = content;
        }
      }
      if (part.parts) {
        part.parts.forEach(extractBody);
      }
    };
    extractBody(gmailMsg.payload);

    const snippet = gmailMsg.snippet || bodyText.substring(0, 200) || subject;

    return {
      emailAccountId: accountId as any,
      threadId: gmailMsg.threadId || `thread-${Date.now()}`,
      messageId,
      inReplyTo,
      from,
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      replyTo: getHeader("reply-to")
        ? parseAddressList(getHeader("reply-to"))[0]
        : undefined,
      subject,
      bodyText: bodyText || undefined,
      bodyHtml: bodyHtml || undefined,
      snippet,
      folder,
      labels: gmailMsg.labelIds || [],
      isRead: !gmailMsg.labelIds?.includes("UNREAD"),
      isStarred: gmailMsg.labelIds?.includes("STARRED") || false,
      isDraft: gmailMsg.labelIds?.includes("DRAFT") || false,
      isArchived: !gmailMsg.labelIds?.includes("INBOX") || false,
      receivedAt: gmailMsg.internalDate ? new Date(parseInt(gmailMsg.internalDate)) : new Date(),
    };
  }
}

