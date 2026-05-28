/**
 * Idempotent seed for a single test hotel used in lead flow demos.
 *
 * Usage: npx ts-node scripts/seedTestHotel.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { PropertyModel } from "../src/models/property";

const TEST_HOTEL = {
  name: "Postcard Goa",
  code: "POSTCARD_GOA",
  hotelCode: "TEST-GOA",
  city: "Goa",
};

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected for test hotel seed");

  const exactNameRegex = new RegExp(`^${escapeRegex(TEST_HOTEL.name)}$`, "i");
  const existing = await PropertyModel.findOne({ name: { $regex: exactNameRegex } })
    .select("_id name")
    .lean();

  if (existing) {
    await PropertyModel.updateOne(
      { _id: existing._id },
      {
        $set: {
          "location.city": TEST_HOTEL.city,
          status: "ACTIVE",
          "pmsConfig.hotelCode": TEST_HOTEL.hotelCode,
        },
      }
    );
    logger.info("Updated test hotel", { name: TEST_HOTEL.name, id: existing._id.toString() });
  } else {
    const created = await PropertyModel.create({
      name: TEST_HOTEL.name,
      code: TEST_HOTEL.code,
      location: { city: TEST_HOTEL.city },
      status: "ACTIVE",
      pmsConfig: { hotelCode: TEST_HOTEL.hotelCode },
    });
    logger.info("Created test hotel", { name: TEST_HOTEL.name, id: created._id.toString() });
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error("seedTestHotel failed", {}, err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
