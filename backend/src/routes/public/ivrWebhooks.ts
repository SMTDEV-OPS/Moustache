import { Router } from "express";
import { z } from "zod";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType } from "../../models/common";
import { badRequest } from "../../utils/httpError";
import { logger } from "../../config/logger";
import { LeadActivityModel, LeadActivityType } from "../../models/leadActivity";

export const publicIvrWebhooksRouter = Router();

// Exotel generic incoming call payload
const ivrPayloadSchema = z.object({
    CallSid: z.string().optional(),
    From: z.string().min(1, "Caller number is required"),
    To: z.string().optional(),
    Digits: z.string().optional(),
    Direction: z.string().optional(),
    RecordingUrl: z.string().url().optional(),
});

/**
 * Public endpoint for IVR/CTI webhooks
 * Standard Exotel / generic IVR webhook
 */
publicIvrWebhooksRouter.post("/", async (req, res, next) => {
    try {
        const parsed = ivrPayloadSchema.safeParse(req.query.Digits ? req.query : req.body);
        if (!parsed.success) {
            throw badRequest(
                `Invalid IVR payload: ${parsed.error.errors.map((e) => e.message).join(", ")}`
            );
        }

        const data = parsed.data;

        // Only capture if customer pressed 1 for Sales, or if no digits configured but it's an inbound call
        if (data.Digits === "1" || data.Digits === '"1"') {
            const lead = await createLead({
                guestContact: {
                    name: `IVR Caller ${data.From.slice(-4)}`,
                    phone: data.From,
                },
                source: LeadSource.IVR,
                leadType: LeadType.STAY, // default
                notes: `Captured from IVR via webhook. Call SID: ${data.CallSid || 'N/A'}${data.RecordingUrl ? '. Recording: ' + data.RecordingUrl : ''}`,
                assignmentMode: "auto",
                // Additional references could be saved if schema supported it
            });

            await LeadActivityModel.create({
                leadId: lead._id,
                type: LeadActivityType.INBOUND_CALL,
                note: `Incoming IVR Call. Call SID: ${data.CallSid || 'N/A'}`,
                metadata: {
                    callSid: data.CallSid,
                    recordingUrl: data.RecordingUrl,
                    fromNumber: data.From,
                    direction: data.Direction
                }
            });

            logger.info("IVR Lead captured", {
                leadId: lead._id.toString(),
                leadNumber: lead.leadNumber,
                phone: data.From,
            });

            return res.status(200).send("OK");
        }

        // Acknowledge receipt even if not captured (e.g. didn't press 1)
        res.status(200).send("Ignored");
    } catch (err) {
        logger.error("Failed to process IVR webhook", {
            error: err instanceof Error ? err.message : String(err),
        });
        // Return 200 so the IVR provider doesn't retry
        res.status(200).send("Error");
    }
});
