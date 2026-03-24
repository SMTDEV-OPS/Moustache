import { Router } from "express";
import { Types } from "mongoose";
import { ScoringThresholdModel } from "../models/scoringThreshold";
import { hasPermission, requireAuth } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { z } from "zod";
import { logger } from "../config/logger";

export const scoringThresholdsRouter = Router();
scoringThresholdsRouter.use(requireAuth);

const thresholdSchema = z.object({
    label: z.string().min(1),
    min_score: z.number().int(),
    max_score: z.number().int(),
    color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
    inactive_hours_warning: z.number().int().optional().nullable(),
    inactive_hours_critical: z.number().int().optional().nullable(),
    inactive_color_warning: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().nullable(),
    inactive_color_critical: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().nullable(),
    auto_action: z.enum(["none", "notify_tl", "auto_lost"]).default("none"),
});

/** Resolve orgId from query param, falling back to first property in DB */
async function resolveOrgId(query: any): Promise<string | undefined> {
    if (query.org_id && typeof query.org_id === "string") {
        return query.org_id;
    }
    try {
        const { PropertyModel } = await import("../models/property");
        const first = await PropertyModel.findOne().select("_id").lean();
        return first?._id?.toString();
    } catch {
        return undefined;
    }
}

/** Validate no overlap between score ranges (excluding selfId). No org filter. */
async function validateNoOverlap(_orgId: string, min: number, max: number, excludeId?: string) {
    const query: any = { $or: [{ min_score: { $lte: max }, max_score: { $gte: min } }] };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await ScoringThresholdModel.find(query);
    if (existing.length > 0) {
        return `Score range ${min}-${max} overlaps with "${existing[0].label}" (${existing[0].min_score}-${existing[0].max_score}).`;
    }
    return null;
}

// GET all thresholds (no org filter)
scoringThresholdsRouter.get("/", async (req, res, next) => {
    try {
        const thresholds = await ScoringThresholdModel.find({}).sort({ min_score: 1 });
        res.json(thresholds);
    } catch (error) {
        next(error);
    }
});

// POST — create threshold
scoringThresholdsRouter.post("/", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = thresholdSchema.parse(req.body);
        const resolvedOrg = (await resolveOrgId(req.query)) || "69ae144fae23030b62f901f5";

        const overlap = await validateNoOverlap(resolvedOrg, parsed.min_score, parsed.max_score);
        if (overlap) return res.status(400).json({ error: overlap });

        const threshold = await ScoringThresholdModel.create({ ...parsed, orgId: new Types.ObjectId(resolvedOrg) });
        res.status(201).json(threshold);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// PUT — full replace
scoringThresholdsRouter.put("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = thresholdSchema.parse(req.body);
        const resolvedOrg = (await resolveOrgId(req.query)) || "69ae144fae23030b62f901f5";

        const overlap = await validateNoOverlap(resolvedOrg, parsed.min_score, parsed.max_score, req.params.id);
        if (overlap) return res.status(400).json({ error: overlap });

        const updated = await ScoringThresholdModel.findByIdAndUpdate(
            req.params.id,
            { ...parsed, orgId: new Types.ObjectId(resolvedOrg) },
            { new: true, runValidators: true }
        );
        if (!updated) return res.status(404).json({ error: "Threshold not found." });
        res.json(updated);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// PATCH — partial update
scoringThresholdsRouter.patch("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = thresholdSchema.partial().parse(req.body);
        const orgId = await resolveOrgId(req.query);

        if (parsed.min_score !== undefined || parsed.max_score !== undefined) {
            const current = await ScoringThresholdModel.findById(req.params.id);
            if (!current) return res.status(404).json({ error: "Threshold not found." });
            const min = parsed.min_score !== undefined ? parsed.min_score : current.min_score;
            const max = parsed.max_score !== undefined ? parsed.max_score : current.max_score;
            const resolvedOrg = orgId || current.orgId?.toString();
            if (resolvedOrg) {
                const overlap = await validateNoOverlap(resolvedOrg, min, max, req.params.id);
                if (overlap) return res.status(400).json({ error: overlap });
            }
        }

        const updated = await ScoringThresholdModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
        if (!updated) return res.status(404).json({ error: "Threshold not found." });
        res.json(updated);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// DELETE
scoringThresholdsRouter.delete("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }
        await ScoringThresholdModel.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});
