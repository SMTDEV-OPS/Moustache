import bcrypt from "bcrypt";
import { logger } from "../config/logger";
import { RoleModel } from "../models/role";
import { ProfileModel } from "../models/profile";
import { UserModel } from "../models/user";
import { MODULES } from "../constants/permissions";

export async function runSeedAdmin(): Promise<void> {
  const adminProfileName = "Admin";
  const adminRoleName = "Admin Role";
  const adminEmail = "admin@moustachecrm.local";
  const adminPassword = "Admin@123";

  const modulePermissions = Object.values(MODULES).map((mod) => ({
    module: mod,
    view: true,
    create: true,
    edit: true,
    delete: true,
  }));

  const setupKeys = [
    "users.manage",
    "roles.manage",
    "profiles.manage",
    "groups.manage",
    "settings.manage",
  ];
  const setupPermissions = setupKeys.map((key) => ({
    key,
    enabled: true,
  }));

  let profile = await ProfileModel.findOne({ name: adminProfileName });
  if (!profile) {
    profile = await ProfileModel.create({
      name: adminProfileName,
      description: "System administrator profile with full permissions",
      modulePermissions,
      setupPermissions,
      isSystemProfile: true,
    });
    logger.info("Created Admin Profile");
  } else {
    profile.modulePermissions = modulePermissions;
    profile.setupPermissions = setupPermissions;
    profile.isSystemProfile = true;
    await profile.save();
    logger.info("Admin Profile already exists, updated permissions");
  }

  let role = await RoleModel.findOne({ name: adminRoleName });
  if (!role) {
    role = await RoleModel.create({
      name: adminRoleName,
      description: "Root role in the hierarchy",
      isSystemRole: true,
      parentRoleId: undefined,
    });
    logger.info("Created Admin Role");
  } else {
    role.isSystemRole = true;
    role.parentRoleId = undefined;
    await role.save();
    logger.info("Admin Role already exists, updated configuration");
  }

  let user = await UserModel.findOne({ email: adminEmail });
  if (!user) {
    const passwordHash = await bcrypt.hash(adminPassword, 10);
    user = await UserModel.create({
      name: "System Admin",
      email: adminEmail,
      phone: "",
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
      logger.info("Updated admin user with profile and role");
    }
  }
}
