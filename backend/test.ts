import "dotenv/config";
import mongoose from "mongoose";
import { config } from "./src/config/env";
import { UserModel } from "./src/models/user";
import { ProfileModel } from "./src/models/profile";
import { RoleModel } from "./src/models/role";

async function run() {
    await mongoose.connect(config.mongoUri);
    const profile = await ProfileModel.findOne({ name: "Admin" });
    const role = await RoleModel.findOne({ name: "Admin Role" });

    if (profile && role) {
        const result = await UserModel.updateOne(
            { email: "admin@newhotelcrm.local" },
            { $set: { profileId: profile._id, roleId: role._id } }
        );
        console.log(`Updated admin@newhotelcrm.local with Admin profile and role! Modified count: ${result.modifiedCount}`);
    } else {
        console.log("Admin profile or role not found");
    }
    process.exit(0);
}
run();
