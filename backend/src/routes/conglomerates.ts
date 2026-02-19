import { Router } from "express";
import { z } from "zod";
import { ConglomerateModel } from "../models/conglomerate";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { badRequest, notFound } from "../utils/httpError";

export const conglomeratesRouter = Router();

conglomeratesRouter.use(requireAuth);

const conglomerateSchema = z.object({
    name: z.string().min(1),
    country: z.string().min(1),
    region: z.string().min(1),
    isGlobal: z.boolean().optional(),
});

// List all conglomerates with search and country filtering
conglomeratesRouter.get("/", async (req, res, next) => {
    try {
        const { search, country, region } = req.query;
        const filter: Record<string, any> = { isActive: true };

        if (search) {
            filter.$text = { $search: search as string };
        }
        if (country) {
            filter.country = country;
        }
        if (region) {
            filter.region = region;
        }

        const conglomerates = await ConglomerateModel.find(filter)
            .sort({ name: 1 })
            .lean();
        res.json(conglomerates);
    } catch (err) {
        next(err);
    }
});

// Get conglomerates by country
conglomeratesRouter.get("/by-country/:country", async (req, res, next) => {
    try {
        const conglomerates = await ConglomerateModel.find({
            country: req.params.country,
            isActive: true,
        }).sort({ name: 1 }).lean();
        res.json(conglomerates);
    } catch (err) {
        next(err);
    }
});

// Get single conglomerate
conglomeratesRouter.get("/:id", async (req, res, next) => {
    try {
        const conglomerate = await ConglomerateModel.findById(req.params.id).lean();
        if (!conglomerate) {
            throw notFound("Conglomerate not found");
        }
        res.json(conglomerate);
    } catch (err) {
        next(err);
    }
});

// Create new conglomerate (admin only)
conglomeratesRouter.post(
    "/",
    requirePermissions(["users.manage"]), // Reusing users.manage for admin tasks for now
    async (req, res, next) => {
        try {
            const parsed = conglomerateSchema.safeParse(req.body);
            if (!parsed.success) {
                throw badRequest("Invalid conglomerate payload");
            }

            const conglomerate = await ConglomerateModel.create({
                ...parsed.data,
                createdBy: req.user?.id,
            });
            res.status(201).json(conglomerate);
        } catch (err) {
            next(err);
        }
    }
);

// Update conglomerate (admin only)
conglomeratesRouter.patch(
    "/:id",
    requirePermissions(["users.manage"]),
    async (req, res, next) => {
        try {
            const parsed = conglomerateSchema.partial().safeParse(req.body);
            if (!parsed.success) {
                throw badRequest("Invalid update payload");
            }

            const conglomerate = await ConglomerateModel.findByIdAndUpdate(
                req.params.id,
                { $set: parsed.data },
                { new: true }
            ).lean();

            if (!conglomerate) {
                throw notFound("Conglomerate not found");
            }
            res.json(conglomerate);
        } catch (err) {
            next(err);
        }
    }
);
