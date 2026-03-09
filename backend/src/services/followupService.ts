import { TaskModel } from "../models/task";
import { FollowupRuleModel } from "../models/followupRule";
import { LeadModel } from "../models/lead";
import { logger } from "../config/logger";
import { leadEventBus } from "./leadService";

export class FollowupService {
    /**
     * Inits the service, binds to lead events
     */
    static initialize() {
        leadEventBus.on("lead.rescored", async (data: { leadId: string; score: number; bucket: string; orgId?: string }) => {
            try {
                await FollowupService.generateFollowupTasks(data.leadId, data.bucket, data.orgId);
                logger.info(`Regenerated follow-up tasks for lead ${data.leadId} on rescored event (bucket: ${data.bucket})`);
            } catch (err) {
                logger.error(`Failed to generate follow-up tasks for lead ${data.leadId} on rescored event`, {}, err instanceof Error ? err : new Error(String(err)));
            }
        });
        logger.info("FollowupService initialized properly");
    }

    /**
     * Generates new follow-up tasks based on the active bucket rules,
     * canceling existing tasks first.
     */
    static async generateFollowupTasks(leadId: string, bucket: string, orgId?: string, baseTime: Date = new Date()) {
        // Cancel existing pending followup tasks
        await TaskModel.updateMany(
            { leadId, type: "followup", status: "OPEN" },
            { $set: { status: "CANCELLED" } }
        );

        // Find active rules for this bucket
        // We try to match the exact orgId, or if it's undefined, we search for null/undefined
        const query: any = { bucket, is_active: true, org_id: orgId || null };

        // In many implementations, if a rule has no orgId configured, it's considered "global".
        // Alternatively, we could do $or: [ {org_id: orgId}, {org_id: null} ] to fallback to global rules.
        // We'll construct a simple fallback: if specific org rules aren't found, try global.
        let rules = await FollowupRuleModel.find(query).sort({ display_order: 1 }).exec();

        // Fallback if specific org has no rules, check if there are global/default rules (org_id is null/absent)
        if (rules.length === 0 && orgId) {
            rules = await FollowupRuleModel.find({ bucket, is_active: true, org_id: { $in: [null, undefined, ""] } }).sort({ display_order: 1 }).exec();
        }

        // Nothing to do if no rules 
        if (rules.length === 0) return [];

        const lead = await LeadModel.findById(leadId).select("assignedToUserId").exec();
        if (!lead || !lead.assignedToUserId) {
            return [];
        }

        const newTasks = [];
        for (const rule of rules) {
            const dueAt = new Date(baseTime);
            if (typeof rule.offset_hours === "number") {
                dueAt.setHours(dueAt.getHours() + rule.offset_hours);
            } else if (typeof rule.offset_days === "number") {
                dueAt.setDate(dueAt.getDate() + rule.offset_days);
            } else {
                continue;
            }

            const task = await TaskModel.create({
                title: rule.description || `Follow-up #${rule.followup_number} (${bucket})`,
                type: "followup",
                followupRuleId: rule._id,
                leadId,
                ownerUserId: lead.assignedToUserId,
                createdByUserId: lead.assignedToUserId,
                dueAt,
                status: "OPEN"
            });
            newTasks.push(task);
        }

        return newTasks;
    }

    /**
     * Seed Moustache default schedules. Idempotent.
     */
    static async seedDefaultFollowupRules(orgId?: string) {
        const defaults = [
            { bucket: "Hot", followup_number: 1, offset_hours: 2, description: "Hot Lead Follow-up 1 (2 hours)", display_order: 1 },
            { bucket: "Hot", followup_number: 2, offset_hours: 5, description: "Hot Lead Follow-up 2 (5 hours)", display_order: 2 },
            { bucket: "Warm", followup_number: 1, offset_hours: 24, description: "Warm Lead Follow-up 1 (24 hours)", display_order: 1 },
            { bucket: "Warm", followup_number: 2, offset_hours: 48, description: "Warm Lead Follow-up 2 (48 hours)", display_order: 2 },
            { bucket: "Cold", followup_number: 1, offset_days: 5, description: "Cold Lead Follow-up (5 days)", display_order: 1 },
        ];

        const targetOrgId = orgId || null;

        for (const def of defaults) {
            const existing = await FollowupRuleModel.findOne({
                org_id: targetOrgId,
                bucket: def.bucket,
                followup_number: def.followup_number
            });

            if (!existing) {
                await FollowupRuleModel.create({
                    org_id: targetOrgId,
                    bucket: def.bucket,
                    followup_number: def.followup_number,
                    offset_hours: def.offset_hours,
                    offset_days: def.offset_days,
                    description: def.description,
                    display_order: def.display_order,
                    is_active: true
                });
            }
        }
        logger.info(`Seed default Followup rules completed for org: ${targetOrgId}`);
    }
}
