import { LeadModel } from "../models/lead";
import { ScoringRuleModel, IScoringRule, IScoringCondition } from "../models/scoringRule";
import { logger } from "../config/logger";

import { ScoringThresholdModel } from "../models/scoringThreshold";

export class ScoringService {
    static async evaluateThreshold(_orgId: string | undefined | null, finalScore: number) {
        let bucket = "Cold";
        let color = "#3b82f6";
        let thresholdId = undefined;

        const threshold = await ScoringThresholdModel.findOne({
            min_score: { $lte: finalScore },
            max_score: { $gte: finalScore }
        }).sort({ min_score: -1 });

        if (threshold) {
            bucket = threshold.label;
            color = threshold.color;
            thresholdId = threshold._id;
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
     * Supports nested fields, customData Map, and itinerary fields.
     */
    private static evaluateCondition(lead: any, condition: IScoringCondition): boolean {
        const { field, operator, value } = condition;

        // Extract property value (checks direct, customData, itineraries)
        const actualValue = this.getLeadFieldValue(lead, field);

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

    private static getLeadFieldValue(lead: any, path: string): any {
        // Handle _daysUntil_ prefix for date comparisons (e.g. "within N days")
        if (path.startsWith("_daysUntil_")) {
            path = path.replace("_daysUntil_", "");
        }

        let val = undefined;

        // 1. Direct model field
        val = lead[path];

        // 2. customData Map
        if ((val === undefined || val === null || val === '') && typeof lead.customData?.get === 'function') {
            val = lead.customData.get(path);
        }

        // 3. customData plain object
        if ((val === undefined || val === null || val === '') && lead.customData && typeof lead.customData === 'object' && typeof lead.customData.get !== 'function') {
            val = lead.customData[path];
        }

        // 4. first itinerary
        if ((val === undefined || val === null || val === '') && lead.itineraries?.[0]) {
            val = lead.itineraries[0][path];
        }

        // 5. Fallbacks
        if (val === undefined || val === null || val === '') {
            if (path === 'budget') {
                val = lead.estimatedValue;
            } else if (path === 'bookingWindow') {
                val = lead.bookingWindow ?? lead.customData?.get?.('booking_window') ?? lead.customData?.booking_window ?? lead.customData?.get?.('bookingWindow') ?? lead.customData?.bookingWindow;
            }
        }

        // Date field conversion
        if (['checkInDate', 'travelDate', 'travel_date'].includes(path)) {
            if (val) {
                const date = new Date(val);
                if (!isNaN(date.getTime())) {
                    return Math.ceil((date.getTime() - Date.now()) / 86400000);
                }
            }
        }

        return val;
    }
}
