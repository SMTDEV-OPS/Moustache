import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { PMSFactory } from "../services/pms/PMSFactory";
import type { RoomMasterCatalog } from "../services/pms/IPMSService";
import { BookingService } from "../services/bookingService";
import { badRequest, notFound } from "../utils/httpError";
import { PMSRoomCatalogueModel, IRoomType, IRatePlan } from "../models/pmsRoomCatalogue";

export const pmsRouter = Router();

pmsRouter.use(requireAuth);

const dateSchema = z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    roomTypeId: z.string().optional(),
});

// GET Catalogue
pmsRouter.get("/:propertyId/catalogue", async (req, res, next) => {
    try {
        const { propertyId } = req.params;
        const catalogue = await PMSRoomCatalogueModel.findOne({ propertyId });
        
        if (!catalogue) {
            return res.json({ roomTypes: [], ratePlans: [], needsSync: true });
        }
        
        const isStale = Date.now() - catalogue.lastSyncedAt.getTime() > 24 * 60 * 60 * 1000;
        if (isStale) {
            res.setHeader("X-Cache-Stale", "true");
        }
        
        res.json(catalogue);
    } catch (err) {
        next(err);
    }
});

// POST Sync Catalogue
pmsRouter.post("/:propertyId/catalogue/sync", async (req, res, next) => {
  try {
    const { propertyId } = req.params;
    const pms = await PMSFactory.getPMS(propertyId);
    
    if (!pms) {
      // No PMS configured — return empty catalogue
      const catalogue = await PMSRoomCatalogueModel.findOneAndUpdate(
        { propertyId },
        { propertyId, roomTypes: [], ratePlans: [], lastSyncedAt: new Date() },
        { upsert: true, new: true }
      );
      return res.json({ roomTypes: [], ratePlans: [], message: "No PMS configured", needsSync: true });
    }

    const today = new Date().toISOString().split("T")[0];
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const pmsWithMaster = pms as {
      getRoomMasterCatalog?: () => Promise<RoomMasterCatalog | null>;
    };
    const masterPromise =
      typeof pmsWithMaster.getRoomMasterCatalog === "function"
        ? pmsWithMaster.getRoomMasterCatalog!()
        : Promise.resolve(null);

    const [inventory, rates, master] = await Promise.allSettled([
      pms.getInventory(today, future),
      pms.getRates(today, future),
      masterPromise,
    ]);

    const roomTypeMap = new Map<string, IRoomType>();

    if (master.status === "fulfilled" && master.value?.roomTypes?.length) {
      for (const rt of master.value.roomTypes) {
        roomTypeMap.set(rt.roomTypeId, {
          roomTypeId: rt.roomTypeId,
          roomTypeCode: rt.roomTypeId,
          roomTypeName: rt.roomTypeName,
        });
      }
    }

    if (inventory.status === "fulfilled") {
      for (const item of inventory.value) {
        if (!roomTypeMap.has(item.roomTypeId)) {
          roomTypeMap.set(item.roomTypeId, {
            roomTypeId: item.roomTypeId,
            roomTypeCode: item.roomTypeId,
            roomTypeName:
              item.roomTypeName && item.roomTypeName !== "Unknown"
                ? item.roomTypeName
                : `Room Type ${item.roomTypeId}`,
          });
        }
      }
    }

    const ratePlanMap = new Map<string, IRatePlan>();

    if (master.status === "fulfilled" && master.value?.ratePlans?.length) {
      for (const rp of master.value.ratePlans) {
        ratePlanMap.set(rp.ratePlanId, {
          ratePlanId: rp.ratePlanId,
          ratePlanCode: rp.ratePlanId,
          ratePlanName: rp.ratePlanName,
        });
      }
    }

    if (rates.status === "fulfilled") {
      for (const rate of rates.value) {
        if (!ratePlanMap.has(rate.ratePlanId)) {
          ratePlanMap.set(rate.ratePlanId, {
            ratePlanId: rate.ratePlanId,
            ratePlanCode: rate.ratePlanId,
            ratePlanName: `Rate Plan ${rate.ratePlanId}`,
          });
        }
      }
    }

    const catalogue = await PMSRoomCatalogueModel.findOneAndUpdate(
      { propertyId },
      {
        propertyId,
        roomTypes: Array.from(roomTypeMap.values()),
        ratePlans: Array.from(ratePlanMap.values()),
        lastSyncedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json(catalogue);
  } catch (err) {
    next(err);
  }
});

// GET Availability
pmsRouter.get(
    "/:propertyId/availability",
    async (req, res, next) => {
        try {
            const { propertyId } = req.params;
            const query = dateSchema.safeParse(req.query);

            if (!query.success) {
                throw badRequest("Invalid date range. Use YYYY-MM-DD format.");
            }

            const pms = await PMSFactory.getPMS(propertyId);
            if (!pms) {
                return res.json({ available: false, error: "No PMS configured" });
            }

            const fetchTimeout = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("PMS timeout")), 8000)
            );

            try {
                const inventory = await Promise.race([
                    pms.getInventory(query.data.from, query.data.to),
                    fetchTimeout
                ]);
                res.json(inventory);
            } catch (err) {
                return res.json({ available: false, error: "PMS unavailable" });
            }
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
                return res.json({ available: false, error: "No PMS configured" });
            }

            const fetchTimeout = new Promise<never>((_, reject) => 
                setTimeout(() => reject(new Error("PMS timeout")), 8000)
            );

            try {
                const rates = await Promise.race([
                    pms.getRates(query.data.from, query.data.to),
                    fetchTimeout
                ]);
                
                if (query.data.roomTypeId) {
                    res.json(rates.filter((r: any) => r.roomTypeId === query.data.roomTypeId));
                } else {
                    res.json(rates);
                }
            } catch (err) {
                return res.json({ available: false, error: "PMS unavailable" });
            }
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
