import { Router } from "express";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, forbidden } from "../utils/httpError";
import { SalesTargetModel } from "../models/salesTarget";
import { getDefaultOrgId } from "../services/accountsDashboardService";
import { PERMISSIONS } from "../constants/permissions";
import { Types } from "mongoose";

export const salesTargetsRouter = Router();
salesTargetsRouter.use(requireAuth);

salesTargetsRouter.get("/", async (req, res, next) => {
  try {
    const orgId = await getDefaultOrgId();
    const year = parseInt(String(req.query.year || new Date().getFullYear()), 10);
    const targets = await SalesTargetModel.find({ orgId, year }).lean();
    res.json(targets);
  } catch (err) {
    next(err);
  }
});

salesTargetsRouter.put("/", async (req, res, next) => {
  try {
    if (!req.user?.isAdmin && !hasPermission(req.user!, PERMISSIONS.LEADS.MANAGE)) {
      throw forbidden("Insufficient permissions");
    }
    const orgId = await getDefaultOrgId();
    const { year, month, userId, targetAmount, targetCount } = req.body;
    if (!year || !month) throw badRequest("year and month required");
    const doc = await SalesTargetModel.findOneAndUpdate(
      {
        orgId,
        year,
        month,
        userId: userId ? new Types.ObjectId(userId) : { $exists: false },
      },
      { targetAmount, targetCount },
      { upsert: true, new: true }
    );
    res.json(doc);
  } catch (err) {
    next(err);
  }
});
