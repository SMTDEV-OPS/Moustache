/**
 * Drops the entire MongoDB database named in MONGO_URI (all collections).
 * Use before re-seeding, or before cloning from another URI.
 *
 * Safety: set CONFIRM_RESET_DB=YES or the script exits.
 *
 *   CONFIRM_RESET_DB=YES npm run db:reset
 *
 * Then (optional): npm run seed:complete
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";

async function main() {
  if (process.env.CONFIRM_RESET_DB !== "YES") {
    console.error(
      "Refusing to drop database. Set CONFIRM_RESET_DB=YES to confirm (this deletes all data in the DB from MONGO_URI)."
    );
    if (process.env.ONFIRM_RESET_DB !== undefined) {
      console.error('(Typo: use CONFIRM_RESET_DB=YES — the leading "C" is required.)');
    }
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error("No database connection");
  }
  const name = db.databaseName;
  console.log("Dropping database:", name);
  await db.dropDatabase();
  await mongoose.disconnect();
  console.log("Done. Run: npm run seed:complete  (if you want a fresh seeded DB instead of a clone)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
