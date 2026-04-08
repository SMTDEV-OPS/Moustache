import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { requireAuth, hasPermission } from "../middleware/auth";
import { RoleModel } from "../models/role";
import { EmployeeGroupModel } from "../models/employeeGroup";
import {
  HeatLevel,
  LeadSource,
  LeadStatus,
  LeadType,
  CallStatus
} from "../models/common";
import { LeadModel, ILead } from "../models/lead";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { CommunicationModel } from "../models/communication";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import {
  canAccessLeadPatch,
  enforceLeadFieldPermissions,
  getEditableLeadFieldKeys,
} from "../utils/leadFieldEditPolicy";
import { createLead, reassignLead, validateStageMove, leadEventBus, dryRunAssignment } from "../services/leadService";
import { assertLeadAccess } from "../utils/leadAccess";
import { logAudit } from "../utils/auditLog";
import { logger } from "../config/logger";
import { getEligibleUsersForManualAssignment } from "../services/assignmentService";
import { UserModel } from "../models/user";
import { getCommunicationTimeline } from "../services/communicationService";
import { PERMISSIONS } from "../constants/permissions";
import { uploadResource } from "../middleware/upload";
import { parse } from "csv-parse/sync";

export const leadsRouter = Router();

/** Spread customData fields to top level for frontend compatibility (reads lead.budget, lead.customerType, etc.) */
function spreadCustomDataToLead(leadObj: any): any {
  if (!leadObj) return leadObj;
  const obj = leadObj.toObject ? leadObj.toObject() : { ...leadObj };
  if (obj.customData) {
    const customDataObj =
      obj.customData instanceof Map ? Object.fromEntries(obj.customData) : obj.customData;
    if (customDataObj && typeof customDataObj === "object") {
      Object.assign(obj, customDataObj);
    }
  }
  return obj;
}

// All lead operations require authentication. Fine-grained permissions are
// enforced per endpoint and per-lead below.
leadsRouter.use(requireAuth);

type LeadScope = "own" | "team" | "all";

type AccessUser = {
  id: string;
  email: string;
  permissions?: string[];
  isAdmin?: boolean;
};

async function getTeamMemberIdsForRoleOwner(userId: string): Promise<string[]> {
  // New System: If a user has leads.read.team (or manage) profile permission,
  // they can see leads of all users who report to them directly or indirectly.

  // Note: the "leads.read.team" permission itself is checked in the auth middleware 
  // or before calling this function. This function purely resolves the User IDs.

  try {
    const { AccessControlService } = await import("../services/auth/AccessControlService");
    const descendantIds = await AccessControlService.getDescendants(userId);
    return descendantIds;
  } catch (error) {
    console.error("Error fetching team member IDs:", error);
    return [];
  }
}

const DEFAULT_LEAD_PAGE_SIZE = 50;
const MAX_LEAD_PAGE_SIZE = 200;

