import { Router } from "express";
import { requireAuth, requireAnyPermission } from "../middleware/auth";
import { getConfig, updateConfig, getWorkloads, putWorkloadAvailability } from "../controllers/allocationController";

export const allocationRouter = Router();

allocationRouter.use(requireAuth);
allocationRouter.use(requireAnyPermission(["leads.manage", "settings.manage"]));

// GET /api/admin/allocation/config?orgId=
allocationRouter.get("/config", (req, res, next) =>
  getConfig(req, res).catch(next)
);

// PUT /api/admin/allocation/config
allocationRouter.put("/config", (req, res, next) =>
  updateConfig(req, res).catch(next)
);

// GET /api/admin/allocation/workload?orgId=&date?
allocationRouter.get("/workload", (req, res, next) =>
  getWorkloads(req, res).catch(next)
);

// PUT /api/admin/allocation/workload/:agentId/availability?orgId=&date?
// body: { is_available: boolean }
allocationRouter.put("/workload/:agentId/availability", (req, res, next) =>
  putWorkloadAvailability(req, res).catch(next)
);
