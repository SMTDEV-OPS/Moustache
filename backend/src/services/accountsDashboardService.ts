import { Types } from "mongoose";
import { LeadModel } from "../models/lead";
import { LeadItineraryModel } from "../models/leadItinerary";
import { ReservationModel } from "../models/reservation";
import { HolidayCalendarModel } from "../models/holidayCalendar";
import { SalesTargetModel } from "../models/salesTarget";
import { OrgSalesSettingsModel } from "../models/orgSalesSettings";
import { PipelineStageModel } from "../models/pipelineStage";
import { PipelineModel } from "../models/pipeline";
import { LeadStatus } from "../models/common";
import { buildLeadQueryForUser } from "./dashboardDataScope";

async function getDefaultOrgId(): Promise<Types.ObjectId> {
  const { PropertyModel } = await import("../models/property");
  const prop = await PropertyModel.findOne().select("_id").lean();
  if (prop?._id) return prop._id as Types.ObjectId;
  return new Types.ObjectId();
}

export type OrgSalesSettingsDto = {
  financialYearStartMonth: number;
  financialYearStartDay: number;
  achievementMetric: "revenue" | "booked_leads";
};

export async function getOrgSalesSettings(orgId: Types.ObjectId): Promise<OrgSalesSettingsDto> {
  const existing = await OrgSalesSettingsModel.findOne({ orgId }).lean();
  if (existing) {
    return {
      financialYearStartMonth: existing.financialYearStartMonth,
      financialYearStartDay: existing.financialYearStartDay,
      achievementMetric: existing.achievementMetric,
    };
  }
  const created = await OrgSalesSettingsModel.create({
    orgId,
    financialYearStartMonth: 4,
    financialYearStartDay: 1,
    achievementMetric: "booked_leads",
  });
  return {
    financialYearStartMonth: created.financialYearStartMonth,
    financialYearStartDay: created.financialYearStartDay,
    achievementMetric: created.achievementMetric,
  };
}

export function getFinancialYearRange(
  settings: { financialYearStartMonth: number; financialYearStartDay: number },
  refDate = new Date()
) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth() + 1;
  const day = refDate.getDate();
  let fyStartYear = year;
  if (
    month < settings.financialYearStartMonth ||
    (month === settings.financialYearStartMonth && day < settings.financialYearStartDay)
  ) {
    fyStartYear = year - 1;
  }
  const start = new Date(
    fyStartYear,
    settings.financialYearStartMonth - 1,
    settings.financialYearStartDay
  );
  const end = new Date(start);
  end.setFullYear(end.getFullYear() + 1);
  end.setMilliseconds(-1);
  return { start, end };
}

async function getBookedStageIds(orgId: Types.ObjectId): Promise<Types.ObjectId[]> {
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
  if (!pipeline) return [];
  const stages = await PipelineStageModel.find({ pipelineId: pipeline._id })
    .select("_id name")
    .lean();
  return stages
    .filter((s) => /booked|confirmed/i.test(String((s as { name?: string }).name || "")))
    .map((s) => s._id as Types.ObjectId);
}

async function countAchievement(
  orgId: Types.ObjectId,
  leadFilter: Record<string, unknown>,
  from: Date,
  to: Date,
  metric: "revenue" | "booked_leads"
): Promise<number> {
  const dateFilter = { createdAt: { $gte: from, $lte: to } };
  const bookedStageIds = await getBookedStageIds(orgId);

  const achievementFilter: Record<string, unknown> = {
    ...leadFilter,
    ...dateFilter,
    $or: [
      { status: LeadStatus.CONFIRMED },
      ...(bookedStageIds.length ? [{ stageId: { $in: bookedStageIds } }] : []),
    ],
  };

  if (metric === "booked_leads") {
    return LeadModel.countDocuments(achievementFilter);
  }

  const leads = await LeadModel.find(achievementFilter)
    .select("estimatedValue budget")
    .lean();
  return leads.reduce((sum, l) => {
    const budget = (l as { budget?: number }).budget;
    const parsed = parseFloat(
      String((l as { estimatedValue?: string }).estimatedValue || "0").replace(/[^\d.-]/g, "")
    );
    const fromEstimate = Number.isNaN(parsed) ? 0 : parsed;
    const v = budget ?? fromEstimate;
    return sum + v;
  }, 0);
}

