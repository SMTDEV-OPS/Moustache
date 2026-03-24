/**
 * V2 Allocation Engine Test Script
 *
 * Run: npx ts-node scripts/testV2Allocation.ts
 * Or:  MONGO_URI=... npx ts-node scripts/testV2Allocation.ts
 *
 * This script thoroughly tests the V2 assignment engine and identifies why it might not be working.
 */

import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { AssignmentRuleModel } from "../src/models/assignmentRule";
import { EmployeeGroupModel } from "../src/models/employeeGroup";
import { UserModel } from "../src/models/user";
import { AllocationConfigModel } from "../src/models/allocationConfig";
import { AgentDailyWorkloadModel } from "../src/models/agentDailyWorkload";
import { tryV2Assignment } from "../src/services/assignmentService";
import { Types } from "mongoose";

const log = (msg: string, data?: any) => {
  console.log(`\n${"=".repeat(60)}`);
  console.log(msg);
  if (data !== undefined) console.log(JSON.stringify(data, null, 2));
  console.log("=".repeat(60));
};

async function main() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to MongoDB");

  try {
    // ── 1. Check V2 Rules ─────────────────────────────────────────────
    log("1. V2 ASSIGNMENT RULES (module: leads, isActive: true)", null);

    const rules = await AssignmentRuleModel.find({ module: "leads", isActive: true })
      .sort({ priority: 1 })
      .populate("employeeGroupId", "groupName memberUserIds")
      .populate("specificUserId", "name email status")
      .lean();

    if (!rules || rules.length === 0) {
      log("❌ NO RULES FOUND", "Create V2 assignment rules in Setup → Assignment Rules. The engine returns null when no rules exist.");
      log("Expected: At least one rule with module='leads' and isActive=true");
      return;
    }

    console.log(`✓ Found ${rules.length} rule(s)\n`);
    for (let i = 0; i < rules.length; i++) {
      const r = rules[i] as any;
      console.log(`Rule ${i + 1}: "${r.name}" (priority=${r.priority})`);
      console.log(`  applyToAll: ${r.applyToAll}`);
      console.log(`  conditions: ${r.conditions?.length || 0} (logic: ${r.conditionLogic})`);
      if (r.conditions?.length) {
        r.conditions.forEach((c: any, j: number) => {
          console.log(`    [${j}] ${c.field} ${c.operator} ${c.value}`);
        });
      }
      console.log(`  assignTo: ${r.assignTo}`);
      if (r.assignTo === "user" && r.specificUserId) {
        console.log(`  specificUserId: ${r.specificUserId._id} (${r.specificUserId.name}, status=${r.specificUserId.status})`);
      }
      if (r.assignTo !== "user" && r.employeeGroupId) {
        const memberCount = Array.isArray(r.employeeGroupId?.memberUserIds)
          ? r.employeeGroupId.memberUserIds.length
          : 0;
        console.log(`  employeeGroupId: ${r.employeeGroupId._id} (${r.employeeGroupId.groupName}, ${memberCount} members)`);
      }
      console.log("");
    }

    // ── 2. Field name mapping (critical for condition matching) ─────────
    log("2. FIELD NAME MAPPING (rule conditions → CreateLeadInput)", null);
    console.log(`
Rule conditions look up: leadInput.customData[field] ?? leadInput[field]

CreateLeadInput has these fields at assignment time:
  - source, leadType, budget, bookingWindow, customerType
  - customData (object with snake_case keys from forms: customer_type, booking_window, etc.)

⚠️  COMMON MISTAKES:
  - Rule field "estimatedBudget" → input has "budget" (NOT estimatedBudget) → WILL NOT MATCH
  - Rule field "leadScore" → score is calculated AFTER assignment → WILL NEVER MATCH
  - Rule field "customer_type" → check customData.customer_type OR input.customerType
  - Rule field "source" → use exact enum: BRAND_WEBSITE, DIRECT_CALL, etc.
`);

    // ── 3. Employee groups & users ────────────────────────────────────
    log("3. EMPLOYEE GROUPS & MEMBERS", null);

    const groups = await EmployeeGroupModel.find({ isActive: true })
      .populate("memberUserIds", "name email status isOnline lastLoginAt")
      .lean();

    if (groups.length === 0) {
      console.log("⚠️  No employee groups found. Rules that assign to groups will have 0 eligible users.");
    } else {
      for (const g of groups as any[]) {
        const members = g.memberUserIds || [];
        const activeCount = members.filter((m: any) => m?.status === "ACTIVE").length;
        console.log(`Group: ${g.groupName} (${g._id})`);
        console.log(`  Members: ${members.length}, ACTIVE: ${activeCount}`);
        members.slice(0, 5).forEach((m: any) => {
          if (m) console.log(`    - ${m.name} (${m.email}) status=${m.status} isOnline=${m.isOnline}`);
        });
        if (members.length > 5) console.log(`    ... and ${members.length - 5} more`);
        console.log("");
      }
    }

    // ── 4. Allocation config & capacity ───────────────────────────────
    log("4. ALLOCATION CONFIG (affects getAvailableAgentsForLead)", null);

    const allocConfigs = await AllocationConfigModel.find({}).lean();
    if (allocConfigs.length === 0) {
      console.log("No AllocationConfig documents. Defaults: daily_lead_cap=30, allocation_window_hours=8");
      console.log("Note: getConfigValue looks up by key only (not orgId).");
    } else {
      allocConfigs.forEach((c: any) => {
        console.log(`  ${c.key}: ${c.value} (orgId: ${c.orgId})`);
      });
    }

    const workloads = await AgentDailyWorkloadModel.find({
      date: new Date().toISOString().split("T")[0],
    }).lean();
    console.log(`\nToday's agent workloads: ${workloads.length} records`);
    workloads.slice(0, 5).forEach((w: any) => {
      console.log(`  agent ${w.agentId}: lead_count=${w.lead_count} is_available=${w.is_available}`);
    });

    // ── 5. Get default org for testing ────────────────────────────────
    const firstProp = await mongoose.connection.db
      ?.collection("properties")
      ?.findOne({}, { projection: { _id: 1 } });
    const orgId = firstProp ? String((firstProp as any)._id) : undefined;

    // ── 6. Run tryV2Assignment with test inputs ───────────────────────
    log("6. DRY-RUN: tryV2Assignment with sample inputs", null);

    const testInputs = [
      {
        name: "Website lead, budget 500k, STAY",
        input: {
          source: "BRAND_WEBSITE",
          leadType: "STAY",
          budget: 500000,
          bookingWindow: "Within 5 hrs",
          customerType: "B2C",
          customData: { customer_type: "B2C", budget: 500000, booking_window: "Within 5 hrs" },
        } as any,
      },
      {
        name: "Apply-to-all rule test (minimal input)",
        input: {
          source: "BRAND_WEBSITE",
          leadType: "STAY",
        } as any,
      },
      {
        name: "source=DIRECT_CALL",
        input: {
          source: "DIRECT_CALL",
          leadType: "STAY",
        } as any,
      },
    ];

    for (const { name, input } of testInputs) {
      console.log(`\n--- Test: ${name} ---`);
      console.log("Input:", JSON.stringify(input, null, 2));

      const result = await tryV2Assignment(input, orgId);

      if (result) {
        console.log("✓ V2 ASSIGNED:", {
          assignedToUserId: result.assignedToUserId?.toString(),
          assignmentMethod: result.assignmentMethod,
          assignmentSource: result.assignmentSource,
          assignmentRuleName: result.assignmentRuleName,
          isOverflow: result.isOverflow,
          reason: result.reason,
        });
      } else {
        console.log("✗ V2 returned null (no rule matched or no eligible users)");
        console.log("  → Engine falls back to legacy rules, then round-robin.");
      }
    }

    // ── 7. Create a real lead and verify assignment ───────────────────
    log("7. LIVE TEST: Create a real lead with assignmentMode=auto", null);

    const { createLead } = await import("../src/services/leadService");

    const lead = await createLead({
      guestContact: { name: "V2 Allocation Test", phone: "9999999998", email: "v2test@test.com" },
      source: "BRAND_WEBSITE" as any,
      leadType: "STAY" as any,
      budget: 600000,
      bookingWindow: "Within 24 hrs",
      customerType: "B2C",
      assignmentMode: "auto",
    });

    console.log("Created lead:", lead.leadNumber, lead._id);
    console.log("Assignment result:");
    console.log("  assignedToUserId:", (lead as any).assignedToUserId?.toString());
    console.log("  assignmentSource:", (lead as any).assignmentSource);
    console.log("  assignmentRuleName:", (lead as any).assignmentRuleName);
    console.log("  status:", lead.status);

    if ((lead as any).assignmentSource === "v2_rule") {
      console.log("\n✓ V2 allocation is working!");
    } else {
      console.log("\n⚠️  Lead was NOT assigned via V2 rules. assignmentSource =", (lead as any).assignmentSource);
      console.log("   Check: rule conditions, field names, group membership, capacity.");
    }
  } finally {
    await mongoose.connection.close();
    console.log("\nDone.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
