import mongoose from "mongoose";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { PropertyModel } from "../models/property";
import { runSeedAdmin } from "./seedAdminService";
import { seedMoustacheProperties } from "../scripts/seedMoustacheProperties";
import { seedEzeeProperties } from "../scripts/seedEzeeProperties";

export interface ProductionSeedResult {
  admin: boolean;
  properties: { ok: number; fail: number };
  ezee: { upserted: number; created: number };
  activeProperties: number;
  ezeeConfigured: number;
}

let seedInProgress = false;

async function ensureMongoConnection(): Promise<boolean> {
  if (mongoose.connection.readyState === 1) {
    return false;
  }
  await mongoose.connect(config.mongoUri);
  logger.info("productionSeedService connected to MongoDB");
  return true;
}

export async function runProductionSeeds(): Promise<ProductionSeedResult> {
  if (seedInProgress) {
    throw new Error("Production seed is already running");
  }

  seedInProgress = true;
  const openedConnection = await ensureMongoConnection();

  try {
    await runSeedAdmin();
    const properties = await seedMoustacheProperties();
    const ezee = await seedEzeeProperties();

    const activeProperties = await PropertyModel.countDocuments({ status: "ACTIVE" });
    const ezeeConfigured = await PropertyModel.countDocuments({
      status: "ACTIVE",
      pmsProvider: "EZEE",
      "pmsConfig.hotelCode": { $exists: true, $ne: "" },
      "pmsConfig.authCode": { $exists: true, $ne: "" },
    });

    logger.info("runProductionSeeds complete", {
      activeProperties,
      ezeeConfigured,
    });

    return {
      admin: true,
      properties,
      ezee,
      activeProperties,
      ezeeConfigured,
    };
  } finally {
    seedInProgress = false;
    if (openedConnection) {
      await mongoose.disconnect();
    }
  }
}
