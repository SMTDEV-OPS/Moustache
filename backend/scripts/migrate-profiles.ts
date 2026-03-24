import mongoose from "mongoose";
import dotenv from "dotenv";
import { ProfileModel } from "../src/models/profile";
import { ModuleDefaultAccessModel } from "../src/models/moduleDefaultAccess";

dotenv.config();

const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Postcardcrm";

// Standard modules to seed
const MODULES = [
    "leads", "contacts", "accounts", "properties", "tasks", "tickets",
    "guesses", "reservations", "communications", "quotations", "payment-links",
    "workflows", "templates", "knowledge-base", "pms", "regions", "groups",
    "assignment-rules", "notifications", "email", "buddies", "availability",
    "conglomerates", "account-potentials", "hotel-brands"
];

async function migrate() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");

    console.log("--- Seeding Module Default Access ---");
    for (const mod of MODULES) {
        const existing = await ModuleDefaultAccessModel.findOne({ module: mod });
        if (!existing) {
            // Default leads/contacts/accounts to private as a safe default, others public_read_write or similar
            // In Zoho, Leads/Contacts/Accounts are typically Private by default for sharing rules to matter
            let defaultLevel = "public_read_write";
            if (["leads", "contacts", "accounts", "tickets", "quotations", "tasks"].includes(mod)) {
                defaultLevel = "private";
            }

            await ModuleDefaultAccessModel.create({
                module: mod,
                defaultAccess: defaultLevel
            });
            console.log(`Seeded default access for ${mod}: ${defaultLevel}`);
        }
    }

    console.log("\n--- Migrating Profiles to Grouped Schema ---");

    // Use `any` since we're reading a field that was removed from the TypeScript interfaces
    const profiles = await ProfileModel.find().lean() as any[];

    for (const p of profiles) {
        if (p.modulePermissions && p.modulePermissions.length > 0) {
            console.log(`Profile '${p.name}' already has modulePermissions, skipping...`);
            continue;
        }

        const legacyPermissions: string[] = p.permissions || [];
        console.log(`Migrating Profile '${p.name}' (has ${legacyPermissions.length} legacy permissions)...`);

        const modulePermsMap = new Map<string, any>();
        const setupPermsMap = new Map<string, any>();

        for (const mod of MODULES) {
            modulePermsMap.set(mod, { module: mod, view: false, create: false, edit: false, delete: false });
        }

        // Common setup keys
        const setupKeys = ["users.manage", "roles.manage", "profiles.manage", "groups.manage", "settings.manage"];
        for (const key of setupKeys) {
            setupPermsMap.set(key, { key, enabled: false });
        }

        // Process legacy flat permissions
        for (const perm of legacyPermissions) {
            if (setupKeys.includes(perm)) {
                setupPermsMap.set(perm, { key: perm, enabled: true });
                continue;
            }

            const [resource, action] = perm.split(".");

            if (modulePermsMap.has(resource)) {
                const current = modulePermsMap.get(resource);
                if (action === "read" || action === "view") current.view = true;
                if (action === "create") current.create = true;
                if (action === "write" || action === "update") current.edit = true;
                if (action === "delete") current.delete = true;
                if (action === "manage") {
                    current.view = true;
                    current.create = true;
                    current.edit = true;
                    current.delete = true;
                }
            } else if (action === "manage") {
                // It might be a setup perm
                setupPermsMap.set(perm, { key: perm, enabled: true });
            }
        }

        const newModulePermissions = Array.from(modulePermsMap.values());
        const newSetupPermissions = Array.from(setupPermsMap.values());

        await ProfileModel.updateOne(
            { _id: p._id },
            {
                $set: {
                    modulePermissions: newModulePermissions,
                    setupPermissions: newSetupPermissions
                },
                $unset: {
                    permissions: "" // Remove legacy field entirely
                }
            }
        );
        console.log(`  -> Successfully migrated profile '${p.name}'`);
    }

    console.log("\nMigration completed successfully.");
    await mongoose.disconnect();
}

migrate().catch(err => {
    console.error("Migration failed:", err);
    process.exit(1);
});
