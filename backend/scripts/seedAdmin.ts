import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { RoleModel } from "../src/models/role";
import { ProfileModel } from "../src/models/profile";
import { UserModel } from "../src/models/user";
import { TeamType } from "../src/models/common";
import { ALL_PERMISSIONS } from "../src/constants/permissions";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for seeding");

  const adminProfileName = "Admin";
  const adminRoleName = "Admin Role";
  const adminEmail = "admin@moustachecrm.local";
  const adminPassword = "Admin@123";

  // 1. Seed the Admin Profile (Feature Permissions)
  let profile = await ProfileModel.findOne({ name: adminProfileName });
  if (!profile) {
    profile = await ProfileModel.create({
      name: adminProfileName,
      description: "System administrator profile with full permissions",
      permissions: ALL_PERMISSIONS,
      isSystemProfile: true,
    });
    logger.info("Created Admin Profile");
  } else {
    profile.permissions = ALL_PERMISSIONS;
    profile.isSystemProfile = true;
    await profile.save();
    logger.info("Admin Profile already exists, updated permissions to ALL_PERMISSIONS");
  }

  // 2. Seed the Admin Role (Hierarchy / Data Access at the very top)
  let role = await RoleModel.findOne({ name: adminRoleName });
  if (!role) {
    role = await RoleModel.create({
      name: adminRoleName,
      description: "Root role in the hierarchy",
      isSystemRole: true,
      parentRoleId: undefined, // Top of the hierarchy
    });
    logger.info("Created Admin Role");
  } else {
    role.isSystemRole = true;
    role.parentRoleId = undefined; // Ensure it stays at the top
    await role.save();
    logger.info("Admin Role already exists, updated configuration");
  }

  // 3. Seed the Admin User
  let user = await UserModel.findOne({ email: adminEmail });
  if (!user) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    user = await UserModel.create({
      name: "System Admin",
      email: adminEmail,
      phone: "",
      teamType: TeamType.OPERATIONS,
      regions: [],
      profileId: profile._id,
      roleId: role._id,
      status: "ACTIVE",
      passwordHash,
    });
    logger.info("Created admin user", { email: adminEmail });
  } else {
    logger.info("Admin user already exists", { email: adminEmail });
    let updated = false;

    // Ensure profile and role are correctly attached
    if (!user.profileId || user.profileId.toString() !== profile._id.toString()) {
      user.profileId = profile._id;
      updated = true;
    }
    if (!user.roleId || user.roleId.toString() !== role._id.toString()) {
      user.roleId = role._id;
      updated = true;
    }

    if (updated) {
      await user.save();
      logger.info("Updated admin user with new Profile and Role configurations");
    }
  }

  // Clean up legacy UserRoleModel if necessary (not required but good for sanity)
  // We dropped this pattern in Phase 1, but we can safely ignore it.

  logger.info("Seeding complete. You can log in with:", {
    email: adminEmail,
    password: adminPassword,
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
