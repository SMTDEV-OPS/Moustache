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
import { LeadItineraryModel } from "../models/leadItinerary";

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
  bookingDetails: z
    .object({
      checkInDate: z.string().optional(),
      checkOutDate: z.string().optional(),
      nights: z.number().optional(),
      adults: z.number().optional(),
      children: z.number().optional(),
      occasion: z.string().optional(),
      specialRequests: z.string().optional(),
      bookingSource: z.string().optional(),
      roomDetails: z
        .array(
          z.object({
            roomCategory: z.string().optional(),
            roomPreference: z.string().optional(),
            numberOfGuests: z.string().optional(),
          })
        )
        .optional(),
      hotels: z
        .array(
          z.object({
            hotelName: z.string().optional(),
            checkInDate: z.string().optional(),
            checkOutDate: z.string().optional(),
            rooms: z
              .array(
                z.object({
                  roomCategory: z.string().optional(),
                  roomPreference: z.string().optional(),
                  numberOfGuests: z.string().optional(),
                })
              )
              .optional(),
          })
        )
        .optional(),
    })
    .optional(),
});

// Helper function to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
  }).format(amount);
};

// Helper function to generate quotation email HTML
const generateQuotationEmailHtml = (
  quote: any,
  lead: any,
  property: any,
  versionNumber: number,
  itinerary: any
) => {
  const rooms = quote.rooms || 1;
  const rate = quote.rate || 0;
  const taxes = quote.taxes || 0;
  const total = (rate * rooms) + taxes;

  const checkInDate = itinerary?.checkInDate
    ? new Date(itinerary.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : quote?.bookingDetails?.checkInDate
    ? new Date(quote.bookingDetails.checkInDate).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : lead.checkInDate
    ? new Date(lead.checkInDate).toLocaleDateString("en-IN", { 
        weekday: "long", year: "numeric", month: "long", day: "numeric" 
      })
    : "To be confirmed";
  
  const checkOutDate = itinerary?.checkOutDate
    ? new Date(itinerary.checkOutDate).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : quote?.bookingDetails?.checkOutDate
    ? new Date(quote.bookingDetails.checkOutDate).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : lead.checkOutDate
    ? new Date(lead.checkOutDate).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric"
      })
    : "To be confirmed";

  const propertyName = property?.name || "Our Property";
  const leadContact = lead?.contactDetails || {};
  const quoteHotels = Array.isArray(quote?.bookingDetails?.hotels)
    ? quote.bookingDetails.hotels
    : [];
  const itineraryRooms = Array.isArray(itinerary?.rooms)
    ? itinerary.rooms
    : quoteHotels[0]?.rooms && Array.isArray(quoteHotels[0].rooms)
    ? quoteHotels[0].rooms
    : Array.isArray(quote?.bookingDetails?.roomDetails)
    ? quote.bookingDetails.roomDetails
    : [];
  const hotelSummary =
    quoteHotels.length > 0
      ? quoteHotels
          .map((hotel: any, idx: number) => {
            const inDate = hotel?.checkInDate ? new Date(hotel.checkInDate).toLocaleDateString("en-IN") : "N/A";
            const outDate = hotel?.checkOutDate ? new Date(hotel.checkOutDate).toLocaleDateString("en-IN") : "N/A";
            return `<li>Hotel ${idx + 1}: ${hotel?.hotelName || "N/A"} | ${inDate} - ${outDate}</li>`;
          })
          .join("")
      : "<li>No hotel-level details available</li>";
  const roomSummary =
    itineraryRooms.length > 0
      ? itineraryRooms
          .map((room: any, idx: number) => {
            const parts = [
              `Room ${idx + 1}`,
              room?.roomCategory ? `Category: ${room.roomCategory}` : "",
              room?.roomPreference ? `Preference: ${room.roomPreference}` : "",
              room?.numberOfGuests ? `Guests: ${room.numberOfGuests}` : "",
            ].filter(Boolean);
            return `<li>${parts.join(" | ")}</li>`;
          })
          .join("")
      : "<li>Standard room details to be confirmed</li>";

  const adults = quote?.bookingDetails?.adults ?? lead?.guests?.adults ?? 0;
  const children = quote?.bookingDetails?.children ?? lead?.guests?.children ?? 0;
  const totalGuests = `${adults} Adults${children ? `, ${children} Children` : ""}`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quotation for ${propertyName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { margin: 0; font-size: 28px; }
    .header p { margin: 10px 0 0 0; opacity: 0.9; }
    .content { padding: 30px; }
    .greeting { font-size: 18px; margin-bottom: 20px; }
    .quote-box { background: #f8f9fa; border-radius: 10px; padding: 25px; margin: 20px 0; border-left: 4px solid #667eea; }
    .quote-title { font-size: 20px; font-weight: bold; color: #667eea; margin-bottom: 15px; }
    .detail-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .detail-row:last-child { border-bottom: none; }
    .detail-label { color: #666; }
    .detail-value { font-weight: 600; color: #333; }
    .total-row { background: #667eea; color: white; padding: 15px; border-radius: 8px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 18px; }
    .inclusions { background: #e8f5e9; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .inclusions h3 { color: #2e7d32; margin-top: 0; }
    .inclusions ul { margin: 0; padding-left: 20px; }
    .inclusions li { padding: 5px 0; }
    .special-packages { background: #fff3e0; border-radius: 8px; padding: 20px; margin: 20px 0; }
    .special-packages h3 { color: #ef6c00; margin-top: 0; }
    .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; font-weight: bold; margin: 20px 0; }
    .footer { background: #f8f9fa; padding: 20px 30px; text-align: center; color: #666; font-size: 14px; }
    .version-badge { display: inline-block; background: #667eea; color: white; padding: 3px 10px; border-radius: 15px; font-size: 12px; margin-left: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${propertyName}</h1>
      <p>Your Personalized Quotation</p>
    </div>
    
    <div class="content">
      <p class="greeting">Dear ${quote.sentTo?.name || "Valued Guest"},</p>
      
      <p>Thank you for your interest in ${propertyName}. We are delighted to present you with this personalized quotation for your upcoming stay.</p>
      
      <div class="quote-box">
        <div class="quote-title">
          Quotation Details
          <span class="version-badge">Version ${versionNumber}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Lead Reference</span>
          <span class="detail-value">#${lead.leadNumber}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Check-in Date</span>
          <span class="detail-value">${checkInDate}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Check-out Date</span>
          <span class="detail-value">${checkOutDate}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Guest Name</span>
          <span class="detail-value">${leadContact?.name || quote.sentTo?.name || "To be confirmed"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Guest Email</span>
          <span class="detail-value">${leadContact?.email || quote.sentTo?.email || "To be confirmed"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Guest Phone</span>
          <span class="detail-value">${leadContact?.phone || quote.sentTo?.phone || "To be confirmed"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Guests</span>
          <span class="detail-value">${totalGuests}</span>
        </div>
        
        <div class="detail-row">
          <span class="detail-label">Number of Rooms</span>
          <span class="detail-value">${rooms}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Lead Source</span>
          <span class="detail-value">${lead?.source || "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Lead Type</span>
          <span class="detail-value">${lead?.leadType || "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Booking Window</span>
          <span class="detail-value">${lead?.bookingWindow || "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Customer Type</span>
          <span class="detail-value">${lead?.customerType || "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Estimated Budget</span>
          <span class="detail-value">${lead?.budget ? formatCurrency(Number(lead.budget)) : "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Occasion</span>
          <span class="detail-value">${quote?.bookingDetails?.occasion || lead?.occasion || "N/A"}</span>
        </div>

        <div class="detail-row">
          <span class="detail-label">Booking Source</span>
          <span class="detail-value">${quote?.bookingDetails?.bookingSource || lead?.bookingSource || "N/A"}</span>
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
      
      ${quote.inclusions ? `
      <div class="inclusions">
        <h3>✓ Inclusions</h3>
        <ul>
          ${quote.inclusions.split('\n').map((item: string) => `<li>${item.trim()}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="inclusions">
        <h3>🛏️ Booking Details</h3>
        <ul>
          ${hotelSummary}
          ${roomSummary}
        </ul>
      </div>
      
      ${quote.specialPackages ? `
      <div class="special-packages">
        <h3>🎁 Special Packages</h3>
        <p>${quote.specialPackages.replace(/\n/g, '<br>')}</p>
      </div>
      ` : ''}

      ${(lead?.specialRequests || lead?.occasion || lead?.isCorporateBooking) ? `
      <div class="special-packages">
        <h3>📌 Lead Notes</h3>
        <p>
          ${(quote?.bookingDetails?.occasion || lead?.occasion) ? `<strong>Occasion:</strong> ${quote?.bookingDetails?.occasion || lead?.occasion}<br>` : ""}
          ${(quote?.bookingDetails?.specialRequests || lead?.specialRequests) ? `<strong>Special Requests:</strong> ${quote?.bookingDetails?.specialRequests || lead?.specialRequests}<br>` : ""}
          ${lead?.isCorporateBooking ? `<strong>Corporate Booking:</strong> Yes${lead?.companyName ? ` (${lead.companyName})` : ""}` : ""}
        </p>
      </div>
      ` : ""}
      
      <p>This quotation is valid for 7 days. To confirm your booking or if you have any questions, please don't hesitate to contact us.</p>
      
      <p>We look forward to welcoming you!</p>
      
      <p>Warm regards,<br>The ${propertyName} Team</p>
    </div>
    
    <div class="footer">
      <p>This is an automated quotation email. Please do not reply directly to this email.</p>
      <p>Quotation Reference: QT-${lead.leadNumber}-V${versionNumber}</p>
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
      const itinerary = await LeadItineraryModel.findOne({ leadId: lead._id })
        .sort({ createdAt: 1 })
        .lean();

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
        sentAt: new Date(),
      });

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
              itinerary
            );

            await sendEmail(primaryAccount._id.toString(), {
              to: [{ 
                email: parsed.data.sentTo.email, 
                name: parsed.data.sentTo.name 
              }],
              subject: `Quotation for ${propertyName} - Ref: ${lead.leadNumber}`,
              bodyHtml: emailHtml,
              bodyText: `Dear ${parsed.data.sentTo.name || lead.contactDetails?.name || "Guest"},\n\nPlease find your quotation for ${propertyName}.\n\nQuotation Reference: QT-${lead.leadNumber}-V${versionNumber}\nLead Source: ${lead.source || "N/A"}\nLead Type: ${lead.leadType || "N/A"}\nBooking Window: ${lead.bookingWindow || "N/A"}\nCustomer Type: ${lead.customerType || "N/A"}\nRooms: ${parsed.data.rooms || 1}\nRate: ₹${parsed.data.rate || 0}\nTaxes: ₹${parsed.data.taxes || 0}\nGuest Email: ${lead.contactDetails?.email || parsed.data.sentTo.email || "N/A"}\nGuest Phone: ${lead.contactDetails?.phone || parsed.data.sentTo.phone || "N/A"}\n\nThank you for choosing us!\n\nWarm regards,\nThe ${propertyName} Team`,
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


