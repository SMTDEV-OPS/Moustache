import cron from "node-cron";
import { LeadModel } from "../models/lead";
import { ScoringThresholdModel } from "../models/scoringThreshold";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { CommunicationModel } from "../models/communication";
import { LeadStatus } from "../models/common";
import { logger } from "../config/logger";
import { validateStageMove, leadEventBus } from "../services/leadService";

export const startInactiveLeadMonitor = () => {
    // Run every 30 minutes
    cron.schedule("*/30 * * * *", async () => {
        logger.info("[Cron] Starting inactive lead monitor...");
        try {
            await checkInactiveLeads();
        } catch (error) {
            logger.error("[Cron] Error checking inactive leads", {}, error instanceof Error ? error : new Error(String(error)));
        }
    });
};

async function checkInactiveLeads() {
    const thresholds = await ScoringThresholdModel.find({
        $or: [
            { inactive_hours_warning: { $ne: null } },
            { inactive_hours_critical: { $ne: null } }
        ]
    });

    if (thresholds.length === 0) return;

    for (const threshold of thresholds) {
        const leads = await LeadModel.find({
            orgId: threshold.orgId,
            thresholdId: threshold._id,
            status: { $nin: [LeadStatus.CONFIRMED, LeadStatus.LOST, LeadStatus.CLOSED_AUTO] }
        });

        for (const lead of leads) {
            const lastActivity = await LeadActivityModel.findOne({ leadId: lead._id }).sort({ performedAt: -1 });
            const lastComm = await CommunicationModel.findOne({ leadId: lead._id }).sort({ createdAt: -1 });

            let lastActiveTime = lead.createdAt.getTime();
            if (lastActivity && lastActivity.performedAt.getTime() > lastActiveTime) {
                lastActiveTime = lastActivity.performedAt.getTime();
            }
            if (lastComm && lastComm.createdAt.getTime() > lastActiveTime) {
                lastActiveTime = lastComm.createdAt.getTime();
            }

            const hoursSinceActive = (Date.now() - lastActiveTime) / (1000 * 60 * 60);

            if (threshold.inactive_hours_critical && hoursSinceActive >= threshold.inactive_hours_critical) {
                await handleInactiveLead(lead, threshold, "critical");
            } else if (threshold.inactive_hours_warning && hoursSinceActive >= threshold.inactive_hours_warning) {
                await handleInactiveLead(lead, threshold, "warning");
            }
        }
    }
}

async function handleInactiveLead(lead: any, threshold: any, level: "critical" | "warning") {
    let changed = false;

    if (level === "critical" && threshold.inactive_color_critical && lead.color !== threshold.inactive_color_critical) {
        lead.color = threshold.inactive_color_critical;
        changed = true;
    } else if (level === "warning" && threshold.inactive_color_warning && lead.color !== threshold.inactive_color_warning) {
        lead.color = threshold.inactive_color_warning;
        changed = true;
    }

    const recentAlert = await LeadActivityModel.findOne({
        leadId: lead._id,
        type: LeadActivityType.NOTE,
        note: new RegExp(`\\[System Alert: Inactive ${level}\\]`, "i"),
        performedAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    });

    if (!recentAlert) {
        await LeadActivityModel.create({
            leadId: lead._id,
            type: LeadActivityType.NOTE,
            note: `[System Alert: Inactive ${level}] Lead has been inactive for >= ${level === 'critical' ? threshold.inactive_hours_critical : threshold.inactive_hours_warning} hours.`,
            performedAt: new Date()
        });

        if (level === "warning") {
            leadEventBus.emit("lead.inactive_warning", {
                leadId: lead._id.toString(),
                leadNumber: lead.leadNumber,
                orgId: lead.orgId?.toString()
            });
            logger.info(`[InactiveMonitor] Emitted lead.inactive_warning for ${lead._id}`);
        } else if (level === "critical") {
            if (threshold.auto_action === 'notify_tl') {
                leadEventBus.emit("lead.inactive_critical", {
                    leadId: lead._id.toString(),
                    leadNumber: lead.leadNumber,
                    orgId: lead.orgId?.toString()
                });
                logger.info(`[InactiveMonitor] Emitted lead.inactive_critical for ${lead._id}`);
            } else if (threshold.auto_action === 'auto_lost') {
                const { PipelineModel } = await import("../models/pipeline");
                const { PipelineStageModel } = await import("../models/pipelineStage");
                const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
                if (pipeline) {
                    const lostStage = await PipelineStageModel.findOne({ pipelineId: pipeline._id, name: /Lost/i }).exec();
                    if (lostStage) {
                        const previousStageId = lead.stageId;
                        const validation = await validateStageMove(lead._id.toString(), lostStage._id.toString(), lead.orgId?.toString());

                        // We still move it if it's the system automated action, or we respect the gate?
                        // "call the same stage-move logic from E2, which enforces gates".
                        if (validation.allowed) {
                            lead.stageId = lostStage._id;
                            lead.status = LeadStatus.LOST;
                            lead.closedReason = "NO_RESPONSE";
                            lead.closedAt = new Date();
                            changed = true;

                            process.nextTick(() => {
                                leadEventBus.emit('lead.stage_moved', {
                                    leadId: lead._id.toString(),
                                    fromStageId: previousStageId?.toString() || null,
                                    toStageId: lostStage._id.toString(),
                                });
                            });

                            logger.info(`[InactiveMonitor] Auto-lost lead ${lead._id} due to inactivity threshold.`);
                        } else {
                            logger.warn(`[InactiveMonitor] Failed to auto-lose lead ${lead._id} because stage move validation failed. Reason: ${validation.reason}`);
                        }
                    }
                }
            }
        }
    }

    if (changed) {
        await lead.save();
    }
}
