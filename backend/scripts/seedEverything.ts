/**
 * Seed all engine configuration data into Postcardcrm.
 * Idempotent: skips entities that already exist.
 * Uses the same MongoDB config as the app (config.mongoUri).
 *
 * Usage: npm run seed:everything
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PipelineModel } from "../src/models/pipeline";
import { PipelineStageModel } from "../src/models/pipelineStage";
import { CustomFieldModel } from "../src/models/customField";
import { ScoringThresholdModel } from "../src/models/scoringThreshold";
import { ScoringRuleModel } from "../src/models/scoringRule";
import { FollowupRuleModel } from "../src/models/followupRule";
import { AllocationConfigModel } from "../src/models/allocationConfig";
import { CallQualityDimensionModel } from "../src/models/callQualityDimension";
import { AccountModel } from "../src/models/account";
import { PropertyModel } from "../src/models/property";
import { Types } from "mongoose";

async function getOrCreateOrgId(): Promise<Types.ObjectId> {
  let account = await AccountModel.findOne().select("_id").lean();
  if (account) return account._id as Types.ObjectId;

  const property = await PropertyModel.findOne().select("_id").lean();
  if (property) return property._id as Types.ObjectId;

  const newAccount = await AccountModel.create({
    name: "Postcard CRM",
    organizationType: "CORPORATE",
    type: "CORPORATE",
    accountLevel: "MASTER",
    isHeadquarter: true,
  });
  return newAccount._id as Types.ObjectId;
}

async function seedEverything() {
  await mongoose.connect(config.mongoUri);
  console.log("Connected to:", config.mongoUri);

  const results: Record<string, string> = {};
  const orgId = await getOrCreateOrgId();
  console.log("Using orgId:", orgId.toString());

  // ── STEP 1: Pipeline ──────────────────────────────────────────
  let pipeline = await PipelineModel.findOne({
    module: "leads",
    isDefault: true,
  });

  if (!pipeline) {
    pipeline = await PipelineModel.create({
      name: "Sales Pipeline",
      module: "leads",
      isDefault: true,
      isActive: true,
    });
    results["Pipeline"] = "created";
  } else {
    results["Pipeline"] = "already exists";
  }

  const stageCount = await PipelineStageModel.countDocuments({
    pipelineId: pipeline._id,
  });

  if (stageCount === 0) {
    await PipelineStageModel.insertMany([
      {
        pipelineId: pipeline._id,
        name: "New Lead",
        order: 1,
        isTerminal: false,
        color: "#6366f1",
        mandatory_fields_json: [],
      },
      {
        pipelineId: pipeline._id,
        name: "1st Connect",
        order: 2,
        isTerminal: false,
        color: "#3b82f6",
        mandatory_fields_json: [],
      },
      {
        pipelineId: pipeline._id,
        name: "Discussion",
        order: 3,
        isTerminal: false,
        color: "#f59e0b",
        mandatory_fields_json: [],
      },
      {
        pipelineId: pipeline._id,
        name: "Payment Request",
        order: 4,
        isTerminal: false,
        color: "#8b5cf6",
        mandatory_fields_json: [],
      },
      {
        pipelineId: pipeline._id,
        name: "Booked",
        order: 5,
        isTerminal: true,
        terminalType: "WON",
        color: "#22c55e",
        mandatory_fields_json: [],
      },
      {
        pipelineId: pipeline._id,
        name: "Lost",
        order: 6,
        isTerminal: true,
        terminalType: "LOST",
        color: "#ef4444",
        mandatory_fields_json: [],
      },
    ]);
    results["Pipeline Stages"] = "6 created";
  } else {
    results["Pipeline Stages"] = `${stageCount} already exist`;
  }

  // ── STEP 2: Custom Fields ─────────────────────────────────────
  const fieldDefs = [
    {
      name: "customer_type",
      slug: "customer_type",
      label: "Customer Type",
      entity_type: "lead" as const,
      dataType: "DROPDOWN" as const,
      is_tag: true,
      display_order: 1,
      is_active: true,
      module: "leads" as const,
      options: [
        "B2C",
        "B2B",
        "Corporate",
        "Influencer",
        "NRI",
        "HNI",
        "Reference",
      ].map((v) => ({ label: v, value: v })),
    },
    {
      name: "booking_window",
      slug: "booking_window",
      label: "Booking Window",
      entity_type: "lead" as const,
      dataType: "DROPDOWN" as const,
      display_order: 2,
      is_active: true,
      module: "leads" as const,
      options: ["Within 5 hrs", "Within 24 hrs", "Yet to decide"].map((v) => ({
        label: v,
        value: v,
      })),
    },
    {
      name: "budget",
      slug: "budget",
      label: "Budget",
      entity_type: "lead" as const,
      dataType: "NUMBER" as const,
      display_order: 3,
      is_active: true,
      module: "leads" as const,
    },
    {
      name: "occasion",
      slug: "occasion",
      label: "Occasion",
      entity_type: "lead" as const,
      dataType: "TEXT" as const,
      display_order: 4,
      is_active: true,
      module: "leads" as const,
    },
    {
      name: "guest_type",
      slug: "guest_type",
      label: "Guest Type",
      entity_type: "lead" as const,
      dataType: "DROPDOWN" as const,
      display_order: 5,
      is_active: true,
      module: "leads" as const,
      options: ["First Time", "Repeat"].map((v) => ({ label: v, value: v })),
    },
    {
      name: "closure_reason",
      slug: "closure_reason",
      label: "Closure Reason",
      entity_type: "lead" as const,
      dataType: "DROPDOWN" as const,
      display_order: 6,
      is_active: true,
      module: "leads" as const,
      options: [
        "Sold Out",
        "Budget",
        "Booked Elsewhere - OTA",
        "Booked Elsewhere - Website",
        "No Response",
        "Policy Issue - Under 18",
        "Policy Issue - Local ID",
        "Policy Issue - Pet",
        "Policy Issue - Alcohol",
        "Property Under Maintenance",
      ].map((v) => ({ label: v, value: v })),
    },
  ];

  let fieldsCreated = 0;
  for (const field of fieldDefs) {
    const exists = await CustomFieldModel.findOne({
      $or: [
        { slug: field.slug, entity_type: "lead" },
        { module: field.module, fieldName: field.name },
      ],
    });
    if (!exists) {
      // Legacy index { module, fieldName } is unique; omitting fieldName stores null and duplicates fail (E11000).
      await CustomFieldModel.create({
        ...field,
        fieldName: field.name,
      });
      fieldsCreated++;
    }
  }
  results["Custom Fields"] =
    fieldsCreated > 0 ? `${fieldsCreated} created` : "all exist";

  // ── STEP 3: Scoring Thresholds ───────────────────────────────
  const thresholdCount = await ScoringThresholdModel.countDocuments({
    orgId,
  });
  if (thresholdCount === 0) {
    await ScoringThresholdModel.insertMany([
      {
        orgId,
        label: "Hot",
        min_score: 7,
        max_score: 10,
        color: "#ef4444",
        inactive_hours_warning: 48,
        inactive_hours_critical: 72,
        auto_action: "notify_tl",
      },
      {
        orgId,
        label: "Warm",
        min_score: 4,
        max_score: 6,
        color: "#f59e0b",
        inactive_hours_warning: 72,
        inactive_hours_critical: 96,
        auto_action: "none",
      },
      {
        orgId,
        label: "Cold",
        min_score: 0,
        max_score: 3,
        color: "#3b82f6",
        inactive_hours_warning: 120,
        inactive_hours_critical: 168,
        auto_action: "auto_lost",
      },
    ]);
    results["Scoring Thresholds"] = "3 created";
  } else {
    results["Scoring Thresholds"] = `${thresholdCount} already exist`;
  }

  // ── STEP 4: Scoring Rules ────────────────────────────────────
  // Operators: is, is_not, contains, starts_with, greater_than, less_than, is_empty, is_not_empty
  // For "within N days": use field "_daysUntil_checkInDate" + operator "less_than" + value N+1
  const ruleCount = await ScoringRuleModel.countDocuments({ module: "leads" });
  if (ruleCount === 0) {
    await ScoringRuleModel.insertMany([
      {
        name: "Travel Date - Urgent (within 10 days)",
        module: "leads",
        isActive: true,
        priority: 1,
        conditionLogic: "AND",
        points: 3,
        conditions: [
          {
            field: "_daysUntil_checkInDate",
            operator: "less_than",
            value: 11,
          },
        ],
      },
      {
        name: "Travel Date - Soon (within 30 days)",
        module: "leads",
        isActive: true,
        priority: 2,
        conditionLogic: "AND",
        points: 2,
        conditions: [
          {
            field: "_daysUntil_checkInDate",
            operator: "less_than",
            value: 31,
          },
        ],
      },
      {
        name: "Travel Date - Planned (within 60 days)",
        module: "leads",
        isActive: true,
        priority: 3,
        conditionLogic: "AND",
        points: 1,
        conditions: [
          {
            field: "_daysUntil_checkInDate",
            operator: "less_than",
            value: 61,
          },
        ],
      },
      {
        name: "Budget - High (50k+)",
        module: "leads",
        isActive: true,
        priority: 4,
        conditionLogic: "AND",
        points: 2,
        conditions: [{ field: "budget", operator: "greater_than", value: 49999 }],
      },
      {
        name: "Budget - Medium (20k+)",
        module: "leads",
        isActive: true,
        priority: 5,
        conditionLogic: "AND",
        points: 1,
        conditions: [{ field: "budget", operator: "greater_than", value: 19999 }],
      },
      {
        name: "Source - IVR Callback",
        module: "leads",
        isActive: true,
        priority: 6,
        conditionLogic: "AND",
        points: 1,
        conditions: [{ field: "source", operator: "is", value: "IVR" }],
      },
      {
        name: "Booking Window - Urgent (within 5 hrs)",
        module: "leads",
        isActive: true,
        priority: 7,
        conditionLogic: "AND",
        points: 2,
        conditions: [
          {
            field: "bookingWindow",
            operator: "is",
            value: "Within 5 hrs",
          },
        ],
      },
      {
        name: "Booking Window - Today (within 24 hrs)",
        module: "leads",
        isActive: true,
        priority: 8,
        conditionLogic: "AND",
        points: 1,
        conditions: [
          {
            field: "bookingWindow",
            operator: "is",
            value: "Within 24 hrs",
          },
        ],
      },
    ]);
    results["Scoring Rules"] = "8 created";
  } else {
    results["Scoring Rules"] = `${ruleCount} already exist`;
  }

  // ── STEP 5: Follow-up Rules ──────────────────────────────────
  const fuCount = await FollowupRuleModel.countDocuments();
  if (fuCount === 0) {
    await FollowupRuleModel.insertMany([
      {
        bucket: "Hot",
        followup_number: 1,
        offset_hours: 2,
        description: "Hot FU-1: Call within 2 hours",
        is_active: true,
        display_order: 1,
      },
      {
        bucket: "Hot",
        followup_number: 2,
        offset_hours: 5,
        description: "Hot FU-2: Follow up at 5 hours",
        is_active: true,
        display_order: 2,
      },
      {
        bucket: "Warm",
        followup_number: 1,
        offset_hours: 24,
        description: "Warm FU-1: Call within 24 hours",
        is_active: true,
        display_order: 3,
      },
      {
        bucket: "Warm",
        followup_number: 2,
        offset_hours: 48,
        description: "Warm FU-2: Follow up at 48 hours",
        is_active: true,
        display_order: 4,
      },
      {
        bucket: "Cold",
        followup_number: 1,
        offset_days: 5,
        description: "Cold FU-1: Check in after 5 days",
        is_active: true,
        display_order: 5,
      },
    ]);
    results["Follow-up Rules"] = "5 created";
  } else {
    results["Follow-up Rules"] = `${fuCount} already exist`;
  }

  // ── STEP 6: Allocation Config ────────────────────────────────
  const configCount = await AllocationConfigModel.countDocuments({ orgId });
  if (configCount === 0) {
    await AllocationConfigModel.insertMany([
      {
        orgId,
        key: "daily_lead_cap",
        value: "30",
        description: "Max leads per agent per day",
      },
      {
        orgId,
        key: "allocation_window_hours",
        value: "8",
        description: "Hours after login to allocate",
      },
      {
        orgId,
        key: "overflow_mode",
        value: "smart_queue",
        description: "queue or smart_queue",
      },
      {
        orgId,
        key: "alert_threshold_percent",
        value: "90",
        description: "Alert TL at this % of cap",
      },
      {
        orgId,
        key: "allocation_mode",
        value: "round_robin",
        description: "round_robin or manual",
      },
      {
        orgId,
        key: "tl_notification_user_ids",
        value: "[]",
        description: "JSON array of TL User IDs to notify",
      },
    ]);
    results["Allocation Config"] = "6 keys created";
  } else {
    results["Allocation Config"] = `${configCount} already exist`;
  }

  // ── STEP 7: Call Quality Dimensions ─────────────────────────
  const cqCount = await CallQualityDimensionModel.countDocuments({ orgId });
  if (cqCount === 0) {
    await CallQualityDimensionModel.insertMany([
      {
        orgId,
        name: "Warm Welcome & Greeting",
        weight_percent: 15,
        display_order: 1,
        is_active: true,
      },
      {
        orgId,
        name: "Understanding Guest Needs",
        weight_percent: 15,
        display_order: 2,
        is_active: true,
      },
      {
        orgId,
        name: "Building Rapport",
        weight_percent: 15,
        display_order: 3,
        is_active: true,
      },
      {
        orgId,
        name: "Product Knowledge",
        weight_percent: 15,
        display_order: 4,
        is_active: true,
      },
      {
        orgId,
        name: "Pitching Skills",
        weight_percent: 10,
        display_order: 5,
        is_active: true,
      },
      {
        orgId,
        name: "Objection Handling",
        weight_percent: 10,
        display_order: 6,
        is_active: true,
      },
      {
        orgId,
        name: "Closing",
        weight_percent: 10,
        display_order: 7,
        is_active: true,
      },
      {
        orgId,
        name: "Follow-up",
        weight_percent: 10,
        display_order: 8,
        is_active: true,
      },
    ]);
    results["Call Quality Dimensions"] = "8 created";
  } else {
    results["Call Quality Dimensions"] = `${cqCount} already exist`;
  }

  // ── PRINT RESULTS ────────────────────────────────────────────
  console.log("\n╔══════════════════════════════════════╗");
  console.log("║         SEED COMPLETE                ║");
  console.log("╠══════════════════════════════════════╣");
  for (const [key, val] of Object.entries(results)) {
    console.log(`║ ${key.padEnd(22)} ${val.padEnd(14)}║`);
  }
  console.log("╚══════════════════════════════════════╝\n");

  // ── VERIFICATION COUNTS ──────────────────────────────────────
  const dbName = mongoose.connection.db?.databaseName ?? "unknown";
  console.log("Verification (database:", dbName + "):");
  console.log("  ScoringThresholds:", await ScoringThresholdModel.countDocuments());
  console.log("  ScoringRules:", await ScoringRuleModel.countDocuments());
  console.log("  FollowupRules:", await FollowupRuleModel.countDocuments());
  console.log("  PipelineStages:", await PipelineStageModel.countDocuments());
  console.log("  CustomFields:", await CustomFieldModel.countDocuments());
  console.log("  AllocationConfigs:", await AllocationConfigModel.countDocuments());
  console.log("  CallQualityDimensions:", await CallQualityDimensionModel.countDocuments());
  console.log("");

  await mongoose.disconnect();
}

seedEverything().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
