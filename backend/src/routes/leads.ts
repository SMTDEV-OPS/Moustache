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
import { createLead, reassignLead } from "../services/leadService";
import { getEligibleUsersForManualAssignment } from "../services/assignmentService";
import { UserModel } from "../models/user";
import { getCommunicationTimeline } from "../services/communicationService";
import { PERMISSIONS } from "../constants/permissions";
import { uploadResource } from "../middleware/upload";
import { parse } from "csv-parse/sync";

export const leadsRouter = Router();

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

async function assertLeadAccess(
  user: AccessUser,
  lead: { assignedToUserId?: any }
) {
  // Admins and users with full lead visibility can see any lead.
  // Admins and users with full lead management can see any lead.
  if (
    user.isAdmin ||
    hasPermission(user, PERMISSIONS.LEADS.MANAGE)
  ) {
    return;
  }

  // Use AccessControlService for scoped checks (own vs team)
  const { AccessControlService } = await import(
    "../services/auth/AccessControlService"
  );

  const hasAccess = await AccessControlService.hasPermission(
    user,
    "leads",
    "read",
    { ownerId: lead.assignedToUserId }
  );

  if (hasAccess) return;

  throw forbidden("Insufficient permissions to access this lead");
}

const leadCreateSchema = z.object({
  guestId: z.string().optional(),
  guestContact: z
    .object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
  propertyId: z.string().optional(),
  accountId: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  leadType: z.nativeEnum(LeadType),
  checkInDate: z.string().datetime().optional(),
  checkOutDate: z.string().datetime().optional(),
  roomsRequested: z.number().int().optional(),
  guests: z
    .object({
      adults: z.number().int().optional(),
      children: z.number().int().optional(),
    })
    .optional(),
  occasion: z.string().optional(),
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
  roomCategory: z.string().optional(),
  roomPreference: z.string().optional(),
  // Assignment options
  assignmentMode: z.enum(["auto", "manual"]).optional(),
  assignedToUserId: z.string().optional(),
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

    const lead = await createLead({
      guestId: data.guestId,
      guestContact: data.guestContact,
      propertyId: data.propertyId,
      accountId: data.accountId,
      source: data.source,
      leadType: data.leadType,
      checkInDate: data.checkInDate
        ? new Date(data.checkInDate)
        : undefined,
      checkOutDate: data.checkOutDate
        ? new Date(data.checkOutDate)
        : undefined,
      roomsRequested: data.roomsRequested,
      guests: data.guests,
      occasion: data.occasion,
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
      roomCategory: data.roomCategory,
      roomPreference: data.roomPreference,
      // Pass assignment options
      assignmentMode: data.assignmentMode ?? "auto",
      assignedToUserId: data.assignedToUserId,
      createdByUserId: req.user?.id,
    });

    // Note: Activity logging is now handled in leadService.createLead

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
        const name = row.Name || row.name || row.GuestName;
        const phone = row.Phone || row.phone || row.Contact;
        const email = row.Email || row.email;
        const notes = row.Notes || row.notes || "Imported via CSV Bulk Upload";

        if (!name) {
          throw new Error("Name is required");
        }

        await createLead({
          guestContact: {
            name,
            phone,
            email,
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

    const { status, assigneeId, propertyId, fromDate, toDate, heat, scope } =
      req.query;
    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (assigneeId) filter.assignedToUserId = assigneeId;
    if (propertyId) filter.propertyId = propertyId;
    if (heat) filter.heatLevel = heat;

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
    res.json(leads);
  } catch (err) {
    next(err);
  }
});

leadsRouter.get("/:id", async (req, res, next) => {
  try {
    const lead = await LeadModel.findById(req.params.id)
      .populate("guestId", "name phone email")
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

    res.json({ lead, activities, communications, previousCommunications });
  } catch (err) {
    next(err);
  }
});

const leadUpdateSchema = z.object({
  status: z.nativeEnum(LeadStatus).optional(),
  heatLevel: z.nativeEnum(HeatLevel).optional(),
  callStatus: z.nativeEnum(CallStatus).optional(),
  notes: z.string().optional(),
  checkInDate: z.string().datetime().optional(),
  checkOutDate: z.string().datetime().optional(),
  roomsRequested: z.number().int().optional(),
  guests: z
    .object({
      adults: z.number().int().optional(),
      children: z.number().int().optional(),
    })
    .optional(),
  occasion: z.string().optional(),
  assignedToUserId: z.string().optional(),
  // Allow updating contact details (the inquiry snapshot)
  contactDetails: z
    .object({
      name: z.string(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    })
    .optional(),
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
    const prevHeatLevel = existing.heatLevel;
    const prevCallStatus = existing.callStatus;

    if (parsed.data.checkInDate) {
      existing.checkInDate = new Date(parsed.data.checkInDate);
    }
    if (parsed.data.checkOutDate) {
      existing.checkOutDate = new Date(parsed.data.checkOutDate);
    }

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

    if (parsed.data.heatLevel !== undefined) {
      existing.heatLevel = parsed.data.heatLevel;
    }

    if (parsed.data.callStatus !== undefined) {
      existing.callStatus = parsed.data.callStatus;
    }

    if (parsed.data.notes !== undefined) {
      existing.notes = parsed.data.notes;
    }
    if (parsed.data.roomsRequested) {
      existing.roomsRequested = parsed.data.roomsRequested;
    }
    if (parsed.data.guests) {
      existing.guests = parsed.data.guests;
    }
    if (parsed.data.occasion) {
      existing.occasion = parsed.data.occasion;
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
            // Copy over other updates
            if (parsed.data.status) updatedLead.status = parsed.data.status;
            if (parsed.data.heatLevel) updatedLead.heatLevel = parsed.data.heatLevel;
            if (parsed.data.roomsRequested) updatedLead.roomsRequested = parsed.data.roomsRequested;
            if (parsed.data.guests) updatedLead.guests = parsed.data.guests;
            if (parsed.data.occasion) updatedLead.occasion = parsed.data.occasion;
            if (parsed.data.checkInDate) updatedLead.checkInDate = new Date(parsed.data.checkInDate);
            if (parsed.data.checkOutDate) updatedLead.checkOutDate = new Date(parsed.data.checkOutDate);

            await updatedLead.save();

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

            return res.json(updatedLead);
          }
        } else {
          existing.assignedToUserId = newAssigneeId as any;
        }
      } else {
        throw forbidden("Insufficient permissions to assign leads");
      }
    }

    await existing.save();

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

    res.json(existing);
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



