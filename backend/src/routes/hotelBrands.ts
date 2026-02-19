import { Router } from "express";
import { z } from "zod";
import { HotelBrandModel } from "../models/hotelBrand";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";

export const hotelBrandsRouter = Router();

hotelBrandsRouter.use(requireAuth);

const hotelBrandSchema = z.object({
    name: z.string().min(1),
    category: z.enum(["LUXURY", "UPPER_UPSCALE", "UPSCALE", "MID_SEGMENT", "BUDGET", "GUEST_HOUSE"]),
    isActive: z.boolean().optional(),
});

hotelBrandsRouter.get("/", async (req, res, next) => {
    try {
        const brands = await HotelBrandModel.find({ isActive: true }).sort({ name: 1 }).lean();
        res.json(brands);
    } catch (err) {
        next(err);
    }
});

hotelBrandsRouter.post("/", requirePermissions(["users.manage"]), async (req, res, next) => {
    try {
        const parsed = hotelBrandSchema.safeParse(req.body);
        if (!parsed.success) {
            throw badRequest("Invalid hotel brand payload");
        }
        const brand = await HotelBrandModel.create(parsed.data);
        res.status(201).json(brand);
    } catch (err) {
        next(err);
    }
});
