/**
 * Seed system filters for Postcard CRM.
 * Idempotent: uses orgId + name to avoid duplicates.
 *
 * Usage: npx ts-node scripts/seedSystemFilters.ts <orgId>
 */
import "dotenv/config";
declare var process: any;
declare var require: any;
declare var module: any;
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { SavedFilterModel } from "../src/models/savedFilter";
import { PipelineModel } from "../src/models/pipeline";
import { PipelineStageModel } from "../src/models/pipelineStage";
import { LeadSource, LeadStatus } from "../src/models/common";
import { Types } from "mongoose";

export async function seedSystemFilters(orgId: string) {
  const oid = new Types.ObjectId(orgId);
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).lean();

  const terminalStages =
    pipeline
      ? await PipelineStageModel.find({
          pipelineId: pipeline._id,
          isTerminal: true,
        })
          .select("_id")
          .lean()
      : [];
  const terminalStageIds = terminalStages.map((s) => s._id.toString());

  const systemFilters = [
    {
      name: "Hot Leads",
      filter_json: {
        conditions: [
          { field: "bucket", operator: "eq", value: "HOT" },
          {
            field: "stage_id",
            operator: "not_in",
            value: terminalStageIds,
          },
        ],
        logic: "AND",
      },
    },
    {
      name: "Pending Follow-ups",
      filter_json: {
        conditions: [{ field: "has_overdue_followup", operator: "eq", value: true }],
        logic: "AND",
      },
    },
    {
      name: "Not Contacted",
      filter_json: {
        conditions: [
          { field: "first_contact_done", operator: "eq", value: false },
        ],
        logic: "AND",
      },
    },
    {
      name: "Unassigned / Overflow",
      filter_json: {
        conditions: [
          {
            field: "status",
            operator: "eq",
            value: LeadStatus.UNASSIGNED_OVERFLOW,
          },
        ],
        logic: "AND",
      },
    },
    {
      name: "Booked - This Month",
      filter_json: {
        conditions: [
          { field: "terminal_type", operator: "eq", value: "won" },
          {
            field: "closed_at",
            operator: "gte",
            value: "__start_of_month",
          },
        ],
        logic: "AND",
      },
    },
    {
      name: "Lost Leads",
      filter_json: {
        conditions: [
          { field: "terminal_type", operator: "eq", value: "lost" },
        ],
        logic: "AND",
      },
    },
    {
      name: "By Source: IVR",
      filter_json: {
        conditions: [{ field: "source", operator: "eq", value: LeadSource.IVR_LIVE }],
        logic: "AND",
      },
    },
    {
      name: "By Source: WhatsApp",
      filter_json: {
        conditions: [
          { field: "source", operator: "eq", value: LeadSource.WHATSAPP },
        ],
        logic: "AND",
      },
    },
    {
      name: "Deal Size 50k+",
      filter_json: {
        conditions: [{ field: "budget", operator: "gte", value: 50000 }],
        logic: "AND",
      },
    },
  ];

  for (const sf of systemFilters) {
    const existing = await SavedFilterModel.findOne({
      orgId: oid,
      name: sf.name,
      is_system: true,
    });

    if (existing) {
      logger.info(`System filter "${sf.name}" already exists for org ${orgId}, skipping`);
      continue;
    }

    await SavedFilterModel.create({
      orgId: oid,
      name: sf.name,
      entity_type: "lead",
      filter_json: sf.filter_json,
      is_system: true,
      created_by: null,
      is_shared: true,
    });

    logger.info(`Created system filter "${sf.name}" for org ${orgId}`);
  }
}

async function main() {
  const orgId = process.argv[2];
  if (!orgId) {
    console.error("Usage: npx ts-node scripts/seedSystemFilters.ts <orgId>");
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  await seedSystemFilters(orgId);
  await mongoose.disconnect();
  logger.info("Seed complete");
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
