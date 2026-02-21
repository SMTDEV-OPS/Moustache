import { Router } from "express";
import { z } from "zod";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType, LeadStatus } from "../../models/common";
import { badRequest } from "../../utils/httpError";
import { logger } from "../../config/logger";
import { LeadActivityModel, LeadActivityType } from "../../models/leadActivity";
import { LeadModel } from "../../models/lead";
import { GuestModel } from "../../models/guest";

export const publicWhatsappWebhooksRouter = Router();

// WATI incoming message payload
const watiPayloadSchema = z.object({
    waId: z.string().min(1, "Sender WhatsApp ID is required"),
    senderName: z.string().optional(),
    text: z.string().optional(),
    messageId: z.string().optional()
});

/**
 * Public endpoint for WhatsApp/WATI webhooks
 */
publicWhatsappWebhooksRouter.post("/", async (req, res, next) => {
    try {
        const parsed = watiPayloadSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest(
                `Invalid WhatsApp payload: ${parsed.error.errors.map((e) => e.message).join(", ")}`
            );
        }

        const data = parsed.data;

        // We assume WATI waId is the normalized phone number
        let lead;
        try {
            lead = await createLead({
                guestContact: {
                    name: data.senderName || `WA Contact ${data.waId.slice(-4)}`,
                    phone: data.waId,
                },
                source: LeadSource.WHATSAPP,
                leadType: LeadType.STAY, // default
                notes: `Generated from WhatsApp. Initial message: "${data.text || 'N/A'}"`,
                assignmentMode: "auto"
            });

            logger.info("WhatsApp Lead captured via WATI", {
                leadId: lead._id.toString(),
                leadNumber: lead.leadNumber,
                phone: data.waId,
            });
        } catch (err: any) {
            // Check if error is due to active lead (duplicate check in leadService.ts)
            if (err.message && err.message.includes("Active lead exists for this guest")) {
                const guest = await GuestModel.findOne({ "contactDetails.phone": data.waId });
                if (guest) {
                    lead = await LeadModel.findOne({
                        guestId: guest._id,
                        status: {
                            $nin: [LeadStatus.LOST, LeadStatus.CLOSED_AUTO, LeadStatus.CONFIRMED]
                        }
                    });
                }

                if (!lead) {
                    logger.error("Duplicate lead error caught, but could not locate the active lead for WA append.");
                    return res.status(200).send("Active Lead Found - Append Failed");
                }

                logger.info("Appending WA message to existing active lead", { leadId: lead._id.toString() });
            } else {
                throw err;
            }
        }

        if (lead) {
            await LeadActivityModel.create({
                leadId: lead._id,
                type: LeadActivityType.INBOUND_WHATSAPP,
                note: `Inbound WhatsApp Message: "${data.text || ''}"`,
                metadata: {
                    waId: data.waId,
                    messageId: data.messageId,
                    senderName: data.senderName,
                    text: data.text
                }
            });
        }

        res.status(200).send("OK");
    } catch (err: any) {
        logger.error("Failed to process WhatsApp webhook", {
            error: err instanceof Error ? err.message : String(err),
        });

        res.status(200).send("Error");
    }
});
