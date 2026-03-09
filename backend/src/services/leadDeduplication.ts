import { CustomFieldModel } from "../models/customField";
import { LeadModel } from "../models/lead";

/**
 * Checks if a lead to be created is a duplicate of an existing lead
 * based on custom fields marked as "is_unique_identifier".
 */
export async function checkDuplicateLead(
    leadData: any,
    orgId?: string // Stub for future multi-tenant context (e.g., accountId / propertyId filter)
): Promise<{ isDuplicate: boolean; matchedLeadId?: string; matchedFields: string[] }> {

    // Find all fields marked as unique identifiers for leads
    const uniqueFields = await CustomFieldModel.find({
        entity_type: "lead",
        is_unique_identifier: true,
        is_active: true
    }).lean();

    if (uniqueFields.length === 0) {
        return { isDuplicate: false, matchedFields: [] };
    }

    const orConditions: any[] = [];
    const matchedFields: string[] = [];

    // Construct the $or query looking for duplicates
    for (const field of uniqueFields) {
        let incomingValue;

        // Value might be at the root (if built in like 'phone' or 'email' mapped to a slug)
        // Or it might be inside customData Map
        if (leadData[field.slug] !== undefined) {
            incomingValue = leadData[field.slug];
        } else if (leadData.customData && leadData.customData[field.slug] !== undefined) {
            incomingValue = leadData.customData[field.slug];
        }

        if (incomingValue !== undefined && incomingValue !== null && incomingValue !== "") {
            orConditions.push({ [field.slug]: incomingValue });
            orConditions.push({ [`customData.${field.slug}`]: incomingValue });
            matchedFields.push(field.slug);
        }
    }

    if (orConditions.length === 0) {
        return { isDuplicate: false, matchedFields: [] };
    }

    // Attempt to find any existing lead matching these exact values
    const query: any = { $or: orConditions };

    // NOTE: If orgId is later required to scope uniqueness per-tenant, add it here
    // if (orgId) { query.accountId = orgId; }

    const existingLead = await LeadModel.findOne(query).select("_id").lean();

    if (existingLead) {
        return {
            isDuplicate: true,
            matchedLeadId: existingLead._id.toString(),
            matchedFields
        };
    }

    return { isDuplicate: false, matchedFields: [] };
}


/**
 * Extracts UTM parameters from query parameters based on custom fields 
 * marked with "utm_capture = true".
 */
export async function extractUtmFields(
    queryParams: Record<string, any>,
    orgId?: string // Stub for future multi-tenant context
): Promise<Record<string, any>> {

    const utmFields = await CustomFieldModel.find({
        entity_type: "lead",
        utm_capture: true,
        is_active: true
    }).lean();

    const extractedData: Record<string, any> = {};

    for (const field of utmFields) {
        if (queryParams[field.slug] !== undefined) {
            extractedData[field.slug] = queryParams[field.slug];
        } else if (queryParams[field.name] !== undefined) {
            // Fallback to name in case the URL param uses the name exactly
            extractedData[field.slug] = queryParams[field.name];
        }
    }

    return extractedData;
}
