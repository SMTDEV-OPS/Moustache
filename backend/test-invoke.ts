import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { handleClientResponse } from "./src/services/clientResponseService";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        const emails = await EmailMessageModel.find({ "from.email": "aj@aaisha.ai" }).sort({ createdAt: -1 }).limit(1);
        const email = emails[0];

        // Simulate what imapListener does:
        email.linkedLeadId = new mongoose.Types.ObjectId("699a2d3ce1d3b02cef762df2") as any;
        email.linkedGuestId = new mongoose.Types.ObjectId("699a2d3be1d3b02cef762dec") as any;

        console.log("Invoking handleClientResponse manually...");
        await handleClientResponse(email);
        console.log("Finished invoked handleClientResponse");
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
