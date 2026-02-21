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

export interface ParsedEmailData {
    fromName: string | null;
    fromEmail: string | null;
    subject: string | null;
    body: string;
}

export interface ExtractedLeadInfo {
    name?: string;
    phone?: string;
    email?: string;
    checkInDate?: string;      // ISO date string e.g. "2025-06-15"
    checkOutDate?: string;     // ISO date string e.g. "2025-06-18"
    numberOfGuests?: number;
    roomCategory?: string;
    occasion?: string;
    specialRequests?: string;
    isHotelEnquiry: boolean;   // Whether the email is actually a hotel booking enquiry
}

/**
 * Use an LLM (Google Gemini via REST, no SDK needed) to extract
 * structured lead data from raw email text.
 */
async function extractWithLLM(emailData: ParsedEmailData): Promise<ExtractedLeadInfo> {
    const geminiApiKey = process.env.GEMINI_API_KEY;
    const openAiApiKey = process.env.OPENAI_API_KEY;

    const prompt = buildExtractionPrompt(emailData);

    // Try Gemini first (free tier available), then fall back to OpenAI
    if (geminiApiKey) {
        return callGemini(prompt, geminiApiKey);
    } else if (openAiApiKey) {
        return callOpenAI(prompt, openAiApiKey);
    } else {
        logger.warn("[EmailLeadParser] No LLM API key configured. Falling back to basic extraction.");
        return basicExtraction(emailData);
    }
}

function buildExtractionPrompt(emailData: ParsedEmailData): string {
    return `You are a hotel CRM assistant. Your job is to analyze hotel booking inquiry emails and extract structured information.

Analyze the following email and extract lead information. Return ONLY valid JSON, no markdown, no explanation.

Email From: ${emailData.fromName || "Unknown"} <${emailData.fromEmail || "unknown@email.com"}>
Subject: ${emailData.subject || "(no subject)"}
Body:
---
${emailData.body.slice(0, 3000)}
---

Return this exact JSON structure (use null for any field you cannot determine):
{
  "isHotelEnquiry": true or false,
  "name": "Full name of the guest or null",
  "phone": "Phone number with country code or null",
  "email": "Email address or null",
  "checkInDate": "YYYY-MM-DD format or null",
  "checkOutDate": "YYYY-MM-DD format or null",
  "numberOfGuests": integer or null,
  "roomCategory": "e.g. Deluxe, Suite, Standard or null",
  "occasion": "e.g. Anniversary, Birthday, Honeymoon or null",
  "specialRequests": "Any special requests mentioned or null"
}

Only set isHotelEnquiry to true if this is clearly a hotel booking/stay/availability inquiry.
If it is spam, promotional, or unrelated, set isHotelEnquiry to false.`;
}

async function callGemini(prompt: string, apiKey: string): Promise<ExtractedLeadInfo> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 500,
                responseMimeType: "application/json",
            },
        }),
    });

    if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    return JSON.parse(rawText) as ExtractedLeadInfo;
}

async function callOpenAI(prompt: string, apiKey: string): Promise<ExtractedLeadInfo> {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.1,
            response_format: { type: "json_object" },
        }),
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const rawText = data?.choices?.[0]?.message?.content ?? "{}";
    return JSON.parse(rawText) as ExtractedLeadInfo;
}

/**
 * Basic rule-based extraction fallback (no LLM).
 * Uses regex to detect phone numbers and dates.
 */
function basicExtraction(emailData: ParsedEmailData): ExtractedLeadInfo {
    const body = emailData.body.toLowerCase();

    // If no hotel-related keywords → not an enquiry
    const hotelKeywords = ["check-in", "check in", "booking", "room", "stay", "nights", "reservation", "hotel", "resort"];
    const isHotelEnquiry = hotelKeywords.some((k) => body.includes(k));

    const phoneMatch = emailData.body.match(/(\+?\d[\d\s\-().]{7,14}\d)/);
    const dateMatch = emailData.body.match(/\b(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\b/g);

    return {
        isHotelEnquiry,
        name: emailData.fromName || undefined,
        email: emailData.fromEmail || undefined,
        phone: phoneMatch?.[0] ?? undefined,
        checkInDate: dateMatch?.[0] ?? undefined,
        checkOutDate: dateMatch?.[1] ?? undefined,
    };
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

        // 1. Extract structured data using LLM
        const extracted = await extractWithLLM(emailData);

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
                checkInDate,
                checkOutDate,
                roomCategory: extracted.roomCategory || undefined,
                occasion: extracted.occasion || undefined,
                specialRequests: extracted.specialRequests || undefined,
                roomsRequested: extracted.numberOfGuests ? Math.ceil(extracted.numberOfGuests / 2) : undefined,
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
