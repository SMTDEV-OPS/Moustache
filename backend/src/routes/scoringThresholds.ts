import { Router } from "express";
import { ScoringThresholdModel } from "../models/scoringThreshold";
import { UserModel } from "../models/user";
import { hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { z } from "zod";

export const scoringThresholdsRouter = Router();

const thresholdSchema = z.object({
    label: z.string().min(1),
    min_score: z.number().int(),
    max_score: z.number().int(),
    color: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i),
    inactive_hours_warning: z.number().int().optional().nullable(),
    inactive_hours_critical: z.number().int().optional().nullable(),
    inactive_color_warning: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().nullable(),
    inactive_color_critical: z.string().regex(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i).optional().nullable(),
    auto_action: z.enum(["none", "notify_tl", "auto_lost"]),
});

scoringThresholdsRouter.get("/", async (req, res, next) => {
    try {
        if (!req.user) {
            return res.status(403).json({ error: "Unauthorized" });
        }
        const orgId = "default_org";
        const thresholds = await ScoringThresholdModel.find({ orgId }).sort({ min_score: 1 });
        res.json(thresholds);
    } catch (error) {
        next(error);
    }
});

scoringThresholdsRouter.post("/", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const orgId = "default_org";

        const parsed = thresholdSchema.parse(req.body);

        const existing = await ScoringThresholdModel.find({
            orgId,
            $or: [
                { min_score: { $lte: parsed.max_score }, max_score: { $gte: parsed.min_score } }
            ]
        });

        if (existing.length > 0) {
            return res.status(400).json({ error: "Score range overlaps with an existing threshold." });
        }

        const threshold = await ScoringThresholdModel.create({
            ...parsed,
            orgId
        });

        res.status(201).json(threshold);
    } catch (error) {
        next(error);
    }
});

scoringThresholdsRouter.patch("/:id", async (req, res, next) => {
    try {
        if (!req.user || !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE)) {
            return res.status(403).json({ error: "Insufficient permissions." });
        }

        const parsed = thresholdSchema.partial().parse(req.body);
        const orgId = "default_org";

        if (parsed.min_score !== undefined || parsed.max_score !== undefined) {
            const thresholdToUpdate = await ScoringThresholdModel.findById(req.params.id);
            const min = parsed.min_score !== undefined ? parsed.min_score : thresholdToUpdate!.min_score;
            const max = parsed.max_score !== undefined ? parsed.max_score : thresholdToUpdate!.max_score;

            const existing = await ScoringThresholdModel.find({
                orgId,
                _id: { $ne: req.params.id },
                $or: [
                    { min_score: { $lte: max }, max_score: { $gte: min } }
                ]
            });

            if (existing.length > 0) {
                return res.status(400).json({ error: "Score range overlaps with an existing threshold." });
            }
        }

        const updated = await ScoringThresholdModel.findByIdAndUpdate(req.params.id, parsed, { new: true });
        res.json(updated);
    } catch (error) {
        next(error);
    }
});

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
