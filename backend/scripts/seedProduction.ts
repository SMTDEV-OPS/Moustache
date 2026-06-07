/**
 * Run all production-critical seeds against MONGO_URI (local or Render Atlas).
 *
 * Usage:
 *   cd backend
 *   MONGO_URI="mongodb+srv://..." npm run seed:production
 *
 * On Render Shell (uses dashboard MONGO_URI automatically):
 *   cd backend && npm run seed:production
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { runProductionSeeds } from "../src/services/productionSeedService";

async function main() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for seed:production");
  const result = await runProductionSeeds();
  logger.info("seed:production finished", result);
  await mongoose.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error("seed:production failed", { error: err instanceof Error ? err.message : err });
    process.exit(1);
  });
