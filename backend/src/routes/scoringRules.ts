import { Router } from "express";
import { ScoringRuleModel } from "../models/scoringRule";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { HttpError } from "../utils/httpError";

const router = Router();

// Get all scoring rules
router.get(
    "/",
    requireAuth,
    requirePermissions(["leads.manage"]),
    async (req, res, next) => {
        try {
            const { module = "leads" } = req.query;
            const rules = await ScoringRuleModel.find({ module: module as string }).sort({ priority: -1 });
            res.json(rules);
        } catch (error) {
            next(error);
        }
    }
);

// Create scoring rule
router.post(
    "/",
    requireAuth,
    requirePermissions(["leads.manage"]),
    async (req, res, next) => {
        try {
            const rule = await ScoringRuleModel.create(req.body);
            res.status(201).json(rule);
        } catch (error) {
            next(error);
        }
    }
);

// Update scoring rule
router.patch(
    "/:id",
    requireAuth,
    requirePermissions(["leads.manage"]),
    async (req, res, next) => {
        try {
            const rule = await ScoringRuleModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!rule) throw new HttpError(404, "Rule not found");
            res.json(rule);
        } catch (error) {
            next(error);
        }
    }
);

// Delete scoring rule
router.delete(
    "/:id",
    requireAuth,
    requirePermissions(["leads.manage"]),
    async (req, res, next) => {
        try {
            const rule = await ScoringRuleModel.findByIdAndDelete(req.params.id);
            if (!rule) throw new HttpError(404, "Rule not found");
            res.status(204).end();
        } catch (error) {
            next(error);
        }
    }
);

export { router as scoringRouter };