function parseLeadListPage(query: Record<string, unknown>): number {
  const raw = query.page;
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

function parseLeadListLimit(query: Record<string, unknown>): number {
  const raw = query.limit;
  const n = typeof raw === "string" ? parseInt(raw, 10) : typeof raw === "number" ? raw : NaN;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LEAD_PAGE_SIZE;
  return Math.min(n, MAX_LEAD_PAGE_SIZE);
}

type LeadsIndexQuery = {
  status?: string;
  source?: string;
  assigneeId?: string;
  propertyId?: string;
  fromDate?: string;
  toDate?: string;
  heat?: string;
  assignmentSource?: string;
  stageId?: string;
  search?: string;
};

/**
 * Build Mongo filter for lead index (list + summary). Caller must resolve `effectiveScope` and permissions first.
 */
async function buildLeadsIndexFilter(
  user: AccessUser,
  query: LeadsIndexQuery,
  effectiveScope: LeadScope
): Promise<{ filter: Record<string, unknown>; earlyEmpty: boolean }> {
  const filter: Record<string, unknown> = {};

  if (query.status) filter.status = query.status;
  if (query.source) filter.source = query.source;
  if (query.assigneeId) filter.assignedToUserId = query.assigneeId;
  if (query.propertyId) filter.propertyId = query.propertyId;
  if (query.heat) filter.heatLevel = query.heat;
  if (
    query.assignmentSource &&
    ["v2_rule", "legacy_rule", "round_robin_fallback", "manual", "overflow", "none"].includes(
      String(query.assignmentSource)
    )
  ) {
    filter.assignmentSource = query.assignmentSource;
  }

  if (query.stageId && query.stageId !== "ALL" && Types.ObjectId.isValid(String(query.stageId))) {
    filter.stageId = new Types.ObjectId(String(query.stageId));
  }

  if (query.fromDate || query.toDate) {
    filter.createdAt = {};
    if (query.fromDate) (filter.createdAt as Record<string, Date>).$gte = new Date(String(query.fromDate));
    if (query.toDate) (filter.createdAt as Record<string, Date>).$lte = new Date(String(query.toDate));
  }

  const trimmedSearch = query.search ? String(query.search).trim() : "";
  if (trimmedSearch.length > 0) {
    const esc = trimmedSearch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(esc, "i");
    filter.$or = [
      { leadNumber: re },
      { "contactDetails.name": re },
      { "contactDetails.email": re },
      { "contactDetails.phone": re },
    ];
  }

  if (effectiveScope === "own") {
    filter.assignedToUserId = user.id;
  } else if (effectiveScope === "team") {
    const teamMemberIds = await getTeamMemberIdsForRoleOwner(user.id);
    if (teamMemberIds.length === 0) {
      return { filter: {}, earlyEmpty: true };
    }
    filter.assignedToUserId = { $in: teamMemberIds };
  }

  return { filter, earlyEmpty: false };
}

async function attachItinerariesToLeads(leads: Record<string, unknown>[]): Promise<unknown[]> {
  if (leads.length === 0) return [];
  const { LeadItineraryModel } = await import("../models/leadItinerary");
  const leadIds = leads.map((l) => l._id);
  const allItins = await LeadItineraryModel.find({ leadId: { $in: leadIds } })
    .select("leadId checkInDate checkOutDate hotelName")
    .lean();
  const byLead = new Map<string, any[]>();
  for (const it of allItins) {
    const k = String(it.leadId);
    if (!byLead.has(k)) byLead.set(k, []);
    byLead.get(k)!.push(it);
  }
  return leads.map((l) => {
    const obj = spreadCustomDataToLead(l);
    const itineraries = byLead.get(String(l._id)) ?? [];
    return { ...obj, itineraries };
  });
}

const roomRequestSchema = z.object({
  roomTypeId: z.string().min(1).optional(),
  roomTypeName: z.string().optional(),
  quantity: z.number().int().min(1).optional(),
  adults: z.number().int().min(1).optional(),
  children: z.number().int().min(0).optional(),
  notes: z.string().optional(),
});

const hotelSchema = z.object({
  hotelName: z.string().optional(),
  propertyId: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  // Legacy single room category (backward compatible)
  roomCategory: z.string().optional(),
  // New multi-room-type structure (preferred)
  roomsRequested: z.array(roomRequestSchema).optional(),
  roomPreference: z.string().optional(),
  numberOfGuests: z.string().optional(),
});

const leadCreateSchema = z.object({
  guestId: z.string().optional(),
  guestContact: z
    .object({
      name: z.string().trim().min(1, "Guest name is required"),
      phone: z
        .string()
        .trim()
        .regex(/^\+?[0-9\s\-()]{10,15}$/, "Invalid phone number")
        .optional(),
      email: z.string().trim().email().optional(),
    })
    .refine(
      (value) => Boolean(value.phone?.trim() || value.email?.trim()),
      "At least one contact method (phone or email) is required"
    )
    .optional(),
  propertyId: z.string().optional(),
  accountId: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  leadType: z.nativeEnum(LeadType),
  heatLevel: z.nativeEnum(HeatLevel).optional(),
  // Additional form fields
  alternateContact: z.string().optional(),
  occupation: z.string().optional(),
  bookingSource: z.string().optional(),
  specialRequests: z.string().optional(),
  isCorporateBooking: z.boolean().optional(),
  companyName: z.string().optional(),
  gstin: z.string().optional(),
  estimatedValue: z.string().optional(),
  notes: z.string().optional(),
  // Assignment options
  assignmentMode: z.enum(["auto", "manual"]).optional(),
  assignedToUserId: z.string().optional(),
  // Dynamic custom fields
  customData: z.record(z.any()).optional(),
  hotels: z.array(hotelSchema).optional(),
  budget: z.number().optional(),
  bookingWindow: z.string().optional(),
  customerType: z.string().optional(),
  // Hotel booking fields
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  roomTypeName: z.string().optional(),
  ratePlanId: z.string().optional(),
  ratePlanName: z.string().optional(),
  roomCategory: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  estimatedRate: z.number().optional(),
});

// Get eligible users for manual assignment based on lead type
leadsRouter.get("/eligible-assignees", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const { leadType } = req.query;

    if (!leadType || !Object.values(LeadType).includes(leadType as LeadType)) {
      throw badRequest("Valid leadType query parameter is required");
    }

    const eligibleUsers = await getEligibleUsersForManualAssignment(
      leadType as LeadType
    );

    res.json(eligibleUsers);
  } catch (err) {
    next(err);
  }
});

/** Dry-run assignment: test what assignee would be chosen without creating a lead */
leadsRouter.post("/test-assignment", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");
    if (!req.user.isAdmin && !hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
      throw forbidden("Insufficient permissions for test assignment");
    }

    const data = req.body;
    const { PropertyModel } = await import("../models/property");
    const { AccountModel } = await import("../models/account");
    const { Types } = await import("mongoose");

    let orgId: string | undefined;
    if (data.propertyId && Types.ObjectId.isValid(data.propertyId)) {
      orgId = data.propertyId;
    } else if (data.accountId && Types.ObjectId.isValid(data.accountId)) {
      orgId = data.accountId;
    } else {
      const firstProp = await PropertyModel.findOne().select("_id").lean();
      if (firstProp) orgId = String((firstProp as any)._id);
    }

    const result = await dryRunAssignment(
      {
        source: data.source,
        leadType: data.leadType,
        assignmentMode: data.assignmentMode ?? "auto",
        assignedToUserId: data.assignedToUserId,
        budget: data.budget,
        bookingWindow: data.bookingWindow,
        customerType: data.customerType,
        customData: data.customData,
      },
      orgId
    );

    res.json({ assignment: result, orgId });
  } catch (err) {
    next(err);
  }
});

