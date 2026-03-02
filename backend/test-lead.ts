import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { LeadModel } from "./src/models/lead";
import { EmailMessageModel } from "./src/models/emailMessage";

async function check() {
  try {
    await mongoose.connect(config.mongoUri);
    const emails = await EmailMessageModel.find({ "from.email": "aj@aaisha.ai" }).sort({ createdAt: -1 }).limit(1);
    const email = emails[0];
    console.log("Email:", email._id, email.linkedLeadId);

    const lead = await LeadModel.findOne({ "guestId": email.linkedGuestId || "699a2d3be1d3b02cef762dec" });
    console.log("Lead assignedToUserId:", lead?.assignedToUserId);
    console.log("Is AssignedToUserId truthy?", !!lead?.assignedToUserId);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
