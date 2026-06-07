import { Router } from "express";
import { z } from "zod";
import { createLead } from "../../services/leadService";
import { LeadSource, LeadType } from "../../models/common";
import { badRequest } from "../../utils/httpError";
import { logger } from "../../config/logger";
import { LeadActivityModel, LeadActivityType } from "../../models/leadActivity";
import { UserModel } from "../../models/user";
import { LeadModel } from "../../models/lead";
import { LeadStatus } from "../../models/common";
import util from "util";
import { normalizePhone } from "../../utils/phoneUtils";

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

// Custom IVR payload (as provided)
const customIvrPayloadSchema = z.object({
    uuid: z.string().optional(),
    call_to_number: z.string().optional(),
    caller_id_number: z.string().min(1, "caller_id_number is required"),
    start_stamp: z.string().optional(),
    answer_stamp: z.string().optional(),
    end_stamp: z.string().optional(),
    hangup_cause: z.string().optional(),
    billsec: z.union([z.string(), z.number()]).optional(),
    digits_dialed: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional(),
    direction: z.string().optional(),
    duration: z.union([z.string(), z.number()]).optional(),
    answered_agent: z
        .union([
            z.string(),
            z
                .object({
                    name: z.string().optional(),
                    number: z.string().optional(),
                    num: z.string().optional(),
                    agent_number: z.string().optional(),
                })
                .passthrough(),
        ])
        .optional(),
    missed_agent: z.any().optional(),
    call_flow: z.any().optional(),
    broadcast_lead_fields: z.any().optional(),
    recording_url: z.string().optional(),
    call_status: z.string().optional(),
    call_id: z.string().optional(),
    outbound_sec: z.union([z.string(), z.number()]).optional(),
    agent_ring_time: z.union([z.string(), z.number()]).optional(),
    billing_circle: z.string().optional(),
    start_date: z.string().optional(),
    start_time: z.string().optional(),
    call_connected: z.union([z.string(), z.boolean(), z.number()]).optional(),
    broadcast_name: z.string().optional(),
    broadcast_id: z.string().optional(),
    bridged_duration: z.union([z.string(), z.number()]).optional(),
});

function escapeRegex(input: string): string {
    return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSingle(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) return normalizeSingle(value[0]);
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return undefined;
}

function isTruthyFlag(value: unknown): boolean {
    const v = normalizeSingle(value);
    if (!v) return false;
    return ["1", "true", "yes", "y", "answered", "connected"].includes(v.toLowerCase());
}

function normalizeDigitsDialed(value: unknown): string | undefined {
    if (value === null || value === undefined) return undefined;
    if (Array.isArray(value)) {
        const out = value
            .map((x) => normalizeSingle(x))
            .filter((x): x is string => Boolean(x))
            .join("");
        return out.length ? out : undefined;
    }
    return normalizeSingle(value);
}

function extractAnsweredAgentName(value: unknown): string | undefined {
    const direct = normalizeSingle(value);
    if (direct) return direct;
    if (value && typeof value === "object" && !Array.isArray(value)) {
        const maybeName = (value as any).name;
        return normalizeSingle(maybeName);
    }
    return undefined;
}

function safeJsonStringify(value: unknown): string | undefined {
    try {
        return JSON.stringify(
            value,
            (_k, v) => {
                if (typeof v === "bigint") return v.toString();
                if (v instanceof Map) return Object.fromEntries(v.entries());
                if (v instanceof Set) return Array.from(v.values());
                return v;
            },
            2
        );
    } catch {
        return undefined;
    }
}

function sanitizeHeaders(headers: Record<string, any> | undefined): Record<string, any> | undefined {
    if (!headers) return undefined;
    const out: Record<string, any> = { ...headers };
    for (const k of Object.keys(out)) {
        const key = k.toLowerCase();
        if (["authorization", "cookie", "set-cookie", "x-api-key"].includes(key)) {
            out[k] = "[redacted]";
        }
    }
    return out;
}

