import mongoose from "mongoose";
import dotenv from "dotenv";
import { AccessControlService } from "../src/services/auth/AccessControlService";
import { UserModel as User } from "../src/models/user";
import { RoleModel as Role } from "../src/models/role";
import { ProfileModel as Profile } from "../src/models/profile";

dotenv.config();

async function runTests() {
    console.log("Starting DB Connection...");
    await mongoose.connect(process.env.MONGO_URI || "mongodb://localhost:27017/postcard_crm");
    console.log("Connected to DB.");

    try {
        // 1. Setup Test Data
        console.log("\n--- Creating Test Profiles ---");
        const adminProfile = await Profile.create({
            name: "Test Admin Profile",
            description: "Full access",
            permissions: ["users.manage", "leads.manage", "tickets.manage"]
        });

        const managerProfile = await Profile.create({
            name: "Test Manager Profile",
            description: "Manage leads",
            permissions: ["leads.manage", "reports.read" as any] // Ignoring missing reports.view in ALL_PERMISSIONS if any
        });

        const repProfile = await Profile.create({
            name: "Test Rep Profile",
            description: "Read own leads",
            permissions: ["leads.view.own", "leads.create"]
        });

        console.log("\n--- Creating Test Roles (Hierarchy) ---");
        const ceoRole = await Role.create({
            name: "Test CEO",
            description: "Top level",
            parentRoleId: null
        });

        const managerRole = await Role.create({
            name: "Test Sales Manager",
            description: "Mid level",
            parentRoleId: ceoRole._id
        });

        const repRole = await Role.create({
            name: "Test Sales Rep",
            description: "Low level",
            parentRoleId: managerRole._id
        });

        console.log("\n--- Creating Test Users ---");
        const adminUser = await User.create({
            name: "Test Admin",
            email: "test.admin@example.com",
            passwordHash: "hash",
            profileId: adminProfile._id,
            roleId: ceoRole._id,
            teamType: "SALES",
            isAdmin: true,
            authProvider: "local"
        });

        const managerUser = await User.create({
            name: "Test Manager",
            email: "test.manager@example.com",
            passwordHash: "hash",
            profileId: managerProfile._id,
            roleId: managerRole._id,
            reportsTo: adminUser._id,
            teamType: "SALES",
            authProvider: "local"
        });

        const repUser1 = await User.create({
            name: "Test Rep 1",
            email: "test.rep1@example.com",
            passwordHash: "hash",
            profileId: repProfile._id,
            roleId: repRole._id,
            reportsTo: managerUser._id,
            teamType: "SALES",
            authProvider: "local"
        });

        const repUser2 = await User.create({
            name: "Test Rep 2",
            email: "test.rep2@example.com",
            passwordHash: "hash",
            profileId: repProfile._id,
            roleId: repRole._id,
            reportsTo: managerUser._id,
            teamType: "SALES",
            authProvider: "local"
        });

        // 2. Test getUserPermissions
        console.log("\n--- Testing getUserPermissions ---");
        const repAuth = await AccessControlService.getUserPermissions(repUser1._id.toString());
        console.log("Rep Permissions:", repAuth.permissions);
        if (!repAuth.permissions.includes("leads.view.own") || !repAuth.permissions.includes("leads.create")) {
            console.error("❌ Rep permissions extraction failed");
        } else {
            console.log("✅ Rep permissions extraction passed");
        }

        const managerAuth = await AccessControlService.getUserPermissions(managerUser._id.toString());
        console.log("Manager Permissions:", managerAuth.permissions);
        if (!managerAuth.permissions.includes("leads.manage")) {
            console.error("❌ Manager permissions extraction failed");
        } else {
            console.log("✅ Manager permissions extraction passed");
        }


        // 3. Test hasPermission
        console.log("\n--- Testing hasPermission ---");

        // Rep should be able to create leads
        const repCanCreate = await AccessControlService.hasPermission({ id: repUser1._id.toString(), permissions: repAuth.permissions } as any, "leads", "create");
        if (repCanCreate) console.log("✅ Rep can create leads");
        else console.error("❌ Rep CANNOT create leads but should be able to");

        // Rep should NOT be able to delete leads
        const repCanDelete = await AccessControlService.hasPermission({ id: repUser1._id.toString(), permissions: repAuth.permissions } as any, "leads", "delete");
        if (!repCanDelete) console.log("✅ Rep cannot delete leads");
        else console.error("❌ Rep CAN delete leads but shouldn't be able to");

        // Manager should be able to delete leads (via leads.manage wildcard)
        const managerCanDelete = await AccessControlService.hasPermission({ id: managerUser._id.toString(), permissions: managerAuth.permissions } as any, "leads", "delete");
        if (managerCanDelete) console.log("✅ Manager can delete leads (via .manage wildcard)");
        else console.error("❌ Manager CANNOT delete leads but should be able to");


        // 4. Test getSubordinateUserIds (Role Hierarchy) via reportsTo for now
        console.log("\n--- Testing getDescendants (Role Hierarchy equivalent) ---");

        // Rep has no subordinates
        const repSubs = await AccessControlService.getDescendants(repUser1._id.toString());
        console.log(`Rep Subordinates: [${repSubs.join(", ")}]`);
        if (repSubs.length === 0) console.log("✅ Rep has exactly 0 subordinates");
        else console.error("❌ Rep has subordinates but shouldn't");

        // Manager has Rep1 and Rep2 as subordinates
        const managerSubs = await AccessControlService.getDescendants(managerUser._id.toString());
        console.log(`Manager Subordinates: [${managerSubs.join(", ")}]`);
        if (managerSubs.length === 2 && managerSubs.includes(repUser1._id.toString()) && managerSubs.includes(repUser2._id.toString())) {
            console.log("✅ Manager correctly identifies subordinate Reps");
        } else {
            console.error("❌ Manager subordinate resolution failed");
        }

        // Admin (CEO) has Manager, Rep1, Rep2 as subordinates
        const adminSubs = await AccessControlService.getDescendants(adminUser._id.toString());
        console.log(`Admin(CEO) Subordinates: [${adminSubs.join(", ")}]`);
        if (adminSubs.length === 3 && adminSubs.includes(managerUser._id.toString()) && adminSubs.includes(repUser1._id.toString())) {
            console.log("✅ Admin correctly identifies all deep subordinates");
        } else {
            console.error("❌ Admin subordinate depth resolution failed");
        }

    } catch (error) {
        console.error("Test execution failed:", error);
    } finally {
        console.log("\n--- Cleaning up Test Data ---");
        await User.deleteMany({ email: { $regex: "^test.*@example.com$" } });
        await Role.deleteMany({ name: { $regex: "^Test.*" } });
        await Profile.deleteMany({ name: { $regex: "^Test.*" } });

        await mongoose.disconnect();
        console.log("Done.");
    }
}

runTests();
