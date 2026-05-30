import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { PropertyModel } from "../src/models/property";

async function verify() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    console.log("Connected to MongoDB for verification.");

    const count = await PropertyModel.countDocuments();
    console.log(`Total properties in database: ${count}`);

    const sampleCodes = ["26548", "29072", "61329", "60611"];
    console.log("\nVerifying sample properties from your list:");

    for (const code of sampleCodes) {
        const prop = await PropertyModel.findOne({ "pmsConfig.hotelCode": code }).lean();
        if (prop) {
            console.log(`✅ Found Property Code ${code}:`);
            console.log(`   Name: ${prop.name}`);
            console.log(`   PMS Provider: ${prop.pmsProvider}`);
            console.log(`   Hotel Code: ${prop.pmsConfig?.hotelCode}`);
            console.log(`   Auth Code: ${prop.pmsConfig?.authCode}`);
        } else {
            console.log(`❌ Failed to find Property Code ${code}`);
        }
    }

    await mongoose.disconnect();
    console.log("Disconnected from database.");
}

verify().catch(console.error);
