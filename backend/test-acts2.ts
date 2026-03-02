import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { LeadModel } from "./src/models/lead";
import { LeadActivityModel } from "./src/models/leadActivity";

async function check() {
  try {
    await mongoose.connect(config.mongoUri);
    const lead = await LeadModel.findOne({ "leadNumber": "L-20260222-9628" });
    if (lead) {
      const acts = await LeadActivityModel.find({ leadId: lead._id }).sort({ createdAt: -1 }).limit(5);
      for (const a of acts) {
        console.log(` - ID: ${a._id}, Type: ${a.type}`);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    process.exit(0);
  }
}
check();
