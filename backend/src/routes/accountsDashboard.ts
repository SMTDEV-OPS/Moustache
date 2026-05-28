import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { badRequest } from "../utils/httpError";
import {
  getCalendarEvents,
  getConversionFy,
  getDefaultOrgId,
  getHolidays,
  getOrgSalesSettings,
  getTargetsSummary,
} from "../services/accountsDashboardService";
import { OrgSalesSettingsModel } from "../models/orgSalesSettings";

export const accountsDashboardRouter = Router();
accountsDashboardRouter.use(requireAuth);

accountsDashboardRouter.get("/calendar", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing user");
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(from.getFullYear(), from.getMonth() + 1, 0);
    const scope = (req.query.scope as "own" | "team" | "all") || "team";
    const orgId = await getDefaultOrgId();
    const events = await getCalendarEvents(orgId, from, to, req.user, scope);
    res.json({ events });
  } catch (err) {
    next(err);
  }
});

accountsDashboardRouter.get("/holidays", async (req, res, next) => {
  try {
    const from = req.query.from ? new Date(String(req.query.from)) : new Date();
    const to = req.query.to
      ? new Date(String(req.query.to))
      : new Date(from.getFullYear(), from.getMonth() + 2, 0);
    const orgId = await getDefaultOrgId();
    const holidays = await getHolidays(orgId, from, to);
    res.json({ holidays });
  } catch (err) {
    next(err);
  }
});

accountsDashboardRouter.get("/targets", async (req, res, next) => {
  try {
    const period = req.query.period === "ytd" ? "ytd" : "mtd";
    const userId = req.query.userId ? String(req.query.userId) : undefined;
    const orgId = await getDefaultOrgId();
    const summary = await getTargetsSummary(orgId, period, userId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

accountsDashboardRouter.get("/conversion-fy", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing user");
    const scope = (req.query.scope as "own" | "team" | "all") || "team";
    const orgId = await getDefaultOrgId();
    const data = await getConversionFy(orgId, req.user, scope);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

accountsDashboardRouter.get("/sales-settings", async (req, res, next) => {
  try {
    const orgId = await getDefaultOrgId();
    const settings = await getOrgSalesSettings(orgId);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

accountsDashboardRouter.put("/sales-settings", async (req, res, next) => {
  try {
    const orgId = await getDefaultOrgId();
    const updated = await OrgSalesSettingsModel.findOneAndUpdate(
      { orgId },
      {
        financialYearStartMonth: req.body.financialYearStartMonth,
        financialYearStartDay: req.body.financialYearStartDay,
        achievementMetric: req.body.achievementMetric,
      },
      { upsert: true, new: true }
    );
    res.json(updated);
  } catch (err) {
    next(err);
  }
});
