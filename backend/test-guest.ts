import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { GuestModel } from "./src/models/guest";
import { LeadModel } from "./src/models/lead";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);

        const emailToSearch = "aj@aaisha.ai";
        const guest = await GuestModel.findOne({
            $or: [
                { email: { $regex: new RegExp(`^${emailToSearch}$`, 'i') } },
                { "contactDetails.email": { $regex: new RegExp(`^${emailToSearch}$`, 'i') } }
            ]
        });

        console.log("Guest search result for", emailToSearch, ":", guest ? guest._id : "NOT FOUND");

        if (guest) {
            console.log("Guest email field:", guest.email);
            console.log("Guest contactDetails.email field:", (guest as any).contactDetails?.email);

            const leads = await LeadModel.find({ guestId: guest._id });
            console.log(`Found ${leads.length} leads for guest`);
            for (const l of leads) {
                console.log(`- Lead ${l.leadNumber}, status: ${l.status}, assignment: ${l.assignedToUserId}`);
            }
        }
    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
