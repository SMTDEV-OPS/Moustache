import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { LeadModel } from "./src/models/lead";
import { LeadActivityModel } from "./src/models/leadActivity";
import { NotificationModel } from "./src/models/notification";

async function check() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB:", config.mongoUri);

    const emails = await EmailMessageModel.find().sort({ createdAt: -1 }).limit(3);
    console.log("RECENT EMAILS:");
    for (const e of emails) {
      console.log(`- ${e.subject} (from: ${e.from?.email}, isLinked: ${!!e.linkedLeadId})`);
      if (e.linkedLeadId) {
        const lead = await LeadModel.findById(e.linkedLeadId);
        console.log(`  Linked to Lead: ${lead?.leadNumber}, AssignedTo: ${lead?.assignedToUserId}`);

        const acts = await LeadActivityModel.find({ leadId: e.linkedLeadId }).sort({ createdAt: -1 }).limit(3);
        console.log(`  Recent acts: ${acts.map(a => a.type).join(', ')}`);
      }
    }

    const notifs = await NotificationModel.find().sort({ createdAt: -1 }).limit(3);
    console.log("\nRECENT NOTIFICATIONS:");
    for (const n of notifs) {
      console.log(`- ${n.type} for user ${n.userId}: ${n.title}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
