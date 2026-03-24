import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";
import { KnowledgeBaseModel } from "../src/models/knowledgeBase";

const TARGET_CODES = [
  "POSTCARD_JAIPUR_HERITAGE",
  "POSTCARD_UDAIPUR_LAKEVIEW",
  "POSTCARD_GOA_RIVERSIDE",
];

async function removeLegacyDummyProperties() {
  await mongoose.connect(config.mongoUri);

  const properties = await PropertyModel.find({
    code: { $in: TARGET_CODES },
  })
    .select("_id code")
    .lean();

  const propertyIds = properties.map((p) => p._id);
  const kbResult =
    propertyIds.length > 0
      ? await KnowledgeBaseModel.deleteMany({ propertyId: { $in: propertyIds } })
      : { deletedCount: 0 };

  const propResult = await PropertyModel.deleteMany({
    code: { $in: TARGET_CODES },
  });

  console.log("Removed properties:", propResult.deletedCount ?? 0);
  console.log("Removed knowledge base items:", kbResult.deletedCount ?? 0);
  console.log(
    "Deleted property codes:",
    properties.length > 0 ? properties.map((p) => p.code).join(", ") : "none"
  );
}

removeLegacyDummyProperties()
  .then(async () => {
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Failed to remove legacy dummy properties:", error);
    await mongoose.disconnect().catch(() => undefined);
    process.exit(1);
  });
