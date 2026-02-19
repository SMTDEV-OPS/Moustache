import { Router } from "express";
import { z } from "zod";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { AvailabilityReportModel } from "../models/availabilityReport";
import { badRequest } from "../utils/httpError";

export const availabilityRouter = Router();

availabilityRouter.use(requireAuth);

const availabilitySchema = z.object({
  propertyId: z.string(),
  date: z.string().datetime(),
  reportDateRange: z
    .object({
      start: z.string().datetime().optional(),
      end: z.string().datetime().optional(),
    })
    .optional(),
  data: z.unknown(),
});

availabilityRouter.post(
  "/",
  requirePermissions(["availability.upload"]),
  async (req, res, next) => {
    try {
      const parsed = availabilitySchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid availability payload");
      }

      const report = await AvailabilityReportModel.create({
        propertyId: parsed.data.propertyId,
        date: new Date(parsed.data.date),
        reportDateRange: parsed.data.reportDateRange
          ? {
              start: parsed.data.reportDateRange.start
                ? new Date(parsed.data.reportDateRange.start)
                : undefined,
              end: parsed.data.reportDateRange.end
                ? new Date(parsed.data.reportDateRange.end)
                : undefined,
            }
          : undefined,
        data: parsed.data.data,
        uploadedByUserId: req.user?.id,
      });

      res.status(201).json(report);
    } catch (err) {
      next(err);
    }
  }
);

availabilityRouter.get("/latest", async (req, res, next) => {
  try {
    const { propertyId } = req.query;
    if (!propertyId) {
      throw badRequest("propertyId is required");
    }
    const report = await AvailabilityReportModel.findOne({
      propertyId,
    })
      .sort({ date: -1 })
      .lean();
    res.json(report);
  } catch (err) {
    next(err);
  }
});



