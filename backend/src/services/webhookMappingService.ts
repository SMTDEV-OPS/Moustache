import { WebhookFieldMappingModel, WebhookTransform } from "../models/webhookFieldMapping";
import { Types } from "mongoose";
import { normalizePhone } from "../utils/phoneUtils";

/**
 * Apply transform to a value
 */
function applyTransform(value: any, transform: WebhookTransform): any {
  if (value === undefined || value === null) return value;
  const str = String(value);
  switch (transform) {
    case "uppercase":
      return str.toUpperCase();
    case "lowercase":
      return str.toLowerCase();
    case "phone_normalize":
      return normalizePhone(str) ?? str;
    case "date_parse": {
      const d = new Date(str);
      return isNaN(d.getTime()) ? str : d.toISOString();
    }
    default:
      return value;
  }
}

/**
 * Map webhook payload to CRM lead payload using field mappings
 */
export async function applyFieldMappings(
  payload: Record<string, any>,
  orgId: Types.ObjectId,
  integrationConfigId: Types.ObjectId
): Promise<Record<string, any>> {
  const mappings = await WebhookFieldMappingModel.find({
    orgId,
    integrationConfigId,
  }).lean();

  const result: Record<string, any> = {};
  const customData: Record<string, any> = {};

  const standardFields = new Set([
    "contactDetails",
    "source",
    "leadType",
    "budget",
    "notes",
    "propertyId",
    "accountId",
  ]);

  for (const m of mappings) {
    let raw = payload[m.source_field];
    if (raw === undefined) continue;
    const transformed = applyTransform(raw, m.transform);

    if (m.target_field_slug === "contactDetails") {
      result.contactDetails = result.contactDetails || {};
      if (m.source_field.toLowerCase().includes("name")) {
        result.contactDetails.name = transformed;
      } else if (m.source_field.toLowerCase().includes("phone") || m.source_field.toLowerCase().includes("mobile")) {
        result.contactDetails.phone = transformed;
      } else if (m.source_field.toLowerCase().includes("email")) {
        result.contactDetails.email = transformed;
      } else {
        result.contactDetails[m.source_field] = transformed;
      }
    } else if (standardFields.has(m.target_field_slug)) {
      result[m.target_field_slug] = transformed;
    } else {
      customData[m.target_field_slug] = transformed;
    }
  }

  if (Object.keys(customData).length > 0) {
    result.customData = customData;
  }

  return result;
}
