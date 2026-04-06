import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { QuotationModel } from "../models/quotation";
import { LeadModel } from "../models/lead";
import { PropertyModel } from "../models/property";
import { PaymentLinkModel } from "../models/paymentLink";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { sendEmail, getPrimaryEmailAccount } from "../services/emailService";
import { badRequest, notFound } from "../utils/httpError";
import { logger } from "../config/logger";
import { LeadStatus } from "../models/common";
import { handleQuotationResponse } from "../services/clientResponseService";
import { IFactSheetContent } from "../models/knowledgeBase";
import { KnowledgeBaseService } from "../services/knowledgeBaseService";

export const quotationsRouter = Router();

quotationsRouter.use(requireAuth);

const quotationSchema = z.object({
  rooms: z.number().int().optional(),
  rate: z.number().optional(),
  taxes: z.number().optional(),
  inclusions: z.string().optional(),
  specialPackages: z.string().optional(),
  sentVia: z.enum(["EMAIL", "WHATSAPP"]).optional(),
  sentTo: z
    .object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    })
    .optional(),
  kbFactsheetId: z.string().optional(),
  propertyTier: z.enum(["HOSTEL", "SELECT", "LUXURIA"]).optional(),
});

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const TIER_BRANDING = {
  LUXURIA: {
    headerBg: "#2C1810",
    headerAccent: "#C9A84C",
    accentColor: "#C9A84C",
    lightBg: "#F5F0E8",
    bodyFont: "'Georgia', 'Times New Roman', serif",
    tagline: "An exceptional experience awaits",
    borderColor: "#C9A84C",
    totalBg: "#2C1810",
    inclusionBg: "#F5F0E8",
    inclusionHeading: "#2C1810",
    specialHeading: "#2C1810",
  },
  SELECT: {
    headerBg: "#1A2E42",
    headerAccent: "#4A7BAB",
    accentColor: "#2C4A6E",
    lightBg: "#F8F6F2",
    bodyFont: "'Helvetica Neue', Arial, sans-serif",
    tagline: "Curated comfort, thoughtfully designed",
    borderColor: "#2C4A6E",
    totalBg: "#2C4A6E",
    inclusionBg: "#F8F6F2",
    inclusionHeading: "#1A2E42",
    specialHeading: "#1A2E42",
  },
  HOSTEL: {
    headerBg: "#0A1F15",
    headerAccent: "#52B788",
    accentColor: "#1B4332",
    lightBg: "#F9F7F4",
    bodyFont: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    tagline: "Where travellers become friends",
    borderColor: "#1B4332",
    totalBg: "#1B4332",
    inclusionBg: "#F9F7F4",
    inclusionHeading: "#0A1F15",
    specialHeading: "#0A1F15",
  },
} as const;

function getPropertyBranding(tier: string) {
  const t = tier === "LUXURIA" || tier === "SELECT" || tier === "HOSTEL" ? tier : "SELECT";
  return TIER_BRANDING[t];
}

function buildPropertyHighlightsHtml(
  factsheet: IFactSheetContent,
  b: ReturnType<typeof getPropertyBranding>
): string {
  const attractions = (factsheet.nearbyAttractions ?? []).slice(0, 3);
  const rules = (factsheet.inHouseRules ?? []).slice(0, 4);
  const ci = factsheet.checkInTime;
  const co = factsheet.checkOutTime;
  const poc = factsheet.pocDetails;

  const parts: string[] = [];
  if (attractions.length > 0) {
    parts.push(
      `<h3 style="color:${b.inclusionHeading};margin-top:0;">Nearby</h3><ul style="margin:0;padding-left:20px;">${attractions
        .map((a) => `<li style="padding:4px 0;">${escapeHtml(a)}</li>`)
        .join("")}</ul>`
    );
  }
  if (ci || co) {
    parts.push(
      `<p style="margin:12px 0 0 0;"><strong>Check-in / Check-out:</strong> ${escapeHtml(ci || "—")} / ${escapeHtml(co || "—")}</p>`
    );
  }
  if (rules.length > 0) {
    parts.push(
      `<h3 style="color:${b.inclusionHeading};margin-top:16px;">House rules</h3><ul style="margin:0;padding-left:20px;">${rules
        .map((r) => `<li style="padding:4px 0;">${escapeHtml(r)}</li>`)
        .join("")}</ul>`
    );
  }

  if (parts.length === 0) {
    return "";
  }

  return `
      <div class="highlights" style="background:${b.inclusionBg};border-radius:8px;padding:20px;margin:20px 0;border:1px solid ${b.borderColor};">
        <h3 style="color:${b.accentColor};margin-top:0;">Property highlights</h3>
        ${parts.join("")}
      </div>`;
}