export async function getTargetsSummary(
  orgId: Types.ObjectId,
  period: "mtd" | "ytd",
  userId?: string
) {
  const settings = await getOrgSalesSettings(orgId);
  const now = new Date();
  const fy = getFinancialYearRange(settings, now);

  let from: Date;
  let to: Date = now;
  if (period === "mtd") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    from = fy.start;
    to = now > fy.end ? fy.end : now;
  }

  const targetQuery: Record<string, unknown> = {
    orgId,
    year: period === "mtd" ? now.getFullYear() : fy.start.getFullYear(),
    month: period === "mtd" ? now.getMonth() + 1 : undefined,
  };
  if (userId) targetQuery.userId = new Types.ObjectId(userId);
  else targetQuery.userId = { $exists: false };

  const targets = await SalesTargetModel.find(
    period === "ytd"
      ? { orgId, year: { $gte: fy.start.getFullYear(), $lte: now.getFullYear() } }
      : targetQuery
  ).lean();

  let targetValue = 0;
  const metric = settings.achievementMetric;
  for (const t of targets) {
    if (period === "mtd" && t.month !== now.getMonth() + 1) continue;
    if (metric === "booked_leads") targetValue += t.targetCount || 0;
    else targetValue += t.targetAmount || 0;
  }

  const achievement = await countAchievement(orgId, { orgId }, from, to, metric);

  return {
    period,
    metric,
    target: targetValue,
    achieved: achievement,
    remaining: Math.max(0, targetValue - achievement),
    fyLabel: `${fy.start.toLocaleDateString()} – ${fy.end.toLocaleDateString()}`,
  };
}

export async function getConversionFy(
  orgId: Types.ObjectId,
  user: { id: string; permissions?: string[]; isAdmin?: boolean },
  scope: "own" | "team" | "all"
) {
  const settings = await getOrgSalesSettings(orgId);
  const fy = getFinancialYearRange(settings);
  const leadFilter = await buildLeadQueryForUser(orgId, user.id, user, scope);
  leadFilter.accountId = { $exists: true, $ne: null };

  const createdInFy = await LeadModel.countDocuments({
    ...leadFilter,
    createdAt: { $gte: fy.start, $lte: fy.end },
  });

  const bookedStageIds = await getBookedStageIds(orgId);
  const converted = await LeadModel.countDocuments({
    ...leadFilter,
    createdAt: { $gte: fy.start, $lte: fy.end },
    $or: [
      { status: LeadStatus.CONFIRMED },
      ...(bookedStageIds.length ? [{ stageId: { $in: bookedStageIds } }] : []),
    ],
  });

  const conversionPct = createdInFy > 0 ? Math.round((converted / createdInFy) * 1000) / 10 : 0;

  return {
    conversionPct,
    createdInFy,
    converted,
    fyStart: fy.start,
    fyEnd: fy.end,
    settings,
  };
}

export async function getCalendarEvents(
  orgId: Types.ObjectId,
  from: Date,
  to: Date,
  user: { id: string; permissions?: string[]; isAdmin?: boolean },
  scope: "own" | "team" | "all"
) {
  const leadFilter = await buildLeadQueryForUser(orgId, user.id, user, scope);
  leadFilter.accountId = { $exists: true, $ne: null };

  const accountLeads = await LeadModel.find(leadFilter).select("_id leadNumber accountId").lean();
  const leadIds = accountLeads.map((l) => l._id);
  const leadMap = new Map(accountLeads.map((l) => [String(l._id), l]));

  const itineraries = await LeadItineraryModel.find({
    leadId: { $in: leadIds },
    checkInDate: { $gte: from, $lte: to },
  })
    .select("leadId hotelName checkInDate")
    .lean();

  const events: {
    id: string;
    title: string;
    date: string;
    type: string;
    leadId?: string;
  }[] = itineraries.map((it) => {
    const lead = leadMap.get(String(it.leadId));
    return {
      id: `it-${it._id}`,
      title: it.hotelName || "Check-in",
      date: new Date(it.checkInDate!).toISOString().slice(0, 10),
      type: "lead_itinerary",
      leadId: lead ? String(lead._id) : undefined,
    };
  });

  const reservations = await ReservationModel.find({
    checkInDate: { $gte: from, $lte: to },
  })
    .select("checkInDate guestId propertyId pmsReservationId")
    .limit(200)
    .lean();

  for (const r of reservations) {
    events.push({
      id: `res-${r._id}`,
      title: "Reservation check-in",
      date: new Date(r.checkInDate).toISOString().slice(0, 10),
      type: "reservation",
    });
  }

  return events;
}

export async function getHolidays(orgId: Types.ObjectId, from: Date, to: Date) {
  return HolidayCalendarModel.find({
    orgId,
    startDate: { $lte: to },
    endDate: { $gte: from },
  })
    .sort({ startDate: 1 })
    .lean();
}

export { getDefaultOrgId };
