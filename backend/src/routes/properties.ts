import { Router } from "express";
import { z } from "zod";
import { PropertyModel } from "../models/property";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";
import { syncEzeeReservations } from "../jobs/ezeeSync";
import { ReservationModel } from "../models/reservation";

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
  pmsProvider: z.enum(["NONE", "EZEE"]).optional(),
  pmsConfig: z
    .object({
      hotelCode: z.string().optional(),
      authCode: z.string().optional(),
      username: z.string().optional(),
    })
    .optional(),
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

