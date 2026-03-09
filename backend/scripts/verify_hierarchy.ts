import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { UserModel } from "../src/models/user";
import { RoleModel } from "../src/models/role";
import { UserRoleModel } from "../src/models/userRole";
import { LeadModel } from "../src/models/lead";
import { LeadSource, LeadType, LeadStatus } from "../src/models/common";
import { AccessControlService } from "../src/services/auth/AccessControlService";

/**
 * Run this script with: npx ts-node scripts/verify_hierarchy.ts
 */
async function runTests() {
    await mongoose.connect(config.mongoUri);
    console.log(`\n--- STARTING ACCESS CONTROL TESTS ---\n`);

    try {
        // 1. SETUP CLEAN SLATE
        console.log("Cleaning up old test data...");
        await UserModel.deleteMany({ email: { $regex: "@test.com" } });
        await RoleModel.deleteMany({ name: { $regex: "Test Role" } });
        await LeadModel.deleteMany({ leadNumber: { $regex: "TEST-LEAD" } });

        // 2. CREATE ROLES
        console.log("Creating Test Roles...");
        const standardRoleRes = await RoleModel.collection.insertOne({
            name: "Standard Sales Test Role",
            permissions: ["leads:read:own", "leads:update:own"],
            isSystemRole: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const standardSalesRole = await RoleModel.findById(standardRoleRes.insertedId);

        const globalRoleRes = await RoleModel.collection.insertOne({
            name: "Global Sales Test Role",
            permissions: ["leads:read:global"],
            isSystemRole: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });
        const globalSalesRole = await RoleModel.findById(globalRoleRes.insertedId);

        // 3. CREATE USERS (HIERARCHY)
        console.log("Creating User Hierarchy...");

        const ceo = await UserModel.create({
            name: "Test CEO",
            email: "ceo@test.com",
            status: "ACTIVE",
            passwordHash: "test1234",
        });

        const b2cManager = await UserModel.create({
            name: "Test B2C Manager",
            email: "b2c.mgr@test.com",
            reportsTo: ceo._id,
            status: "ACTIVE",
            passwordHash: "test1234",
        });

        const b2cLead = await UserModel.create({
            name: "Test B2C Team Lead",
            email: "b2c.lead@test.com",
            reportsTo: b2cManager._id,
            status: "ACTIVE",
            passwordHash: "test1234",
        });

        const b2cExec1 = await UserModel.create({
            name: "Test B2C Exec 1",
            email: "exec1@test.com",
            reportsTo: b2cLead._id,
            status: "ACTIVE",
            passwordHash: "test1234",
        });

        const b2cExec2 = await UserModel.create({
            name: "Test B2C Exec 2",
            email: "exec2@test.com",
            reportsTo: b2cLead._id,
            status: "ACTIVE",
            passwordHash: "test1234",
        });

        // Assign Roles
        await UserRoleModel.create([
            { userId: ceo._id, roleId: globalSalesRole!._id }, // CEO sees all
            { userId: b2cManager._id, roleId: standardSalesRole!._id }, // Manager sees own + descendants
            { userId: b2cLead._id, roleId: standardSalesRole!._id },
            { userId: b2cExec1._id, roleId: standardSalesRole!._id },
            { userId: b2cExec2._id, roleId: standardSalesRole!._id },
        ]);

        // Rebuild Hierarchy Paths (Crucial for AccessControlService)
        console.log("Rebuilding Hierarchy Paths...");
        await AccessControlService.rebuildHierarchy(ceo._id.toString());

        // 4. CREATE LEADS
        console.log("Creating Test Leads...");
        const leadExec1 = await LeadModel.create({
            leadNumber: "TEST-LEAD-1",
            source: LeadSource.BRAND_WEBSITE,
            leadType: LeadType.STAY,
            status: LeadStatus.NEW,
            stageId: new mongoose.Types.ObjectId(),
            assignedToUserId: b2cExec1._id, // Owned by Exec 1
        });

        const leadExec2 = await LeadModel.create({
            leadNumber: "TEST-LEAD-2",
            source: LeadSource.BRAND_WEBSITE,
            leadType: LeadType.STAY,
            status: LeadStatus.NEW,
            stageId: new mongoose.Types.ObjectId(),
            assignedToUserId: b2cExec2._id, // Owned by Exec 2
        });

        // 5. RUN TESTS
        console.log("\n--- EXECUTING PERMISSION TESTS ---\n");

        const checkAccess = async (userDoc: any, leadDoc: any, expected: boolean, scenario: string) => {
            // Mock the AuthUser object expected by AccessControlService
            const permissionsObj = await AccessControlService.getUserPermissions(userDoc._id);
            const descendants = await AccessControlService.getDescendants(userDoc._id.toString());

            const authUser = {
                id: userDoc._id.toString(),
                email: userDoc.email,
                isAdmin: permissionsObj.isAdmin,
                permissions: permissionsObj.permissions,
                descendants: descendants,
            };

            const hasAccess = await AccessControlService.hasPermission(
                authUser,
                "leads",
                "read",
                { ownerId: leadDoc.assignedToUserId?.toString() }
            );

            const result = hasAccess === expected ? "✅ PASS" : "❌ FAIL";
            console.log(`[${result}] ${scenario} | Has Access: ${hasAccess} (Expected: ${expected})`);
        };

        // Test 1: Exec 1 reading their own lead
        await checkAccess(b2cExec1, leadExec1, true, "Exec 1 accessing their OWN lead");

        // Test 2: Exec 1 reading Exec 2's lead (Should Fail)
        await checkAccess(b2cExec1, leadExec2, false, "Exec 1 accessing Exec 2's lead (Peer)");

        // Test 3: Team Lead reading Exec 1's lead (Should Pass due to descendants)
        await checkAccess(b2cLead, leadExec1, true, "Team Lead accessing subordinate's lead");

        // Test 4: B2C Manager reading Exec 2's lead (Should Pass due to deep descendants)
        await checkAccess(b2cManager, leadExec2, true, "Department Manager accessing deep subordinate's lead");

        // Test 5: CEO reading Exec 1's lead (Should Pass due to global scope)
        await checkAccess(ceo, leadExec1, true, "CEO accessing any lead (Global Role)");


    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        console.log("\nCleaning up test data...");
        await UserModel.deleteMany({ email: { $regex: "@test.com" } });
        await RoleModel.deleteMany({ name: { $regex: "Test Role" } });
        await LeadModel.deleteMany({ leadNumber: { $regex: "TEST-LEAD" } });

        await mongoose.disconnect();
        console.log("--- TESTS COMPLETE ---");
    }
}

runTests();
