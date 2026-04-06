/**
 * Applies spreadsheet-derived IFactSheetContent to Moustache Jaipur (code: JAIPUR).
 * Run from backend/: `npm run seed:jaipur-factsheet`
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { PropertyModel } from "../models/property";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../models/knowledgeBase";
import { UserModel } from "../models/user";
import { jaipurFactSheetContent } from "./data/jaipurFactSheetContent";

const JAIPUR_CODE = "JAIPUR";

async function resolveSystemUserId(): Promise<Types.ObjectId> {
  const envId = process.env.SEED_SYSTEM_USER_ID?.trim();
  if (envId && Types.ObjectId.isValid(envId)) {
    return new Types.ObjectId(envId);
  }
  const admin = await UserModel.findOne({ email: "admin@moustachecrm.local" })
    .select("_id")
    .lean();
  if (admin?._id) return admin._id as Types.ObjectId;
  const anyUser = await UserModel.findOne().sort({ createdAt: 1 }).select("_id").lean();
  if (anyUser?._id) return anyUser._id as Types.ObjectId;
  throw new Error(
    "No user found. Set SEED_SYSTEM_USER_ID or run seed:admin first."
  );
}

async function main() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected — applying Jaipur fact sheet content");

  const property = await PropertyModel.findOne({ code: JAIPUR_CODE }).lean();
  if (!property?._id) {
    logger.error(`Property with code "${JAIPUR_CODE}" not found. Run seed:properties or create the property first.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const systemUserId = await resolveSystemUserId();

  const result = await KnowledgeBaseModel.findOneAndUpdate(
    {
      propertyId: property._id,
      type: KnowledgeBaseType.FACTSHEET,
      isActive: true,
    },
    {
      $set: {
        content: jaipurFactSheetContent as Record<string, unknown>,
        updatedBy: systemUserId,
        title: "Moustache Jaipur — Fact Sheet",
      },
      $setOnInsert: {
        type: KnowledgeBaseType.FACTSHEET,
        propertyId: property._id,
        files: [],
        isActive: true,
        createdBy: systemUserId,
      },
    },
    { upsert: true, new: true }
  );

  if (!result) {
    logger.error("Failed to upsert KnowledgeBase FACTSHEET for Jaipur");
    await mongoose.disconnect();
    process.exit(1);
  }

  logger.info(`Jaipur fact sheet updated. KB id: ${result._id.toString()}`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  logger.error("applyJaipurFactSheet failed", {
    error: e instanceof Error ? e.message : e,
  });
  process.exit(1);
});
