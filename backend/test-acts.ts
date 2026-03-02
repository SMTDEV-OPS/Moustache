import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { LeadModel } from "./src/models/lead";
import { LeadActivityModel } from "./src/models/leadActivity";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);

        const lead = await LeadModel.findOne({ "guestId": "699a2d3be1d3b02cef762dec" });
        if (lead) {
            console.log(`Lead ${lead.leadNumber} ID:`, lead._id);
            const acts = await LeadActivityModel.find({ leadId: lead._id, type: "CLIENT_RESPONSE" }).sort({ createdAt: -1 }).limit(5);
            console.log("CLIENT_RESPONSE Activities:");
            for (const a of acts) {
                console.log(` - ID: ${a._id}, Note: ${a.note}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
