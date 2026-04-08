import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { QuotationModel } from "../models/quotation";
import { LeadModel } from "../models/lead";
import { PropertyModel } from "../models/property";
import { PaymentLinkModel } from "../models/paymentLink";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { sendEmail, getPrimaryEmailAccount } from "../services/emailService";
import { HttpError, badRequest, notFound } from "../utils/httpError";
import { logger } from "../config/logger";
import { LeadStatus } from "../models/common";
import { handleQuotationResponse } from "../services/clientResponseService";
import { IFactSheetContent } from "../models/knowledgeBase";
import { KnowledgeBaseService } from "../services/knowledgeBaseService";
import { LeadItineraryModel } from "../models/leadItinerary";
import { config } from "../config/env";
import {
  TIER_VISUAL_PALETTE,
  buildQuotationFontFaceCss,
  resolveQuotationFontStacks,
  resolveQuotationTierForProperty,
} from "../constants/quotationVisualBranding";
import {
  buildQuotationStayContext,
  firstItinerary,
} from "../utils/quotationLeadContext";
import { EzeePMSService } from "../services/pms/adapters/EzeePMSService";
import {
  generateQuotationEmailHtml,
  buildQuotationEmailSubject,
  pmsPolicyFieldToEmailBodyHtml,
  pmsPolicyFieldToPlainText,
  type GenerateQuotationEmailOptions,
} from "../utils/quotationEmailTemplate";

export const quotationsRouter = Router();

quotationsRouter.use(requireAuth);

/** Empty strings from JSON forms fail z.email(); treat as absent */
const emptyToUndefined = (v: unknown) =>
  v === "" || v === null || v === undefined ? undefined : v;

/** Coerce JSON numbers or numeric strings; drop null/empty/NaN */
function numberOrUndef(v: unknown): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

const optionalTrimmed = (max: number) =>
  z.preprocess(
    (v) => {
      if (v === null || v === undefined) return undefined;
      if (typeof v === "string") {
        const t = v.trim();
        return t === "" ? undefined : t;
      }
      return v;
    },
    z.string().max(max).optional()
  );

const quotationSchema = z.object({
  rooms: z.preprocess((v) => {
    const n = numberOrUndef(v);
    if (n === undefined) return undefined;
    return Math.trunc(n);
  }, z.number().int().optional()),
  rateLines: z
    .array(
      z.object({
        roomTypeName: z.preprocess(
          (v) => (typeof v === "string" ? v.trim() : v),
          z.string().min(1).max(200)
        ),
        quantity: z.preprocess((v) => {
          const n = numberOrUndef(v);
          if (n === undefined) return undefined;
          return Math.max(1, Math.trunc(n));
        }, z.number().int().min(1)),
        ratePerNight: z.preprocess(numberOrUndef, z.number().min(0)),
        hotelName: optionalTrimmed(300),
      })
    )
    .optional(),
  rate: z.preprocess(numberOrUndef, z.number().optional()),
  taxes: z.preprocess(numberOrUndef, z.number().optional()),
  inclusions: z.preprocess(emptyToUndefined, z.string().optional()),
  specialPackages: z.preprocess(emptyToUndefined, z.string().optional()),
  sentVia: z.enum(["EMAIL", "WHATSAPP"]).optional(),
  sentTo: z
    .object({
      name: optionalTrimmed(300),
      // Do not use .email() here — lead CRM data is often malformed; mail send will fail clearly.
      email: optionalTrimmed(500),
      phone: optionalTrimmed(50),
    })
    .optional(),
  kbFactsheetId: z.string().optional(),
  propertyTier: z.enum(["HOSTEL", "SELECT", "LUXURIA"]).optional(),
});

