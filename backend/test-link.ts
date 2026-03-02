import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { GuestModel } from "./src/models/guest";
import { LeadModel } from "./src/models/lead";
import { EmailMessageModel } from "./src/models/emailMessage";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);

        const emailToSearch = "aj@aaisha.ai";
        const emails = await EmailMessageModel.find({ "from.email": emailToSearch }).sort({ createdAt: -1 }).limit(1);
        const email = emails[0];

        if (!email) {
            console.log("No email found");
            return;
        }

        console.log("Email from:", "'" + email.from?.email + "'");

        const guestEmails = [
            email.from?.email,
            ...(email.to?.map((t) => t.email) || []),
            ...(email.cc?.map((c) => c.email) || []),
        ].filter((e): e is string => !!e);

        console.log("guestEmails array:", guestEmails);

        for (const emailAddr of guestEmails) {
            const guest = await GuestModel.findOne({ email: emailAddr }).lean();
            console.log("Did it find guest for", "'" + emailAddr + "'?", !!guest);

            const regexGuest = await GuestModel.findOne({ email: { $regex: new RegExp(`^${emailAddr}$`, 'i') } }).lean();
            console.log("Did it find guest with regex?", !!regexGuest);
        }

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
