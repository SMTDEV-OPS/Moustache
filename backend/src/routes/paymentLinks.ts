import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { PaymentLinkModel } from "../models/paymentLink";
import { LeadModel } from "../models/lead";
import { ReservationModel } from "../models/reservation";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { badRequest, notFound } from "../utils/httpError";
import { LeadStatus } from "../models/common";
import { logger } from "../config/logger";
import { sendConfirmationLetter } from "../services/confirmationLetterService";

export const paymentLinksRouter = Router();

paymentLinksRouter.use(requireAuth);

const createPaymentLinkSchema = z.object({
  gateway: z.enum(["RAZORPAY", "PAYU", "HDFC", "OTHER"]),
  amount: z.number(),
  currency: z.string().default("INR"),
});

// GET payment links for a lead
paymentLinksRouter.get(
  "/:leadId/payment-links",
  async (req, res, next) => {
    try {
      const lead = await LeadModel.findById(req.params.leadId);
      if (!lead) {
        throw notFound("Lead not found");
      }

      const links = await PaymentLinkModel.find({ leadId: lead._id })
        .sort({ createdAt: -1 })
        .lean();

      res.json(links);
    } catch (err) {
      next(err);
    }
  }
);

paymentLinksRouter.post(
  "/:leadId/payment-links",
  async (req, res, next) => {
    try {
      const parsed = createPaymentLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid payment link payload");
      }

      const lead = await LeadModel.findById(req.params.leadId);
      if (!lead) {
        throw notFound("Lead not found");
      }

      const link = await PaymentLinkModel.create({
        leadId: lead._id,
        guestId: lead.guestId,
        gateway: parsed.data.gateway,
        amount: parsed.data.amount,
        currency: parsed.data.currency,
      });

      await LeadActivityModel.create({
        leadId: lead._id,
        type: LeadActivityType.PAYMENT_LINK_SENT,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });

      res.status(201).json(link);
    } catch (err) {
      next(err);
    }
  }
);

const updateStatusSchema = z.object({
  status: z.enum([
    "CREATED",
    "SENT",
    "PARTIALLY_PAID",
    "PAID",
    "EXPIRED",
    "FAILED",
  ]),
});

paymentLinksRouter.patch(
  "/payment-links/:id/status",
  async (req, res, next) => {
    try {
      const parsed = updateStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid status payload");
      }

      const link = await PaymentLinkModel.findById(req.params.id);
      if (!link) {
        throw notFound("Payment link not found");
      }

      const oldStatus = link.status;
      link.status = parsed.data.status;
      if (
        parsed.data.status === "PAID" ||
        parsed.data.status === "PARTIALLY_PAID"
      ) {
        link.paidAt = new Date();
      }
      await link.save();

      // Get lead to update status
      const lead = await LeadModel.findById(link.leadId);
      if (!lead) {
        throw notFound("Lead not found");
      }

      // Handle payment status changes
      if (parsed.data.status === "PARTIALLY_PAID") {
        // Calculate pending amount
        const totalPaid = link.paymentBreakup?.reduce(
          (sum, p) => sum + (p.amount || 0),
          0
        ) || 0;
        const pendingAmount = link.amount - totalPaid;

        // Update lead status to ON_HOLD and store pending amount
        lead.status = LeadStatus.ON_HOLD;
        lead.pendingAmount = pendingAmount;
        await lead.save();

        logger.info("Payment partially received, lead marked as ON_HOLD", {
          leadId: lead._id,
          paymentLinkId: link._id,
          paidAmount: totalPaid,
          pendingAmount,
        });
      } else if (parsed.data.status === "PAID" && oldStatus !== "PAID") {
        // Full payment received - mark as CONFIRMED and create reservation
        lead.status = LeadStatus.CONFIRMED;
        lead.pendingAmount = 0;
        await lead.save();

        const { LeadItineraryModel } = await import("../models/leadItinerary");
        const itineraries = await LeadItineraryModel.find({ leadId: lead._id }).sort({ checkInDate: 1 }).lean();
        const primaryItinerary = itineraries[0];

        // Create reservation record
        if (primaryItinerary && primaryItinerary.checkInDate && primaryItinerary.checkOutDate) {
          const reservation = await ReservationModel.create({
            leadId: lead._id,
            guestId: lead.guestId,
            propertyId: lead.propertyId,
            checkInDate: primaryItinerary.checkInDate,
            checkOutDate: primaryItinerary.checkOutDate,
            roomsBooked: primaryItinerary.numberOfGuests ? Math.ceil(Number(primaryItinerary.numberOfGuests) / 2) : 1,
            totalAmount: link.amount,
            status: "CONFIRMED",
          });

          logger.info("Full payment received, reservation created", {
            leadId: lead._id,
            paymentLinkId: link._id,
            reservationId: reservation._id,
          });

          // Send confirmation letter
          try {
            const userId = (req as any).user?.id || lead.assignedToUserId?.toString();
            if (userId) {
              await sendConfirmationLetter(reservation._id.toString(), userId);
            }
          } catch (confirmationError) {
            logger.error("Failed to send confirmation letter", {
              reservationId: reservation._id,
              leadId: lead._id,
            }, confirmationError instanceof Error ? confirmationError : new Error(String(confirmationError)));
            // Don't fail the payment update if confirmation fails
          }
        }

        // TODO: Trigger confirmation letter sending (will be implemented in confirmation-letter todo)
      }

      await LeadActivityModel.create({
        leadId: link.leadId,
        type: LeadActivityType.PAYMENT_RECEIVED,
        performedByUserId: req.user?.id,
        note: `Payment status changed from ${oldStatus} to ${parsed.data.status}`,
        performedAt: new Date(),
      });

      res.json(link);
    } catch (err) {
      next(err);
    }
  }
);



