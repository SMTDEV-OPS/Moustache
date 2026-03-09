import { LeadModel } from "../models/lead";
import { ScoringRuleModel, IScoringRule, IScoringCondition } from "../models/scoringRule";
import { logger } from "../config/logger";

import { ScoringThresholdModel } from "../models/scoringThreshold";

export class ScoringService {
    static async evaluateThreshold(orgId: string | undefined | null, finalScore: number) {
        let bucket = "Cold";
        let color = "#3b82f6";
        let thresholdId = undefined;

        if (orgId) {
            const threshold = await ScoringThresholdModel.findOne({
                orgId,
                min_score: { $lte: finalScore },
                max_score: { $gte: finalScore }
            });

            if (threshold) {
                bucket = threshold.label;
                color = threshold.color;
                thresholdId = threshold._id;
            } else {
                if (finalScore >= 7) { bucket = "Hot"; color = "#ef4444"; }
                else if (finalScore >= 4) { bucket = "Warm"; color = "#eab308"; }
            }
        } else {
            if (finalScore >= 7) { bucket = "Hot"; color = "#ef4444"; }
            else if (finalScore >= 4) { bucket = "Warm"; color = "#eab308"; }
        }

        return { bucket, color, thresholdId };
    }

    /**
     * Recalculates the score for a specific lead based on all active scoring rules.
     */
    static async calculateLeadScore(leadId: string): Promise<number> {
        const lead = await LeadModel.findById(leadId);
        if (!lead) {
            throw new Error("Lead not found");
        }

        const finalScore = await this.calculateScoreForLead(lead.toObject());
        const orgId = lead.orgId || lead.propertyId || lead.accountId;

        const { bucket, color, thresholdId } = await this.evaluateThreshold(orgId?.toString(), finalScore);

        if (
            lead.score !== finalScore ||
            lead.heatLevel !== bucket ||
            lead.color !== color ||
            String(lead.thresholdId) !== String(thresholdId)
        ) {
            lead.score = finalScore;
            lead.heatLevel = bucket as any;
            lead.color = color;
            lead.thresholdId = thresholdId;

            await lead.save();
            logger.info(`Lead ${leadId} score updated to ${finalScore}, bucket: ${bucket}.`);

            // Use dynamic import to prevent circular dependency
            const { leadEventBus } = await import("./leadService");
            leadEventBus.emit("lead.rescored", {
                leadId: lead._id.toString(),
                score: finalScore,
                bucket,
                orgId: orgId?.toString()
            });
        }

        return finalScore;
    }

    /**
     * Calculates score for any lead data object (saved or unsaved)
     */
    static async calculateScoreForLead(leadData: any): Promise<number> {
        const rules = await ScoringRuleModel.find({
            module: "leads",
            isActive: true
        }).sort({ priority: -1 });

        let totalPoints = 0; // Base score starting from 0, points are added/subtracted based on rules

        for (const rule of rules) {
            const isMatch = this.evaluateRule(leadData, rule);
            if (isMatch) {
                totalPoints += rule.points;
            }
        }

        return Math.max(0, Math.min(10, totalPoints));
    }

    /**
     * Evaluates if a lead matches a specific scoring rule.
     */
    private static evaluateRule(lead: any, rule: IScoringRule): boolean {
        if (rule.conditions.length === 0) return false;

        if (rule.conditionLogic === "AND") {
            return rule.conditions.every(cond => this.evaluateCondition(lead, cond));
        } else {
            return rule.conditions.some(cond => this.evaluateCondition(lead, cond));
        }
    }

    /**
     * Evaluates a single condition against lead data.
     * Supports nested fields and customData.
     */
    private static evaluateCondition(lead: any, condition: IScoringCondition): boolean {
        const { field, operator, value } = condition;

        // Extract property value (handles nested fields like 'guests.adults' or 'customData.field')
        const actualValue = this.getFieldValue(lead, field);

        switch (operator) {
            case "is":
                return String(actualValue) === String(value);
            case "is_not":
                return String(actualValue) !== String(value);
            case "contains":
                return String(actualValue).toLowerCase().includes(String(value).toLowerCase());
            case "starts_with":
                return String(actualValue).toLowerCase().startsWith(String(value).toLowerCase());
            case "greater_than":
                if (actualValue instanceof Date || (typeof actualValue === 'string' && !isNaN(Date.parse(actualValue)))) {
                    return new Date(actualValue) > new Date(value);
                }
                return Number(actualValue) > Number(value);
            case "less_than":
                if (actualValue instanceof Date || (typeof actualValue === 'string' && !isNaN(Date.parse(actualValue)))) {
                    return new Date(actualValue) < new Date(value);
                }
                return Number(actualValue) < Number(value);
            case "is_empty":
                return !actualValue || actualValue === "";
            case "is_not_empty":
                return !!actualValue && actualValue !== "";
            default:
                return false;
        }
    }

    private static getFieldValue(obj: any, path: string): any {
        if (path.startsWith("_daysUntil_")) {
            const actualPath = path.replace("_daysUntil_", "");
            const dateVal = actualPath.split(".").reduce((acc, part) => acc && (acc instanceof Map ? acc.get(part) : (acc as any)[part]), obj);
            if (!dateVal) return null;
            const targetDate = new Date(dateVal);
            if (isNaN(targetDate.getTime())) return null;
            const diffTime = targetDate.getTime() - new Date().getTime();
            return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        }

        return path.split(".").reduce((acc: any, part) => {
            if (acc == null) return acc;

            // Support Map-based dynamic fields (e.g. Mongoose Map for customData)
            if (acc instanceof Map || (typeof acc.get === "function" && !(part in acc))) {
                return acc.get(part);
            }

            return acc[part];
        }, obj);
    }
}
