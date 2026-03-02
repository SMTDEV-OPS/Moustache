import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { LeadModel } from "./src/models/lead";
import { CommunicationModel } from "./src/models/communication";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        const emails = await EmailMessageModel.find({ _id: "699a3b4ae1d3b02cef763728" });
        const email = emails[0];
        console.log("Email from DB:");
        console.log("- folder:", email.folder);
        console.log("- linkedLeadId:", email.linkedLeadId);

        const comms = await CommunicationModel.find({ emailMessageId: email._id });
        console.log(`Found ${comms.length} Communications for this email.`);
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
