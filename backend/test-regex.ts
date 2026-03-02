import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { LeadActivityModel } from "./src/models/leadActivity";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);

        const emails = await EmailMessageModel.find({ "from.email": "aj@aaisha.ai" }).sort({ createdAt: -1 }).limit(3);

        for (const email of emails) {
            console.log(`Email ID: ${email._id}, messageId: ${email.messageId}`);

            try {
                const existingActivity = await LeadActivityModel.findOne({
                    // leadId: ...,
                    type: "CLIENT_RESPONSE",
                    note: { $regex: email.messageId },
                }).lean();
                console.log(`Did regex search succeed? Yes. Result: ${!!existingActivity}`);
            } catch (err) {
                console.error(`Regex search crashed for ${email.messageId}:`, (err as any).message);
            }
        }
    } catch (err) {
        console.error("Connection error:", err);
    } finally {
        process.exit(0);
    }
}
check();
