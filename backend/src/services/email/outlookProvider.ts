import { Client } from "@microsoft/microsoft-graph-client";
import { logger } from "../../config/logger";
import { IEmailAccount } from "../../models/emailAccount";
import { IEmailMessage, IEmailAddress } from "../../models/emailMessage";
import { SendEmailOptions } from "./imapProvider";

export class OutlookProvider {
  private account: IEmailAccount;
  private graphClient!: Client; // Definite assignment assertion

  constructor(account: IEmailAccount) {
    this.account = account;
    this.initializeGraphClient();
  }

  private initializeGraphClient() {
    if (!this.account.oauth) {
      throw new Error("OAuth credentials not found for Outlook account");
    }

    // Create a custom auth provider
    const authProvider = {
      getAccessToken: async () => {
        // Check if token needs refresh
        if (this.account.oauth && this.account.oauth.expiresAt <= new Date()) {
          await this.refreshTokenIfNeeded();
        }
        return this.account.oauth?.accessToken || "";
      },
    };

    // Use Client.init with custom auth provider
    this.graphClient = Client.init({
      authProvider: authProvider as any, // Type assertion needed due to MS Graph SDK types
    });
  }

  /**
   * Refresh OAuth token if expired
   */
  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.account.oauth) return;

    if (this.account.oauth.expiresAt > new Date()) {
      return; // Token still valid
    }

    // Refresh token using Microsoft Graph token endpoint
    const response = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID || "",
        client_secret: process.env.MICROSOFT_CLIENT_SECRET || "",
        refresh_token: this.account.oauth.refreshToken,
        grant_type: "refresh_token",
        scope: "https://graph.microsoft.com/.default",
      }),
    });

    const data = await response.json();

    if (data.access_token) {
      this.account.oauth.accessToken = data.access_token;
      if (data.refresh_token) {
        this.account.oauth.refreshToken = data.refresh_token;
      }
      if (data.expires_in) {
        this.account.oauth.expiresAt = new Date(Date.now() + data.expires_in * 1000);
      }
    }
  }

  /**
   * Send an email via Microsoft Graph API
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    await this.refreshTokenIfNeeded();

    const message: any = {
      message: {
        subject: options.subject,
        body: {
          contentType: options.bodyHtml ? "HTML" : "Text",
          content: options.bodyHtml || options.bodyText || "",
        },
        toRecipients: options.to.map((addr) => ({
          emailAddress: {
            name: addr.name,
            address: addr.email,
          },
        })),
      },
    };

    if (options.cc && options.cc.length > 0) {
      message.message.ccRecipients = options.cc.map((addr) => ({
        emailAddress: {
          name: addr.name,
          address: addr.email,
        },
      }));
    }

    if (options.bcc && options.bcc.length > 0) {
      message.message.bccRecipients = options.bcc.map((addr) => ({
        emailAddress: {
          name: addr.name,
          address: addr.email,
        },
      }));
    }

    if (options.replyTo) {
      message.message.replyTo = [
        {
          emailAddress: {
            address: options.replyTo,
          },
        },
      ];
    }

    if (options.threadId) {
      message.message.conversationId = options.threadId;
    }

    const internetMessageHeaders: Array<{ name: string; value: string }> = [];
    if (options.inReplyTo) {
      internetMessageHeaders.push({ name: "In-Reply-To", value: options.inReplyTo });
    }
    if (options.references) {
      internetMessageHeaders.push({ name: "References", value: options.references });
    }
    if (internetMessageHeaders.length > 0) {
      message.message.internetMessageHeaders = internetMessageHeaders;
    }

    const response = await this.graphClient.api("/me/messages").post(message);
    return response.id;
  }

  /**
   * Fetch new emails from Outlook
   */
  async fetchEmails(folder: string = "Inbox", since?: Date): Promise<any[]> {
    await this.refreshTokenIfNeeded();

    // Map folder name to Graph API folder path
    let folderPath = "/me/mailFolders/Inbox/messages";
    if (folder === "SENT") {
      folderPath = "/me/mailFolders/SentItems/messages";
    } else if (folder === "DRAFTS") {
      folderPath = "/me/mailFolders/Drafts/messages";
    } else if (folder === "TRASH") {
      folderPath = "/me/mailFolders/DeletedItems/messages";
    }

    let filter = "";
    if (since) {
      const isoDate = since.toISOString();
      filter = `&$filter=receivedDateTime ge ${isoDate}`;
    }

    const response = await this.graphClient
      .api(`${folderPath}?$top=50&$orderby=receivedDateTime desc${filter}`)
      .get();

    return response.value || [];
  }

  /**
   * Convert Outlook message to IEmailMessage format
   */
  static outlookMessageToEmailMessage(
    outlookMsg: any,
    accountId: string,
    folder: string
  ): Partial<IEmailMessage> {
    const from: IEmailAddress = {
      name: outlookMsg.from?.emailAddress?.name,
      email: outlookMsg.from?.emailAddress?.address || "",
    };

    const to: IEmailAddress[] =
      outlookMsg.toRecipients?.map((r: any) => ({
        name: r.emailAddress?.name,
        email: r.emailAddress?.address || "",
      })) || [];

    const cc: IEmailAddress[] =
      outlookMsg.ccRecipients?.map((r: any) => ({
        name: r.emailAddress?.name,
        email: r.emailAddress?.address || "",
      })) || [];

    const bcc: IEmailAddress[] =
      outlookMsg.bccRecipients?.map((r: any) => ({
        name: r.emailAddress?.name,
        email: r.emailAddress?.address || "",
      })) || [];

    const snippet = outlookMsg.bodyPreview || outlookMsg.body?.content?.substring(0, 200) || outlookMsg.subject || "";

    return {
      emailAccountId: accountId as any,
      threadId: outlookMsg.conversationId || `thread-${Date.now()}`,
      messageId: outlookMsg.internetMessageId || outlookMsg.id || `outlook-${Date.now()}`,
      inReplyTo: outlookMsg.internetMessageHeaders?.find((h: any) => h.name === "In-Reply-To")?.value,
      from,
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      replyTo: outlookMsg.replyTo?.length > 0
        ? {
            name: outlookMsg.replyTo[0].name,
            email: outlookMsg.replyTo[0].emailAddress,
          }
        : undefined,
      subject: outlookMsg.subject || "(No Subject)",
      bodyText: outlookMsg.body?.contentType === "Text" ? outlookMsg.body.content : undefined,
      bodyHtml: outlookMsg.body?.contentType === "HTML" ? outlookMsg.body.content : undefined,
      snippet,
      folder,
      isRead: outlookMsg.isRead || false,
      isStarred: outlookMsg.flag?.flagStatus === "flagged" || false,
      isDraft: outlookMsg.isDraft || false,
      isArchived: false,
      receivedAt: outlookMsg.receivedDateTime ? new Date(outlookMsg.receivedDateTime) : new Date(),
      attachments: outlookMsg.hasAttachments
        ? outlookMsg.attachments?.map((att: any) => ({
            filename: att.name || "attachment",
            mimeType: att.contentType || "application/octet-stream",
            size: att.size || 0,
            contentId: att.contentId,
          }))
        : undefined,
    };
  }
}

