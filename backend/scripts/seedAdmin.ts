import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { runSeedAdmin } from "../src/services/seedAdminService";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for seeding");
  await runSeedAdmin();
  logger.info("Seeding complete. You can log in with:", {
    email: "admin@moustachecrm.local",
    password: "Admin@123",
  });
  await mongoose.disconnect();
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Error seeding admin:", err);
    process.exit(1);
  });
