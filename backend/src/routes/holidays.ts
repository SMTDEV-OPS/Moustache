import { Router } from "express";
import { requireAuth, hasPermission } from "../middleware/auth";
import { badRequest, forbidden, notFound } from "../utils/httpError";
import { HolidayCalendarModel } from "../models/holidayCalendar";
import { getDefaultOrgId } from "../services/accountsDashboardService";
import { PERMISSIONS } from "../constants/permissions";

export const holidaysRouter = Router();
holidaysRouter.use(requireAuth);

holidaysRouter.get("/", async (req, res, next) => {
  try {
    const orgId = await getDefaultOrgId();
    const holidays = await HolidayCalendarModel.find({ orgId }).sort({ startDate: 1 }).lean();
    res.json(holidays);
  } catch (err) {
    next(err);
  }
});

holidaysRouter.post("/", async (req, res, next) => {
  try {
    if (!req.user?.isAdmin && !hasPermission(req.user!, PERMISSIONS.LEADS.MANAGE)) {
      throw forbidden("Insufficient permissions");
    }
    const orgId = await getDefaultOrgId();
    const { name, startDate, endDate, type, region } = req.body;
    if (!name || !startDate || !endDate || !type) throw badRequest("Missing fields");
    const doc = await HolidayCalendarModel.create({
      orgId,
      name,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      type,
      region,
    });
    res.status(201).json(doc);
  } catch (err) {
    next(err);
  }
});

holidaysRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!req.user?.isAdmin && !hasPermission(req.user!, PERMISSIONS.LEADS.MANAGE)) {
      throw forbidden("Insufficient permissions");
    }
    const doc = await HolidayCalendarModel.findByIdAndDelete(req.params.id);
    if (!doc) throw notFound("Holiday not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
