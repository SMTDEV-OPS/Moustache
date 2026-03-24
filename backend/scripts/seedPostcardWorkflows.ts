/**
 * Seed Postcard workflows for event-driven automation.
 * Idempotent: uses name+orgId uniqueness to avoid duplicates.
 *
 * Usage: npx ts-node scripts/seedPostcardWorkflows.ts [orgId]
 */
import "dotenv/config";
declare var process: any;
declare var require: any;
declare var module: any;
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { WorkflowV2Model } from "../src/models/workflowV2";
import { WorkflowConditionModel } from "../src/models/workflowV2";
import { WorkflowActionModel } from "../src/models/workflowV2";
import { TemplateModel } from "../src/models/template";
import { PipelineModel } from "../src/models/pipeline";
import { PipelineStageModel } from "../src/models/pipelineStage";
import { Types } from "mongoose";
import { LeadSource } from "../src/models/common";

async function findTemplateByName(namePattern: string | RegExp) {
  const pattern = typeof namePattern === "string"
    ? new RegExp(namePattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i")
    : namePattern;
  return TemplateModel.findOne({ name: pattern, medium: "WHATSAPP", isActive: true }).lean();
}

export async function seedPostcardWorkflows(orgId: string) {
  const oid = new Types.ObjectId(orgId);
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).lean();
  if (!pipeline) {
    logger.warn("No default leads pipeline found, skipping stage lookups");
  }

  const firstConnectStage = pipeline
    ? await PipelineStageModel.findOne({ pipelineId: pipeline._id, name: /1st Connect|First Connect/i }).lean()
    : null;
  const paymentRequestStage = pipeline
    ? await PipelineStageModel.findOne({ pipelineId: pipeline._id, name: /Payment Request/i }).lean()
    : null;

  const reqGatheringTemplate = await findTemplateByName(/req.*gathering|requirement.*gathering/i);
  const fuTemplateHot = await findTemplateByName(/fu.*hot|follow.?up.*hot/i);
  const fuTemplateWarm = await findTemplateByName(/fu.*warm|follow.?up.*warm/i);
  const fuTemplateCold = await findTemplateByName(/fu.*cold|follow.?up.*cold/i);
  const fuTemplate = fuTemplateHot || fuTemplateWarm || fuTemplateCold || await findTemplateByName(/fu|follow.?up/i);

  const tz = "Asia/Kolkata";

  const workflows: Array<{
    name: string;
    description?: string;
    trigger_event: string;
    trigger_params_json?: Record<string, any>;
    conditions: Array<{ field_slug: string; operator: string; value: string; logical_group: number }>;
    actions: Array<{ action_type: string; params_json: Record<string, any>; delay_minutes: number; order: number }>;
  }> = [
    {
      name: "Auto WA if lead unattended 30 min",
      description: "Send WhatsApp when lead is unattended for 30 minutes",
      trigger_event: "lead_unattended",
      trigger_params_json: { minutes: 30 },
      conditions: [
        { field_slug: "bucket", operator: "neq", value: "COLD", logical_group: 1 },
        { field_slug: "first_contact_done", operator: "eq", value: "false", logical_group: 1 },
      ],
      actions: reqGatheringTemplate
        ? [{ action_type: "send_whatsapp", params_json: { template_id: reqGatheringTemplate._id.toString(), recipient_field: "lead_mobile" }, delay_minutes: 0, order: 0 }]
        : [],
    },
    {
      name: "Auto WA follow-up if FU missed 3h",
      description: "Send WhatsApp follow-up when follow-up task is missed, only during business hours",
      trigger_event: "followup_missed",
      conditions: [
        { field_slug: "time_of_day", operator: "gte", value: "9", logical_group: 1 },
        { field_slug: "time_of_day", operator: "lte", value: "22", logical_group: 1 },
      ],
      actions: fuTemplate
        ? [{ action_type: "send_whatsapp", params_json: { template_id: fuTemplate._id.toString(), recipient_field: "lead_mobile" }, delay_minutes: 0, order: 0 }]
        : [],
    },
    {
      name: "Notify TL after 2 missed follow-ups",
      description: "Notify team lead when lead has 2+ missed follow-ups",
      trigger_event: "followup_missed_count",
      trigger_params_json: { count: 2 },
      conditions: [],
      actions: [{ action_type: "notify_user", params_json: { recipient: "tl", message: "Lead has 2 missed follow-ups", channel: "in_app" }, delay_minutes: 0, order: 0 }],
    },
    {
      name: "Notify TL+Manager if unattended 12h after 2 missed FUs",
      description: "Escalate when lead is unattended 12h and has 2+ missed follow-ups",
      trigger_event: "lead_unattended",
      trigger_params_json: { minutes: 720 },
      conditions: [{ field_slug: "missed_followup_count", operator: "gte", value: "2", logical_group: 1 }],
      actions: [
        { action_type: "notify_user", params_json: { recipient: "tl", message: "Lead unattended 12h with 2+ missed follow-ups", channel: "in_app" }, delay_minutes: 0, order: 0 },
        { action_type: "notify_user", params_json: { recipient: "manager", message: "Lead unattended 12h with 2+ missed follow-ups", channel: "in_app" }, delay_minutes: 0, order: 1 },
      ],
    },
    {
      name: "Auto-move to 1st Connect on mandate fill (live call)",
      description: "Move to 1st Connect when mandate fields filled and source is IVR live",
      trigger_event: "lead_field_changed",
      conditions: [
        { field_slug: "lead_name", operator: "is_not_empty", value: "", logical_group: 1 },
        { field_slug: "lead_mobile", operator: "is_not_empty", value: "", logical_group: 1 },
        { field_slug: "property_name", operator: "is_not_empty", value: "", logical_group: 1 },
        { field_slug: "budget", operator: "is_not_empty", value: "", logical_group: 1 },
        { field_slug: "source", operator: "eq", value: LeadSource.IVR_LIVE, logical_group: 1 },
      ],
      actions: firstConnectStage
        ? [{ action_type: "move_stage", params_json: { target_stage_id: firstConnectStage._id.toString() }, delay_minutes: 0, order: 0 }]
        : [],
    },
    {
      name: "Excess workload: WA req-gathering then re-assign HOT",
      description: "Send req-gathering WhatsApp then reassign after 30 min",
      trigger_event: "lead_overflow_queued",
      conditions: [],
      actions: reqGatheringTemplate
        ? [
            { action_type: "send_whatsapp", params_json: { template_id: reqGatheringTemplate._id.toString(), recipient_field: "lead_mobile" }, delay_minutes: 0, order: 0 },
            { action_type: "assign_lead", params_json: { strategy: "min_open_leads" }, delay_minutes: 30, order: 1 },
          ]
        : [],
    },
    {
      name: "Hourly reminder if in Payment Request stage not closed",
      description: "Remind agent if lead in Payment Request and not updated in 1h",
      trigger_event: "scheduled",
      trigger_params_json: { cron: "0 * * * *", timezone: tz },
      conditions: [
        { field_slug: "stage_id", operator: "eq", value: paymentRequestStage?._id?.toString() || "", logical_group: 1 },
      ],
      actions: [{ action_type: "notify_user", params_json: { recipient: "assigned_agent", message: "Lead still in Payment Request — please update status", channel: "in_app" }, delay_minutes: 0, order: 0 }],
    },
  ];

  for (const w of workflows) {
    if (w.actions.length === 0 && (w.name.includes("WA") || w.name.includes("move_stage"))) {
      logger.warn(`Skipping workflow "${w.name}" - required template/stage not found`);
      continue;
    }

    const existing = await WorkflowV2Model.findOne({ name: w.name });
    if (existing) {
      logger.info(`Workflow "${w.name}" already exists for org ${orgId}, skipping`);
      continue;
    }

    const wf = await WorkflowV2Model.create({
      orgId: oid,
      name: w.name,
      description: w.description,
      trigger_event: w.trigger_event,
      trigger_params_json: w.trigger_params_json,
      is_active: true,
      run_once_per_lead: false,
    });

    for (const c of w.conditions) {
      if (c.field_slug === "stage_id" && !c.value) continue;
      await WorkflowConditionModel.create({
        workflowId: wf._id,
        orgId: oid,
        field_slug: c.field_slug,
        operator: c.operator as any,
        value: c.value,
        logical_group: c.logical_group,
      });
    }

    for (let i = 0; i < w.actions.length; i++) {
      const a = w.actions[i];
      await WorkflowActionModel.create({
        workflowId: wf._id,
        orgId: oid,
        action_type: a.action_type as any,
        params_json: a.params_json,
        delay_minutes: a.delay_minutes,
        order: a.order,
      });
    }

    logger.info(`Created workflow "${w.name}" for org ${orgId}`);
  }
}

async function main() {
  const orgId = process.argv[2] || "69ae144fae23030b62f901f5";

  await mongoose.connect(config.mongoUri);
  await seedPostcardWorkflows(orgId);
  await mongoose.disconnect();
  logger.info("Seed complete");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
