
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { UserModel } from "../src/models/user";
import { RoleModel } from "../src/models/role";

const TEST_EMAIL = "test@test.com";

async function fixPermissions() {
    try {
        await mongoose.connect(config.mongoUri);
        logger.info("Connected to MongoDB");

        const user = await UserModel.findOne({ email: TEST_EMAIL });
        if (!user) {
            logger.error(`User ${TEST_EMAIL} not found!`);
            process.exit(1);
        }

        logger.info(`Found user: ${user.email} (${user.id})`);

        if (!user.roleId) {
            logger.error("User has no role assigned!");
            process.exit(1);
        }

        const role = await RoleModel.findById(user.roleId);
        if (!role) {
            logger.error(`Role ${user.roleId} not found!`);
            process.exit(1);
        }

        logger.info(`Found role: ${role.name} (${role.id})`);
        logger.info(`Current permissions: ${JSON.stringify(role.permissions)}`);
        logger.info(`Current memberPermissions: ${JSON.stringify(role.memberPermissions)}`);

        // Permissions to add
        const requiredPermissions = [
            "leads.view.own",
            "leads.create",
            "leads.update",
            "leads.view.team", // Optional, but helpful for testing
            "users.manage" // To fix the other 403 if they still have it? No, I relaxed that middleware.
        ];

        let updated = false;

        // Update main permissions array
        const currentPerms = role.permissions || [];
        for (const perm of requiredPermissions) {
            if (!currentPerms.includes(perm)) {
                currentPerms.push(perm);
                updated = true;
            }
        }
        role.permissions = currentPerms;

        // Also update memberPermissions for legacy/consistency if used
        const currentMemberPerms = role.memberPermissions || [];
        for (const perm of requiredPermissions) {
            if (!currentMemberPerms.includes(perm)) {
                currentMemberPerms.push(perm);
                updated = true;
            }
        }
        role.memberPermissions = currentMemberPerms;

        if (updated) {
            await role.save();
            logger.info(`Updated role ${role.name} with new permissions.`);
            logger.info(`New permissions: ${JSON.stringify(role.permissions)}`);
        } else {
            logger.info("Role already has required permissions.");
        }

    } catch (err) {
        logger.error("Error fixing permissions:", { err });
    } finally {
        await mongoose.disconnect();
    }
}

fixPermissions();
