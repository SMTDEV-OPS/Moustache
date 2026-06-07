import { Router } from "express";
import { requireAuth, requirePermissions } from "../middleware/auth";
import { runProductionSeeds } from "../services/productionSeedService";
import { logger } from "../config/logger";

export const adminBootstrapRouter = Router();

adminBootstrapRouter.post(
  "/seed",
  requireAuth,
  requirePermissions(["settings.manage"]),
  async (_req, res, next) => {
    try {
      const result = await runProductionSeeds();
      res.json({
        message: "Production seed completed",
        ...result,
      });
    } catch (err) {
      logger.error("Production seed failed", {
        error: err instanceof Error ? err.message : err,
      });
      next(err);
    }
  }
);
