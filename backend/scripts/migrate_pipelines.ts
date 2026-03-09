import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { LeadModel } from "../src/models/lead";
import { PipelineModel } from "../src/models/pipeline";
import { PipelineStageModel } from "../src/models/pipelineStage";
import { LeadStage } from "../src/models/common";

/**
 * Migration script to create default Pipeline and migrate existing string string stages to PipelineStage ObjectIds
 * Run with: npx ts-node scripts/migrate_pipelines.ts
 */
async function runMigration() {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB");

    try {
        // 1. Create default pipeline
        let pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true });

        if (!pipeline) {
            console.log("Creating default Leads Pipeline...");
            pipeline = await PipelineModel.create({
                name: "Standard Sales Pipeline",
                description: "Default pipeline for all stays and bookings",
                module: "leads",
                isActive: true,
                isDefault: true,
            });
        } else {
            console.log("Default Leads Pipeline already exists.");
        }

        // 2. Create standard stages based on old LeadStage enum
        const standardStages = [
            { name: "New Lead", enumValue: LeadStage.NEW_LEAD, order: 0, color: "#9ca3af", probability: 10, isTerminal: false },
            { name: "First Connect", enumValue: LeadStage.FIRST_CONNECT, order: 1, color: "#60a5fa", probability: 25, isTerminal: false },
            { name: "Discussion", enumValue: LeadStage.DISCUSSION, order: 2, color: "#f59e0b", probability: 50, isTerminal: false },
            { name: "Payment Request", enumValue: LeadStage.PAYMENT_REQUEST, order: 3, color: "#8b5cf6", probability: 80, isTerminal: false },
            { name: "Booked", enumValue: LeadStage.BOOKED, order: 4, color: "#10b981", probability: 100, isTerminal: true, terminalType: "WON" },
            { name: "Lost", enumValue: LeadStage.LOST, order: 5, color: "#ef4444", probability: 0, isTerminal: true, terminalType: "LOST" },
        ];

        const stageMap = new Map<string, string>(); // enumValue -> ObjectId string

        console.log("Ensuring pipeline stages exist...");
        for (const stageData of standardStages) {
            // Find existing
            let stage = await PipelineStageModel.findOne({
                pipelineId: pipeline._id,
                name: stageData.name
            });

            if (!stage) {
                stage = await PipelineStageModel.create({
                    pipelineId: pipeline._id,
                    name: stageData.name,
                    order: stageData.order,
                    color: stageData.color,
                    probability: stageData.probability,
                    isTerminal: stageData.isTerminal,
                    terminalType: stageData.terminalType,
                });
            }

            stageMap.set(stageData.enumValue, stage._id.toString());
        }

        // 3. Migrate leads
        // We will update 'stageId' on all leads
        console.log("Migrating leads...");
        const leads = await LeadModel.find({});

        let migratedCount = 0;
        for (const lead of leads) {
            // lead.stage is technically string from db
            const currentStageStr = lead.get("stage") as string;
            const targetStageId = stageMap.get(currentStageStr);

            if (targetStageId) {
                // use set to bypass ts errors before we fully migrate the schema
                lead.set("stageId", new mongoose.Types.ObjectId(targetStageId));
                await lead.save({ validateBeforeSave: false }); // skip validation if strict
                migratedCount++;
            }
        }

        console.log(`Migration complete! Successfully added stageId to ${migratedCount} leads.`);

    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

runMigration();
