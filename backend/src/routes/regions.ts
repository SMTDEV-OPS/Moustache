import { Router } from "express";
import { z } from "zod";
import { RegionModel } from "../models/region";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";

export const regionsRouter = Router();

regionsRouter.use(requireAuth);

const regionSchema = z.object({
  name: z.string().min(1),
  properties: z.array(z.string()).optional(),
});

regionsRouter.get("/", async (_req, res, next) => {
  try {
    const regions = await RegionModel.find().lean();
    res.json(regions);
  } catch (err) {
    next(err);
  }
});

regionsRouter.post(
  "/",
  requirePermissions(["regions.manage"]),
  async (req, res, next) => {
    try {
      const parsed = regionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid region payload");
      }
      const region = await RegionModel.create(parsed.data);
      res.status(201).json(region);
    } catch (err) {
      next(err);
    }
  }
);

regionsRouter.patch(
  "/:id",
  requirePermissions(["regions.manage"]),
  async (req, res, next) => {
    try {
      const parsed = regionSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        throw badRequest("Invalid region update payload");
      }
      const region = await RegionModel.findByIdAndUpdate(
        req.params.id,
        { $set: parsed.data },
        { new: true }
      ).lean();
      if (!region) {
        throw notFound("Region not found");
      }
      res.json(region);
    } catch (err) {
      next(err);
    }
  }
);



