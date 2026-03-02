import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { LeadModel } from "./src/models/lead";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        const lead = await LeadModel.findOne({ "leadNumber": "L-20260222-9628" });
        console.log("Lead created at:", lead?.createdAt);

        const emails = await EmailMessageModel.find({ "from.email": "aj@aaisha.ai" }).sort({ createdAt: -1 });
        console.log(`Found ${emails.length} emails from aj@aaisha.ai`);
        for (const e of emails) {
            console.log(`- Email ${e._id}: receivedAt=${e.receivedAt}, createdAt=${e.createdAt}, subject="${e.subject}"`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
