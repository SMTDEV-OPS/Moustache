import mongoose from "mongoose";
import assert from "assert";
import { config } from "../config/env";
import { FollowupService } from "./followupService";
import { FollowupRuleModel } from "../models/followupRule";
import { TaskModel } from "../models/task";
import { LeadModel } from "../models/lead";
import { UserModel } from "../models/user";

export async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    console.log("Connected.");

    try {
        const orgId = new mongoose.Types.ObjectId().toHexString();
        console.log(`\n--- Set Up Test Data --- Org: ${orgId}`);

        // Create a dummy user and lead
        const user = await UserModel.create({
            name: "Test User",
            email: `testuser-${Date.now()}@example.com`,
            passwordHash: "test",
            roleId: new mongoose.Types.ObjectId(),
            status: "ACTIVE"
        });

        const lead = await LeadModel.create({
            leadNumber: `TEST-LEAD-${Date.now()}`,
            source: "BRAND_WEBSITE",
            leadType: "STAY",
            status: "NEW",
            assignedToUserId: user._id,
            orgId
        });

        console.log("✅ Seed User & Lead complete");

        console.log("\n--- Testing: Seed Default Followup Rules ---");
        await FollowupService.seedDefaultFollowupRules(orgId);
        let rules = await FollowupRuleModel.find({ org_id: orgId });
        assert.strictEqual(rules.length, 5, "Should have 5 default rules seeded");

        // Test idempotency
        await FollowupService.seedDefaultFollowupRules(orgId);
        rules = await FollowupRuleModel.find({ org_id: orgId });
        assert.strictEqual(rules.length, 5, "Seed should be idempotent");
        console.log("✅ Seed is idempotent and inserted 5 rules");

        console.log("\n--- Testing: Generate Followup Tasks (Hot) ---");
        let baseTime = new Date();
        let tasks = await FollowupService.generateFollowupTasks(lead._id.toString(), "Hot", orgId, baseTime);
        assert.strictEqual(tasks.length, 2, "Hot bucket should generate 2 tasks");

        // Check offsets are correct
        const task1 = tasks.find(t => t.title.includes("Follow-up 1"));
        const task2 = tasks.find(t => t.title.includes("Follow-up 2"));

        assert.ok(task1, "Task 1 created");
        assert.ok(task2, "Task 2 created");

        // offset 2 hours -> difference around 2 hours
        assert.strictEqual(task1!.dueAt.getHours(), new Date(baseTime.getTime() + 2 * 3600000).getHours(), "Offset offset_hours=2 is correct");
        assert.strictEqual(task2!.dueAt.getHours(), new Date(baseTime.getTime() + 5 * 3600000).getHours(), "Offset offset_hours=5 is correct");
        console.log("✅ Generated tasks properly and offsets are calculated correctly for hours.");

        console.log("\n--- Testing: Cancellation of Stale Tasks (Warm) ---");
        // Change to warm and regenerate
        let warmTasks = await FollowupService.generateFollowupTasks(lead._id.toString(), "Warm", orgId, baseTime);
        assert.strictEqual(warmTasks.length, 2, "Warm bucket should generate 2 tasks");

        // Hot tasks should be cancelled
        const previousTasks = await TaskModel.find({ leadId: lead._id, type: "followup" });
        const cancelledTasks = previousTasks.filter(t => t.status === "CANCELLED");
        const openTasks = previousTasks.filter(t => t.status === "OPEN");

        assert.strictEqual(cancelledTasks.length, 2, "Previous 2 hot tasks should be cancelled");
        assert.strictEqual(openTasks.length, 2, "Current 2 warm tasks should be open");
        console.log("✅ Old pending tasks were successfully cancelled.");

        console.log("\n--- Testing: Offset Days Calculation (Cold) ---");
        let coldTasks = await FollowupService.generateFollowupTasks(lead._id.toString(), "Cold", orgId, baseTime);
        assert.strictEqual(coldTasks.length, 1, "Cold bucket should generate 1 task");

        const diffDays = Math.round((coldTasks[0].dueAt.getTime() - baseTime.getTime()) / (1000 * 3600 * 24));
        assert.strictEqual(diffDays, 5, "Offset days should accurately reflect 5 days");
        console.log("✅ Generated tasks properly and offsets are calculated correctly for days.");

        // Clean up
        await FollowupRuleModel.deleteMany({ org_id: orgId });
        await TaskModel.deleteMany({ leadId: lead._id });
        await LeadModel.findByIdAndDelete(lead._id);
        await UserModel.findByIdAndDelete(user._id);

        console.log("\n-------------- ALL TESTS PASSED --------------");

    } catch (err) {
        console.error("❌ Test failed:", err);
        process.exitCode = 1;
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

if (require.main === module) {
    runTests();
}
