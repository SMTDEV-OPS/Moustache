import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { PMSFactory } from "../services/pms/PMSFactory";
import { BookingService } from "../services/bookingService";
import { badRequest, notFound } from "../utils/httpError";

export const pmsRouter = Router();

pmsRouter.use(requireAuth);

const dateSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET Inventory
pmsRouter.get(
    "/:propertyId/inventory",
    async (req, res, next) => {
        try {
            const { propertyId } = req.params;
            const query = dateSchema.safeParse(req.query);

            if (!query.success) {
                throw badRequest("Invalid date range. Use YYYY-MM-DD format.");
            }

            const pms = await PMSFactory.getPMS(propertyId);
            if (!pms) {
                // If no PMS configured, return empty list or handle gracefully
                return res.json([]);
            }

            const inventory = await pms.getInventory(query.data.from, query.data.to);
            res.json(inventory);
        } catch (err) {
            next(err);
        }
    }
);

// GET Rates
pmsRouter.get(
    "/:propertyId/rates",
    async (req, res, next) => {
        try {
            const { propertyId } = req.params;
            const query = dateSchema.safeParse(req.query);

            if (!query.success) {
                throw badRequest("Invalid date range. Use YYYY-MM-DD format.");
            }

            const pms = await PMSFactory.getPMS(propertyId);
            if (!pms) {
                return res.json([]);
            }

            const rates = await pms.getRates(query.data.from, query.data.to);
            res.json(rates);
        } catch (err) {
            next(err);
        }
    }
);

// POST Create Booking
const bookingSchema = z.object({
    leadId: z.string(),
    roomTypeId: z.string(),
    ratePlanId: z.string(),
    checkInDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    checkOutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.number(),
    occupancy: z.object({
        adults: z.number(),
        children: z.number(),
    }),
    guestDetails: z.object({
        firstName: z.string(),
        lastName: z.string(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        city: z.string().optional(),
        country: z.string().optional(),
    }).optional(),
    comments: z.string().optional(),
});

pmsRouter.post(
    "/:propertyId/bookings",
    async (req, res, next) => {
        try {
            const { propertyId } = req.params;
            const body = bookingSchema.safeParse(req.body);

            if (!body.success) {
                throw badRequest("Invalid booking data");
            }

            // We might want to verify propertyId matches lead's property here too, 
            // but BookingService will check logic.

            const result = await BookingService.createBookingFromLead(
                body.data.leadId,
                {
                    ...body.data,
                }
            );

            res.status(201).json(result);
        } catch (err) {
            next(err);
        }
    }
);
