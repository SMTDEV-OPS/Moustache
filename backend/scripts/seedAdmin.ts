import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { RoleModel } from "../src/models/role";
import { UserModel } from "../src/models/user";
import { UserRoleModel } from "../src/models/userRole";
import { TeamType } from "../src/models/common";

async function seed() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB for seeding");

  const adminRoleName = "Admin";
  const adminEmail = "admin@postcardcrm.local";
  const adminPassword = "Admin@123";

  const permissions = [
    "users.manage",
    "accounts.manage",
    "properties.manage",
    "regions.manage",
    "workflows.manage",
    "availability.upload",
    "reports.view",
  ];

  let role = await RoleModel.findOne({ name: adminRoleName });
  if (!role) {
    role = await RoleModel.create({
      name: adminRoleName,
      description: "System administrator role with full management permissions",
      permissions,
      isSystemRole: true,
    });
    logger.info("Created Admin role");
  } else {
    const updatedPermissions = Array.from(new Set([...(role.permissions ?? []), ...permissions]));
    role.permissions = updatedPermissions;
    role.isSystemRole = role.isSystemRole ?? true;
    await role.save();
    logger.info("Admin role already exists, updated permissions/flags if needed");
  }

  let user = await UserModel.findOne({ email: adminEmail });
  if (!user) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    user = await UserModel.create({
      name: "System Admin",
      email: adminEmail,
      phone: "",
      teamType: TeamType.OPERATIONS,
      regions: [],
      roleId: role._id,
      status: "ACTIVE",
      passwordHash,
    });
    logger.info("Created admin user", { email: adminEmail });
  } else {
    logger.info("Admin user already exists", { email: adminEmail });
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


