import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { UserModel } from "../src/models/user";

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error("Usage: npm run reset:password <email> <newPassword>");
  console.error("Example: npm run reset:password admin@example.com NewPassword123");
  process.exit(1);
}

async function resetPassword() {
  await mongoose.connect(config.mongoUri);
  logger.info("Connected to MongoDB");

  const user = await UserModel.findOne({ email });
  if (!user) {
    console.error(`User with email ${email} not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  user.passwordHash = passwordHash;
  user.status = "ACTIVE"; // Ensure user is active
  await user.save();

  logger.info("Password reset successfully", { email });
  console.log(`\n✓ Password reset successfully for ${email}`);
  console.log(`  New password: ${newPassword}\n`);

  await mongoose.disconnect();
}

resetPassword()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Error resetting password:", err);
    process.exit(1);
  });

