import mongoose from "mongoose";
import assert from "assert";
import {
    checkDuplicateLead,
    extractUtmFields
} from "./leadDeduplication";
import { CustomFieldModel } from "../models/customField";
import { LeadModel } from "../models/lead";
import { config } from "../config/env";

async function runTests() {
    console.log("Connecting to MongoDB...");
    await mongoose.connect(config.mongoUri);
    console.log("Connected.");

    try {
        console.log("--- Setup Test Data ---");
        // Clear collections for pure test execution
        await CustomFieldModel.deleteMany({ name: { $regex: /^TEST_/ } });
        await LeadModel.deleteMany({ leadNumber: { $regex: /^TEST-DUP/ } });

        // Create Unique Fields
        await CustomFieldModel.create([
            {
                name: "TEST_Email",
                slug: "test_email",
                entity_type: "lead",
                // We'll mock the service manually for tests or insert standard entity_type
                // For test isolation, let's just insert as standard but cleanup carefully.
                is_unique_identifier: true,
                utm_capture: false,
                dataType: "TEXT",
                label: "TEST Email",
                is_active: true,
            },
            {
                name: "TEST_Mobile",
                slug: "test_mobile",
                entity_type: "lead",
                is_unique_identifier: true,
                utm_capture: false,
                dataType: "PHONE",
                label: "TEST Mobile",
                is_active: true,
            },
            {
                name: "TEST_UTM_Source",
                slug: "utm_source",
                entity_type: "lead",
                is_unique_identifier: false,
                utm_capture: true,
                dataType: "TEXT",
                label: "UTM Source",
                is_active: true,
            }
        ]);

        // Manually rewrite entity_type to standard for the service to pick it up, then we will delete it later
        await CustomFieldModel.updateMany({ entity_type: "lead" }, { entity_type: "lead", original_test: true });

        // Insert an existing lead to duplicate against
        const existingLead = await LeadModel.create({
            leadNumber: "TEST-DUP-1",
            source: "BRAND_WEBSITE", // Fixed Enum
            leadType: "STAY",        // Fixed Enum
            status: "NEW",
            customData: {
                test_email: "test@example.com",
                test_mobile: "9876543210"
            }
        });

        console.log("--- Running extractUtmFields Tests ---");

        const qpMatches = await extractUtmFields({ utm_source: "fb_ads", ignore_me: "yes" });
        assert.strictEqual(qpMatches["utm_source"], "fb_ads", "UTM source extraction failed");
        assert.strictEqual(qpMatches["ignore_me"], undefined, "Extracted arbitrary field incorrectly");
        console.log("✅ extractUtmFields passed");


        console.log("--- Running checkDuplicateLead Tests ---");

        // Test 1: Exact match on custom data
        const res1 = await checkDuplicateLead({ customData: { test_email: "test@example.com" } });
        assert.strictEqual(res1.isDuplicate, true, "Failed to identify exact email duplicate");
        assert.strictEqual(res1.matchedLeadId, existingLead._id.toString(), "Matched wrong lead ID for email");
        assert.ok(res1.matchedFields.includes("test_email"), "Missing test_email in matched fields");
        console.log("✅ checkDuplicateLead (match true) passed");

        // Test 2: No match
        const res2 = await checkDuplicateLead({ customData: { test_email: "no-match@example.com" } });
        assert.strictEqual(res2.isDuplicate, false, "Falsely identified duplicate");
        console.log("✅ checkDuplicateLead (match false) passed");

        // Test 3: Multiple unique identifiers provided
        const res3 = await checkDuplicateLead({ customData: { test_mobile: "9876543210" } });
        assert.strictEqual(res3.isDuplicate, true, "Failed to identify mobile duplicate");
        console.log("✅ checkDuplicateLead (multiple identifiers) passed");

    } catch (err) {
        console.error("❌ Test failed:", err);
        process.exitCode = 1;
    } finally {
        console.log("--- Cleaning up ---");
        await CustomFieldModel.deleteMany({ name: { $regex: /^TEST_/ } });
        await LeadModel.deleteMany({ leadNumber: { $regex: /^TEST-DUP/ } });

        await mongoose.disconnect();
        console.log("Disconnected.");
    }
}

runTests();
