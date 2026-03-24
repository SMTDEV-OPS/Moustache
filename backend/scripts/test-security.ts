import mongoose from "mongoose";
import dotenv from "dotenv";
import { RoleModel } from "../src/models/role";
import { ProfileModel } from "../src/models/profile";
import { EmployeeGroupModel } from "../src/models/employeeGroup";
import { DataSharingRuleModel } from "../src/models/dataSharingRule";
import { DataSharingService } from "../src/services/auth/DataSharingService";
import { AccessControlService } from "../src/services/auth/AccessControlService";
import { UserModel } from "../src/models/user";

dotenv.config();
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/Postcardcrm";

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(MONGO_URI);

    try {
        console.log("\n--- Setting up Test Data ---");

        // Clean up any old data
        await RoleModel.deleteMany({ name: { $in: ["TEST_CEO", "TEST_VP", "TEST_REP"] } });
        await UserModel.deleteMany({ email: { $in: ["ceo@test.com", "vp@test.com", "rep@test.com"] } });
        await EmployeeGroupModel.deleteMany({ name: "VP Test Group" });

        // 1. Create a Hierarchy of Roles
        const ceoRole = await RoleModel.create({ name: "TEST_CEO", isSystemRole: false });
        const vpRole = await RoleModel.create({ name: "TEST_VP", parentRoleId: ceoRole._id, isSystemRole: false });
        const repRole = await RoleModel.create({ name: "TEST_REP", parentRoleId: vpRole._id, isSystemRole: false });

        // 2. Create Users in those Roles
        const ceoUser = await UserModel.create({ name: "CEO User", email: "ceo@test.com", passwordHash: "x", roleId: ceoRole._id, teamType: "OPERATIONS", status: "ACTIVE" });
        const vpUser = await UserModel.create({ name: "VP User", email: "vp@test.com", passwordHash: "x", roleId: vpRole._id, teamType: "OPERATIONS", status: "ACTIVE", reportsTo: ceoUser._id });
        const repUser = await UserModel.create({ name: "Rep User", email: "rep@test.com", passwordHash: "x", roleId: repRole._id, teamType: "OPERATIONS", status: "ACTIVE", reportsTo: vpUser._id });

        // Force rebuild hierarchy paths
        await AccessControlService.rebuildHierarchy(ceoUser.id);

        // 3. Create a Group with the VP Role in it
        const vpGroup = await EmployeeGroupModel.create({
            name: "VP Test Group",
            memberRoleIds: [vpRole._id]
        });

        // 4. Create a Data Sharing Rule (Rep shares Leads with VP Group for FULL access)
        await DataSharingRuleModel.create({
            module: "leads",
            fromType: "role",
            fromId: repRole._id,
            toType: "group",
            toId: vpGroup._id,
            accessLevel: "full",
            isActive: true
        });

        console.log("\n--- Testing DataSharingService.getEffectiveAccess ---");

        // Test A: Can CEO see Rep's leads? (Yes, via hierarchy getDescendants logic)
        const accessA = await DataSharingService.getEffectiveAccess(ceoUser.id, ceoUser.roleId?.toString(), repUser.id, repUser.roleId?.toString(), "leads");
        console.log(`CEO access to Rep's lead: ${accessA} (Expected: full - via hierarchy)`);

        // Test B: Can VP see Rep's leads? (Yes, via sharing rule granting FULL access to the VP Group)
        const accessB = await DataSharingService.getEffectiveAccess(vpUser.id, vpUser.roleId?.toString(), repUser.id, repUser.roleId?.toString(), "leads");
        console.log(`VP access to Rep's lead: ${accessB} (Expected: full - via group sharing rule)`);

        // Test C: Can Rep see VP's leads? (No, default is private for leads)
        const accessC = await DataSharingService.getEffectiveAccess(repUser.id, repUser.roleId?.toString(), vpUser.id, vpUser.roleId?.toString(), "leads");
        console.log(`Rep access to VP's lead: ${accessC} (Expected: none - subordinate shouldn't see superior)`);

        // Test D: Can Rep see CEO's leads? (No)
        const accessD = await DataSharingService.getEffectiveAccess(repUser.id, repUser.roleId?.toString(), ceoUser.id, ceoUser.roleId?.toString(), "leads");
        console.log(`Rep access to CEO's lead: ${accessD} (Expected: none)`);

        console.log("\n--- Cleaning up Test Data ---");
        await RoleModel.deleteMany({ _id: { $in: [ceoRole._id, vpRole._id, repRole._id] } });
        await UserModel.deleteMany({ _id: { $in: [ceoUser._id, vpUser._id, repUser._id] } });
        await EmployeeGroupModel.deleteMany({ _id: vpGroup._id });
        await DataSharingRuleModel.deleteMany({ module: "leads", fromId: repRole._id, toId: vpGroup._id });

        console.log("Cleanup complete. Tests finished.");
    } catch (error) {
        console.error("Test Error:", error);
    } finally {
        await mongoose.disconnect();
    }
}

runTests();
