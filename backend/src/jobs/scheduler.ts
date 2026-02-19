// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - node-cron has no official TypeScript types in this project
import cron from "node-cron";
import { logger } from "../config/logger";
import { LeadModel } from "../models/lead";
import { LeadStatus, ClosedReason, CommunicationChannel, CommunicationDirection } from "../models/common";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { TaskModel } from "../models/task";
import { processPendingWorkflowSteps } from "../services/workflowExecutionService";
import { EmailAccountModel } from "../models/emailAccount";
import { syncEmails } from "../services/emailService";
import { sendSMS } from "../services/smsService";
import { CommunicationModel } from "../models/communication";
import { GuestModel } from "../models/guest";

async function runAutoClosureJob() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(
    Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
  );
  const end = new Date(
    Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999)
  );

  const leads = await LeadModel.find({
    checkInDate: { $gte: start, $lte: end },
    status: { $nin: [LeadStatus.CONFIRMED, LeadStatus.LOST, LeadStatus.CLOSED_AUTO] },
  });

  for (const lead of leads) {
    lead.status = LeadStatus.CLOSED_AUTO;
    lead.closedReason = ClosedReason.GUEST_NOT_RESPONDING;
    lead.closedAt = new Date();
    await lead.save();

    await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.STATUS_CHANGE,
      fromStatus: LeadStatus.NEW,
      toStatus: LeadStatus.CLOSED_AUTO,
    });
  }

  if (leads.length > 0) {
    logger.info(`Auto-closure job closed ${leads.length} leads`);
  }
}

async function runReminderJob() {
  const now = new Date();
  const tasks = await TaskModel.find({
    status: "OPEN",
    dueAt: { $lte: now },
  });

  for (const task of tasks) {
    task.popupState = { ...(task.popupState ?? {}), lastShownAt: now };
    await task.save();

    await LeadActivityModel.create({
      leadId: task.leadId,
      type: LeadActivityType.REMINDER_TRIGGERED,
    });
  }

  if (tasks.length > 0) {
    logger.info(`Reminder job triggered for ${tasks.length} tasks`);
  }
}

async function runWorkflowJob() {
  try {
    const processedCount = await processPendingWorkflowSteps();
    if (processedCount > 0) {
      logger.info("Workflow job processed steps", { processedCount });
    }
  } catch (error) {
    logger.error("Error in workflow job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

async function runEmailSyncJob() {
  try {
    const activeAccounts = await EmailAccountModel.find({
      isActive: true,
      syncStatus: { $ne: "SYNCING" },
    }).lean();

    for (const account of activeAccounts) {
      try {
        await syncEmails(account._id.toString());
      } catch (error) {
        logger.error("Error syncing emails for account", {
          accountId: account._id.toString(),
          email: account.email,
        }, error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (activeAccounts.length > 0) {
      logger.info("Email sync job processed accounts", { accountCount: activeAccounts.length });
    }
  } catch (error) {
    logger.error("Error in email sync job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

async function runSMSFollowUpJob() {
  try {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Find leads that need SMS follow-up
    // Criteria:
    // - Status is QUOTATION_SHARED or PAYMENT_PENDING
    // - checkInDate is in the future (at least 1 day away)
    // - No SMS sent in last 24 hours (or never sent)
    const leads = await LeadModel.find({
      status: { $in: [LeadStatus.QUOTATION_SHARED, LeadStatus.PAYMENT_PENDING] },
      checkInDate: { $gte: tomorrow }, // At least 1 day before arrival
      $or: [
        { lastSMSFollowUpAt: { $exists: false } },
        { lastSMSFollowUpAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }, // More than 24 hours ago
      ],
    }).lean();

    let sentCount = 0;

    for (const lead of leads) {
      try {
        // Get guest phone number
        if (!lead.guestId) {
          continue;
        }

        const guest = await GuestModel.findById(lead.guestId).lean();
        if (!guest || !guest.phone) {
          logger.warn("Lead has no guest phone number for SMS follow-up", {
            leadId: lead._id,
          });
          continue;
        }

        // Generate follow-up message
        const checkInDate = lead.checkInDate
          ? new Date(lead.checkInDate).toLocaleDateString("en-IN", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : "your stay";

        const message = `Dear ${guest.name},\n\nThis is a friendly reminder about your upcoming reservation. Check-in: ${checkInDate}.\n\nPlease complete your payment to confirm your booking. If you have any questions, feel free to contact us.\n\nThank you!`;

        // Send SMS
        await sendSMS({
          to: guest.phone,
          message,
        });

        // Create communication record
        await CommunicationModel.create({
          leadId: lead._id,
          guestId: lead.guestId,
          channel: CommunicationChannel.SMS,
          direction: CommunicationDirection.OUTBOUND,
          summary: "Automated SMS follow-up",
          messageContent: message,
        });

        // Update lead's last SMS follow-up timestamp
        await LeadModel.findByIdAndUpdate(lead._id, {
          lastSMSFollowUpAt: now,
        });

        sentCount++;
      } catch (error) {
        logger.error("Error sending SMS follow-up for lead", {
          leadId: lead._id,
        }, error instanceof Error ? error : new Error(String(error)));
      }
    }

    if (sentCount > 0) {
      logger.info("SMS follow-up job sent messages", { sentCount });
    }
  } catch (error) {
    logger.error("Error in SMS follow-up job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

function setupJobs() {
  // Auto-closure runs every hour.
  cron.schedule("0 * * * *", () => {
    void runAutoClosureJob();
  });

  // Reminder job runs every 5 minutes.
  cron.schedule("*/5 * * * *", () => {
    void runReminderJob();
  });

  // Workflow job runs every 15 minutes to process pending workflow steps.
  cron.schedule("*/15 * * * *", () => {
    void runWorkflowJob();
  });

  // Email sync job runs every 5 minutes to sync emails for all active accounts.
  cron.schedule("*/5 * * * *", () => {
    void runEmailSyncJob();
  });

  // SMS follow-up job runs daily at 10 AM
  cron.schedule("0 10 * * *", () => {
    void runSMSFollowUpJob();
  });

  logger.info("Scheduler jobs registered (auto-closure, reminders, workflow execution, email sync, SMS follow-up)");
}

setupJobs();
