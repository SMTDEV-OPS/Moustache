import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { logger } from "../config/logger";
import { EmailAccountModel, IEmailAccount } from "../models/emailAccount";
import { processInboundEmailForLeads } from "./emailLeadParser";
import { EmailMessageModel, IEmailMessage } from "../models/emailMessage";
import { decryptPassword } from "../models/emailAccount";
import { handleClientResponse } from "./clientResponseService";
import { emitToUser } from "../websocket";
import { matchAndStore } from "./emailMatchingService";

// We keep a registry of active clients to gracefully close them or avoid duplicates
const activeClients: Map<string, ImapFlow> = new Map();

function extractHeader(rawSource: Buffer, headerName: string): string | undefined {
    const raw = rawSource.toString("utf8");
    const match = raw.match(new RegExp(`^${headerName}:\\s*(.+)$`, "gim"));
    if (!match || match.length === 0) return undefined;
    const lastLine = match[match.length - 1];
    return lastLine.replace(new RegExp(`^${headerName}:\\s*`, "i"), "").trim();
}

export async function initializeImapListeners() {
    logger.info("[IMAPListener] Initializing IMAP IDLE listeners...");

    try {
        // Fetch all active SMTP_IMAP accounts
        const accounts = await EmailAccountModel.find({
            isActive: true,
            provider: "SMTP_IMAP",
            "imap.host": { $exists: true }
        });

        if (accounts.length === 0) {
            logger.info("[IMAPListener] No active IMAP accounts found to idle on.");
            return;
        }

        for (const account of accounts) {
            if (activeClients.has(account._id.toString())) {
                continue; // Already listening on this account
            }
            startListenerForAccount(account).catch(err => {
                logger.error(`[IMAPListener] Failed to start listener for account ${account.email}`, {
                    error: err.message
                });
            });
        }
    } catch (err) {
        logger.error("[IMAPListener] Failed to load IMAP accounts", { error: err instanceof Error ? err.message : String(err) });
    }
}

async function startListenerForAccount(account: IEmailAccount) {
    if (!account.imap || !account.imap.host || !account.imap.username || !account.imap.password) {
        return;
    }

    const decryptedPassword = decryptPassword(account.imap.password);

    const client = new ImapFlow({
        host: account.imap.host,
        port: account.imap.port,
        secure: account.imap.secure,
        auth: {
            user: account.imap.username,
            pass: decryptedPassword
        },
        logger: false // Set to true for debugging IDLE details
    });

    activeClients.set(account._id.toString(), client);

    try {
        await client.connect();
        logger.info(`[IMAPListener] Connected to IMAP for ${account.email}. Opening INBOX...`);

        // Open the inbox and start idling
        let lock = await client.getMailboxLock('INBOX');

        // Listen for new messages
        client.on('exists', async (data) => {
            logger.info(`[IMAPListener] New message received on ${account.email}. Total messages: ${data.count}`);
            // Let's fetch the highest sequence number (which is the new message)
            try {
                const newMsgSeq = data.count.toString();
                // Fetch the raw message source
                const msg = await client.fetchOne(newMsgSeq, { source: true, uid: true });
                if (msg && msg.source) {
                    await processPushedMessage(msg.source, msg.uid.toString(), account);
                }
            } catch (err) {
                logger.error(`[IMAPListener] Error processing pushed message for ${account.email}:`, {
                    error: err instanceof Error ? err.message : String(err)
                });
            }
        });

        logger.info(`[IMAPListener] Started IDLE on INBOX for ${account.email}. Awaiting push events...`);

        // This keeps the connection alive waiting for push events
        await client.idle();

    } catch (err) {
        logger.error(`[IMAPListener] IMAP Connection Error for ${account.email}:`, {
            error: err instanceof Error ? err.message : String(err)
        });
        activeClients.delete(account._id.toString());
        // Try reconnecting after a minute
        setTimeout(() => startListenerForAccount(account), 60000);
    }
}

async function processPushedMessage(rawSource: Buffer, uid: string, account: IEmailAccount) {
    try {
        const parsed = await simpleParser(rawSource);

        const messageId = parsed.messageId || `${uid}@${account.imap?.host}`;

        // Check if we already synced this email
        const existing = await EmailMessageModel.findOne({
            messageId,
            emailAccountId: account._id
        });

        if (existing) {
            return; // Already handled by the cron sync or previous event
        }

        const parsedTo = ((parsed.to as any)?.value || []).map((t: any) => ({
            name: t?.name,
            email: t?.address || "",
        })).filter((t: { email: string }) => Boolean(t.email));

        const xGmThrid = extractHeader(rawSource, "X-GM-THRID");
        const referencesHeader = extractHeader(rawSource, "References");

        const result = await matchAndStore({
            emailAccountId: account._id as any,
            messageId,
            threadId: xGmThrid || parsed.inReplyTo || messageId,
            inReplyTo: parsed.inReplyTo || undefined,
            references: referencesHeader,
            from: {
                name: parsed.from?.value[0]?.name,
                email: parsed.from?.value[0]?.address || "unknown@email.com",
            },
            to: parsedTo,
            subject: parsed.subject || "(no subject)",
            bodyText: parsed.text || "",
            bodyHtml: (typeof parsed.html === "string" ? parsed.html : parsed.textAsHtml) || "",
            receivedAt: parsed.date || new Date(),
        });

        const savedEmail = await EmailMessageModel.findById(result.emailMessageId);
        if (!savedEmail) {
            return;
        }

        // Push real-time notification to the frontend user!
        emitToUser(account.userId.toString(), "EMAIL_RECEIVED", { emailId: savedEmail._id });

        // Run LLM parsing right away ONLY if this is a company inbox enabled for lead capture
        if (!result.matched) {
            if (account.isLeadCaptureEnabled) {
                const bodyText = savedEmail.bodyText || savedEmail.bodyHtml?.replace(/<[^>]+>/g, " ") || "";
                await processInboundEmailForLeads({
                    fromName: savedEmail.from?.name || null,
                    fromEmail: savedEmail.from?.email || null,
                    subject: savedEmail.subject || null,
                    body: bodyText,
                }, savedEmail._id.toString());
            } else {
                logger.info(`[IMAPListener] Skipping LLM extraction for ${account.email} - isLeadCaptureEnabled is false.`);
            }
        } else {
            // Already identified author
            await handleClientResponse(savedEmail as IEmailMessage);
        }

    } catch (err) {
        logger.error(`[IMAPListener] Error saving pushed message:`, {
            error: err instanceof Error ? err.message : String(err)
        });
    }
}
