import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailAccountModel } from "./src/models/emailAccount";

async function check() {
  try {
    await mongoose.connect(config.mongoUri);
    const accounts = await EmailAccountModel.find({});
    for (const acc of accounts) {
      console.log(`Account ${acc.email}: provider=${acc.provider}, isActive=${acc.isActive}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