leadsRouter.post("/", async (req, res, next) => {
  try {
    if (
      !req.user ||
      !(
        hasPermission(req.user, PERMISSIONS.LEADS.CREATE) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)
      )
    ) {
      throw forbidden("Insufficient permissions to create leads");
    }

    const parsed = leadCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid lead payload");
    }

    const data = parsed.data;

    let estimatedRoomNights: number | undefined;
    let estimatedRevenue: number | undefined;

    // Auto-calculate room nights and revenue
    if (data.checkIn && data.checkOut) {
      const nights = Math.round(
        (new Date(data.checkOut).getTime() - new Date(data.checkIn).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      estimatedRoomNights = nights > 0 ? nights : undefined;
      if (data.estimatedRate && nights > 0) {
        estimatedRevenue = data.estimatedRate * nights;
      }
    }

    const hotels = data.hotels?.map((h) => ({
      ...h,
      checkInDate: h.checkInDate ? new Date(h.checkInDate) : undefined,
      checkOutDate: h.checkOutDate ? new Date(h.checkOutDate) : undefined,
    }));

    const lead = await createLead({
      guestId: data.guestId,
      guestContact: data.guestContact,
      propertyId: data.propertyId,
      accountId: data.accountId,
      source: data.source,
      leadType: data.leadType,
      heatLevel: data.heatLevel,
      // Additional form fields
      alternateContact: data.alternateContact,
      occupation: data.occupation,
      bookingSource: data.bookingSource,
      specialRequests: data.specialRequests,
      isCorporateBooking: data.isCorporateBooking,
      companyName: data.companyName,
      gstin: data.gstin,
      estimatedValue: data.estimatedValue,
      notes: data.notes,
      budget: data.budget ?? data.customData?.budget,
      bookingWindow: data.bookingWindow ?? data.customData?.bookingWindow ?? data.customData?.booking_window,
      customerType: data.customerType ?? data.customData?.customerType ?? data.customData?.customer_type,
      // Pass assignment options
      assignmentMode: data.assignmentMode ?? "auto",
      assignedToUserId: data.assignedToUserId,
      createdByUserId: req.user?.id,
      customData: data.customData,
      hotels,
      // Hotel booking fields
      checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      roomTypeId: data.roomTypeId,
      roomTypeName: data.roomTypeName,
      ratePlanId: data.ratePlanId,
      ratePlanName: data.ratePlanName,
      roomCategory: data.roomCategory,
      adults: data.adults,
      children: data.children,
      estimatedRate: data.estimatedRate,
      estimatedRoomNights,
      estimatedRevenue,
    });

    // Note: Activity logging is now handled in leadService.createLead
    logAudit(
      "created",
      "lead",
      lead._id.toString(),
      null,
      { leadNumber: lead.leadNumber, source: lead.source },
      req,
      { orgId: lead.orgId?.toString() }
    );

    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

leadsRouter.post("/bulk-upload", uploadResource.single("file"), async (req, res, next) => {
  try {
    if (
      !req.user ||
      !(
        hasPermission(req.user, PERMISSIONS.LEADS.CREATE) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)
      )
    ) {
      throw forbidden("Insufficient permissions to create leads from CSV");
    }

    if (!req.file) {
      throw badRequest("CSV file is required");
    }

    // Parse CSV from memory buffer
    const csvData = req.file.buffer.toString("utf-8");
    const records = parse(csvData, {
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });

    if (records.length === 0) {
      throw badRequest("No valid data found in CSV file.");
    }

    // Prepare success and failure tracking
    let successCount = 0;
    const errors = [];

    // Process row by row
    for (let i = 0; i < records.length; i++) {
      const row: any = records[i];
      try {
        // Map common CSV columns to our schema
        const name = String(row.Name || row.name || row.GuestName || "").trim();
        const phone = String(row.Phone || row.phone || row.Contact || "").trim();
        const email = String(row.Email || row.email || "").trim();
        const notes = row.Notes || row.notes || "Imported via CSV Bulk Upload";

        if (!name) {
          throw new Error("Name is required");
        }
        if (!phone && !email) {
          throw new Error("Either phone or email is required");
        }

        await createLead({
          guestContact: {
            name,
            phone: phone || undefined,
            email: email || undefined,
          },
          source: LeadSource.CSV_UPLOAD,
          leadType: LeadType.STAY, // default
          notes,
          assignmentMode: "auto",
          createdByUserId: req.user.id,
        });

        successCount++;
      } catch (err: any) {
        // If Active Lead exists (duplicate check fail), log it specifically
        const errorMsg = err instanceof Error ? err.message : String(err);
        errors.push({ row: i + 1, data: row, error: errorMsg });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${records.length} records.`,
      successCount,
      failureCount: errors.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const q = req.query as Record<string, string | undefined>;
    const requestedScope = q.scope as string | undefined;
    let effectiveScope: LeadScope;

    if (requestedScope === "team") {
      if (
        hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
        req.user.isAdmin
      ) {
        effectiveScope = "team";
      } else {
        throw forbidden("Insufficient permissions for team leads");
      }
    } else if (requestedScope === "all") {
      if (req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
        effectiveScope = "all";
      } else {
        throw forbidden("Insufficient permissions for all leads");
      }
    } else {
      if (
        !(
          hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
          hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
          req.user.isAdmin
        )
      ) {
        throw forbidden("Insufficient permissions for own leads");
      }
      effectiveScope = "own";
    }

    const indexQuery: LeadsIndexQuery = {
      status: q.status,
      source: q.source,
      assigneeId: q.assigneeId,
      propertyId: q.propertyId,
      fromDate: q.fromDate,
      toDate: q.toDate,
      heat: q.heat,
      assignmentSource: q.assignmentSource,
      stageId: q.stageId,
      search: q.search,
    };

    const { filter, earlyEmpty } = await buildLeadsIndexFilter(
      req.user as AccessUser,
      indexQuery,
      effectiveScope
    );

    const page = parseLeadListPage(req.query as Record<string, unknown>);
    const limit = parseLeadListLimit(req.query as Record<string, unknown>);
    const skip = (page - 1) * limit;

    if (earlyEmpty) {
      return res.json({
        items: [],
        total: 0,
        page,
        limit,
        hasMore: false,
      });
    }

    const [total, leads] = await Promise.all([
      LeadModel.countDocuments(filter),
      LeadModel.find(filter)
        .populate("guestId", "name phone email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const items = await attachItinerariesToLeads(leads as Record<string, unknown>[]);
    const hasMore = skip + items.length < total;

    res.json({
      items,
      total,
      page,
      limit,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
});

/** Get assignment source stats - counts by how leads were assigned (for verifying rules) */
leadsRouter.get("/assignment-stats", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");
    if (!req.user.isAdmin && !hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
      throw forbidden("Insufficient permissions for assignment stats");
    }

    const { fromDate, toDate } = req.query;
    const match: Record<string, unknown> = {};
    if (fromDate || toDate) {
      match.createdAt = {};
      if (fromDate) (match.createdAt as any).$gte = new Date(String(fromDate));
      if (toDate) (match.createdAt as any).$lte = new Date(String(toDate));
    }

    const stats = await LeadModel.aggregate([
      { $match: Object.keys(match).length ? match : {} },
      { $group: { _id: "$assignmentSource", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const bySource: Record<string, number> = {};
    for (const s of stats) {
      const key = s._id != null ? String(s._id) : "not_tracked"; // Old leads created before this field
      bySource[key] = s.count;
    }

    res.json({ bySource, total: stats.reduce((sum, s) => sum + s.count, 0) });
  } catch (err) {
    next(err);
  }
});

/** Aggregated counts + recent leads + alerts for dashboard (same scope rules as GET /leads). */
leadsRouter.get("/summary", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");

    const q = req.query as Record<string, string | undefined>;
    const requestedScope = q.scope as string | undefined;
    let effectiveScope: LeadScope;

    if (requestedScope === "team") {
      if (
        hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
        req.user.isAdmin
      ) {
        effectiveScope = "team";
      } else {
        throw forbidden("Insufficient permissions for team leads");
      }
    } else if (requestedScope === "all") {
      if (req.user.isAdmin || hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)) {
        effectiveScope = "all";
      } else {
        throw forbidden("Insufficient permissions for all leads");
      }
    } else {
      if (
        !(
          hasPermission(req.user, PERMISSIONS.LEADS.READ) ||
          hasPermission(req.user, PERMISSIONS.LEADS.MANAGE) ||
          req.user.isAdmin
        )
      ) {
        throw forbidden("Insufficient permissions for own leads");
      }
      effectiveScope = "own";
    }

    const indexQuery: LeadsIndexQuery = {
      status: q.status,
      source: q.source,
      assigneeId: q.assigneeId,
      propertyId: q.propertyId,
      fromDate: q.fromDate,
      toDate: q.toDate,
      heat: q.heat,
      assignmentSource: q.assignmentSource,
      stageId: q.stageId,
      search: q.search,
    };

    const { filter, earlyEmpty } = await buildLeadsIndexFilter(
      req.user as AccessUser,
      indexQuery,
      effectiveScope
    );

    const emptyPayload = {
      stats: {
        totalLeads: 0,
        todayLeads: 0,
        hotLeads: 0,
        warmLeads: 0,
        coldLeads: 0,
        confirmed: 0,
        newLeads: 0,
        contacted: 0,
        conversionRate: 0,
        leadsBySource: {} as Record<string, number>,
      },
      recentLeads: [] as unknown[],
      alerts: [] as unknown[],
    };

    if (earlyEmpty) {
      return res.json(emptyPayload);
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const nowMs = Date.now();
    const threeDaysMs = 3 * 86400000;

    const checkInWindow = {
      checkIn: {
        $gte: new Date(nowMs),
        $lte: new Date(nowMs + threeDaysMs),
      },
    };

    const [total, agg, recentDocs, checkInLeads, staleNew] = await Promise.all([
      LeadModel.countDocuments(filter),
      LeadModel.aggregate([
        { $match: filter },
        {
          $facet: {
            heat: [{ $group: { _id: "$heatLevel", count: { $sum: 1 } } }],
            status: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
            source: [{ $group: { _id: "$source", count: { $sum: 1 } } }],
            today: [{ $match: { createdAt: { $gte: todayStart } } }, { $count: "c" }],
          },
        },
      ]),
      LeadModel.find(filter)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("guestId", "name phone email")
        .lean(),
      LeadModel.find({ ...filter, ...checkInWindow })
        .select("leadNumber checkIn createdAt")
        .limit(400)
        .lean(),
      LeadModel.find({
        ...filter,
        status: LeadStatus.NEW,
        createdAt: { $lt: new Date(nowMs - 3600000) },
      })
        .select("leadNumber createdAt")
        .limit(400)
        .lean(),
    ]);

    const facet = (agg[0] as Record<string, { _id?: string; count?: number; c?: number }[]>) || {
      heat: [],
      status: [],
      source: [],
      today: [],
    };

    const statusRows = facet.status || [];
    const statusCount = (s: string) =>
      statusRows.find((x) => x._id === s)?.count ?? 0;

    const heatRows = facet.heat || [];
    const heatCount = (h: string) => heatRows.find((x) => x._id === h)?.count ?? 0;

    const leadsBySource: Record<string, number> = {};
    for (const row of facet.source || []) {
      if (row._id) leadsBySource[String(row._id)] = row.count ?? 0;
    }

    const todayLeads = facet.today?.[0]?.c ?? 0;
    const confirmed = statusCount(LeadStatus.CONFIRMED);
    const conversionRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;

    const alerts: Array<{
      leadId: string;
      message: string;
      minutesOld: number;
      type: "checkin_urgent" | "checkin_critical" | "followup_overdue" | "no_response";
    }> = [];

    for (const l of checkInLeads) {
      if (!l.checkIn) continue;
      const checkInTime = new Date(l.checkIn).getTime();
      const daysUntilCheckIn = Math.floor((checkInTime - nowMs) / (1000 * 60 * 60 * 24));
      if (daysUntilCheckIn < 0 || daysUntilCheckIn > 3) continue;
      const hoursSinceCreated = l.createdAt
        ? Math.floor((nowMs - new Date(l.createdAt).getTime()) / (1000 * 60 * 60))
        : 0;
      if (daysUntilCheckIn <= 1) {
        alerts.push({
          leadId: String(l._id),
          message: `Check-in in ${daysUntilCheckIn} day(s) - ${l.leadNumber}`,
          minutesOld: hoursSinceCreated * 60,
          type: "checkin_critical",
        });
      } else {
        alerts.push({
          leadId: String(l._id),
          message: `Check-in in ${daysUntilCheckIn} days - ${l.leadNumber}`,
          minutesOld: hoursSinceCreated * 60,
          type: "checkin_urgent",
        });
      }
    }

    for (const l of staleNew) {
      if (!l.createdAt) continue;
      const hoursSinceCreated = Math.floor(
        (nowMs - new Date(l.createdAt).getTime()) / (1000 * 60 * 60)
      );
      if (hoursSinceCreated >= 1) {
        alerts.push({
          leadId: String(l._id),
          message: `New lead without response - ${l.leadNumber}`,
          minutesOld: hoursSinceCreated * 60,
          type: "no_response",
        });
      }
    }

    alerts.sort((a, b) => {
      const priorityOrder: Record<string, number> = {
        checkin_critical: 0,
        checkin_urgent: 1,
        followup_overdue: 2,
        no_response: 3,
      };
      return (
        (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99) ||
        a.minutesOld - b.minutesOld
      );
    });

    const recentLeads = recentDocs.map((l) => {
      const o = spreadCustomDataToLead(l) as Record<string, unknown>;
      const id = o._id ? String(o._id) : "";
      let checkInDate: string | undefined;
      if (o.checkIn) {
        checkInDate = new Date(o.checkIn as Date).toISOString().slice(0, 10);
      }
      return { ...o, id, checkInDate };
    });

    res.json({
      stats: {
        totalLeads: total,
        todayLeads,
        hotLeads: heatCount(HeatLevel.HOT),
        warmLeads: heatCount(HeatLevel.WARM),
        coldLeads: heatCount(HeatLevel.COLD),
        confirmed,
        newLeads: statusCount(LeadStatus.NEW),
        contacted: statusCount(LeadStatus.CONTACTED),
        conversionRate,
        leadsBySource,
      },
      recentLeads,
      alerts: alerts.slice(0, 10),
    });
  } catch (err) {
    next(err);
  }
});

const LEAD_DETAIL_ACTIVITIES_LIMIT = 150;
const LEAD_DETAIL_COMMUNICATIONS_LIMIT = 150;
const LEAD_DETAIL_PREVIOUS_COMM_LIMIT = 50;

leadsRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await LeadModel.findById(req.params.id)
      .populate("guestId", "name phone email")
      .populate("propertyId", "name")
      .lean();
    if (!lead) {
      throw notFound("Lead not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertLeadAccess(req.user, lead);

    // Get activities and communications for current lead
    const [activities, communications] = await Promise.all([
      LeadActivityModel.find({ leadId: lead._id })
        .populate("performedByUserId", "name email")
        .populate("assignedByUserId", "name email")
        .populate("fromUserId", "name email")
        .populate("toUserId", "name email")
        .sort({ performedAt: -1 })
        .limit(LEAD_DETAIL_ACTIVITIES_LIMIT)
        .lean(),
      CommunicationModel.find({ leadId: lead._id })
        .populate("performedByUserId", "name email")
        .select("-rawPayload")
        .sort({ createdAt: -1 })
        .limit(LEAD_DETAIL_COMMUNICATIONS_LIMIT)
        .lean(),
    ]);

    // Previous communications for same guest (last 30 days) — single query on guestId when available
    let previousCommunications: any[] = [];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const guestObjectId =
      lead.guestId && typeof lead.guestId === "object" && "_id" in (lead.guestId as object)
        ? (lead.guestId as { _id: Types.ObjectId })._id
        : (lead.guestId as Types.ObjectId | undefined);

    if (guestObjectId) {
      previousCommunications = await CommunicationModel.find({
        guestId: guestObjectId,
        leadId: { $ne: lead._id },
        createdAt: { $gte: thirtyDaysAgo },
      })
        .select("-rawPayload")
        .populate("performedByUserId", "name email")
        .sort({ createdAt: -1 })
        .limit(LEAD_DETAIL_PREVIOUS_COMM_LIMIT)
        .lean();
    }

    const { LeadItineraryModel } = await import("../models/leadItinerary");
    const itineraries = await LeadItineraryModel.find({ leadId: lead._id }).sort({ createdAt: 1 }).lean();

    const leadObj = spreadCustomDataToLead(lead);
    const editableLeadFields = getEditableLeadFieldKeys(req.user);
    res.json({
      lead: { ...leadObj, itineraries },
      activities,
      communications,
      previousCommunications,
      editableLeadFields,
    });
  } catch (err) {
    next(err);
  }
});

import { ScoringService } from "../services/scoringService";

const leadUpdateSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  source: z.nativeEnum(LeadSource).optional(),
  heatLevel: z.nativeEnum(HeatLevel).optional(),
  callStatus: z.nativeEnum(CallStatus).optional(),
  notes: z.string().optional(),
  assignedToUserId: z.string().optional(),
  stageId: z.string().optional(),
  budget: z.number().optional(),
  bookingWindow: z.string().optional(),
  customerType: z.string().optional(),
  // Allow updating contact details (the inquiry snapshot)
  contactDetails: z
    .object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  customData: z.record(z.any()).optional(),
  hotels: z.array(hotelSchema).optional(),
  // Hotel booking fields
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  roomTypeName: z.string().optional(),
  ratePlanId: z.string().optional(),
  ratePlanName: z.string().optional(),
  roomCategory: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  estimatedRate: z.number().optional(),
});

leadsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = leadUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      const issue = parsed.error.issues?.[0];
      const path = issue?.path?.length ? issue.path.join(".") : undefined;
      const msg = issue?.message || "Invalid lead update payload";
      throw badRequest(path ? `Invalid lead update payload: ${path} — ${msg}` : msg);
    }

    const existing = await LeadModel.findById(req.params.id);
    if (!existing) {
      throw notFound("Lead not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertLeadAccess(req.user, existing);

    if (!canAccessLeadPatch(req.user)) {
      throw forbidden("Insufficient permissions to update leads");
    }

    enforceLeadFieldPermissions(req.user, parsed.data as Record<string, unknown>);

    const prevStatus = existing.status;
    const prevStageId = existing.stageId?.toString();
    const prevHeatLevel = existing.heatLevel;
    const prevCallStatus = existing.callStatus;
    const beforeSnapshot = existing.toObject ? existing.toObject() : {};

    if (parsed.data.status) {
      existing.status = parsed.data.status;
      if (
        !existing.firstResponseAt &&
        parsed.data.status !== LeadStatus.NEW
      ) {
        existing.firstResponseAt = new Date();
      }
      if (
        [
          LeadStatus.CONFIRMED,
          LeadStatus.LOST,
          LeadStatus.CLOSED_AUTO,
        ].includes(parsed.data.status)
      ) {
        existing.closedAt = new Date();
      }
    }

    if (parsed.data.source !== undefined) {
      existing.source = parsed.data.source;
    }

    if (parsed.data.heatLevel !== undefined) {
      existing.heatLevel = parsed.data.heatLevel;
    }

    if (parsed.data.callStatus !== undefined) {
      existing.callStatus = parsed.data.callStatus;
    }

    if (parsed.data.notes !== undefined) {
      existing.notes = parsed.data.notes;
    }

    if (parsed.data.customData) {
      existing.customData = new Map(Object.entries(parsed.data.customData));
      existing.markModified("customData");
      const cd = parsed.data.customData;
      if (cd.budget !== undefined) existing.budget = Number(cd.budget) || 0;
      if (cd.booking_window !== undefined || cd.bookingWindow !== undefined) {
        existing.bookingWindow = (cd.booking_window ?? cd.bookingWindow) as string;
      }
      if (cd.customer_type !== undefined || cd.customerType !== undefined) {
        existing.customerType = (cd.customer_type ?? cd.customerType) as string;
      }
    }

    if (parsed.data.budget !== undefined) existing.budget = parsed.data.budget;
    if (parsed.data.bookingWindow !== undefined) existing.bookingWindow = parsed.data.bookingWindow;
    if (parsed.data.customerType !== undefined) existing.customerType = parsed.data.customerType;

    // Hotel booking fields
    if (parsed.data.checkIn) existing.checkIn = new Date(parsed.data.checkIn);
    if (parsed.data.checkOut) existing.checkOut = new Date(parsed.data.checkOut);
    if (parsed.data.roomTypeId !== undefined) existing.roomTypeId = parsed.data.roomTypeId;
    if (parsed.data.roomTypeName !== undefined) existing.roomTypeName = parsed.data.roomTypeName;
    if (parsed.data.ratePlanId !== undefined) existing.ratePlanId = parsed.data.ratePlanId;
    if (parsed.data.ratePlanName !== undefined) existing.ratePlanName = parsed.data.ratePlanName;
    if (parsed.data.roomCategory !== undefined) existing.roomCategory = parsed.data.roomCategory;
    if (parsed.data.adults !== undefined) existing.adults = parsed.data.adults;
    if (parsed.data.children !== undefined) existing.children = parsed.data.children;
    if (parsed.data.estimatedRate !== undefined) existing.estimatedRate = parsed.data.estimatedRate;

    // Auto-calculate room nights and revenue
    if (existing.checkIn && existing.checkOut) {
      const nights = Math.round(
        (new Date(existing.checkOut).getTime() - new Date(existing.checkIn).getTime()) 
        / (1000 * 60 * 60 * 24)
      );
      existing.estimatedRoomNights = nights > 0 ? nights : undefined;
      if (existing.estimatedRate && nights > 0) {
        existing.estimatedRevenue = existing.estimatedRate * nights;
      }
    }

    // Handle contactDetails update (with normalization)
    if (parsed.data.contactDetails) {
      const { normalizePhone, normalizeEmail } = await import("../utils/phoneUtils");
      const { name, phone, email } = parsed.data.contactDetails;

      existing.contactDetails = {
        name,
        phone: normalizePhone(phone) || undefined,
        email: normalizeEmail(email) || undefined,
      };
    }

    // Handle reassignment (allowed keys already enforced via enforceLeadFieldPermissions + getEditableLeadFieldKeys)
    if (parsed.data.assignedToUserId) {
      const previousAssigneeId = existing.assignedToUserId?.toString();
      const newAssigneeId = parsed.data.assignedToUserId;

      if (previousAssigneeId !== newAssigneeId) {
        await reassignLead(
          existing._id.toString(),
          newAssigneeId,
          req.user.id
        );
        const updatedLead = await LeadModel.findById(existing._id);
        if (updatedLead) {
          if (parsed.data.status) updatedLead.status = parsed.data.status;

          if (parsed.data.status && parsed.data.status !== prevStatus) {
            await LeadActivityModel.create({
              leadId: updatedLead._id,
              type: LeadActivityType.STATUS_CHANGE,
              fromStatus: prevStatus,
              toStatus: parsed.data.status,
              performedByUserId: req.user?.id,
              performedAt: new Date(),
            });
          }

          logAudit(
            "assigned",
            "lead",
            existing._id.toString(),
            { assignedToUserId: previousAssigneeId },
            { assignedToUserId: newAssigneeId },
            req,
            { orgId: existing.orgId?.toString() }
          );
          return res.json(spreadCustomDataToLead(updatedLead));
        }
      } else {
        existing.assignedToUserId = newAssigneeId as any;
      }
    }

    // Handle Stage Move (Pipeline Builder E2)
    if (parsed.data.stageId && parsed.data.stageId !== existing.stageId?.toString()) {
      const validation = await validateStageMove(existing._id.toString(), parsed.data.stageId);

      if (!validation.allowed) {
        if (validation.reason === 'already_terminal') {
          return res.status(422).json({
            error: 'Cannot move lead from a terminal stage.',
            reason: validation.reason
          });
        } else if (validation.missingFields && validation.missingFields.length > 0) {
          return res.status(422).json({
            error: 'Mandatory fields are missing for this stage.',
            missingFields: validation.missingFields
          });
        } else {
          return res.status(422).json({ error: 'Stage move not allowed', reason: validation.reason });
        }
      }

      const previousStageId = existing.stageId;
      existing.stageId = parsed.data.stageId as any;

      // Emit event locally without awaiting or breaking the request
      logAudit(
        "stage_moved",
        "lead",
        existing._id.toString(),
        { stageId: previousStageId?.toString() },
        { stageId: parsed.data.stageId },
        req,
        { orgId: existing.orgId?.toString() }
      );
      process.nextTick(() => {
        leadEventBus.emit('lead.stage_moved', {
          leadId: existing._id.toString(),
          fromStageId: previousStageId?.toString() || null,
          toStageId: parsed.data.stageId,
        });
      });
    }

    if (parsed.data.hotels !== undefined) {
      const { LeadItineraryModel } = await import("../models/leadItinerary");
      // For simplicity, replace all itineraries for this lead
      await LeadItineraryModel.deleteMany({ leadId: existing._id });
      if (parsed.data.hotels.length > 0) {
        const { Types } = await import("mongoose");
        const itinerariesToInsert = parsed.data.hotels.map((hotel: any) => ({
          leadId: existing._id,
          hotelName: hotel.hotelName,
          propertyId: hotel.propertyId && Types.ObjectId.isValid(hotel.propertyId) ? new Types.ObjectId(hotel.propertyId) : undefined,
          checkInDate: hotel.checkInDate,
          checkOutDate: hotel.checkOutDate,
          roomCategory: hotel.roomCategory,
          roomsRequested: hotel.roomsRequested,
          roomPreference: hotel.roomPreference,
          numberOfGuests: hotel.numberOfGuests,
        }));
        await LeadItineraryModel.insertMany(itinerariesToInsert);
      }
    }

    await existing.save();

    // Re-score asynchronously when scoring-relevant fields change
    const body = req.body || {};
    const scoringFields = ["budget", "checkInDate", "customerType", "source", "bookingWindow", "hotels", "customData"];
    const scoringFieldChanged = scoringFields.some(
      (f) => body[f] !== undefined || body.customData?.[f] !== undefined
    );
    if (scoringFieldChanged) {
      import("../services/scoringService").then(({ ScoringService }) => {
        ScoringService.calculateLeadScore(existing._id.toString()).catch((err) =>
          logger.error("Re-scoring failed after lead update", {}, err instanceof Error ? err : new Error(String(err)))
        );
      });
    }

    // Log status change
    if (parsed.data.status && parsed.data.status !== prevStatus) {
      await LeadActivityModel.create({
        leadId: existing._id,
        type: LeadActivityType.STATUS_CHANGE,
        fromStatus: prevStatus,
        toStatus: parsed.data.status,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });
    }

    // Log heat level change
    if (parsed.data.heatLevel !== undefined && parsed.data.heatLevel !== prevHeatLevel) {
      await LeadActivityModel.create({
        leadId: existing._id,
        type: LeadActivityType.STATUS_CHANGE,
        note: `Heat level changed from ${prevHeatLevel} to ${parsed.data.heatLevel}`,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });
    }

    // Log call status change
    if (parsed.data.callStatus !== undefined && parsed.data.callStatus !== prevCallStatus) {
      await LeadActivityModel.create({
        leadId: existing._id,
        type: LeadActivityType.STATUS_CHANGE,
        note: `Call disposition changed from ${prevCallStatus || "None"} to ${parsed.data.callStatus}`,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });
    }

    // Log notes update if notes were changed
    if (parsed.data.notes !== undefined && parsed.data.notes !== existing.notes) {
      await LeadActivityModel.create({
        leadId: existing._id,
        type: LeadActivityType.NOTE,
        note: parsed.data.notes,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });
    }

    // Emit lead.field_changed for workflow triggers
    const fieldSlugMap: Record<string, string> = {
      contactDetails: "contact_details",
      assignedToUserId: "assigned_agent_id",
      stageId: "stage_id",
      heatLevel: "bucket",
    };
    for (const key of Object.keys(parsed.data)) {
      if (key === "stageId") continue; // stage_moved is emitted separately
      const slug = fieldSlugMap[key] || key;
      const oldVal = (beforeSnapshot as any)[key];
      const newVal = (existing as any)[key];
      const oldStr = oldVal !== undefined && oldVal !== null ? (typeof oldVal === "object" ? JSON.stringify(oldVal) : String(oldVal)) : undefined;
      const newStr = newVal !== undefined && newVal !== null ? (typeof newVal === "object" ? JSON.stringify(newVal) : String(newVal)) : undefined;
      if (oldStr !== newStr) {
        process.nextTick(() => {
          leadEventBus.emit("lead.field_changed", {
            leadId: existing._id.toString(),
            field_slug: slug,
            old_value: oldStr,
            new_value: newStr,
            orgId: existing.orgId?.toString(),
          });
        });
      }
    }
    if (parsed.data.customData) {
      const beforeCustom = (beforeSnapshot as any).customData;
      const afterCustom = existing.customData;
      const beforeMap = beforeCustom instanceof Map ? Object.fromEntries(beforeCustom) : (beforeCustom || {});
      const afterMap = afterCustom instanceof Map ? Object.fromEntries(afterCustom) : (afterCustom || {});
      const allKeys = new Set([...Object.keys(beforeMap), ...Object.keys(afterMap)]);
      for (const k of allKeys) {
        const ov = beforeMap[k];
        const nv = afterMap[k];
        if (String(ov ?? "") !== String(nv ?? "")) {
          process.nextTick(() => {
            leadEventBus.emit("lead.field_changed", {
              leadId: existing._id.toString(),
              field_slug: k,
              old_value: ov != null ? String(ov) : undefined,
              new_value: nv != null ? String(nv) : undefined,
              orgId: existing.orgId?.toString(),
            });
          });
        }
      }
    }

    const hadStageMove = parsed.data.stageId && parsed.data.stageId !== prevStageId;
    if (!hadStageMove) {
      logAudit(
        "updated",
        "lead",
        existing._id.toString(),
        beforeSnapshot as Record<string, any>,
        existing.toObject ? existing.toObject() : {},
        req,
        { orgId: existing.orgId?.toString() }
      );
    }

    const responseLead = spreadCustomDataToLead(existing);
    res.json(responseLead);
  } catch (err) {
    next(err);
  }
});

const activitySchema = z.object({
  type: z.nativeEnum(LeadActivityType),
  note: z.string().optional(),
  dueAt: z.string().datetime().optional(),
});

leadsRouter.post("/:id/activities", async (req, res, next) => {
  try {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid activity payload");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertLeadAccess(req.user, lead);

    if (parsed.data.type === LeadActivityType.NOTE) {
      if (!canAccessLeadPatch(req.user)) {
        throw forbidden("Insufficient permissions to add activities for this lead");
      }
      enforceLeadFieldPermissions(req.user, { notes: " " });
    } else if (
      !hasPermission(req.user, "leads.update") &&
      !hasPermission(req.user, "leads.manage")
    ) {
      throw forbidden(
        "Insufficient permissions to add activities for this lead"
      );
    }

    const activity = await LeadActivityModel.create({
      leadId: lead._id,
      type: parsed.data.type,
      note: parsed.data.note,
      dueAt: parsed.data.dueAt
        ? new Date(parsed.data.dueAt)
        : undefined,
      performedByUserId: req.user?.id,
      performedAt: new Date(),
    });

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/:id/activities", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    const activities = await LeadActivityModel.find({
      leadId: req.params.id,
    })
      .sort({ performedAt: -1 })
      .lean();
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

// Update call status
const callStatusSchema = z.object({
  callStatus: z.nativeEnum(CallStatus),
});

leadsRouter.patch("/:id/call-status", async (req, res, next) => {
  try {
    const parsed = callStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid call status payload");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    if (!canAccessLeadPatch(req.user)) {
      throw forbidden("Insufficient permissions to update call status");
    }
    enforceLeadFieldPermissions(req.user, { callStatus: parsed.data.callStatus });

    lead.callStatus = parsed.data.callStatus;
    await lead.save();

    // Log activity
    await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.STATUS_CHANGE,
      note: `Call status updated to ${parsed.data.callStatus}`,
      performedByUserId: req.user.id,
      performedAt: new Date(),
    });

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// Get communication timeline
leadsRouter.get("/:id/communication-timeline", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    const timeline = await getCommunicationTimeline(req.params.id);
    res.json(timeline);
  } catch (err) {
    next(err);
  }
});

// Add note to lead
const addNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});

leadsRouter.post("/:id/notes", async (req, res, next) => {
  try {
    const parsed = addNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Note is required");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    if (!canAccessLeadPatch(req.user)) {
      throw forbidden("Insufficient permissions to add notes");
    }
    enforceLeadFieldPermissions(req.user, { notes: " " });

    // Create activity log entry
    const activity = await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.NOTE,
      note: parsed.data.note,
      performedByUserId: req.user.id,
      performedAt: new Date(),
    });

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

import { CallQualityService } from "../services/callQualityService";
import { CallQualityScoreModel } from "../models/callQualityScore";

// Submit Call Quality Score
const callQualitySchema = z.object({
  scoresJson: z.record(z.string(), z.number()),
  notes: z.string().optional(),
});

leadsRouter.post("/:id/call-quality", async (req, res, next) => {
  try {
    const parsed = callQualitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid call quality payload");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    // Role Validation (TL or Admin)
    if (!hasPermission(req.user, "leads.manage") && !hasPermission(req.user, "settings.manage")) {
      throw forbidden("Insufficient permissions to score call quality");
    }

    const orgId = "69ae144fae23030b62f901f5"; // Moustache CRM fallback for single tenant deployments

    const score = await CallQualityService.submitCallQualityScore(
      req.params.id,
      req.user.id,
      parsed.data.scoresJson,
      parsed.data.notes || "",
      orgId.toString()
    );

    res.status(201).json(score);
  } catch (err) {
    next(err);
  }
});

// Get Call Quality Scores for lead
leadsRouter.get("/:id/call-quality", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const lead = await LeadModel.findById(req.params.id);
    if (!lead) {
      throw notFound("Lead not found");
    }

    await assertLeadAccess(req.user, lead);

    const scores = await CallQualityScoreModel.find({ leadId: req.params.id })
      .populate("scored_by", "name email")
      .sort({ createdAt: -1 })
      .lean();

    res.json(scores);
  } catch (err) {
    next(err);
  }
});
