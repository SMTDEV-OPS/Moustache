/**
 * Upsert custom dropdown fields for guest segment and lead channel.
 *
 * Usage: npx ts-node scripts/seedLeadDropdownFields.ts
 */
import "dotenv/config";
import mongoose from "mongoose";
import { config } from "../src/config/env";
import { logger } from "../src/config/logger";
import { CustomFieldModel } from "../src/models/customField";

const GUEST_SEGMENT_OPTIONS = [
  "Solo",
  "Couples",
  "Family",
  "Wellness",
  "Packages multi-prop",
  "Packages",
  "Social Group",
  "Corp Retreat",
  "Walk-In",
];

const LEAD_CHANNEL_OPTIONS = [
  "Website",
  "Email",
  "Telecall",
  "Sales Team - Delhi",
  "Sales Team - Mumbai and for other city",
  "WhatsApp",
  "Instagram",
  "Google Ads",
  "Referral",
  "gift Voucher",
  "Corp Voucher",
  "Amex 35 K",
  "Amex 60K",
  "Amex Partial Voucher",
  "Amex Expereinces",
  "Indusind Bank",
  "Axis",
  "HSBC",
  "Indigo",
  "Ethiad",
  "KrisFlyer",
];

function toOptions(values: string[]) {
  return values.map((v) => ({ label: v, value: v }));
}

const fields = [
  {
    name: "guest_segment",
    slug: "guest_segment",
    label: "Guest Segment",
    entity_type: "lead" as const,
    dataType: "DROPDOWN" as const,
    module: "leads" as const,
    display_order: 10,
    is_active: true,
    isRequired: false,
    options: toOptions(GUEST_SEGMENT_OPTIONS),
  },
  {
    name: "lead_channel",
    slug: "lead_channel",
    label: "Channel",
    entity_type: "lead" as const,
    dataType: "DROPDOWN" as const,
    module: "leads" as const,
    display_order: 11,
    is_active: true,
    isRequired: false,
    options: toOptions(LEAD_CHANNEL_OPTIONS),
  },
];

async function seed() {
  await mongoose.connect(config.mongoUri);

  for (const field of fields) {
    const existing = await CustomFieldModel.findOne({
      slug: field.slug,
      entity_type: "lead",
    });

    if (existing) {
      await CustomFieldModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            name: field.name,
            label: field.label,
            dataType: field.dataType,
            module: field.module,
            display_order: field.display_order,
            is_active: field.is_active,
            options: field.options,
          },
        }
      );
      logger.info("Updated custom field", { slug: field.slug });
    } else {
      await CustomFieldModel.create({
        ...field,
        fieldName: field.name,
        isActive: field.is_active,
      });
      logger.info("Created custom field", { slug: field.slug });
    }
  }

  await mongoose.disconnect();
  logger.info("Lead dropdown custom fields seeded");
}

seed().catch((err) => {
  logger.error("seedLeadDropdownFields failed", {}, err instanceof Error ? err : new Error(String(err)));
  process.exit(1);
});
