import { Router } from "express";
import { z } from "zod";
import { PropertyModel } from "../models/property";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { syncEzeeReservations } from "../jobs/ezeeSync";
import { ReservationModel } from "../models/reservation";
import { EzeePMSService } from "../services/pms/adapters/EzeePMSService";
import { logger } from "../config/logger";

export const propertiesRouter = Router();

propertiesRouter.use(requireAuth);

const propertySchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1),
  location: z
    .object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
    })
    .optional(),
  title: z.string().optional(), // Allow title if it exists on frontend form (sometimes it does)
  timeZone: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  tier: z.enum(["HOSTEL", "SELECT", "LUXURIA"]).optional(),
  branding: z
    .object({
      primaryFont: z.string().optional(),
      secondaryFont: z.string().optional(),
      colorScheme: z
        .object({
          primary: z.string().optional(),
          accent: z.string().optional(),
          background: z.string().optional(),
          text: z.string().optional(),
        })
        .optional(),
    })
    .optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  mapLocation: z.string().optional(),
  pmsProvider: z.enum(["NONE", "EZEE"]).optional(),
  pmsConfig: z
    .object({
      hotelCode: z.string().optional(),
      authCode: z.string().optional(),
      username: z.string().optional(),
    })
    .optional(),
  roomCategories: z.array(z.string()).optional(),
});

propertiesRouter.get("/", async (_req, res, next) => {
  try {
    const properties = await PropertyModel.find().lean();
    res.json(properties);
  } catch (err) {
    next(err);
  }
});

propertiesRouter.post(
  "/",
  requirePermissions(["properties.manage"]),
  async (req, res, next) => {
    try {
      const parsed = propertySchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid property payload");
      }
      const property = await PropertyModel.create(parsed.data);
      res.status(201).json(property);
    } catch (err) {
      next(err);
    }
  }
);

propertiesRouter.patch(
  "/:id",
  requirePermissions(["properties.manage"]),
  async (req, res, next) => {
    try {
      const parsed = propertySchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid property update payload");
      }
      const property = await PropertyModel.findByIdAndUpdate(
        req.params.id,
        { $set: parsed.data },
        { new: true }
      ).lean();
      if (!property) {
        throw notFound("Property not found");
      }
      res.json(property);
    } catch (err) {
      next(err);
    }
  }
);

const ezeeRatesQuerySchema = z.object({
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

// GET /properties/:id/ezee-rates — eZee rate suggestions (before GET /:id for clarity)
propertiesRouter.get("/:id/ezee-rates", async (req, res, next) => {
  try {
    const parsedQuery = ezeeRatesQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      throw badRequest("checkIn and checkOut query params (YYYY-MM-DD) are required");
    }

    const property = await PropertyModel.findById(req.params.id).lean();
    if (!property) {
      throw notFound("Property not found");
    }

    if (
      property.pmsProvider !== "EZEE" ||
      !property.pmsConfig?.hotelCode ||
      !property.pmsConfig?.authCode
    ) {
      return res.json({
        available: false,
        rates: [] as Array<{ roomType: string; rate: number; currency: "INR" }>,
        message: "PMS not configured",
      });
    }

    try {
      const ezee = new EzeePMSService({
        hotelCode: property.pmsConfig.hotelCode,
        authCode: property.pmsConfig.authCode,
      });

      const [rates, catalog] = await Promise.all([
        ezee.getRates(parsedQuery.data.checkIn, parsedQuery.data.checkOut),
        ezee.getRoomMasterCatalog(),
      ]);

      const nameByRoomTypeId = new Map<string, string>();
      if (catalog?.roomTypes) {
        for (const rt of catalog.roomTypes) {
          nameByRoomTypeId.set(rt.roomTypeId, rt.roomTypeName);
        }
      }

      const byRoom = new Map<string, number>();
      for (const r of rates) {
        const prev = byRoom.get(r.roomTypeId);
        const val = r.baseRate;
        if (prev === undefined || val > prev) {
          byRoom.set(r.roomTypeId, val);
        }
      }

      const out: Array<{ roomType: string; rate: number; currency: "INR" }> = [];
      for (const [roomTypeId, rate] of byRoom.entries()) {
        out.push({
          roomType: nameByRoomTypeId.get(roomTypeId) ?? `Room ${roomTypeId}`,
          rate,
          currency: "INR",
        });
      }

      if (out.length === 0) {
        return res.json({
          available: false,
          rates: [],
          message: "No rates returned for this date range",
        });
      }

      return res.json({ available: true, rates: out });
    } catch (e) {
      logger.warn("Ezee rates fetch failed", {
        propertyId: req.params.id,
        error: e instanceof Error ? e.message : e,
      });
      return res.json({
        available: false,
        rates: [] as Array<{ roomType: string; rate: number; currency: "INR" }>,
        message: "Unable to load rates from PMS",
      });
    }
  } catch (err) {
    next(err);
  }
});

propertiesRouter.get("/:id", async (req, res, next) => {
  try {
    const property = await PropertyModel.findById(req.params.id).lean();
    if (!property) {
      throw notFound("Property not found");
    }
    res.json(property);
  } catch (err) {
    next(err);
  }
});

propertiesRouter.delete(
  "/:id",
  requirePermissions(["properties.manage"]),
  async (req, res, next) => {
    try {
      const property = await PropertyModel.findByIdAndDelete(req.params.id).lean();
      if (!property) {
        throw notFound("Property not found");
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

propertiesRouter.post(
  "/:id/sync-pms",
  requirePermissions(["properties.manage"]),
  async (req, res, next) => {
    try {
      const property = await PropertyModel.findById(req.params.id).lean();
      if (!property) {
        throw notFound("Property not found");
      }

      if (property.pmsProvider !== "EZEE" || !property.pmsConfig?.hotelCode) {
        throw badRequest("Property does not have EZEE PMS configured");
      }

      const result = await syncEzeeReservations(req.params.id);
      res.json({ synced: result.synced, created: result.created, updated: result.updated });
    } catch (err) {
      next(err);
    }
  }
);

propertiesRouter.get("/:id/reservations", async (req, res, next) => {
  try {
    const property = await PropertyModel.findById(req.params.id).lean();
    if (!property) {
      throw notFound("Property not found");
    }

    const querySchema = z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      status: z
        .enum(["CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "CANCELLED", "AMENDED"])
        .optional(),
    });

    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw badRequest("Invalid query params");
    }

    const filter: Record<string, any> = { propertyId: property._id };
    if (parsed.data.status) filter.status = parsed.data.status;
    if (parsed.data.from || parsed.data.to) {
      filter.checkInDate = {};
      if (parsed.data.from) filter.checkInDate.$gte = new Date(parsed.data.from);
      if (parsed.data.to) filter.checkInDate.$lte = new Date(parsed.data.to);
    }

    const reservations = await ReservationModel.find(filter)
      .sort({ checkInDate: 1 })
      .populate("guestId", "name phone")
      .populate("leadId", "_id")
      .lean();
    res.json(reservations);
  } catch (err) {
    next(err);
  }
});

