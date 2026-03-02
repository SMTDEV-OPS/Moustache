import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel } from "./src/models/emailMessage";
import { GuestModel } from "./src/models/guest";

async function check() {
    await mongoose.connect(config.mongoUri);
    const emails = await EmailMessageModel.find({ "from.email": "aj@aaisha.ai" }).sort({ createdAt: -1 }).limit(1);
    const email = emails[0];

    const guestEmails = [
        email.from?.email,
        ...(email.to?.map((t) => t.email) || []),
        ...(email.cc?.map((c) => c.email) || []),
    ].filter((e): e is string => !!e);

    for (const emailAddr of guestEmails) {
        console.log(`Checking exact string: "${emailAddr}"`);
        const guest = await GuestModel.findOne({ email: emailAddr }).lean();
        console.log(`Guest found with EXACT findOne({ email: "${emailAddr}" }):`, !!guest);
    }
    process.exit();
}
check();
