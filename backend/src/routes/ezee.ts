import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { PropertyModel } from "../models/property";
import { EzeePMSService } from "../services/pms/adapters/EzeePMSService";
import { badRequest, notFound } from "../utils/httpError";
import { logger } from "../config/logger";

export const ezeeRouter = Router();

ezeeRouter.use(requireAuth);

function normName(s: unknown): string {
  return String(s || "").trim().toLowerCase();
}

/** Drop PMS placeholder rows only — never use RatePlanID / ID suffix (legitimate plans can end in ...0000001). */
function isDefaultUnmappedLabel(name: unknown): boolean {
  return normName(name).includes("default unmapped");
}

function rateTypeNameForPlan(
  mapping: { rateTypes?: { id: string; name: string }[] },
  rateTypeId: string | undefined
): string | undefined {
  const id = String(rateTypeId || "").trim();
  if (!id) return undefined;
  const rt = (mapping.rateTypes ?? []).find((x) => String(x.id || "").trim() === id);
  return rt?.name ? String(rt.name).trim() : undefined;
}

// GET /api/ezee/room-info?hotelId={propertyId}
ezeeRouter.get("/room-info", async (req, res, next) => {
  try {
    const query = z.object({ hotelId: z.string().min(1) }).safeParse(req.query);
    if (!query.success) throw badRequest("hotelId is required");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");

    if (property.pmsProvider !== "EZEE") {
      return res.json({ roomTypes: [], rateTypes: [], ratePlans: [] });
    }
    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) {
      return res.json({ roomTypes: [], rateTypes: [], ratePlans: [] });
    }

    const ezee = new EzeePMSService({ hotelCode, authCode });
    const mapping = await ezee.getSeparateSourceMapping();

    const roomTypes = (mapping.roomTypes ?? [])
      .filter((x) => x?.id)
      .filter((x) => !isDefaultUnmappedLabel(x.name))
      .map((x) => ({ id: String(x.id).trim(), name: String(x.name || "").trim() }))
      .filter((x) => x.id);

    const rateTypes = (mapping.rateTypes ?? [])
      .filter((x) => x?.id)
      .filter((x) => !isDefaultUnmappedLabel(x.name))
      .map((x) => ({ id: String(x.id).trim(), name: String(x.name || "").trim() }))
      .filter((x) => x.id);

    const ratePlans = (mapping.ratePlans ?? [])
      .filter((p) => p?.id)
      .filter(
        (p) =>
          !isDefaultUnmappedLabel(p.name) && !isDefaultUnmappedLabel(rateTypeNameForPlan(mapping, p.rateTypeId))
      )
      .map((p) => ({
        id: String(p.id).trim(),
        roomTypeId: p.roomTypeId ? String(p.roomTypeId).trim() : undefined,
        rateTypeId: p.rateTypeId ? String(p.rateTypeId).trim() : undefined,
        name: p.name ? String(p.name).trim() : undefined,
      }))
      .filter((p) => p.id);

    res.json({ roomTypes, rateTypes, ratePlans });
  } catch (err) {
    next(err);
  }
});

// GET /api/ezee/rates?hotelId={propertyId}&fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD
ezeeRouter.get("/rates", async (req, res, next) => {
  try {
    const query = z
      .object({
        hotelId: z.string().min(1),
        fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        toDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
      .safeParse(req.query);
    if (!query.success) throw badRequest("hotelId, fromDate, toDate are required (YYYY-MM-DD)");

    const property = await PropertyModel.findById(query.data.hotelId).lean();
    if (!property) throw notFound("Hotel not found");

    if (property.pmsProvider !== "EZEE") {
      return res.json({});
    }
    const hotelCode = property.pmsConfig?.hotelCode?.trim();
    const authCode = property.pmsConfig?.authCode?.trim();
    if (!hotelCode || !authCode) {
      return res.json({});
    }

    const ezee = new EzeePMSService({ hotelCode, authCode });
    try {
      const map = await ezee.getRatesLookup(query.data.fromDate, query.data.toDate);
      res.json(map);
    } catch (e) {
      logger.warn("eZee rate fetch failed", {
        propertyId: property._id,
        err: e instanceof Error ? e.message : String(e),
      });
      throw badRequest("PMS rate fetch failed — enter rates manually");
    }
  } catch (err) {
    next(err);
  }
});

