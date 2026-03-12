import { Router } from "express";
import { Types } from "mongoose";
import { requireAuth, hasPermission } from "../middleware/auth";
import { AuditLogModel } from "../models/auditLog";
import { badRequest, forbidden } from "../utils/httpError";
import { PERMISSIONS } from "../constants/permissions";

export const adminAuditLogRouter = Router();

adminAuditLogRouter.use(requireAuth);

// GET /api/admin/audit-log?entity_type=&entity_id=&user_id=&from=&to=&page=&limit=&orgId=
adminAuditLogRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    if (
      !hasPermission(req.user, PERMISSIONS.SETTINGS.MANAGE) &&
      !hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)
    ) {
      throw forbidden("Insufficient permissions to view audit log");
    }

    const {
      entity_type,
      entity_id,
      user_id,
      from,
      to,
      page = "1",
      limit = "50",
      orgId,
    } = req.query;

    const filter: Record<string, any> = {};

    if (orgId && typeof orgId === "string") {
      filter.orgId = new Types.ObjectId(orgId);
    }
    if (entity_type && typeof entity_type === "string") {
      filter.entity_type = entity_type;
    }
    if (entity_id && typeof entity_id === "string") {
      filter.entity_id = entity_id;
    }
    if (user_id && typeof user_id === "string") {
      filter.userId = new Types.ObjectId(user_id);
    }
    if (from || to) {
      filter.createdAt = {};
      if (from && typeof from === "string") {
        filter.createdAt.$gte = new Date(from);
      }
      if (to && typeof to === "string") {
        filter.createdAt.$lte = new Date(to);
      }
    }

    const pageNum = Math.max(1, parseInt(String(page), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10)));
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLogModel.find(filter)
        .populate("userId", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLogModel.countDocuments(filter),
    ]);

    res.json({
      data: logs,
      total,
      page: pageNum,
      limit: limitNum,
    });
  } catch (err) {
    next(err);
  }
});
