/**
 * Seed script for NEW HOTEL CRM - use this for a fresh, separate database.
 * Does NOT seed any Postcard-specific data.
 *
 * Usage:
 *   1. Set MONGO_URI to your new hotel's database (e.g. mongodb://localhost:27017/newhotelcrm)
 *   2. Run: npx ts-node scripts/seedNewHotel.ts
 *
 * This creates admin role + admin user. Add your properties via Property Management in the CRM.
 */
import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { RoleModel } from "../src/models/role";
import { UserModel } from "../src/models/user";
import { UserRoleModel } from "../src/models/userRole";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@newhotelcrm.local";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@123";
const ADMIN_NAME = process.env.ADMIN_NAME || "System Admin";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for new hotel seeding", {
    db: config.mongoUri.replace(/\/\/[^/]+\//, "//***/"), // hide credentials in logs
  });

  const adminRoleName = "Admin";

  let role = await RoleModel.findOne({ name: adminRoleName });
  if (!role) {
    role = await RoleModel.create({
      name: adminRoleName,
      description: "System administrator role with full management permissions",
      isSystemRole: true,
    });
    logger.info("Created Admin role");
  } else {
    role.isSystemRole = role.isSystemRole ?? true;
    await role.save();
    logger.info("Admin role already exists, updated configuration if needed");
  }

  let user = await UserModel.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    user = await UserModel.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      phone: "",
      regions: [],
      roleId: role._id,
      status: "ACTIVE",
      passwordHash,
    });
    logger.info("Created admin user", { email: ADMIN_EMAIL });
  } else {
    logger.info("Admin user already exists", { email: ADMIN_EMAIL });
    if (!user.roleId) {
      user.roleId = role._id;
      await user.save();
      logger.info("Updated admin user with admin roleId");
    }
  }

  await UserRoleModel.updateOne(
    { userId: user._id, roleId: role._id },
    {
      $setOnInsert: {
        userId: user._id,
        roleId: role._id,
        assignedBy: user._id,
        assignedAt: new Date(),
      },
    },
    { upsert: true }
  );

  logger.info("New hotel seeding complete. Log in with:", {
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  logger.info("Add your properties via Property Management in the CRM.");

  await mongoose.disconnect();
}

seed()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error("Error seeding new hotel:", err);
    process.exit(1);
  });
