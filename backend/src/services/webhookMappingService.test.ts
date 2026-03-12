import mongoose from "mongoose";
import assert from "assert";
import { applyFieldMappings } from "./webhookMappingService";
import { IntegrationConfigModel } from "../models/integrationConfig";
import { WebhookFieldMappingModel } from "../models/webhookFieldMapping";
import { config } from "../config/env";
import { Types } from "mongoose";

async function runTests() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(config.mongoUri);
  console.log("Connected.");

  try {
    const orgId = new Types.ObjectId();
    const configDoc = await IntegrationConfigModel.create({
      orgId,
      provider: "WATI",
      config_json: "encrypted-placeholder",
      is_active: true,
    });

    await WebhookFieldMappingModel.deleteMany({
      integrationConfigId: configDoc._id,
    });

    await WebhookFieldMappingModel.create([
      {
        orgId,
        integrationConfigId: configDoc._id,
        source_field: "name",
        target_field_slug: "contactDetails",
        transform: "uppercase",
      },
      {
        orgId,
        integrationConfigId: configDoc._id,
        source_field: "mobile",
        target_field_slug: "contactDetails",
        transform: "phone_normalize",
      },
      {
        orgId,
        integrationConfigId: configDoc._id,
        source_field: "budget",
        target_field_slug: "budget",
        transform: "none",
      },
    ]);

    const payload = {
      name: "john doe",
      mobile: "9876543210",
      budget: 50000,
    };

    const result = await applyFieldMappings(
      payload,
      orgId,
      configDoc._id as Types.ObjectId
    );

    assert.ok(result.contactDetails, "contactDetails should exist");
    assert.strictEqual(
      result.contactDetails.name,
      "JOHN DOE",
      "uppercase transform failed"
    );
    assert.ok(
      result.contactDetails.phone || result.contactDetails.mobile,
      "phone/mobile mapped to contactDetails"
    );
    assert.strictEqual(result.budget, 50000, "budget should pass through");

    console.log("✅ Webhook field mapping with transforms passed");

    await IntegrationConfigModel.findByIdAndDelete(configDoc._id);
    await WebhookFieldMappingModel.deleteMany({
      integrationConfigId: configDoc._id,
    });
  } catch (err) {
    console.error("Test failed:", err);
    throw err;
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
