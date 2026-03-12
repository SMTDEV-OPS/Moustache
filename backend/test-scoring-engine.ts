import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { ScoringThresholdModel } from "./src/models/scoringThreshold";
import { CallQualityDimensionModel } from "./src/models/callQualityDimension";
import { CallQualityScoreModel } from "./src/models/callQualityScore";
import { LeadModel } from "./src/models/lead";
import { UserModel } from "./src/models/user";
import { ScoringService } from "./src/services/scoringService";
import { CallQualityService } from "./src/services/callQualityService";

const TEST_ORG_ID = new mongoose.Types.ObjectId().toString();

async function runTests() {
    try {
        await mongoose.connect(config.mongoUri);
        console.log("Connected to DB.");

        // --- SEED CALL QUALITY ---
        const user = await UserModel.create({
            name: "Test User",
            email: `testuser-${Date.now()}@example.com`,
            passwordHash: "test1234",
            regions: [],
            status: "ACTIVE",
            isOnline: false
        });

        const lead = await LeadModel.create({
            name: "Test Lead for CQ",
            phone: "+1234567890",
            source: "BRAND_WEBSITE",
            leadType: "STAY",
            leadNumber: "LD-" + Date.now(),
            status: "NEW",
            pipelineId: new mongoose.Types.ObjectId(),
            stageId: new mongoose.Types.ObjectId(),
        });

        const d1 = await CallQualityDimensionModel.create({
            orgId: TEST_ORG_ID,
            name: "Greeting",
            weight_percent: 20,
            display_order: 1,
            is_active: true
        });

        const d2 = await CallQualityDimensionModel.create({
            orgId: TEST_ORG_ID,
            name: "Closing",
            weight_percent: 80,
            display_order: 2,
            is_active: true
        });

        console.log("Seeded dimensions.");

        // Test successful evaluation
        const scoreVal = await CallQualityService.submitCallQualityScore(
            lead.id,
            user.id,
            {
                [d1.id]: 10,
                [d2.id]: 5
            },
            "Good call",
            TEST_ORG_ID
        );

        // Expected weighted score: (10/10 * 20) + (5/10 * 80) = 20 + 40 = 60.0  (0-100 scale per spec)
        if (Math.abs(scoreVal.weighted_total - 60.0) > 0.01) {
            throw new Error(`Call quality test failed. Expected 60.0, got ${scoreVal.weighted_total}`);
        } else {
            console.log("Call Quality logic works!");
        }

        // --- SEED SCORING THRESHOLD ---
        await ScoringThresholdModel.create({
            orgId: TEST_ORG_ID,
            label: "Super Hot",
            min_score: 9,
            max_score: 10,
            color: "#ff0000",
            inactive_hours_warning: 24,
            inactive_hours_critical: 48,
            auto_action: "none"
        });

        const result = await ScoringService.evaluateThreshold(TEST_ORG_ID, 10);
        if (result.bucket !== "Super Hot" || result.color !== "#ff0000") {
            throw new Error(`Scoring Engine failed setup config: got ${JSON.stringify(result)}`);
        } else {
            console.log("Lead Scoring Engine with existing threshold config works!");
        }

        const missingOrgId = new mongoose.Types.ObjectId().toString();
        const fallbackResult = await ScoringService.evaluateThreshold(missingOrgId, 5);
        if (fallbackResult.bucket !== "Warm") {
            throw new Error(`Scoring Engine fallback failed: got ${JSON.stringify(fallbackResult)}`);
        } else {
            console.log("Lead Scoring Engine fallback works!");
        }

        // Cleanup
        await CallQualityDimensionModel.deleteMany({ orgId: TEST_ORG_ID });
        await CallQualityScoreModel.deleteMany({ orgId: TEST_ORG_ID });
        await ScoringThresholdModel.deleteMany({ orgId: TEST_ORG_ID });
        await LeadModel.findByIdAndDelete(lead.id);
        await UserModel.findByIdAndDelete(user.id);
        console.log("Cleaned up DB.");
        console.log("ALL TESTS PASSED.");
        process.exit(0);
    } catch (error) {
        console.error("TEST FAILED:", error);
        process.exit(1);
    }
}

runTests();
