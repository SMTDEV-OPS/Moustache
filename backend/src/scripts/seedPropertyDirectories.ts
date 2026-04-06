/**
 * Idempotent: upsert PROPERTY_DIRECTORY KnowledgeBase rows for ACTIVE properties.
 *
 * By default, only properties **without** an existing PROPERTY_DIRECTORY document are seeded.
 * If every active property already has one, the script exits successfully without writes.
 *
 * Run: npm run seed:property-directories
 *
 * Options:
 *   --force          Re-seed every active property from the template (overwrites content).
 *   --dry-run        Report what would be seeded; no database writes.
 *
 * Env: SEED_PROPERTY_DIRECTORIES_FORCE=1  (same as --force)
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { config } from "../config/env";
import { logger } from "../config/logger";
import { PropertyModel } from "../models/property";
import { KnowledgeBaseModel, KnowledgeBaseType } from "../models/knowledgeBase";
import { UserModel } from "../models/user";
import { buildPropertyDirectoryContent } from "./data/propertyDirectorySeed";

/** Stable log label when `code` is missing (legacy / bad rows). */
function propertyLabel(p: {
  _id: unknown;
  code?: string;
  name?: string;
}): string {
  const c = p.code != null ? String(p.code).trim() : "";
  if (c) return c;
  const n = p.name != null ? String(p.name).trim() : "";
  if (n) return `(no code) ${n}`;
  return `(no code) id=${String(p._id)}`;
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const force =
    argv.includes("--force") ||
    process.env.SEED_PROPERTY_DIRECTORIES_FORCE === "1";
  const dryRun = argv.includes("--dry-run");
  return { force, dryRun };
}

async function resolveSystemUserId(): Promise<Types.ObjectId> {
  const envId = process.env.SEED_SYSTEM_USER_ID?.trim();
  if (envId && Types.ObjectId.isValid(envId)) {
    return new Types.ObjectId(envId);
  }

  const admin = await UserModel.findOne({
    email: "admin@moustachecrm.local",
  })
    .select("_id")
    .lean();

  if (admin?._id) {
    return admin._id as Types.ObjectId;
  }

  const anyUser = await UserModel.findOne().sort({ createdAt: 1 }).select("_id").lean();
  if (anyUser?._id) {
    logger.warn(
      "SEED_SYSTEM_USER_ID not set; using first user for KB updatedBy/createdBy"
    );
    return anyUser._id as Types.ObjectId;
  }

  throw new Error(
    "No user found. Run seed:admin first or set SEED_SYSTEM_USER_ID."
  );
}

async function main() {
  const { force, dryRun } = parseArgs();

  await mongoose.connect(config.mongoUri);
  logger.info("Connected for seedPropertyDirectories", { force, dryRun });

  const properties = await PropertyModel.find({ status: "ACTIVE" }).lean();

  const existingPropertyIds = await KnowledgeBaseModel.distinct("propertyId", {
    type: KnowledgeBaseType.PROPERTY_DIRECTORY,
  });
  const existingSet = new Set(
    existingPropertyIds.map((id) => String(id))
  );

  const toSeed = properties.filter(
    (p) => force || !existingSet.has(String(p._id))
  );
  const alreadyHave = properties.length - toSeed.length;

  if (toSeed.length === 0) {
    logger.info(
      `Seeding not required: all ${properties.length} active propert${properties.length === 1 ? "y" : "ies"} already have a PROPERTY_DIRECTORY row. Use --force to refresh content from the template.`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  if (force) {
    logger.info(
      `Force mode: updating directory for all ${toSeed.length} active propert${toSeed.length === 1 ? "y" : "ies"} (overwrites PROPERTY_DIRECTORY content).`
    );
  } else {
    logger.info(
      `${toSeed.length} propert${toSeed.length === 1 ? "y" : "ies"} to seed; ${alreadyHave} already had directory rows (skipped).`
    );
  }

  const missingCode = toSeed.filter(
    (p) => !p.code || !String(p.code).trim()
  );
  if (missingCode.length > 0) {
    logger.warn(
      `${missingCode.length} active propert${missingCode.length === 1 ? "y" : "ies"} missing \`code\` in DB — fix in Property admin; using id/name in logs only.`,
      { ids: missingCode.map((p) => String(p._id)) }
    );
  }

  if (dryRun) {
    logger.info(
      `[dry-run] Would ${force ? "update" : "create"} directory for: ${toSeed.map(propertyLabel).join(", ")}`
    );
    await mongoose.disconnect();
    process.exit(0);
  }

  const systemUserId = await resolveSystemUserId();

  let ok = 0;
  let fail = 0;

  for (const p of toSeed) {
    try {
      const content = buildPropertyDirectoryContent(p);
      await KnowledgeBaseModel.findOneAndUpdate(
        {
          propertyId: p._id,
          type: KnowledgeBaseType.PROPERTY_DIRECTORY,
        },
        {
          $set: {
            type: KnowledgeBaseType.PROPERTY_DIRECTORY,
            propertyId: p._id,
            title: `${p.name} — Hotel Directory`,
            description: "Structured directory card for CRM",
            content,
            isActive: true,
            updatedBy: systemUserId,
          },
          $setOnInsert: {
            files: [],
            createdBy: systemUserId,
          },
        },
        { upsert: true, new: true }
      );
      logger.info(`OK directory: ${propertyLabel(p)}`);
      ok += 1;
    } catch (e) {
      fail += 1;
      logger.error(`FAIL directory: ${propertyLabel(p)}`, {
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  logger.info(`seedPropertyDirectories finished: ${ok} ok, ${fail} failed`);
  await mongoose.disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  logger.error("seedPropertyDirectories fatal", { error: String(e) });
  process.exit(1);
});