function extractAnsweredAgentPhone(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string") return undefined;
    if (typeof value === "object" && !Array.isArray(value)) {
        const obj = value as any;
        return (
            normalizeSingle(obj.agent_number) ||
            normalizeSingle(obj.number) ||
            normalizeSingle(obj.num)
        );
    }
    return undefined;
}

function digitsOnly(value: string | undefined): string | undefined {
    if (!value) return undefined;
    const d = value.replace(/\D/g, "");
    return d.length ? d : undefined;
}

/**
 * Public endpoint for IVR/CTI webhooks
 * Standard Exotel / generic IVR webhook
 */
publicIvrWebhooksRouter.post("/", async (req, res, next) => {
    try {
        // Some providers send data in querystring, some in body, some both (and sometimes body is a JSON string).
        let parsedBody: any = req.body;
        if (typeof parsedBody === "string") {
            try {
                parsedBody = JSON.parse(parsedBody);
            } catch {
                // keep original string
            }
        }

        const mergedPayload: any = { ...(req.query as any), ...(parsedBody as any) };

        logger.info("IVR webhook received", {
            contentType: req.header("content-type"),
            userAgent: req.header("user-agent"),
            bodyType: typeof req.body,
            hasBody: req.body !== undefined && req.body !== null,
            bodyKeys: req.body && typeof req.body === "object" ? Object.keys(req.body as any) : undefined,
            queryKeys: req.query && typeof req.query === "object" ? Object.keys(req.query as any) : undefined,
            mergedKeys: mergedPayload && typeof mergedPayload === "object" ? Object.keys(mergedPayload) : undefined,
            headers: sanitizeHeaders(req.headers as any),
            body: req.body,
            query: req.query,
        });

        // Full-fidelity payload dump for debugging (nested arrays/objects won’t collapse to [Object])
        const mergedPayloadJson = safeJsonStringify(mergedPayload);
        logger.info("IVR webhook payload (full)", {
            mergedPayloadJson,
            mergedPayloadInspect: mergedPayloadJson ? undefined : util.inspect(mergedPayload, { depth: null, maxArrayLength: null }),
        });

        const customParsed = customIvrPayloadSchema.safeParse(mergedPayload);
        const exotelParsed = ivrPayloadSchema.safeParse(
            (req.query as any).Digits ? req.query : mergedPayload
        );

        const isCustom = customParsed.success;
        const isExotel = exotelParsed.success;

        if (!isCustom && !isExotel) {
            const customErr = customParsed.success ? undefined : customParsed.error;
            const exotelErr = exotelParsed.success ? undefined : exotelParsed.error;
            logger.warn("IVR webhook payload validation failed", {
                customErrors: customErr?.errors,
                exotelErrors: exotelErr?.errors,
                mergedPayload,
            });
            throw badRequest(
                `Invalid IVR payload: ${[
                    customErr ? `custom(${customErr.errors.map((e) => e.message).join(", ")})` : null,
                    exotelErr ? `exotel(${exotelErr.errors.map((e) => e.message).join(", ")})` : null,
                ]
                    .filter(Boolean)
                    .join(" | ")}`
            );
        }

        // Backwards compatible: old Exotel payload behavior
        if (isExotel && !isCustom) {
            const data = exotelParsed.data;

            // Only capture if customer pressed 1 for Sales
            if (data.Digits === "1" || data.Digits === '"1"') {
                const lead = await createLead({
                    guestContact: {
                        name: `IVR Caller ${data.From.slice(-4)}`,
                        phone: data.From,
                    },
                    source: LeadSource.IVR,
                    leadType: LeadType.STAY,
                    notes: `Captured from IVR via webhook. Call SID: ${data.CallSid || "N/A"}${
                        data.RecordingUrl ? ". Recording: " + data.RecordingUrl : ""
                    }`,
                    assignmentMode: "auto",
                });

                await LeadActivityModel.create({
                    leadId: lead._id,
                    type: LeadActivityType.INBOUND_CALL,
                    note: `Incoming IVR Call. Call SID: ${data.CallSid || "N/A"}`,
                    metadata: {
                        provider: "exotel",
                        callSid: data.CallSid,
                        recordingUrl: data.RecordingUrl,
                        fromNumber: data.From,
                        direction: data.Direction,
                        raw: mergedPayload,
                    },
                });

                logger.info("IVR lead created (exotel)", {
                    leadId: lead._id.toString(),
                    leadNumber: lead.leadNumber,
                    phone: data.From,
                });

                return res.status(200).send("OK");
            }

            return res.status(200).send("Ignored");
        }

        // Custom payload: create lead and attempt to assign to answered_agent (case-insensitive match)
        const data = customParsed.success ? customParsed.data : (customIvrPayloadSchema.parse(mergedPayload) as any);

        const callerPhoneRaw = normalizeSingle((data as any).caller_id_number) || "UNKNOWN";
        const callerPhoneNormalized = callerPhoneRaw !== "UNKNOWN" ? normalizePhone(callerPhoneRaw) : null;
        const callerPhone = callerPhoneNormalized || callerPhoneRaw;
        const answeredAgentName = extractAnsweredAgentName((data as any).answered_agent);
        const answeredAgentPhoneRaw = extractAnsweredAgentPhone((data as any).answered_agent);
        const answeredAgentPhoneNormalized = normalizePhone(answeredAgentPhoneRaw || undefined);
        const digitsDialed = normalizeDigitsDialed((data as any).digits_dialed);

        let assignedToUserId: string | undefined;
        if (answeredAgentPhoneNormalized || answeredAgentName) {
            const agentLast10 = digitsOnly(answeredAgentPhoneNormalized || answeredAgentPhoneRaw)?.slice(-10);

            const user = await UserModel.findOne({
                status: "ACTIVE",
                $or: [
                    ...(answeredAgentPhoneNormalized ? [{ phone: answeredAgentPhoneNormalized }] : []),
                    ...(agentLast10 ? [{ phone: { $regex: new RegExp(`${escapeRegex(agentLast10)}$`) } }] : []),
                    ...(answeredAgentName
                        ? [{ name: { $regex: new RegExp(`^${escapeRegex(answeredAgentName)}$`, "i") } }]
                        : []),
                ],
            })
                .select("_id name email status phone")
                .lean();

            if (user?._id) {
                assignedToUserId = String(user._id);
                logger.info("IVR webhook matched answered_agent to user", {
                    answeredAgentName,
                    answeredAgentPhone: answeredAgentPhoneNormalized || answeredAgentPhoneRaw,
                    matchedUserId: assignedToUserId,
                    matchedUserName: (user as any).name,
                    matchedUserPhone: (user as any).phone,
                });
            } else {
                logger.warn("IVR webhook could not match answered_agent to any ACTIVE user", {
                    answeredAgentName,
                    answeredAgentPhone: answeredAgentPhoneNormalized || answeredAgentPhoneRaw,
                });
            }
        } else {
            logger.warn("IVR webhook missing answered_agent; falling back to auto assignment", {
                callerPhone,
            });
        }

        const shouldCreateLead =
            !!callerPhone &&
            (isTruthyFlag((data as any).call_connected) ||
                !!normalizeSingle((data as any).answer_stamp) ||
                !!answeredAgentName ||
                isTruthyFlag((data as any).call_status));

        if (!shouldCreateLead) {
            logger.info("IVR webhook ignored (custom): call not connected/answered", {
                callerPhone,
                call_status: normalizeSingle((data as any).call_status),
                call_connected: normalizeSingle((data as any).call_connected),
                answer_stamp: normalizeSingle((data as any).answer_stamp),
                answered_agent: answeredAgentName,
            });
            return res.status(200).send("Ignored");
        }

        let lead = await (async () => {
            try {
                return await createLead({
                    guestContact: {
                        name: `IVR Caller ${callerPhone === "UNKNOWN" ? "Unknown" : callerPhone.slice(-4)}`,
                        phone: callerPhone === "UNKNOWN" ? undefined : callerPhone,
                    },
                    source: LeadSource.IVR,
                    leadType: LeadType.STAY,
                    notes: [
                        "Captured from IVR via webhook.",
                        (data as any).call_id ? `Call ID: ${(data as any).call_id}` : null,
                        (data as any).uuid ? `UUID: ${(data as any).uuid}` : null,
                        digitsDialed ? `Digits: ${digitsDialed}` : null,
                        answeredAgentName ? `Answered Agent: ${answeredAgentName}` : null,
                        (answeredAgentPhoneNormalized || answeredAgentPhoneRaw)
                            ? `Agent Phone: ${answeredAgentPhoneNormalized || answeredAgentPhoneRaw}`
                            : null,
                        normalizeSingle((data as any).recording_url) ? `Recording: ${normalizeSingle((data as any).recording_url)}` : null,
                        normalizeSingle((data as any).hangup_cause) ? `Hangup: ${normalizeSingle((data as any).hangup_cause)}` : null,
                    ]
                        .filter(Boolean)
                        .join(" "),
                    assignmentMode: assignedToUserId ? "manual" : "auto",
                    assignedToUserId,
                    customData: {
                        ivr: data,
                    },
                });
            } catch (e) {
                const msg = e instanceof Error ? e.message : String(e);
                const existingLeadId = (e as any)?.meta?.existingLeadId ?? (e as any)?.details?.existingLeadId;
                if (msg.includes("already has an active lead")) {
                    logger.info("IVR webhook: guest already has active lead; attaching activity instead of creating new lead", {
                        callerPhone,
                        existingLeadId: existingLeadId ?? null,
                        call_id: (data as any).call_id,
                        uuid: (data as any).uuid,
                    });

                    const existing = await (async () => {
                        if (existingLeadId) {
                            return await LeadModel.findById(existingLeadId).exec();
                        }
                        if (callerPhone && callerPhone !== "UNKNOWN") {
                            return await LeadModel.findOne({
                                "contactDetails.phone": callerPhone,
                                status: {
                                    $nin: [LeadStatus.LOST, LeadStatus.CLOSED_AUTO, LeadStatus.CONFIRMED, LeadStatus.CANCELLED],
                                },
                            })
                                .sort({ createdAt: -1 })
                                .exec();
                        }
                        return null;
                    })();

                    if (!existing) throw e;
                    return existing as any;
                }
                throw e;
            }
        })();

        await LeadActivityModel.create({
            leadId: lead._id,
            type: LeadActivityType.INBOUND_CALL,
            note: `Incoming IVR Call${(data as any).call_id ? `. Call ID: ${(data as any).call_id}` : ""}`,
            metadata: {
                provider: "custom",
                caller_id_number: (data as any).caller_id_number,
                call_to_number: (data as any).call_to_number,
                direction: (data as any).direction,
                digits_dialed: digitsDialed,
                answered_agent: (data as any).answered_agent,
                answered_agent_name: answeredAgentName,
                answered_agent_phone: answeredAgentPhoneNormalized || answeredAgentPhoneRaw,
                missed_agent: (data as any).missed_agent,
                recording_url: (data as any).recording_url,
                call_status: (data as any).call_status,
                call_connected: (data as any).call_connected,
                raw: data,
            },
        });

        logger.info("IVR lead created (custom)", {
            leadId: lead._id.toString(),
            leadNumber: (lead as any).leadNumber,
            callerPhone,
            assignedToUserId: assignedToUserId ?? null,
        });

        return res.status(200).send("OK");
    } catch (err) {
        logger.error("Failed to process IVR webhook", {
            error: err instanceof Error ? err.message : String(err),
            body: req.body,
            query: req.query,
        });
        // Return 200 so the IVR provider doesn't retry
        res.status(200).send("Error");
    }
});
