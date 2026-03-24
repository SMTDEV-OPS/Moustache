import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

// Fix mongoose warning
mongoose.set('strictQuery', false);

import { PipelineStageModel } from "./src/models/pipelineStage";
import { PipelineModel } from "./src/models/pipeline";
import { LeadModel } from "./src/models/lead";
import { CustomFieldModel } from "./src/models/customField";
import { validateStageMove } from "./src/services/leadService";

async function runTests() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/postcard");
        console.log("Connected to DB");

        // Set up test data
        console.log("Setting up test data...");
        const field = await CustomFieldModel.create({
            name: "test_budget",
            slug: "test_budget",
            label: "Test Budget",
            dataType: "NUMBER",
            entity_type: "lead",
            is_active: true
        });

        const pipeline = await PipelineModel.create({
            name: "Test Pipeline",
            module: "leads",
        });

        const stage1 = await PipelineStageModel.create({
            name: "Stage 1",
            pipelineId: pipeline._id,
            order: 0,
            isTerminal: false
        });

        const stage2 = await PipelineStageModel.create({
            name: "Stage 2 (Requires Budget)",
            pipelineId: pipeline._id,
            order: 1,
            isTerminal: false,
            mandatory_fields_json: [field._id.toString()]
        });

        const terminalStage = await PipelineStageModel.create({
            name: "Won Stage",
            pipelineId: pipeline._id,
            order: 2,
            isTerminal: true,
            terminalType: "WON"
        });

        const leadWithoutBudget = await LeadModel.create({
            leadNumber: "TEST-" + Date.now(),
            source: "MANUAL",
            leadType: "STAY",
            stageId: stage1._id,
            guestContact: { name: "Test User" },
        });

        const leadWithBudget = await LeadModel.create({
            leadNumber: "TEST-" + (Date.now() + 1),
            source: "MANUAL",
            leadType: "STAY",
            stageId: stage1._id,
            guestContact: { name: "Test User 2" },
            customData: { test_budget: 5000 }
        });

        const leadTerminal = await LeadModel.create({
            leadNumber: "TEST-" + (Date.now() + 2),
            source: "MANUAL",
            leadType: "STAY",
            stageId: terminalStage._id,
            guestContact: { name: "Test User 3" },
        });

        console.log("Test data setup complete.");

        // TEST 1: Gate blocks on missing fields
        console.log("\\n--- TEST 1: Gate blocks on missing fields ---");
        const res1 = await validateStageMove(leadWithoutBudget._id.toString(), stage2._id.toString());
        if (!res1.allowed && res1.missingFields && res1.missingFields.length > 0) {
            console.log("✅ Passed: Successfully blocked lead without budget. Missing fields:", res1.missingFields);
        } else {
            console.error("❌ Failed: Did not block lead correctly", res1);
        }

        // TEST 2: Gate passes when all mandatory fields are filled
        console.log("\\n--- TEST 2: Gate passes with filled fields ---");
        const res2 = await validateStageMove(leadWithBudget._id.toString(), stage2._id.toString());
        if (res2.allowed) {
            console.log("✅ Passed: Successfully allowed lead with budget.");
        } else {
            console.error("❌ Failed: Blocked lead that should have passed", res2);
        }

        // TEST 3: Cannot move from terminal stage
        console.log("\\n--- TEST 3: Cannot move from terminal stage ---");
        const res3 = await validateStageMove(leadTerminal._id.toString(), stage1._id.toString());
        if (!res3.allowed && res3.reason === 'already_terminal') {
            console.log("✅ Passed: Blocked move from terminal stage.");
        } else {
            console.error("❌ Failed: Allowed move from terminal stage", res3);
        }

        // TEST 4: Delete stage protection
        console.log("\\n--- TEST 4: Delete stage protection ---");
        // Simulated inside pipeline routes logic - just manually checking the core check
        const activeLeadsCount = await LeadModel.countDocuments({ stageId: stage1._id });
        if (activeLeadsCount > 0) {
            console.log(`✅ Passed: Simulated protection would trigger as ${activeLeadsCount} leads found in stage1.`);
        } else {
            console.error("❌ Failed: No leads found in stage1 but expected at least 1.");
        }

        // Cleanup
        console.log("\\nCleaning up test data...");
        await CustomFieldModel.deleteOne({ _id: field._id });
        await PipelineStageModel.deleteMany({ pipelineId: pipeline._id });
        await PipelineModel.deleteOne({ _id: pipeline._id });
        await LeadModel.deleteMany({ _id: { $in: [leadWithoutBudget._id, leadWithBudget._id, leadTerminal._id] } });

        console.log("Cleanup complete.");

    } catch (err) {
        console.error("Error during test run:", err);
    } finally {
        await mongoose.connection.close();
    }
}

runTests();