quotationsRouter.post(
  "/:leadId/quotations",
  async (req, res, next) => {
    try {
      const parsed = quotationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(
          400,
          "Invalid quotation payload",
          "BAD_REQUEST",
          { issues: parsed.error.issues }
        );
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        throw badRequest("User not authenticated");
      }

      const lead = await LeadModel.findById(req.params.leadId);
      if (!lead) {
        throw notFound("Lead not found");
      }

      // Get property details if available
      let property = null;
      if (lead.propertyId) {
        property = await PropertyModel.findById(lead.propertyId).lean();
      }

      const itineraries = await LeadItineraryModel.find({ leadId: lead._id })
        .sort({ createdAt: 1 })
        .lean();

      const firstItin = firstItinerary(itineraries);
      const propertyTier = resolveQuotationTierForProperty(
        property?.tier,
        property?.name,
        firstItin?.hotelName
      );

      let fsRecord: Awaited<
        ReturnType<typeof KnowledgeBaseService.getFactSheetRecordForProperty>
      > = null;
      if (lead.propertyId) {
        fsRecord = await KnowledgeBaseService.getFactSheetRecordForProperty(
          lead.propertyId.toString()
        );
      }

      const last = await QuotationModel.findOne({
        leadId: lead._id,
      })
        .sort({ createdAt: -1 })
        .lean();

      const versionNumber = (last?.versionNumber ?? 0) + 1;

      const quote = await QuotationModel.create({
        leadId: lead._id,
        propertyId: lead.propertyId,
        versionNumber,
        ...parsed.data,
        kbFactsheetId: fsRecord?.kbFactsheetId,
        propertyTier,
        sentAt: new Date(),
      });

      const factsheetForEmail: IFactSheetContent | null = fsRecord?.content ?? null;

      const stay = buildQuotationStayContext(
        lead,
        itineraries,
        property,
        parsed.data.rooms ??
          (parsed.data.rateLines?.reduce((sum, l) => sum + (l.quantity ?? 0), 0) || 1)
      );

      const palette = TIER_VISUAL_PALETTE[stay.tier];
      const fontStacks = resolveQuotationFontStacks(stay.propertyLabel, stay.tier);
      const fontFaceCss = buildQuotationFontFaceCss(config.quotationFontCdnBase);

      let pmsPolicySections:
        | { title: string; bodyHtml: string }[]
        | undefined;
      let pmsPolicyPlainAppend = "";
      if (
        property &&
        property.pmsProvider === "EZEE" &&
        property.pmsConfig?.hotelCode?.trim() &&
        property.pmsConfig?.authCode?.trim()
      ) {
        try {
          const ezee = new EzeePMSService({
            hotelCode: property.pmsConfig.hotelCode.trim(),
            authCode: property.pmsConfig.authCode.trim(),
          });
          const rawPolicies = await ezee.getQuotationPolicySections();
          if (rawPolicies.length > 0) {
            pmsPolicySections = rawPolicies.map((s) => ({
              title: s.title,
              bodyHtml: pmsPolicyFieldToEmailBodyHtml(s.body),
            }));
            pmsPolicyPlainAppend =
              "\n\n--- Hotel policies (from booking system) ---\n" +
              rawPolicies
                .map(
                  (s) =>
                    `${s.title}:\n${pmsPolicyFieldToPlainText(s.body)}`
                )
                .join("\n\n");
          }
        } catch (polErr) {
          logger.warn("Quotation: could not load PMS hotel policies", {
            leadId: lead._id,
            propertyId: lead.propertyId,
            error: polErr instanceof Error ? polErr.message : polErr,
          });
        }
      }

      // Send email if sentVia is EMAIL and we have an email address
      if (parsed.data.sentVia === "EMAIL" && parsed.data.sentTo?.email) {
        try {
          const primaryAccount = await getPrimaryEmailAccount(userId);
          if (primaryAccount) {
            const propertyName = stay.propertyLabel;
            const nights = (() => {
              const cin =
                itineraries?.[0]?.checkInDate ??
                (lead.checkIn ? new Date(lead.checkIn) : undefined);
              const cout =
                itineraries?.[0]?.checkOutDate ??
                (lead.checkOut ? new Date(lead.checkOut) : undefined);
              if (!cin || !cout) return 1;
              const diff = Math.ceil(
                (new Date(cout).getTime() - new Date(cin).getTime()) /
                  (1000 * 60 * 60 * 24)
              );
              return diff > 0 ? diff : 1;
            })();
            const quoteForEmail: GenerateQuotationEmailOptions["quote"] = {
              ...parsed.data,
              sentTo: parsed.data.sentTo,
              nights,
            };
            const emailHtml = generateQuotationEmailHtml({
              quote: quoteForEmail,
              stay,
              leadNumber: lead.leadNumber,
              versionNumber,
              factsheet: factsheetForEmail,
              pmsPolicySections,
              fontFaceCss,
              primaryFont: fontStacks.primaryStack,
              secondaryFont: fontStacks.secondaryStack,
              palette,
            });

            const subject = buildQuotationEmailSubject(
              stay.propertyLabel,
              lead.leadNumber,
              stay.checkInDisplay,
              stay.checkOutDisplay
            );

            await sendEmail(primaryAccount._id.toString(), {
              to: [{ 
                email: parsed.data.sentTo.email, 
                name: parsed.data.sentTo.name 
              }],
              subject,
              bodyHtml: emailHtml,
              bodyText: `Dear ${parsed.data.sentTo.name || "Guest"},\n\nPlease find your quotation for ${propertyName}.\n\nQuotation Reference: QT-${lead.leadNumber}-V${versionNumber}\nProperty: ${propertyName}\nCheck-in: ${stay.checkInDisplay}\nCheck-out: ${stay.checkOutDisplay}\nRooms: ${stay.roomsLine}\nGuests: ${stay.guestsLine}\n${
                parsed.data.rateLines?.length
                  ? `Room rates:\n${parsed.data.rateLines
                      .map(
                        (l) =>
                          `- ${l.quantity} x ${l.roomTypeName}: ₹${Math.round(
                            l.ratePerNight || 0
                          )}/night`
                      )
                      .join("\n")}\nNights: ${nights}`
                  : `Rate: ₹${parsed.data.rate || 0}`
              }\nTaxes: ₹${parsed.data.taxes || 0}${pmsPolicyPlainAppend}\n\nWarm regards,\nThe ${propertyName} Team`,
            });

            logger.info("Quotation email sent successfully", {
              leadId: lead._id,
              quotationId: quote._id,
              to: parsed.data.sentTo.email,
            });
          } else {
            logger.warn("No primary email account found for user, quotation saved but not sent via email", {
              userId,
              leadId: lead._id,
            });
          }
        } catch (emailError) {
          logger.error("Failed to send quotation email", {
            error: emailError instanceof Error ? emailError.message : emailError,
            leadId: lead._id,
            quotationId: quote._id,
          });
          // Don't fail the request, quotation is still saved
        }
      }

      // TODO: Implement WhatsApp sending when sentVia is WHATSAPP

      // Auto-create 50% advance payment link when quotation is shared
      try {
        const nights = (() => {
          const cin =
            itineraries?.[0]?.checkInDate ??
            (lead.checkIn ? new Date(lead.checkIn) : undefined);
          const cout =
            itineraries?.[0]?.checkOutDate ??
            (lead.checkOut ? new Date(lead.checkOut) : undefined);
          if (!cin || !cout) return 1;
          const diff = Math.ceil(
            (new Date(cout).getTime() - new Date(cin).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          return diff > 0 ? diff : 1;
        })();
        const rooms =
          parsed.data.rooms ||
          parsed.data.rateLines?.reduce((sum, l) => sum + (l.quantity ?? 0), 0) ||
          1;
        const rate = parsed.data.rate || 0;
        const taxes = parsed.data.taxes || 0;
        const subtotalFromLines = parsed.data.rateLines?.length
          ? parsed.data.rateLines.reduce(
              (sum, l) => sum + (l.ratePerNight || 0) * (l.quantity || 1) * nights,
              0
            )
          : undefined;
        const totalAmount =
          (subtotalFromLines ?? rate * rooms * nights) + taxes;
        const advanceAmount = totalAmount * 0.5; // 50% advance

        if (advanceAmount > 0) {
          const paymentLink = await PaymentLinkModel.create({
            leadId: lead._id,
            guestId: lead.guestId,
            gateway: "RAZORPAY", // Default gateway, can be configured later
            amount: advanceAmount,
            currency: "INR",
            status: "CREATED",
          });

          logger.info("Auto-created 50% advance payment link", {
            leadId: lead._id,
            paymentLinkId: paymentLink._id,
            amount: advanceAmount,
            totalAmount,
          });
        }
      } catch (paymentLinkError) {
        logger.error("Failed to auto-create payment link", {
          error: paymentLinkError instanceof Error ? paymentLinkError.message : paymentLinkError,
          leadId: lead._id,
        });
        // Don't fail the request, quotation is still saved
      }

      // Update lead status to QUOTATION_SHARED
      lead.status = LeadStatus.QUOTATION_SHARED;
      await lead.save();

      await LeadActivityModel.create({
        leadId: lead._id,
        type: LeadActivityType.QUOTE_SENT,
        performedByUserId: userId,
        note: `Quotation V${versionNumber} sent via ${parsed.data.sentVia || "system"}`,
        performedAt: new Date(),
      });

      res.status(201).json(quote);
    } catch (err) {
      next(err);
    }
  }
);

quotationsRouter.get(
  "/:leadId/quotations",
  async (req, res, next) => {
    try {
      const quotes = await QuotationModel.find({
        leadId: req.params.leadId,
      })
        .sort({ createdAt: -1 })
        .lean();
      res.json(quotes);
    } catch (err) {
      next(err);
    }
  }
);

const statusUpdateSchema = z.object({
  status: z.enum(["SENT", "REVISED", "ACCEPTED", "REJECTED"]),
});

quotationsRouter.patch(
  "/:leadId/quotations/:quotationId",
  async (req, res, next) => {
    try {
      const parsed = statusUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid status update payload");
      }

      const quote = await QuotationModel.findOneAndUpdate(
        {
          _id: req.params.quotationId,
          leadId: req.params.leadId,
        },
        { $set: { status: parsed.data.status } },
        { new: true }
      ).lean();

      if (!quote) {
        throw notFound("Quotation not found");
      }

      // Handle quotation response (ACCEPTED/REJECTED) - creates activity and notification
      if (parsed.data.status === "ACCEPTED" || parsed.data.status === "REJECTED") {
        await handleQuotationResponse(
          req.params.leadId,
          req.params.quotationId,
          parsed.data.status,
          req.user?.id
        );
      } else {
        // For other status changes, just log activity
        await LeadActivityModel.create({
          leadId: req.params.leadId,
          type: LeadActivityType.QUOTE_SENT,
          performedByUserId: req.user?.id,
          note: `Quotation status updated to ${parsed.data.status}`,
          performedAt: new Date(),
        });
      }

      res.json(quote);
    } catch (err) {
      next(err);
    }
  }
);


