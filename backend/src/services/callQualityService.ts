import { LeadModel } from "../models/lead";
import { CallQualityDimensionModel } from "../models/callQualityDimension";
import { CallQualityScoreModel } from "../models/callQualityScore";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";

export class CallQualityService {
    /**
     * Submits a new call quality score for a lead.
     */
    static async submitCallQualityScore(
        leadId: string,
        scoredByUserId: string,
        scoresJson: Record<string, number>,
        notes: string,
        orgId: string
    ) {
        const lead = await LeadModel.findById(leadId);
        if (!lead) {
            throw new Error("Lead not found");
        }

        // Fetch active dimensions for this org
        const activeDimensions = await CallQualityDimensionModel.find({
            orgId,
            is_active: true
        });

        if (activeDimensions.length === 0) {
            throw new Error("No active call quality dimensions configured for this org.");
        }

        let totalWeight = 0;
        let weightedScore = 0;

        for (const dim of activeDimensions) {
            totalWeight += dim.weight_percent;

            const dimIdString = dim._id.toString();
            if (scoresJson[dimIdString] === undefined) {
                throw new Error(`Missing score for dimension: ${dim.name}`);
            }

            const scoreReceived = Number(scoresJson[dimIdString]);
            // Spec: weighted_total = Σ (score_given / 10 * weight_percent)
            // This yields a 0–100 score
            weightedScore += (scoreReceived / 10) * dim.weight_percent;
        }

        // Assuming scoreReceived is out of 10 or 100, the weightedScore scales accordingly.
        // E.g., if out of 100, weightedScore will be out of 100.

        // Save the CallQualityScore
        const cqScore = await CallQualityScoreModel.create({
            orgId,
            leadId,
            scored_by: scoredByUserId,
            scores_json: scoresJson,
            weighted_total: weightedScore,
            notes
        });

        // Log the activity
        await LeadActivityModel.create({
            leadId,
            type: LeadActivityType.NOTE,
            note: `Call quality scored: ${weightedScore.toFixed(2)}`,
            performedByUserId: scoredByUserId,
            performedAt: new Date()
        });

        return cqScore;
    }
}
