import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";
import { UserModel } from "../src/models/user";
import { migratePropertyToGuide } from "../src/services/propertyGuideService";

export async function migrateKnowledgeToPropertyGuide() {
  const user = await UserModel.findOne({ status: "ACTIVE" }).select("_id").lean();
  if (!user?._id) throw new Error("No active user found");

  const properties = await PropertyModel.find({ status: "ACTIVE" }).select("_id name").lean();
  let count = 0;
  for (const p of properties) {
    await migratePropertyToGuide(p._id, user._id);
    count++;
    console.log(`Migrated guide for ${p.name}`);
  }
  console.log(`Done. Migrated ${count} properties.`);
}

if (require.main === module) {
  mongoose
    .connect(config.mongoUri)
    .then(async () => {
      await migrateKnowledgeToPropertyGuide();
      await mongoose.disconnect();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await mongoose.disconnect().catch(() => undefined);
      process.exit(1);
    });
}
