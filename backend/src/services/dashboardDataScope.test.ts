import mongoose from "mongoose";
import assert from "assert";
import { buildLeadQueryForUser } from "./dashboardDataScope";
import { config } from "../config/env";
import { Types } from "mongoose";

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(config.mongoUri);
  console.log("Connected.");

  try {
    const orgId = new Types.ObjectId().toString();
    const userId = new Types.ObjectId().toString();

    console.log("--- Data scope enforcement ---");

    const ownUser = {
      id: userId,
      permissions: ["leads.read"],
      isAdmin: false,
    };

    const q1 = await buildLeadQueryForUser(orgId, userId, ownUser, "own");
    assert.deepStrictEqual(
      q1.assignedToUserId?.toString(),
      userId,
      "own scope: assignedToUserId must match user"
    );
    assert.ok(q1.orgId, "orgId must be set");
    console.log("✅ own scope passed");

    const teamUser = {
      id: userId,
      permissions: ["leads.read"],
      isAdmin: false,
    };

    const q2 = await buildLeadQueryForUser(orgId, userId, teamUser, "team");
    assert.ok(
      q2.assignedToUserId?.$in !== undefined || q2.assignedToUserId !== undefined,
      "team scope: must have assignee filter"
    );
    console.log("✅ team scope passed");

    const adminUser = {
      id: userId,
      permissions: ["leads.manage"],
      isAdmin: false,
    };

    const q3 = await buildLeadQueryForUser(orgId, userId, adminUser, "all");
    assert.strictEqual(
      Object.keys(q3).length,
      1,
      "all scope: only orgId filter for admin"
    );
    assert.ok(q3.orgId, "orgId must be set");
    console.log("✅ all scope (admin) passed");

    console.log("✅ All dashboardDataScope tests passed");
  } catch (err) {
    console.error("Test failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
