import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../config/env";
import { UserModel } from "../models/user";
import { ProfileModel } from "../models/profile";

async function resolveDefaultProfileId(): Promise<{ id: string; name: string } | null> {
  const standard = await ProfileModel.findOne({ name: "Standard User" })
    .select("_id name isSystemProfile")
    .lean();
  if (standard?._id) return { id: String(standard._id), name: String((standard as any).name) };

  const lowestNonSystem = await ProfileModel.findOne({ isSystemProfile: false })
    .sort({ name: 1 })
    .select("_id name isSystemProfile")
    .lean();
  if (lowestNonSystem?._id) return { id: String(lowestNonSystem._id), name: String((lowestNonSystem as any).name) };

  const executives = await ProfileModel.findOne({ name: "Executives" })
    .select("_id name isSystemProfile")
    .lean();
  if (executives?._id) return { id: String(executives._id), name: String((executives as any).name) };

  return null;
}

async function main() {
  await mongoose.connect(config.mongoUri);

  const defaultProfile = await resolveDefaultProfileId();
  if (!defaultProfile) {
    console.error("[BackfillProfiles] No suitable default profile found. Aborting.");
    process.exitCode = 1;
    return;
  }

  const users = await UserModel.find({
    $or: [{ profileId: { $exists: false } }, { profileId: null }],
  })
    .select("_id email name status profileId")
    .lean();

  let updated = 0;
  let skipped = 0;

  for (const u of users) {
    // Do not touch inactive users
    if ((u as any).status !== "ACTIVE") {
      skipped++;
      continue;
    }

    // Do not touch admin users (heuristic: known admin emails in this DB)
    const email = String((u as any).email || "").toLowerCase();
    if (email === "admin@moustachecrm.local" || email === "admin@newhotelcrm.local") {
      skipped++;
      continue;
    }

    await UserModel.updateOne(
      { _id: (u as any)._id, $or: [{ profileId: { $exists: false } }, { profileId: null }] },
      { $set: { profileId: defaultProfile.id } }
    );

    updated++;
    console.log(
      `[BackfillProfiles] Updated ${(u as any).email} (${String((u as any)._id)}) -> ${defaultProfile.name} (${defaultProfile.id})`
    );
  }

  console.log(`[BackfillProfiles] Updated ${updated} users, skipped ${skipped} users.`);
}

main()
  .catch((err) => {
    console.error("[BackfillProfiles] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
  });

