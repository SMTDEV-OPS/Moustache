import mongoose from "mongoose";
import assert from "assert";
import { Types } from "mongoose";
import {
  seedAllocationConfig,
  getAvailableAgents,
  checkCapacityAlerts,
  getConfigValue,
  getTodayDateString,
  getAllocationConfig,
  updateAllocationConfig,
  getWorkloadsForDate,
  toggleAgentAvailability,
  incrementAgentWorkload,
} from "./allocationService";
import { config } from "../config/env";
import { AllocationConfigModel } from "../models/allocationConfig";
import { AgentDailyWorkloadModel } from "../models/agentDailyWorkload";
import { UserModel } from "../models/user";

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(config.mongoUri);
  console.log("Connected.");

  const testOrgId = new Types.ObjectId().toString();
  const testAgentId = new Types.ObjectId();

  try {
    console.log("--- seedAllocationConfig idempotency ---");
    await seedAllocationConfig(testOrgId);
    const v1 = await getConfigValue(testOrgId, "daily_lead_cap", "");
    assert.strictEqual(v1, "30", "First seed: daily_lead_cap should be 30");

    // Manually change a value to verify second seed does NOT overwrite
    await AllocationConfigModel.updateOne(
      { orgId: new Types.ObjectId(testOrgId), key: "daily_lead_cap" },
      { $set: { value: "99" } }
    );
    await seedAllocationConfig(testOrgId);
    const v2 = await getConfigValue(testOrgId, "daily_lead_cap", "");
    assert.strictEqual(v2, "99", "Second seed must not overwrite existing value (idempotent)");
    console.log("✅ seedAllocationConfig idempotency passed");

    console.log("--- getAvailableAgents (cap, window, is_available) ---");
    await updateAllocationConfig(testOrgId, { daily_lead_cap: "2", allocation_window_hours: "8760" }); // 1 year window
    const agents = await getAvailableAgents(testOrgId);
    assert.ok(Array.isArray(agents), "getAvailableAgents returns array");
    // With no teamId, uses all ACTIVE users. May be empty if no users with recent lastLoginAt.
    // Verify at least that agents with workload >= cap are excluded.
    const today = getTodayDateString();
    const user = await UserModel.findOne({ status: "ACTIVE" }).select("_id").lean();
    if (user) {
      await AgentDailyWorkloadModel.findOneAndUpdate(
        { orgId: new Types.ObjectId(testOrgId), agentId: user._id, date: today },
        { $set: { lead_count: 10, is_available: true } },
        { upsert: true }
      );
      const agentsAfter = await getAvailableAgents(testOrgId);
      const excluded = agentsAfter.some((id) => id.equals(user._id));
      assert.ok(!excluded, "Agent at/over cap should be excluded from available");
    }
    console.log("✅ getAvailableAgents passed");

    console.log("--- checkCapacityAlerts (alert_sent, no duplicate) ---");
    await AllocationConfigModel.updateOne(
      { orgId: new Types.ObjectId(testOrgId), key: "daily_lead_cap" },
      { $set: { value: "10" } },
      { upsert: true }
    );
    await AllocationConfigModel.updateOne(
      { orgId: new Types.ObjectId(testOrgId), key: "alert_threshold_percent" },
      { $set: { value: "50" } },
      { upsert: true }
    );
    const threshold = 5; // 50% of 10
    await AgentDailyWorkloadModel.findOneAndUpdate(
      { orgId: new Types.ObjectId(testOrgId), agentId: testAgentId, date: today },
      { $set: { lead_count: threshold, is_available: true, alert_sent: false } },
      { upsert: true }
    );
    const emitted: any[] = [];
    const { leadEventBus } = await import("./leadService");
    const handler = (payload: any) => emitted.push(payload);
    leadEventBus.on("agent.capacity_warning", handler);
    await checkCapacityAlerts(testOrgId);
    assert.ok(emitted.length >= 1, "Should emit agent.capacity_warning when threshold crossed");
    const w = await AgentDailyWorkloadModel.findOne({ orgId: new Types.ObjectId(testOrgId), agentId: testAgentId, date: today });
    assert.strictEqual(w?.alert_sent, true, "alert_sent should be set");
    await checkCapacityAlerts(testOrgId);
    assert.ok(emitted.length >= 1 && emitted.filter((e) => e.agentId === testAgentId.toString()).length <= 1, "No duplicate alerts same day");
    leadEventBus.off("agent.capacity_warning", handler);
    console.log("✅ checkCapacityAlerts passed");

    console.log("--- getAllocationConfig, updateAllocationConfig ---");
    const cfg = await getAllocationConfig(testOrgId);
    assert.ok(typeof cfg === "object", "getAllocationConfig returns object");
    assert.ok(cfg.daily_lead_cap, "Config has daily_lead_cap");
    await updateAllocationConfig(testOrgId, { daily_lead_cap: "25" });
    const cfg2 = await getAllocationConfig(testOrgId);
    assert.strictEqual(cfg2.daily_lead_cap?.value, "25", "updateAllocationConfig updates value");
    console.log("✅ getAllocationConfig, updateAllocationConfig passed");

    console.log("--- getWorkloadsForDate, toggleAgentAvailability ---");
    await incrementAgentWorkload(testOrgId, testAgentId.toString());
    const workloads = await getWorkloadsForDate(testOrgId);
    assert.ok(Array.isArray(workloads), "getWorkloadsForDate returns array");
    const agentWorkload = workloads.find((w) => w.agentId === testAgentId.toString());
    assert.ok(agentWorkload && agentWorkload.lead_count >= 1, "Workload reflects increment");
    await toggleAgentAvailability(testOrgId, testAgentId.toString(), false);
    const workloads2 = await getWorkloadsForDate(testOrgId);
    const agentWorkload2 = workloads2.find((w) => w.agentId === testAgentId.toString());
    assert.strictEqual(agentWorkload2?.is_available, false, "toggleAgentAvailability sets is_available");
    console.log("✅ getWorkloadsForDate, toggleAgentAvailability passed");

    // Cleanup test data
    await AllocationConfigModel.deleteMany({ orgId: new Types.ObjectId(testOrgId) });
    await AgentDailyWorkloadModel.deleteMany({ orgId: new Types.ObjectId(testOrgId) });

    console.log("✅ All allocationService tests passed");
  } catch (err) {
    console.error("Test failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
