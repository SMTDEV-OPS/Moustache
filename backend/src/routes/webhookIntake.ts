import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { IntegrationConfigModel } from "../models/integrationConfig";
import { createLead } from "../services/leadService";
import { checkDuplicateLead } from "../services/leadDeduplication";
import { extractUtmFields } from "../services/leadDeduplication";
import { applyFieldMappings } from "../services/webhookMappingService";
import { decryptConfig } from "../services/integrationEncryption";
import { LeadSource, LeadType } from "../models/common";
import { logger } from "../config/logger";

export const webhookIntakeRouter = Router();

const PROVIDER_TO_SOURCE: Record<string, LeadSource> = {
  WATI: LeadSource.WHATSAPP,
  Exotel: LeadSource.IVR_LIVE,
  Ezee: LeadSource.BRAND_WEBSITE,
  Gmail: LeadSource.EMAIL,
  Outlook: LeadSource.EMAIL,
  Airpay: LeadSource.MANUAL,
};

function getSourceForProvider(provider: string): LeadSource {
  return PROVIDER_TO_SOURCE[provider] ?? LeadSource.MANUAL;
}

/**
 * Validate WATI webhook signature (if webhook_secret in config)
 */
function validateWatiSignature(
  body: string,
  signature: string | undefined,
  secret: string | undefined
): boolean {
  if (!secret) return true;
  if (!signature) return false;
  const crypto = require("crypto");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(expected, "hex")
  );
}

/**
 * Validate request for provider (signature/token)
 */
async function validateWebhookRequest(
  orgId: string,
  provider: string,
  req: { body: any; headers: Record<string, string | string[] | undefined> }
): Promise<{ valid: boolean; config?: any }> {
  const configDoc = await IntegrationConfigModel.findOne({
    orgId: new Types.ObjectId(orgId),
    provider,
    is_active: true,
  });

  if (!configDoc || !configDoc.config_json) {
    return { valid: false };
  }

  const config = decryptConfig(configDoc.config_json);

  if (provider === "WATI") {
    const rawBody =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const sig = req.headers["x-wati-signature"] as string | undefined;
    const secret = config.webhook_secret;
    if (!validateWatiSignature(rawBody, sig, secret)) {
      return { valid: false };
    }
  }
  // Other providers: stub - accept if config exists
  return { valid: true, config };
}

webhookIntakeRouter.post("/:orgId/:provider", async (req, res, next) => {
  try {
    const { orgId, provider } = req.params;
    if (!orgId || !provider) {
      return res.status(400).json({ error: "orgId and provider required" });
    }

    const validation = await validateWebhookRequest(orgId, provider, req);
    if (!validation.valid) {
      return res.status(401).json({ error: "Invalid or unverified request" });
    }

    const oid = new Types.ObjectId(orgId);
    const payload = typeof req.body === "object" ? req.body : {};

    const mapped = await applyFieldMappings(
      payload,
      oid,
      (await IntegrationConfigModel.findOne({
        orgId: oid,
        provider,
        is_active: true,
      }))!._id
    );

    const utmFields = await extractUtmFields(req.query || {}, orgId);
    const leadPayload: Record<string, any> = {
      ...mapped,
      customData: { ...(mapped.customData || {}), ...utmFields },
    };

    const dup = await checkDuplicateLead(leadPayload, orgId);
    if (dup.isDuplicate) {
      logger.info("Webhook intake: duplicate lead, skipping create", {
        orgId,
        provider,
        matchedLeadId: dup.matchedLeadId,
      });
      return res.status(200).json({
        success: false,
        message: "Duplicate lead",
        matchedLeadId: dup.matchedLeadId,
      });
    }

    const source = getSourceForProvider(provider);
    const contactDetails = leadPayload.contactDetails || {};
    const name =
      contactDetails.name ||
      leadPayload.name ||
      `Webhook ${provider} ${Date.now().toString(36)}`;

    const lead = await createLead({
      guestContact: {
        name,
        phone: contactDetails.phone || leadPayload.phone,
        email: contactDetails.email || leadPayload.email,
      },
      source,
      leadType: (leadPayload.leadType as LeadType) || LeadType.STAY,
      propertyId: leadPayload.propertyId,
      accountId: leadPayload.accountId || orgId,
      budget: leadPayload.budget,
      notes: leadPayload.notes,
      customData: leadPayload.customData,
      assignmentMode: "auto",
    });

    logger.info("Webhook intake: lead created", {
      orgId,
      provider,
      leadId: lead._id.toString(),
    });

    return res.status(201).json({
      success: true,
      leadId: lead._id.toString(),
      leadNumber: lead.leadNumber,
    });
  } catch (err: any) {
    logger.error("Webhook intake failed", {
      error: err?.message,
      orgId: req.params.orgId,
      provider: req.params.provider,
    });
    return res.status(200).send("OK"); // Return 200 to avoid webhook retries on our errors
  }
});
