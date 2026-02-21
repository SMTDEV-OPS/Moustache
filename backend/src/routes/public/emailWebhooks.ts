import { Router } from "express";
import multer from "multer";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType, LeadStatus } from "../../models/common";
import { logger } from "../../config/logger";
import { LeadActivityModel, LeadActivityType } from "../../models/leadActivity";
import { LeadModel } from "../../models/lead";
import { GuestModel } from "../../models/guest";

export const publicEmailWebhooksRouter = Router();
const upload = multer(); // Memory storage for parsing form-data

/**
 * Public endpoint for SendGrid Inbound Parse Webhooks
 * Expects multipart/form-data
 */
publicEmailWebhooksRouter.post("/", upload.any(), async (req, res, next) => {
    try {
        const { from, to, subject, text, html } = req.body;

        if (!from) {
            return res.status(200).send("Ignored: Missing from address");
        }

        // SendGrid 'from' looks like "John Doe <john@example.com>"
        const emailMatch = from.match(/<([^>]+)>/);
        const email = emailMatch ? emailMatch[1] : from.trim();
        const namePart = from.split('<')[0].trim() || 'Email Lead';

        let lead;
        try {
            lead = await createLead({
                guestContact: {
                    name: namePart,
                    email: email,
                },
                source: LeadSource.EMAIL,
                leadType: LeadType.STAY, // default
                notes: `Email received: Subject: ${subject || 'N/A'}`,
                assignmentMode: "auto"
            });

            logger.info("Email Lead captured via Webhook", {
                leadId: lead._id.toString(),
                email: email,
            });
        } catch (err: any) {
            // Check if error is due to active lead (duplicate check in leadService.ts)
            if (err.message && err.message.includes("Active lead exists for this guest")) {
                const guest = await GuestModel.findOne({ "contactDetails.email": email });
                if (guest) {
                    lead = await LeadModel.findOne({
                        guestId: guest._id,
                        status: {
                            $nin: [LeadStatus.LOST, LeadStatus.CLOSED_AUTO, LeadStatus.CONFIRMED]
                        }
                    });
                }

                if (!lead) {
                    logger.error("Duplicate lead error caught, but could not locate the active lead for Email append.");
                    return res.status(200).send("Active Lead Found - Append Failed");
                }

                logger.info("Appending Email to existing active lead", { leadId: lead._id.toString() });
            } else {
                logger.error("Failed to process Email webhook lead creation", {
                    error: err.message,
                });
                return res.status(200).send("Error");
            }
        }

        if (lead) {
            // Check for potential attachments (if we wanted to save them later)
            const numAttachments = req.files ? (req.files as any[]).length : parseInt(req.body.attachments || '0', 10);

            await LeadActivityModel.create({
                leadId: lead._id,
                type: LeadActivityType.INBOUND_EMAIL,
                note: `Inbound Email. Subject: ${subject}\n\n${text ? text.slice(0, 500) : 'No plain text body'}`,
                metadata: {
                    from: from,
                    to: to,
                    subject: subject,
                    textBodySnippet: text ? text.slice(0, 1000) : undefined,
                    attachmentCount: numAttachments
                }
            });
        }

        // Always return 200 to SendGrid so they stop retrying
        res.status(200).send("OK");
    } catch (err: any) {
        logger.error("Failed to process Email webhook", {
            error: err instanceof Error ? err.message : String(err),
        });
        res.status(200).send("Error");
    }
});