function buildPocFooterHtml(factsheet: IFactSheetContent): string {
  const p = factsheet.pocDetails;
  if (!p) return "";
  const lines: string[] = [];
  if (p.frontDeskPhone) lines.push(`Front desk: ${escapeHtml(p.frontDeskPhone)}`);
  if (p.frontDeskEmail) lines.push(`Email: ${escapeHtml(p.frontDeskEmail)}`);
  if (p.gmName) lines.push(`GM: ${escapeHtml(p.gmName)}`);
  if (p.gmPhone) lines.push(`GM phone: ${escapeHtml(p.gmPhone)}`);
  if (lines.length === 0) return "";
  return `<p style="margin-top:12px;font-size:13px;">${lines.join(" · ")}</p>`;
}

const generateQuotationEmailHtml = (
  quote: {
    rooms?: number;
    rate?: number;
    taxes?: number;
    inclusions?: string;
    specialPackages?: string;
    sentTo?: { name?: string; email?: string; phone?: string };
  },
  lead: { leadNumber?: string; checkInDate?: Date; checkOutDate?: Date },
  property: { name?: string } | null,
  versionNumber: number,
  tier: string,
  factsheet: IFactSheetContent | null
) => {
  const rooms = quote.rooms || 1;
  const rate = quote.rate || 0;
  const taxes = quote.taxes || 0;
  const total = rate * rooms + taxes;

  const checkInDate = lead.checkInDate
    ? new Date(lead.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const checkOutDate = lead.checkOutDate
    ? new Date(lead.checkOutDate).toLocaleDateString("en-IN", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  const propertyName = escapeHtml(property?.name || "Our Property");
  const b = getPropertyBranding(tier);

  const inclusionsHtml = quote.inclusions
    ? `
      <div class="inclusions" style="background:${b.inclusionBg};border-radius:8px;padding:20px;margin:20px 0;border:1px solid ${b.borderColor};">
        <h3 style="color:${b.inclusionHeading};margin-top:0;">✓ Inclusions</h3>
        <ul style="margin:0;padding-left:20px;">
          ${quote.inclusions
            .split("\n")
            .filter((line) => line.trim())
            .map((item) => `<li style="padding:5px 0;">${escapeHtml(item.trim())}</li>`)
            .join("")}
        </ul>
      </div>`
    : "";

  const specialHtml = quote.specialPackages
    ? `
      <div class="special-packages" style="background:${b.lightBg};border-radius:8px;padding:20px;margin:20px 0;border:1px dashed ${b.borderColor};">
        <h3 style="color:${b.specialHeading};margin-top:0;">Special packages</h3>
        <p style="margin:0;">${escapeHtml(quote.specialPackages).replace(/\n/g, "<br>")}</p>
      </div>`
    : "";

  const highlightsHtml =
    factsheet && Object.keys(factsheet).length > 0
      ? buildPropertyHighlightsHtml(factsheet, b)
      : "";

  const pocFooter = factsheet ? buildPocFooterHtml(factsheet) : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation for ${propertyName}</title>
  <style>
    body { font-family: ${b.bodyFont}; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: ${b.lightBg}; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: ${b.headerBg}; color: #fff; padding: 30px; text-align: center; border-bottom: 4px solid ${b.headerAccent}; }
    .header h1 { margin: 0; font-size: 28px; color: #fff; }
    .header .tagline { margin: 10px 0 0 0; opacity: 0.95; color: ${b.headerAccent}; font-size: 14px; }
    .content { padding: 30px; background: #fff; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .quote-box { background: ${b.lightBg}; border-radius: 10px; padding: 25px; margin: 20px 0; border-left: 4px solid ${b.borderColor}; }
    .quote-title { font-size: 20px; font-weight: bold; color: ${b.accentColor}; margin-bottom: 15px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #333; }
    .total-row { background: ${b.totalBg}; color: white; padding: 15px; border-radius: 8px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 18px; }
    .footer { background: ${b.lightBg}; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; border-top: 1px solid ${b.borderColor}; }
    .version-badge { display: inline-block; background: ${b.accentColor}; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${propertyName}</h1>
      <p class="tagline">${escapeHtml(b.tagline)}</p>
    </div>

    <div class="content">
      <p class="greeting">Dear ${escapeHtml(quote.sentTo?.name || "Valued Guest")},</p>

      <p>Thank you for your interest in ${propertyName}. We are delighted to present you with this personalized quotation for your upcoming stay.</p>

      <div class="quote-box">
        <div class="quote-title">
          Quotation Details
          <span class="version-badge">Version ${versionNumber}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Lead Reference</span>
          <span class="detail-value">#${escapeHtml(String(lead.leadNumber ?? ""))}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Check-in Date</span>
          <span class="detail-value">${escapeHtml(checkInDate)}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Check-out Date</span>
          <span class="detail-value">${escapeHtml(checkOutDate)}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Number of Rooms</span>
          <span class="detail-value">${rooms}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Rate per Room/Night</span>
          <span class="detail-value">${formatCurrency(rate)}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Taxes & Fees</span>
          <span class="detail-value">${formatCurrency(taxes)}</span>
        </div>

        <div class="total-row">
          <span>Total Amount</span>
          <span>${formatCurrency(total)}</span>
        </div>
      </div>

      ${inclusionsHtml}

      ${specialHtml}

      ${highlightsHtml}

      <p>This quotation is valid for 7 days. To confirm your booking or if you have any questions, please don't hesitate to contact us.</p>

      <p>We look forward to welcoming you!</p>

      <p>Warm regards,<br>The ${propertyName} Team</p>
    </div>

    <div class="footer">
      <p>This is an automated quotation email. Please do not reply directly to this email.</p>
      <p>Quotation Reference: QT-${escapeHtml(String(lead.leadNumber ?? ""))}-V${versionNumber}</p>
      ${pocFooter}
    </div>
  </div>
</body>
</html>
`;
};

quotationsRouter.post(
  "/:leadId/quotations",
  async (req, res, next) => {
    try {
      const parsed = quotationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid quotation payload");
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

      const propertyTier =
        property?.tier === "HOSTEL" ||
        property?.tier === "SELECT" ||
        property?.tier === "LUXURIA"
          ? property.tier
          : "SELECT";

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

      // Send email if sentVia is EMAIL and we have an email address
      if (parsed.data.sentVia === "EMAIL" && parsed.data.sentTo?.email) {
        try {
          const primaryAccount = await getPrimaryEmailAccount(userId);
          if (primaryAccount) {
            const propertyName = property?.name || "Our Property";
            const emailHtml = generateQuotationEmailHtml(
              { ...parsed.data, sentTo: parsed.data.sentTo },
              lead,
              property,
              versionNumber,
              propertyTier,
              factsheetForEmail
            );

            await sendEmail(primaryAccount._id.toString(), {
              to: [{ 
                email: parsed.data.sentTo.email, 
                name: parsed.data.sentTo.name 
              }],
              subject: `Quotation for ${propertyName} - Ref: ${lead.leadNumber}`,
              bodyHtml: emailHtml,
              bodyText: `Dear ${parsed.data.sentTo.name || "Guest"},\n\nPlease find attached your quotation for ${propertyName}.\n\nQuotation Reference: QT-${lead.leadNumber}-V${versionNumber}\nRooms: ${parsed.data.rooms || 1}\nRate: ₹${parsed.data.rate || 0}\nTaxes: ₹${parsed.data.taxes || 0}\n\nThank you for choosing us!\n\nWarm regards,\nThe ${propertyName} Team`,
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
        const rooms = parsed.data.rooms || 1;
        const rate = parsed.data.rate || 0;
        const taxes = parsed.data.taxes || 0;
        const totalAmount = (rate * rooms) + taxes;
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


