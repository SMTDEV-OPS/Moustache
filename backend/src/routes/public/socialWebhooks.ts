import { Router } from "express";
import { z } from "zod";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType } from "../../models/common";
import { badRequest } from "../../utils/httpError";
import { logger } from "../../config/logger";

export const publicSocialWebhooksRouter = Router();

// Facebook/Meta Lead Ads webhook payload
const socialPayloadSchema = z.object({
    object: z.string().optional(),
    entry: z.array(z.any()).optional(),
    // Generic fallback if standard POST
    name: z.string().optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    campaign: z.string().optional()
});

/**
 * Public endpoint for Social Media (e.g. Facebook/Instagram) webhooks
 */
publicSocialWebhooksRouter.post("/", async (req, res, next) => {
    try {
        const parsed = socialPayloadSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest(`Invalid Social Media payload`);
        }

        const data = parsed.data;

        // Extremely simplified parser - typically Meta sends a leadgen_id which 
        // requires a Graph API call to retrieve the actual user data. 
        // We assume a middleware or Zapier sends the flattened object here.
        const name = data.name || "Social Media Lead";
        const phone = data.phone;
        const email = data.email;

        if (!phone && !email) {
            return res.status(200).send("Ignored - Missing contact details");
        }

        const lead = await createLead({
            guestContact: {
                name: name,
                phone: phone,
                email: email
            },
            source: LeadSource.SOCIAL,
            leadType: LeadType.STAY, // default
            notes: `Captured from Social Media Campaign: ${data.campaign || 'Unknown'}`,
            assignmentMode: "auto"
        });

        logger.info("Social Media Lead captured", {
            leadId: lead._id.toString(),
            leadNumber: lead.leadNumber,
        });

        res.status(200).send("OK");
    } catch (err: any) {
        logger.error("Failed to process Social webhook", {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(200).send("Error");
    }
});
