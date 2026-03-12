/**
 * Email Lead Parser Service
 *
 * Receives raw email bodies (from IMAP sync or webhooks) and uses an LLM
 * to extract structured lead data, then calls createLead().
 *
 * Flow:
 *   IMAP Inbox Email
 *       ↓
 *   extractLeadDataFromEmail()  ← LLM (Gemini/OpenAI)
 *       ↓
 *   createLead()
 *       ↓
 *   LeadActivityModel (INBOUND_EMAIL)
 */

import { logger } from "../config/logger";
import { createLead } from "./leadService";
import { LeadSource, LeadType, LeadStatus } from "../models/common";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { LeadModel } from "../models/lead";
import { GuestModel } from "../models/guest";

import { extractLeadDataWithLLM, ExtractedLeadInfo } from "./llmService";

export interface ParsedEmailData {
    fromName: string | null;
    fromEmail: string | null;
    subject: string | null;
    body: string;
}

/**
 * Main entry point — called by the emailService after each new INBOX message is synced.
 *
 * @param emailData  Parsed email data (from, subject, body)
 * @param emailMessageId  MongoDB _id of the stored EmailMessage (for activity linking)
 */
export async function processInboundEmailForLeads(
    emailData: ParsedEmailData,
    emailMessageId?: string
): Promise<void> {
    try {
        logger.info("[EmailLeadParser] Processing inbound email for lead extraction", {
            from: emailData.fromEmail,
            subject: emailData.subject,
        });

        const fullText = `Email From: ${emailData.fromName || "Unknown"} <${emailData.fromEmail || "unknown@email.com"}>\nSubject: ${emailData.subject || "(no subject)"}\nBody:\n---\n${emailData.body}`;

        // 1. Extract structured data using reusable LLM Service
        const extracted = await extractLeadDataWithLLM(fullText, 'EMAIL');

        // 2. Skip if the LLM says this is NOT a hotel enquiry at all
        if (!extracted.isHotelEnquiry) {
            logger.info("[EmailLeadParser] Email is not a hotel enquiry, skipping.", {
                from: emailData.fromEmail,
                subject: emailData.subject,
            });
            return;
        }

        const guestEmail = extracted.email || emailData.fromEmail;
        const guestName = extracted.name || emailData.fromName || `Email Contact`;

        // 3. Try to check in/out dates
        const checkInDate = extracted.checkInDate ? new Date(extracted.checkInDate) : undefined;
        const checkOutDate = extracted.checkOutDate ? new Date(extracted.checkOutDate) : undefined;

        let lead;
        try {
            // 4. Call the Lead Ingestion Service
            lead = await createLead({
                guestContact: {
                    name: guestName,
                    email: guestEmail || undefined,
                    phone: extracted.phone || undefined,
                },
                source: LeadSource.EMAIL,
                leadType: LeadType.STAY,
                hotels: checkInDate || checkOutDate ? [{
                    checkInDate: checkInDate,
                    checkOutDate: checkOutDate,
                    roomCategory: extracted.roomCategory || undefined,
                    numberOfGuests: extracted.numberOfGuests ? String(extracted.numberOfGuests) : undefined,
                }] : undefined,
                customData: extracted.occasion ? { occasion: extracted.occasion } : undefined,
                specialRequests: extracted.specialRequests || undefined,
                notes: `Captured from inbound email.\nSubject: ${emailData.subject || "N/A"}\n\nExtracted via AI: ${JSON.stringify(extracted, null, 2)}`,
                assignmentMode: "auto",
            });

            logger.info("[EmailLeadParser] New lead created from email", {
                leadId: lead._id.toString(),
                leadNumber: lead.leadNumber,
                fromEmail: guestEmail,
            });
        } catch (err: any) {
            if (err.message?.includes("Active lead exists for this guest")) {
                // 5. Duplicate — find the existing lead and append the email as an activity
                const guest = guestEmail
                    ? await GuestModel.findOne({ "contactDetails.email": guestEmail })
                    : null;

                if (guest) {
                    lead = await LeadModel.findOne({
                        guestId: guest._id,
                        status: { $nin: [LeadStatus.LOST, LeadStatus.CLOSED_AUTO, LeadStatus.CONFIRMED] },
                    });
                }

                if (lead) {
                    logger.info("[EmailLeadParser] Appending email to existing lead", {
                        leadId: lead._id.toString(),
                    });
                } else {
                    logger.warn("[EmailLeadParser] Could not find active lead for duplicate email.", {
                        fromEmail: guestEmail,
                    });
                    return;
                }
            } else {
                throw err;
            }
        }

        // 6. Append a unified timeline activity to the lead (always)
        if (lead) {
            await LeadActivityModel.create({
                leadId: lead._id,
                type: LeadActivityType.INBOUND_EMAIL,
                note: `Inbound Email. Subject: "${emailData.subject}"\nAI Extracted: ${JSON.stringify(extracted, null, 2)}`,
                metadata: {
                    from: emailData.fromEmail,
                    fromName: emailData.fromName,
                    subject: emailData.subject,
                    bodySnippet: emailData.body?.slice(0, 500),
                    emailMessageId,
                    extracted,
                },
            });
        }
    } catch (err) {
        logger.error("[EmailLeadParser] Failed to process email for lead", {
            from: emailData.fromEmail,
            subject: emailData.subject,
            error: err instanceof Error ? err.message : String(err),
        });
        // Do not throw — email sync should continue even if lead parsing fails for one email
    }
}
