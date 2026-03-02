import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailAccountModel } from "./src/models/emailAccount";

async function check() {
    await mongoose.connect(config.mongoUri);
    const accounts = await EmailAccountModel.find({});
    for (const acc of accounts) {
        console.log(`Account ${acc.email}: provider=${acc.provider}, syncStatus=${acc.syncStatus}, syncError="${acc.syncError}", lastSyncAt=${acc.lastSyncAt}`);
    }
    process.exit();
}
check();
