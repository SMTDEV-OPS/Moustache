/**
 * Bootstrap a fresh Postcard CRM database (collections + admin + engine config).
 * MongoDB creates the database automatically when the first document is written;
 * you only need to point MONGO_URI at the desired database name (e.g. .../postcard_crm).
 *
 * Usage (from backend/): npm run seed:complete
 */
import "dotenv/config";
import { execSync } from "child_process";
import path from "path";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { AccountModel } from "../src/models/account";
import { seedDashboardWidgets } from "./seedDashboardWidgets";
import { seedSystemFilters } from "./seedSystemFilters";
import { seedPostcardWorkflows } from "./seedPostcardWorkflows";

const backendRoot = path.resolve(__dirname, "..");

function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

async function main() {
  console.log("\n=== Postcard DB bootstrap (npm run seed:complete) ===\n");
  console.log("Target:", redactMongoUri(config.mongoUri), "\n");

  execSync("npm run seed:admin", { cwd: backendRoot, stdio: "inherit", env: process.env });
  execSync("npm run seed:everything", { cwd: backendRoot, stdio: "inherit", env: process.env });
  execSync("npm run seed:kb:fixtures", { cwd: backendRoot, stdio: "inherit", env: process.env });

  await mongoose.connect(config.mongoUri);
  try {
    await seedDashboardWidgets();

    const account = await AccountModel.findOne().sort({ createdAt: 1 });
    if (!account) {
      throw new Error("No account found after seed:everything. Cannot seed org-scoped filters/workflows.");
    }
    const orgId = account._id.toString();
    logger.info("Using org for system filters and workflows", { orgId });

    await seedSystemFilters(orgId);
    await seedPostcardWorkflows(orgId);

    console.log("\n=== Seed complete ===");
    console.log("Login: admin@postcardcrm.local  /  Admin@123\n");
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
