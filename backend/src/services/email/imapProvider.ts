import Imap from "imap";
import { simpleParser, ParsedMail } from "mailparser";
import nodemailer, { Transporter } from "nodemailer";
import { logger } from "../../config/logger";
import { IEmailAccount, decryptPassword } from "../../models/emailAccount";
import { IEmailMessage, IEmailAddress, EmailMessageModel } from "../../models/emailMessage";

export interface SendEmailOptions {
  to: IEmailAddress[];
  cc?: IEmailAddress[];
  bcc?: IEmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
    contentType?: string;
  }>;
}

export class IMAPProvider {
  private account: IEmailAccount;
  private transporter: Transporter | null = null;

  constructor(account: IEmailAccount) {
    this.account = account;
  }

  /**
   * Initialize SMTP transporter for sending emails
   */
  private async getTransporter(): Promise<Transporter> {
    if (this.transporter) {
      return this.transporter;
    }

    if (!this.account.smtp) {
      throw new Error("SMTP configuration not found for account");
    }

    const password = decryptPassword(this.account.smtp.password);

    this.transporter = nodemailer.createTransport({
      host: this.account.smtp.host,
      port: this.account.smtp.port,
      secure: this.account.smtp.secure,
      auth: {
        user: this.account.smtp.username,
        pass: password,
      },
    });

    // Verify connection
    await this.transporter.verify();

    return this.transporter;
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<string> {
    const transporter = await this.getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: `${this.account.email}`,
      to: options.to.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", "),
      cc: options.cc?.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", "),
      bcc: options.bcc?.map((addr) => (addr.name ? `${addr.name} <${addr.email}>` : addr.email)).join(", "),
      subject: options.subject,
      text: options.bodyText,
      html: options.bodyHtml,
      replyTo: options.replyTo,
      inReplyTo: options.inReplyTo,
      references: options.references,
      attachments: options.attachments,
    };

    const info = await transporter.sendMail(mailOptions);
    return info.messageId;
  }

  /**
   * Fetch new emails from IMAP server
   */
  async fetchEmails(folder: string = "INBOX", since?: Date): Promise<ParsedMail[]> {
    if (!this.account.imap) {
      throw new Error("IMAP configuration not found for account");
    }

    const imapConfig = this.account.imap;
    const password = decryptPassword(imapConfig.password);

    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user: imapConfig.username,
        password: password,
        host: imapConfig.host,
        port: imapConfig.port,
        tls: imapConfig.secure,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: ParsedMail[] = [];

      imap.once("ready", () => {
        imap.openBox(folder, false, (err, box) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          // Search for emails since last sync
          const searchCriteria: any[] = ["UNSEEN"];
          if (since) {
            searchCriteria.push(["SINCE", since]);
          }

          imap.search(searchCriteria, (err, results) => {
            if (err) {
              imap.end();
              return reject(err);
            }

            if (!results || results.length === 0) {
              imap.end();
              return resolve([]);
            }

            const fetch = imap.fetch(results, { bodies: "" });
            let messageCount = 0;

            fetch.on("message", (msg, seqno) => {
              const parts: Buffer[] = [];
              
              msg.on("body", (stream) => {
                stream.on("data", (chunk: Buffer) => {
                  parts.push(chunk);
                });
              });

              msg.once("end", () => {
                messageCount++;
                const fullBody = Buffer.concat(parts);
                
                simpleParser(fullBody, (err, parsed) => {
                  if (!err && parsed) {
                    emails.push(parsed);
                  }
                  
                  // Mark as seen
                  if (results && results[seqno - 1]) {
                    imap.addFlags(results[seqno - 1], "\\Seen", () => {});
                  }
                  
                  // Resolve when all messages are processed
                  if (messageCount === results.length) {
                    imap.end();
                  }
                });
              });
            });

            fetch.once("end", () => {
              imap.end();
            });
          });
        });
      });

      imap.once("error", (err) => {
        reject(err);
      });

      imap.once("end", () => {
        resolve(emails);
      });

      imap.connect();
    });
  }

  /**
   * Convert ParsedMail to IEmailMessage format
   */
  static parsedMailToEmailMessage(
    parsed: ParsedMail,
    accountId: string,
    folder: string
  ): Partial<IEmailMessage> {
    // Handle parsed.from - can be AddressObject or AddressObject[]
    const fromAddress = Array.isArray(parsed.from) ? parsed.from[0] : parsed.from;
    const from: IEmailAddress = {
      name: fromAddress?.name || undefined,
      email: (fromAddress as any)?.address || (fromAddress as any)?.value?.[0]?.address || "",
    };

    // Handle parsed.to - can be AddressObject or AddressObject[]
    const toAddresses = Array.isArray(parsed.to) ? parsed.to : parsed.to ? [parsed.to] : [];
    const to: IEmailAddress[] = toAddresses.map((addr: any) => ({
      name: addr.name || undefined,
      email: addr.address || addr.value?.[0]?.address || "",
    })).filter((addr) => addr.email);

    // Handle parsed.cc
    const ccAddresses = Array.isArray(parsed.cc) ? parsed.cc : parsed.cc ? [parsed.cc] : [];
    const cc: IEmailAddress[] = ccAddresses.map((addr: any) => ({
      name: addr.name || undefined,
      email: addr.address || addr.value?.[0]?.address || "",
    })).filter((addr) => addr.email);

    // Handle parsed.bcc
    const bccAddresses = Array.isArray(parsed.bcc) ? parsed.bcc : parsed.bcc ? [parsed.bcc] : [];
    const bcc: IEmailAddress[] = bccAddresses.map((addr: any) => ({
      name: addr.name || undefined,
      email: addr.address || addr.value?.[0]?.address || "",
    })).filter((addr) => addr.email);

    // Handle parsed.replyTo
    const replyToAddress = Array.isArray(parsed.replyTo) ? parsed.replyTo[0] : parsed.replyTo;
    const replyTo: IEmailAddress | undefined = replyToAddress
      ? {
          name: (replyToAddress as any).name || undefined,
          email: (replyToAddress as any).address || (replyToAddress as any).value?.[0]?.address || "",
        }
      : undefined;

    const snippet = parsed.text?.substring(0, 200) || parsed.subject || "";

    return {
      emailAccountId: accountId as any,
      threadId: parsed.messageId || `thread-${Date.now()}`,
      messageId: parsed.messageId || `msg-${Date.now()}`,
      inReplyTo: parsed.inReplyTo,
      from,
      to,
      cc: cc.length > 0 ? cc : undefined,
      bcc: bcc.length > 0 ? bcc : undefined,
      replyTo,
      subject: parsed.subject || "(No Subject)",
      bodyText: parsed.text || undefined,
      bodyHtml: parsed.html || undefined,
      snippet,
      folder,
      isRead: false,
      isStarred: false,
      isDraft: false,
      isArchived: false,
      receivedAt: parsed.date || new Date(),
      attachments: parsed.attachments?.map((att) => ({
        filename: att.filename || "attachment",
        mimeType: att.contentType || "application/octet-stream",
        size: att.size || 0,
        contentId: att.contentId,
      })),
    };
  }
}

