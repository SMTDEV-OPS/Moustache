import mongoose from "mongoose";
import assert from "assert";
import { buildLeadQueryFromFilter } from "./filterService";
import { config } from "../config/env";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { Types } from "mongoose";

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(config.mongoUri);
  console.log("Connected.");

  try {
    const orgId = new Types.ObjectId();

    console.log("--- Filter condition translation ---");

    const q1 = await buildLeadQueryFromFilter(
      {
        conditions: [
          { field: "bucket", operator: "eq", value: "HOT" },
          { field: "source", operator: "eq", value: "WHATSAPP" },
        ],
        logic: "AND",
      },
      orgId,
      { orgId }
    );
    assert.ok(q1.$and, "AND conditions should produce $and");
    assert.ok(q1.$and.length >= 2, "At least 2 conditions");
    const heatCond = q1.$and.find((c: any) => c.heatLevel !== undefined);
    assert.ok(heatCond && heatCond.heatLevel === "HOT", "bucket -> heatLevel");
    console.log("✅ eq conditions passed");

    const q2 = await buildLeadQueryFromFilter(
      {
        conditions: [{ field: "budget", operator: "gte", value: 50000 }],
        logic: "AND",
      },
      orgId,
      { orgId }
    );
    const budgetCond =
      q2.budget ||
      q2.$and?.find((c: any) => c.budget !== undefined);
    assert.ok(budgetCond, "budget condition");
    console.log("✅ gte condition passed");

    const q3 = await buildLeadQueryFromFilter(
      {
        conditions: [
          {
            field: "first_contact_done",
            operator: "eq",
            value: false,
          },
        ],
        logic: "AND",
      },
      orgId,
      { orgId }
    );
    assert.ok(q3.$or || q3.firstResponseAt !== undefined, "first_contact_done resolved");
    console.log("✅ first_contact_done virtual field passed");

    console.log("✅ All filterService tests passed");
  } catch (err) {
    console.error("Test failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
