import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { ReservationModel } from "../models/reservation";
import { LeadModel } from "../models/lead";
import { badRequest, notFound } from "../utils/httpError";
import { sendConfirmationLetter } from "../services/confirmationLetterService";

export const reservationsRouter = Router();

reservationsRouter.use(requireAuth);

const reservationSchema = z.object({
  leadId: z.string(),
  pmsReservationId: z.string().optional(),
  checkInDate: z.string().datetime(),
  checkOutDate: z.string().datetime(),
  roomsBooked: z.number().int().optional(),
  ratePlan: z.string().optional(),
  totalAmount: z.number().optional(),
});

reservationsRouter.post("/", async (req, res, next) => {
  try {
    const parsed = reservationSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid reservation payload");
    }

    const lead = await LeadModel.findById(parsed.data.leadId);
    if (!lead) {
      throw badRequest("Lead not found for reservation");
    }

    const reservation = await ReservationModel.create({
      leadId: lead._id,
      guestId: lead.guestId,
      propertyId: lead.propertyId,
      pmsReservationId: parsed.data.pmsReservationId,
      checkInDate: new Date(parsed.data.checkInDate),
      checkOutDate: new Date(parsed.data.checkOutDate),
      roomsBooked: parsed.data.roomsBooked,
      ratePlan: parsed.data.ratePlan,
      totalAmount: parsed.data.totalAmount,
    });

    res.status(201).json(reservation);
  } catch (err) {
    next(err);
  }
});

reservationsRouter.get("/", async (req, res, next) => {
  try {
    const { propertyId, fromDate, toDate, guestId } = req.query;
    const filter: Record<string, unknown> = {};

    if (propertyId) filter.propertyId = propertyId;
    if (guestId) filter.guestId = guestId;

    if (fromDate || toDate) {
      filter.checkInDate = {};
      if (fromDate)
        (filter.checkInDate as any).$gte = new Date(
          String(fromDate)
        );
      if (toDate)
        (filter.checkInDate as any).$lte = new Date(String(toDate));
    }

    const reservations = await ReservationModel.find(filter)
      .sort({ checkInDate: 1 })
      .lean();
    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

// Send confirmation letter for a reservation
const sendConfirmationSchema = z.object({
  preferredChannel: z.enum(["EMAIL", "WHATSAPP"]).optional(),
});

reservationsRouter.post(
  "/:id/send-confirmation",
  async (req, res, next) => {
    try {
      const parsed = sendConfirmationSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid confirmation payload");
      }

      const reservation = await ReservationModel.findById(req.params.id);
      if (!reservation) {
        throw notFound("Reservation not found");
      }

      const userId = (req as any).user?.id;
      if (!userId) {
        throw badRequest("User not authenticated");
      }

      await sendConfirmationLetter(
        req.params.id,
        userId,
        parsed.data.preferredChannel
      );

      res.json({ message: "Confirmation letter sent successfully" });
    } catch (err) {
      next(err);
    }
  }
);



