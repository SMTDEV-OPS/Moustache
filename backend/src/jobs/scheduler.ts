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
import { startInactiveLeadMonitor } from "../cron/inactiveLeadMonitor";
import { processPendingWorkflowActions, registerTrigger } from "../services/workflowEngine";
import { leadEventBus } from "../services/leadService";
import { WorkflowV2Model } from "../models/workflowV2";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { syncEzeeReservations } from "./ezeeSync";
import { logAudit } from "../utils/auditLog";

async function runAutoClosureJob() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const start = new Date(
    Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate())
  );
  const end = new Date(
    Date.UTC(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate(), 23, 59, 59, 999)
  );

  const { LeadItineraryModel } = await import("../models/leadItinerary");
  const itineraryMatch = await LeadItineraryModel.find({
    checkInDate: { $gte: start, $lte: end },
  }).distinct("leadId");

  const leads = await LeadModel.find({
    _id: { $in: itineraryMatch },
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

// Replaced runPendingWorkflowActionsJob with inline cron job below

async function runFollowupMissedJob() {
  try {
    const now = new Date();
    const overdueTasks = await TaskModel.find({
      type: "followup",
      status: "OPEN",
      dueAt: { $lt: now },
      leadId: { $exists: true, $ne: null },
      $or: [
        { "popupState.workflowFollowupMissedEmittedAt": { $exists: false } },
        { popupState: { $exists: false } },
      ],
    }).populate("leadId").lean();

    for (const task of overdueTasks) {
      const leadId = (task as any).leadId?._id?.toString();
      if (!leadId) continue;

      await TaskModel.updateOne(
        { _id: task._id },
        { $set: { "popupState.workflowFollowupMissedEmittedAt": now } }
      );

      const updated = await LeadModel.findByIdAndUpdate(
        leadId,
        { $inc: { missed_followup_count: 1 } },
        { new: true }
      ).lean();

      const newCount = (updated as any)?.missed_followup_count ?? 1;

      await LeadActivityModel.create({
        leadId,
        type: LeadActivityType.FOLLOW_UP,
        note: `Follow-up missed for task ${task._id.toString()} (missed count: ${newCount})`,
        performedAt: now,
        metadata: { taskId: task._id.toString(), missedCount: newCount },
      });

      logAudit(
        "updated",
        "task",
        task._id.toString(),
        { workflowFollowupMissedEmittedAt: null },
        { workflowFollowupMissedEmittedAt: now.toISOString(), missedFollowupCount: newCount },
        undefined,
        { orgId: (task as any).leadId?.orgId?.toString() }
      );

      leadEventBus.emit("lead.followup_missed", {
        leadId,
        taskId: task._id.toString(),
        orgId: (task as any).leadId?.orgId?.toString(),
        missed_count: newCount,
      });

      if (newCount >= 2) {
        leadEventBus.emit("lead.followup_missed_count", {
          leadId,
          orgId: (task as any).leadId?.orgId?.toString(),
          count: newCount,
        });
      }
    }
  } catch (error) {
    logger.error("Error in followup missed job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

async function runLeadUnattendedJob() {
  try {
    const { LeadActivityModel } = await import("../models/leadActivity");
    const now = new Date();
    const terminals = [LeadStatus.CONFIRMED, LeadStatus.LOST, LeadStatus.CLOSED_AUTO];
    const thresholds = [30, 720]; // 30 min, 12h
    for (const minutes of thresholds) {
      const cutoff = new Date(now.getTime() - minutes * 60 * 1000);
      const leads = await LeadModel.find({
        status: { $nin: terminals },
      }).lean();
      for (const lead of leads) {
        const lastActivity = await LeadActivityModel.findOne({ leadId: lead._id }).sort({ performedAt: -1 }).lean();
        const lastComm = await CommunicationModel.findOne({ leadId: lead._id }).sort({ createdAt: -1 }).lean();
        let lastActive = new Date(lead.createdAt).getTime();
        if (lastActivity) lastActive = Math.max(lastActive, new Date(lastActivity.performedAt).getTime());
        if (lastComm) lastActive = Math.max(lastActive, new Date(lastComm.createdAt).getTime());
        if (lastActive <= cutoff.getTime()) {
          leadEventBus.emit("lead.unattended", {
            leadId: lead._id.toString(),
            orgId: lead.orgId?.toString(),
            minutes_idle: minutes,
          });
        }
      }
    }
  } catch (error) {
    logger.error("Error in lead unattended job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

function cronMatchesNow(cron: string, now: Date, tz?: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [min, hour, dom, month, dow] = parts;
  const match = (v: string, n: number, minVal: number, maxVal: number): boolean => {
    if (v === "*") return true;
    if (v.includes(",")) return v.split(",").some((x) => match(x.trim(), n, minVal, maxVal));
    if (v.includes("-")) {
      const [a, b] = v.split("-").map(Number);
      return n >= a && n <= b;
    }
    if (v.includes("/")) {
      const [base, step] = v.split("/");
      const start = base === "*" ? minVal : parseInt(base, 10);
      return (n - start) % parseInt(step, 10) === 0;
    }
    return parseInt(v, 10) === n;
  };
  return (
    match(min, now.getMinutes(), 0, 59) &&
    match(hour, now.getHours(), 0, 23) &&
    match(dom, now.getDate(), 1, 31) &&
    match(month, now.getMonth() + 1, 1, 12) &&
    match(dow, now.getDay() || 7, 0, 7)
  );
}

async function runScheduledWorkflowsJob() {
  try {
    const workflows = await WorkflowV2Model.find({
      trigger_event: "scheduled",
      is_active: true,
    }).lean();
    const now = new Date();
    for (const wf of workflows) {
      const params = (wf as any).trigger_params_json || {};
      const cron = params.cron;
      if (!cron) continue;
      if (!cronMatchesNow(cron, now)) continue;

      const orgId = (wf as any).orgId?.toString();
      const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).lean();
      if (!pipeline) continue;
      const payStage = await PipelineStageModel.findOne({
        pipelineId: pipeline._id,
        name: /Payment Request/i,
      }).lean();
      if (!payStage) continue;
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const leadQuery: Record<string, any> = {
        stageId: payStage._id,
        updatedAt: { $lt: oneHourAgo },
        status: { $nin: [LeadStatus.CONFIRMED, LeadStatus.LOST, LeadStatus.CLOSED_AUTO] },
      };
      if (orgId) leadQuery.orgId = orgId;
      const leads = await LeadModel.find(leadQuery).limit(100).lean();
      for (const lead of leads) {
        leadEventBus.emit("scheduled", {
          workflowId: wf._id.toString(),
          leadId: lead._id.toString(),
          orgId: lead.orgId?.toString(),
        });
      }
    }
  } catch (error) {
    logger.error("Error in scheduled workflows job", {}, error instanceof Error ? error : new Error(String(error)));
  }
}

async function runEmailSyncJob() {
  try {
    const activeAccounts = await EmailAccountModel.find({
      isActive: true,
      syncStatus: { $ne: "SYNCING" },
      provider: { $ne: "SMTP_IMAP" }, // Skip IMAP accounts as they now use the real-time IDLE listener
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
    const { LeadItineraryModel } = await import("../models/leadItinerary");
    const itineraryMatch = await LeadItineraryModel.find({
      checkInDate: { $gte: tomorrow }, // At least 1 day before arrival
    }).distinct("leadId");

    const leads = await LeadModel.find({
      _id: { $in: itineraryMatch },
      status: { $in: [LeadStatus.QUOTATION_SHARED, LeadStatus.PAYMENT_PENDING] },
      $or: [
        { lastSMSFollowUpAt: { $exists: false } },
        { lastSMSFollowUpAt: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } }, // More than 24 hours ago
      ],
    }).populate("itineraries").lean();

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
        const checkIn = (lead as any).itineraries?.[0]?.checkInDate;
        const checkInDate = checkIn
          ? new Date(checkIn).toLocaleDateString("en-IN", {
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

  // Workflow job runs every 15 minutes to process pending workflow steps (legacy).
  cron.schedule("*/15 * * * *", () => {
    void runWorkflowJob();
  });

  // Pending workflow actions (event-driven) - every 2 minutes
  cron.schedule("*/2 * * * *", async () => {
    try {
      await processPendingWorkflowActions();
    } catch (err) {
      logger.error('Pending workflow actions job failed:', {}, err instanceof Error ? err : new Error(String(err)));
    }
  });

  // Followup missed - every 5 minutes
  cron.schedule("*/5 * * * *", () => {
    void runFollowupMissedJob();
  });

  // Lead unattended - every 15 minutes
  cron.schedule("*/15 * * * *", () => {
    void runLeadUnattendedJob();
  });

  // Scheduled workflows (cron-based) - every minute
  cron.schedule("* * * * *", () => {
    void runScheduledWorkflowsJob();
  });

  // Email sync job runs every 5 minutes to sync emails for all active accounts.
  cron.schedule("*/5 * * * *", () => {
    void runEmailSyncJob();
  });

  // SMS follow-up job runs daily at 10 AM
  cron.schedule("0 10 * * *", () => {
    void runSMSFollowUpJob();
  });

  // Sync Ezee reservations every 30 minutes
  cron.schedule("*/30 * * * *", async () => {
    try {
      await syncEzeeReservations();
    } catch (err) {
      logger.error(
        "Ezee sync job failed:",
        {},
        err instanceof Error ? err : new Error(String(err))
      );
    }
  });

  // Start the inactive lead monitor
  startInactiveLeadMonitor();

  logger.info("Scheduler jobs registered (auto-closure, reminders, workflow execution, pending workflow actions, followup missed, lead unattended, scheduled workflows, email sync, SMS follow-up, inactive leads monitor)");
}

setupJobs();
