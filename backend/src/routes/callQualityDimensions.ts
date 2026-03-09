import { Router } from "express";
import { CallQualityDimensionModel } from "../models/callQualityDimension";
import { UserModel } from "../models/user";
import { hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { z } from "zod";

export const callQualityDimensionsRouter = Router();

const dimensionSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    weight_percent: z.number().int().min(1).max(100),
    display_order: z.number().int(),
    is_active: z.boolean().default(true),
});

async function validateWeightSum(orgId: any, excludeId?: string, newWeight?: number) {
    const activeDimensions = await CallQualityDimensionModel.find({
        orgId,
        is_active: true,
        ...(excludeId ? { _id: { $ne: excludeId } } : {})
    });

    let sum = activeDimensions.reduce((acc, curr) => acc + curr.weight_percent, 0);
    if (newWeight !== undefined) {
        sum += newWeight;
    }

    if (sum > 100) {
        throw new Error(`Total active dimension weight cannot exceed 100%. Current sum would be ${sum}%.`);
    }
}

callQualityDimensionsRouter.get("/", async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const orgId = "default_org";
        const dimensions = await CallQualityDimensionModel.find({ orgId }).sort({ display_order: 1 });
        res.json(dimensions);
    } catch (error) {
        next(error);
    }
});

callQualityDimensionsRouter.post("/", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const orgId = "default_org";

        const parsed = dimensionSchema.parse(req.body);

        if (parsed.is_active) {
            try {
                await validateWeightSum(orgId, undefined, parsed.weight_percent);
            } catch (e: any) {
                return res.status(400).json({ error: e.message });
            }
        }

        const dimension = await CallQualityDimensionModel.create({
            ...parsed,
            orgId
        });

        res.status(201).json(dimension);
    } catch (error) {
        next(error);
    }
});

callQualityDimensionsRouter.patch("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = dimensionSchema.partial().parse(req.body);
        const orgId = "default_org";

        const existing = await CallQualityDimensionModel.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ error: "Dimension not found." });
        }

        const isActive = parsed.is_active !== undefined ? parsed.is_active : existing.is_active;
        const weight = parsed.weight_percent !== undefined ? parsed.weight_percent : existing.weight_percent;

        if (isActive) {
            try {
                await validateWeightSum(orgId, req.params.id, weight);
            } catch (e: any) {
                return res.status(400).json({ error: e.message });
            }
        }

        const updated = await CallQualityDimensionModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

callQualityDimensionsRouter.delete("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        await CallQualityDimensionModel.findByIdAndDelete(req.params.id);
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});
