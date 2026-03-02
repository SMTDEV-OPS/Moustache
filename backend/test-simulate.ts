import mongoose from "mongoose";
import * as dotenv from "dotenv";
dotenv.config();

import { config } from "./src/config/env";
import { EmailMessageModel, IEmailMessage } from "./src/models/emailMessage";

async function check() {
    try {
        await mongoose.connect(config.mongoUri);
        // Find the email
        const emailData = await EmailMessageModel.findOne({ _id: "699a3b4ae1d3b02cef763728" }).lean() as any;

        // Create a new copy to test save behavior
        delete emailData._id;
        emailData.messageId = "test-msg-" + Date.now();

        const savedEmail = await EmailMessageModel.create(emailData);
        console.log("Newly created email ID:", savedEmail._id);

        // Simulate what syncEmails does
        const fakeLeadId = new mongoose.Types.ObjectId("699a2d3ce1d3b02cef762df2");

        savedEmail.linkedLeadId = fakeLeadId as any;
        console.log("LinkedLeadId in memory:", savedEmail.linkedLeadId);

        await savedEmail.save();

        // Fetch it back
        const fetched = await EmailMessageModel.findById(savedEmail._id);
        console.log("Fetched from DB - linkedLeadId:", fetched?.linkedLeadId);

    } catch (err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}
check();
