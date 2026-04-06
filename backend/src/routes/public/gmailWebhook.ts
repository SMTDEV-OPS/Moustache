import { Router } from "express";
import { EmailAccountModel } from "../../models/emailAccount";
import { GmailProvider } from "../../services/email/gmailProvider";
import { syncAndStoreEmail } from "../../services/emailService";
import { logger } from "../../config/logger";
import { config } from "../../config/env";

/*
GOOGLE CLOUD SETUP REQUIRED (one-time, done manually):

Create a Google Cloud Project (or use existing one from OAuth setup)
Enable Gmail API + Cloud Pub/Sub API
Create Pub/Sub topic: gmail-inbox-changes
Grant publish permission to: gmail-api-push@system.gserviceaccount.com on that topic
Create a Push Subscription pointing to:
https://yourdomain.com/api/public/gmail-webhook?token=YOUR_GMAIL_WEBHOOK_SECRET
Set GMAIL_PUBSUB_TOPIC in .env to the full topic name
Set GMAIL_WEBHOOK_SECRET in .env to match your subscription URL token
*/

const gmailWebhookRouter = Router();

// TEMPORARY DEBUG ROUTE - REMOVE BEFORE PRODUCTION
gmailWebhookRouter.post("/setup-watch/:accountId", async (req, res) => {
  try {
    const account = await EmailAccountModel.findById(req.params.accountId);
    if (!account) return res.status(404).json({ error: "Account not found" });

    const provider = new GmailProvider(account);
    await provider.setupWatch(config.gmailPubSubTopic);

    const updated = await EmailAccountModel.findById(req.params.accountId)
      .select("email gmailHistoryId gmailWatchExpiration gmailWatchResourceId");

    return res.json({ success: true, account: updated });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
});

gmailWebhookRouter.post("/gmail-webhook", async (req, res) => {
  try {
    const token = req.query.token;
    const configuredToken = process.env.GMAIL_WEBHOOK_SECRET;
    const userAgent = String(req.headers["user-agent"] || "");
    const isGoogleAgent = userAgent.toLowerCase().includes("google");

    const tokenIsValid = configuredToken && typeof token === "string" && token === configuredToken;
    if (!tokenIsValid && !isGoogleAgent) {
      return res.sendStatus(403);
    }

    const message = (req.body as any)?.message;
    if (!message?.data) {
      return res.sendStatus(204);
    }

    const decoded = JSON.parse(Buffer.from(message.data, "base64").toString());
    const { emailAddress, historyId } = decoded;
    console.log("[GmailWebhook] Received for:", emailAddress, "historyId:", historyId);
    if (!emailAddress) {
      return res.sendStatus(204);
    }

    const account = await EmailAccountModel.findOne({
      email: emailAddress,
      provider: "GMAIL",
      isActive: true,
    }).exec();
    if (!account) {
      return res.sendStatus(204);
    }
    console.log("[GmailWebhook] Account found:", account.email, "stored historyId:", account.gmailHistoryId);

    if (account.gmailHistoryId) {
      const provider = new GmailProvider(account);
      const newEmails = await provider.fetchEmailsByHistory(account.gmailHistoryId);
      console.log("[GmailWebhook] New emails fetched:", newEmails.length);
      if (newEmails.length === 0) {
        console.log("[GmailWebhook] No new emails in history delta");
      }

      for (const emailData of newEmails) {
        await syncAndStoreEmail(account, emailData, "INBOX");
        console.log("[GmailWebhook] Email stored, emitting websocket...");
        console.log("[GmailWebhook] Websocket emitted EMAIL_RECEIVED");
      }
    }

    if (historyId) {
      await EmailAccountModel.findByIdAndUpdate(account._id, {
        gmailHistoryId: String(historyId),
      });
    }

    return res.sendStatus(200);
  } catch (error) {
    logger.error("Failed to process Gmail webhook", {}, error instanceof Error ? error : new Error(String(error)));
    return res.sendStatus(200);
  }
});

export default gmailWebhookRouter;
