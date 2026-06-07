import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PipelineModel } from "../src/models/pipeline";
import { PipelineStageModel } from "../src/models/pipelineStage";

/**
 * Ensures a "Cancelled" terminal stage exists on the default leads pipeline.
 * Run with: npx ts-node scripts/ensureCancelledStage.ts
 */
async function run() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  try {
    const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true });
    if (!pipeline) {
      console.log("No default leads pipeline found — nothing to do.");
      return;
    }

    const existing = await PipelineStageModel.findOne({
      pipelineId: pipeline._id,
      name: /^cancelled$/i,
    });

    if (existing) {
      console.log(`Cancelled stage already exists (${existing._id}).`);
      return;
    }

    const lostStage = await PipelineStageModel.findOne({
      pipelineId: pipeline._id,
      name: /^lost$/i,
    });

    if (lostStage && lostStage.order <= 6) {
      lostStage.order = 7;
      await lostStage.save();
      console.log("Bumped Lost stage order to 7.");
    }

    const stage = await PipelineStageModel.create({
      pipelineId: pipeline._id,
      name: "Cancelled",
      order: 6,
      isTerminal: true,
      terminalType: "LOST",
      color: "#f97316",
      mandatory_fields_json: [],
    });

    console.log(`Created Cancelled stage (${stage._id}).`);
  } finally {
    await mongoose.disconnect();
  }
}

void run().catch((err) => {
  console.error(err);
  process.exit(1);
});
