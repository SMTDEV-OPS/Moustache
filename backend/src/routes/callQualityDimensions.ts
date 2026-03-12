import { Router } from "express";
import { CallQualityDimensionModel } from "../models/callQualityDimension";
import { hasPermission, requireAuth } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { z } from "zod";
import { logger } from "../config/logger";
import mongoose from "mongoose";

export const callQualityDimensionsRouter = Router();
callQualityDimensionsRouter.use(requireAuth);

const dimensionSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    weight_percent: z.number().int().min(1).max(100),
    display_order: z.number().int().default(0),
    is_active: z.boolean().default(true),
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

/**
 * Validate that active dimensions for the org sum to <= 100.
 * Returns error string if violated, null if ok.
 * @param orgId - org to check
 * @param excludeId - dimension ID to exclude (when updating)
 * @param newWeight - the new weight being added/changed
 * @param requireExact100 - if true, requires sum to equal exactly 100
 */
async function validateWeightSum(orgId: string, excludeId?: string, newWeight?: number, requireExact100 = false) {
    const query: any = { orgId, is_active: true };
    if (excludeId) query._id = { $ne: excludeId };
    const active = await CallQualityDimensionModel.find(query);
    const existingSum = active.reduce((acc, d) => acc + d.weight_percent, 0);
    const total = existingSum + (newWeight ?? 0);
    if (total > 100) {
        return `Active dimension weights would total ${total}% (must not exceed 100%). Current total without this dimension: ${existingSum}%.`;
    }
    return null;
}

// GET all dimensions
callQualityDimensionsRouter.get("/", async (req, res, next) => {
    try {
        const orgId = await resolveOrgId(req.query);
        const dimensions = await CallQualityDimensionModel.find(orgId ? { orgId } : {}).sort({ display_order: 1 });

        const activeSum = dimensions.filter(d => d.is_active).reduce((a, d) => a + d.weight_percent, 0);
        res.json({ dimensions, active_weight_total: activeSum });
    } catch (error) {
        next(error);
    }
});

// POST — create dimension
callQualityDimensionsRouter.post("/", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = dimensionSchema.parse(req.body);
        const orgId = await resolveOrgId(req.query);
        if (!orgId) return res.status(400).json({ error: "Could not resolve orgId." });

        if (parsed.is_active) {
            const err = await validateWeightSum(orgId, undefined, parsed.weight_percent);
            if (err) return res.status(400).json({ error: err });
        }

        const dimension = await CallQualityDimensionModel.create({ ...parsed, orgId });
        res.status(201).json(dimension);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// PUT — full replace
callQualityDimensionsRouter.put("/reorder", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const updates = z.array(z.object({
            id: z.string(),
            display_order: z.number().int()
        })).parse(req.body);

        const ops = updates.map(u => ({
            updateOne: {
                filter: { _id: new mongoose.Types.ObjectId(u.id) },
                update: { $set: { display_order: u.display_order } }
            }
        }));

        await CallQualityDimensionModel.bulkWrite(ops);
        res.json({ message: "Dimensions reordered successfully." });
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

callQualityDimensionsRouter.put("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = dimensionSchema.parse(req.body);
        const orgId = await resolveOrgId(req.query);

        const current = await CallQualityDimensionModel.findById(req.params.id);
        if (!current) return res.status(404).json({ error: "Dimension not found." });

        const resolvedOrg = orgId || current.orgId?.toString();
        if (resolvedOrg && parsed.is_active) {
            const err = await validateWeightSum(resolvedOrg, req.params.id, parsed.weight_percent);
            if (err) return res.status(400).json({ error: err });
        }

        const updated = await CallQualityDimensionModel.findByIdAndUpdate(
            req.params.id,
            { ...parsed },
            { new: true, runValidators: true }
        );
        res.json(updated);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// PATCH — partial update (also supports soft delete via is_active: false)
callQualityDimensionsRouter.patch("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = dimensionSchema.partial().parse(req.body);

        const current = await CallQualityDimensionModel.findById(req.params.id);
        if (!current) return res.status(404).json({ error: "Dimension not found." });

        const isActive = parsed.is_active !== undefined ? parsed.is_active : current.is_active;
        const weight = parsed.weight_percent !== undefined ? parsed.weight_percent : current.weight_percent;

        if (isActive) {
            const orgId = current.orgId?.toString();
            if (orgId) {
                const err = await validateWeightSum(orgId, req.params.id, weight);
                if (err) return res.status(400).json({ error: err });
            }
        }

        const updated = await CallQualityDimensionModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
        res.json(updated);
    } catch (error) {
        if ((error as any)?.name === "ZodError") return res.status(400).json({ error: (error as any).errors });
        next(error);
    }
});

// DELETE — soft delete
callQualityDimensionsRouter.delete("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }
        const updated = await CallQualityDimensionModel.findByIdAndUpdate(
            req.params.id,
            { is_active: false },
            { new: true }
        );
        if (!updated) return res.status(404).json({ error: "Dimension not found." });
        res.json({ message: "Dimension deactivated (soft deleted).", dim: updated });
    } catch (error) {
        next(error);
    }
});
