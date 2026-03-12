import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { UserModel } from "../src/models/user";

async function listUsers() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB");

  const users = await UserModel.find({}).select("name email status roleId").lean();
  
  console.log("\n=== Users in Database ===\n");
  if (users.length === 0) {
    console.log("No users found in the database.");
  } else {
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Role ID: ${user.roleId || "None"}`);
      console.log("");
    });
  }

  await mongoose.disconnect();
}

listUsers()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error listing users:", err);
    process.exit(1);
  });

