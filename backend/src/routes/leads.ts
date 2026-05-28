import { Router } from "express";
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
import { createLead, reassignLead, validateStageMove, leadEventBus, dryRunAssignment } from "../services/leadService";
import { findDuplicateLeads } from "../services/leadDuplicateService";
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

const roomSchema = z.object({
  roomCategory: z.string().optional(),
  roomPreference: z.string().optional(),
  numberOfGuests: z.string().optional(),
});

const hotelSchema = z.object({
  hotelName: z.string().optional(),
  propertyId: z.string().optional(),
  checkInDate: z.string().optional(),
  checkOutDate: z.string().optional(),
  roomCategory: z.string().optional(),
  roomPreference: z.string().optional(),
  numberOfGuests: z.string().optional(),
  rooms: z.array(roomSchema).optional(),
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
  occasion: z.string().optional(),
  roomsRequested: z.number().int().min(0).optional(),
  followUp: z
    .object({
      dueAt: z.string(),
      notes: z.string().optional(),
    })
    .optional(),
  preserveManualHeatLevel: z.boolean().optional(),
});

const duplicateCheckSchema = z.object({
  phone: z.string().optional(),
  email: z.string().optional(),
  accountId: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  excludeLeadId: z.string().optional(),
});

leadsRouter.post("/check-duplicate", async (req, res, next) => {
  try {
    if (!req.user) throw badRequest("Missing authenticated user");
    const parsed = duplicateCheckSchema.safeParse(req.body);
    if (!parsed.success) throw badRequest("Invalid duplicate check payload");
    const matches = await findDuplicateLeads(parsed.data);
    res.json({ matches });
  } catch (err) {
    next(err);
  }
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
      occasion: data.occasion,
      roomsRequested: data.roomsRequested,
      followUp: data.followUp
        ? { dueAt: new Date(data.followUp.dueAt), notes: data.followUp.notes }
        : undefined,
      preserveManualHeatLevel: data.preserveManualHeatLevel ?? Boolean(data.heatLevel),
      // Pass assignment options
      assignmentMode: data.assignmentMode ?? "auto",
      assignedToUserId: data.assignedToUserId,
      createdByUserId: req.user?.id,
      customData: data.customData,
      hotels,
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

    const { status, assigneeId, propertyId, fromDate, toDate, heat, scope, assignmentSource } =
      req.query;
    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (assigneeId) filter.assignedToUserId = assigneeId;
    if (propertyId) filter.propertyId = propertyId;
    if (heat) filter.heatLevel = heat;
    if (assignmentSource && ["v2_rule", "legacy_rule", "round_robin_fallback", "manual", "overflow", "none"].includes(String(assignmentSource))) {
      filter.assignmentSource = assignmentSource;
    }

    if (fromDate || toDate) {
      filter.createdAt = {};
      if (fromDate)
        (filter.createdAt as any).$gte = new Date(
          String(fromDate)
        );
      if (toDate) (filter.createdAt as any).$lte = new Date(String(toDate));
    }

    const requestedScope = scope as string | undefined;
    let effectiveScope: LeadScope;

    // Determine effective scope based on request and permissions
    if (requestedScope === "team") {
      // In the new model, "leads.read" generally allows reading subordinates' data.
      // We accept requests for "team" if they have leads.read or leads.manage.
      // (The actual data filter below enforces the hierarchy).
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
      // Global read access requires admin or manage, or a specific profile configuration
      if (
        req.user.isAdmin ||
        hasPermission(req.user, PERMISSIONS.LEADS.MANAGE)
      ) {
        effectiveScope = "all";
      } else {
        throw forbidden("Insufficient permissions for all leads");
      }
    } else {
      // Default or explicit "own" 
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

    // Apply scope-based filtering - this is critical for permission enforcement
    if (effectiveScope === "own") {
      // Strictly filter to only leads assigned to this user
      filter.assignedToUserId = req.user.id;
    } else if (effectiveScope === "team") {
      const teamMemberIds = await getTeamMemberIdsForRoleOwner(req.user.id);
      if (teamMemberIds.length === 0) {
        // No team members – return empty result quickly.
        return res.json([]);
      }
      filter.assignedToUserId = { $in: teamMemberIds };
    } else {
      // "all" scope - only for admins or users with explicit "all" permission
      // No additional assignee filter, but make sure explicit assigneeId query param doesn't conflict
      // If assigneeId is specified in query, it should take precedence
      if (!assigneeId) {
        // No explicit assignee filter - user can see all leads
      }
    }

    const leads = await LeadModel.find(filter)
      .populate("guestId", "name phone email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const { LeadItineraryModel } = await import("../models/leadItinerary");
    const leadsWithCustomData = await Promise.all(
      leads.map(async (l) => {
        const obj = spreadCustomDataToLead(l);
        const itineraries = await LeadItineraryModel.find({ leadId: l._id })
          .select("checkInDate checkOutDate hotelName")
          .lean();
        return { ...obj, itineraries };
      })
    );
    res.json(leadsWithCustomData);
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
        .lean(),
      CommunicationModel.find({ leadId: lead._id })
        .populate("performedByUserId", "name email")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    // Get previous communications from other leads of the same guest (last 30 days)
    let previousCommunications: any[] = [];
    if (lead.guestId) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find all other leads for the same guest
      const otherLeadIds = await LeadModel.find({
        guestId: lead.guestId,
        _id: { $ne: lead._id }, // Exclude current lead
      })
        .select("_id")
        .lean();

      if (otherLeadIds.length > 0) {
        const otherLeadIdArray = otherLeadIds.map((l) => l._id);

        // Get communications from those leads within last 30 days
        previousCommunications = await CommunicationModel.find({
          leadId: { $in: otherLeadIdArray },
          createdAt: { $gte: thirtyDaysAgo },
        })
          .sort({ createdAt: -1 })
          .lean();
      }
    }

    const { LeadItineraryModel } = await import("../models/leadItinerary");
    const itineraries = await LeadItineraryModel.find({ leadId: lead._id }).sort({ createdAt: 1 }).lean();

    const leadObj = spreadCustomDataToLead(lead);
    res.json({ lead: { ...leadObj, itineraries }, activities, communications, previousCommunications });
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
  accountId: z.string().optional(),
  occasion: z.string().optional(),
  roomsRequested: z.number().optional(),
  estimatedValue: z.string().optional(),
  alternateContact: z.string().optional(),
  specialRequests: z.string().optional(),
  companyName: z.string().optional(),
});

leadsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = leadUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid lead update payload");
    }

    const existing = await LeadModel.findById(req.params.id);
    if (!existing) {
      throw notFound("Lead not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertLeadAccess(req.user, existing);

    if (
      !hasPermission(req.user, "leads.update") &&
      !hasPermission(req.user, "leads.manage")
    ) {
      throw forbidden("Insufficient permissions to update leads");
    }

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
    if (parsed.data.occasion !== undefined) existing.occasion = parsed.data.occasion;
    if (parsed.data.roomsRequested !== undefined) existing.roomsRequested = parsed.data.roomsRequested;
    if (parsed.data.estimatedValue !== undefined) existing.estimatedValue = parsed.data.estimatedValue;
    if (parsed.data.alternateContact !== undefined) existing.alternateContact = parsed.data.alternateContact;
    if (parsed.data.specialRequests !== undefined) existing.specialRequests = parsed.data.specialRequests;
    if (parsed.data.companyName !== undefined) existing.companyName = parsed.data.companyName;
    if (parsed.data.accountId) {
      const { Types } = await import("mongoose");
      if (Types.ObjectId.isValid(parsed.data.accountId)) {
        existing.accountId = new Types.ObjectId(parsed.data.accountId);
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

    // Handle reassignment
    if (parsed.data.assignedToUserId) {
      if (
        hasPermission(req.user, "leads.assign") ||
        hasPermission(req.user, "leads.manage")
      ) {
        const previousAssigneeId = existing.assignedToUserId?.toString();
        const newAssigneeId = parsed.data.assignedToUserId;

        // Only log reassignment if assignee actually changed
        if (previousAssigneeId !== newAssigneeId) {
          // Use the reassignLead service to handle notification and logging
          await reassignLead(
            existing._id.toString(),
            newAssigneeId,
            req.user.id
          );
          // Reload the lead to get updated data
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
      } else {
        throw forbidden("Insufficient permissions to assign leads");
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
      const { Types } = await import("mongoose");
      await LeadItineraryModel.deleteMany({ leadId: existing._id });
      if (parsed.data.hotels.length > 0) {
        const itinerariesToInsert = parsed.data.hotels.map((hotel: any) => {
          const rooms = hotel.rooms && hotel.rooms.length > 0
            ? hotel.rooms.map((r: any) => ({
                roomCategory: r.roomCategory,
                roomPreference: r.roomPreference,
                numberOfGuests: r.numberOfGuests,
              }))
            : hotel.roomCategory || hotel.roomPreference || hotel.numberOfGuests
              ? [{ roomCategory: hotel.roomCategory, roomPreference: hotel.roomPreference, numberOfGuests: hotel.numberOfGuests }]
              : [];
          return {
            leadId: existing._id,
            hotelName: hotel.hotelName,
            propertyId: hotel.propertyId && Types.ObjectId.isValid(hotel.propertyId) ? new Types.ObjectId(hotel.propertyId) : undefined,
            checkInDate: hotel.checkInDate ? new Date(hotel.checkInDate) : undefined,
            checkOutDate: hotel.checkOutDate ? new Date(hotel.checkOutDate) : undefined,
            roomCategory: rooms[0]?.roomCategory ?? hotel.roomCategory,
            roomPreference: rooms[0]?.roomPreference ?? hotel.roomPreference,
            numberOfGuests: rooms[0]?.numberOfGuests ?? hotel.numberOfGuests,
            rooms,
          };
        });
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

    if (
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

    if (
      !hasPermission(req.user, "leads.update") &&
      !hasPermission(req.user, "leads.manage")
    ) {
      throw forbidden("Insufficient permissions to update call status");
    }

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

    if (
      !hasPermission(req.user, "leads.update") &&
      !hasPermission(req.user, "leads.manage")
    ) {
      throw forbidden("Insufficient permissions to add notes");
    }

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

    const orgId = "69ae144fae23030b62f901f5"; // Postcard CRM fallback for single tenant deployments

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
