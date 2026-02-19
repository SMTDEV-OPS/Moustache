import { Router } from "express";
import { z } from "zod";
import { requireAuth, hasPermission } from "../middleware/auth";
import { RoleModel } from "../models/role";
import { EmployeeGroupModel } from "../models/employeeGroup";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../models/common";
import { TicketModel, ITicket } from "../models/ticket";
import { TicketActivityModel, TicketActivityType } from "../models/ticketActivity";
import { badRequest, notFound, forbidden } from "../utils/httpError";
import { createTicket, reassignTicket, resolveTicket } from "../services/ticketService";
import { UserModel } from "../models/user";

export const ticketsRouter = Router();

// All ticket operations require authentication. Fine-grained permissions are
// enforced per endpoint and per-ticket below.
ticketsRouter.use(requireAuth);

type TicketScope = "own" | "team" | "all";

type AccessUser = {
  id: string;
  email: string;
  permissions?: string[];
  isAdmin?: boolean;
};

async function getTeamMemberIdsForRoleOwner(userId: string): Promise<string[]> {
  // Check both legacy ownerUserId and new ownerUserIds array
  // Role owners can see team tickets if their ownerPermissions include tickets.view.team or tickets.manage
  const ownedRoles = await RoleModel.find({
    $and: [
      {
        $or: [
          { ownerUserId: userId },
          { ownerUserIds: userId },
        ],
      },
      {
        $or: [
          { ownerPermissions: { $in: ["tickets.manage", "tickets.view.team"] } },
          { permissions: { $in: ["tickets.manage", "tickets.view.team"] } }, // Legacy fallback
        ],
      },
    ],
  }).lean();

  if (!ownedRoles.length) {
    return [];
  }

  const roleIds = ownedRoles.map((r) => r._id);

  const groups = await EmployeeGroupModel.find({
    roleIds: { $in: roleIds },
    isActive: true,
  }).lean();

  const memberIds = new Set<string>();
  for (const g of groups) {
    for (const m of g.memberUserIds ?? []) {
      if (m) {
        memberIds.add(m.toString());
      }
    }
  }

  return Array.from(memberIds);
}

async function assertTicketAccess(
  user: AccessUser,
  ticket: { assignedToUserId?: any }
) {
  // Admins and users with full ticket visibility can see any ticket.
  if (
    user.isAdmin ||
    hasPermission(user, "tickets.manage") ||
    hasPermission(user, "tickets.view.all")
  ) {
    return;
  }

  // Directly assigned tickets are always visible if the user has at least own-view rights.
  if (
    hasPermission(user, "tickets.view.own") &&
    ticket.assignedToUserId &&
    ticket.assignedToUserId.toString() === user.id
  ) {
    return;
  }

  // Team tickets – only for role owners mapped via employee groups.
  if (hasPermission(user, "tickets.view.team")) {
    const teamMemberIds = await getTeamMemberIdsForRoleOwner(user.id);
    const assigneeId = ticket.assignedToUserId?.toString();
    if (assigneeId && teamMemberIds.includes(assigneeId)) {
      return;
    }
  }

  throw forbidden("Insufficient permissions to access this ticket");
}

const ticketCreateSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.nativeEnum(TicketCategory),
  priority: z.nativeEnum(TicketPriority).optional(),
  guestId: z.string().optional(),
  accountId: z.string().optional(),
  propertyId: z.string().optional(),
  assignedToUserId: z.string().optional(),
  tags: z.array(z.string()).optional(),
  assignmentMode: z.enum(["auto", "manual"]).optional(),
});

// Get eligible users for manual assignment
ticketsRouter.get("/eligible-assignees", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    // Get all active users (can be filtered by team type if needed)
    const users = await UserModel.find({
      status: "ACTIVE",
    })
      .select("name email teamType")
      .lean();

    res.json(users);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.post("/", async (req, res, next) => {
  try {
    if (
      !req.user ||
      !(
        hasPermission(req.user, "tickets.create") ||
        hasPermission(req.user, "tickets.manage")
      )
    ) {
      throw forbidden("Insufficient permissions to create tickets");
    }

    const parsed = ticketCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid ticket payload");
    }

    const data = parsed.data;

    const ticket = await createTicket({
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      guestId: data.guestId,
      accountId: data.accountId,
      propertyId: data.propertyId,
      assignedToUserId: data.assignedToUserId,
      tags: data.tags,
      assignmentMode: data.assignmentMode ?? "auto",
      createdByUserId: req.user?.id,
    });

    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const { status, assigneeId, priority, category, scope } = req.query;
    const filter: Record<string, unknown> = {};

    if (status) filter.status = status;
    if (assigneeId) filter.assignedToUserId = assigneeId;
    if (priority) filter.priority = priority;
    if (category) filter.category = category;

    const requestedScope = scope as string | undefined;
    let effectiveScope: TicketScope;

    // Determine effective scope based on request and permissions
    if (requestedScope === "team") {
      if (
        hasPermission(req.user, "tickets.view.team") ||
        hasPermission(req.user, "tickets.manage") ||
        req.user.isAdmin
      ) {
        effectiveScope = "team";
      } else {
        throw forbidden("Insufficient permissions for team tickets");
      }
    } else if (requestedScope === "all") {
      if (
        req.user.isAdmin ||
        hasPermission(req.user, "tickets.view.all") ||
        hasPermission(req.user, "tickets.manage")
      ) {
        effectiveScope = "all";
      } else {
        throw forbidden("Insufficient permissions for all tickets");
      }
    } else {
      // Default or explicit "own" - enforce strict own-tickets-only access
      if (
        !(
          hasPermission(req.user, "tickets.view.own") ||
          hasPermission(req.user, "tickets.manage") ||
          req.user.isAdmin
        )
      ) {
        throw forbidden("Insufficient permissions for own tickets");
      }
      effectiveScope = "own";
    }

    // Apply scope-based filtering
    if (effectiveScope === "own") {
      // Strictly filter to only tickets assigned to this user
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
      // No additional assignee filter
    }

    const tickets = await TicketModel.find(filter)
      .populate("guestId", "name phone email")
      .populate("assignedToUserId", "name email")
      .populate("createdByUserId", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json(tickets);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/:id", async (req, res, next) => {
  try {
    const ticket = await TicketModel.findById(req.params.id)
      .populate("guestId", "name phone email")
      .populate("assignedToUserId", "name email")
      .populate("createdByUserId", "name email")
      .populate("resolvedByUserId", "name email")
      .lean();
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertTicketAccess(req.user, ticket);

    // Get activities for current ticket
    const activities = await TicketActivityModel.find({ ticketId: ticket._id })
      .populate("performedByUserId", "name email")
      .populate("assignedByUserId", "name email")
      .populate("fromUserId", "name email")
      .populate("toUserId", "name email")
      .sort({ performedAt: -1 })
      .lean();

    res.json({ ticket, activities });
  } catch (err) {
    next(err);
  }
});

const ticketUpdateSchema = z.object({
  status: z.nativeEnum(TicketStatus).optional(),
  priority: z.nativeEnum(TicketPriority).optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  category: z.nativeEnum(TicketCategory).optional(),
  assignedToUserId: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

ticketsRouter.patch("/:id", async (req, res, next) => {
  try {
    const parsed = ticketUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid ticket update payload");
    }

    const existing = await TicketModel.findById(req.params.id);
    if (!existing) {
      throw notFound("Ticket not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertTicketAccess(req.user, existing);

    if (
      !hasPermission(req.user, "tickets.update") &&
      !hasPermission(req.user, "tickets.manage")
    ) {
      throw forbidden("Insufficient permissions to update tickets");
    }

    const prevStatus = existing.status;
    const prevPriority = existing.priority;

    if (parsed.data.status) {
      existing.status = parsed.data.status;
    }

    if (parsed.data.priority !== undefined) {
      existing.priority = parsed.data.priority;
    }

    if (parsed.data.title) {
      existing.title = parsed.data.title;
    }

    if (parsed.data.description) {
      existing.description = parsed.data.description;
    }

    if (parsed.data.category) {
      existing.category = parsed.data.category;
    }

    if (parsed.data.tags !== undefined) {
      existing.tags = parsed.data.tags;
    }

    // Handle reassignment
    if (parsed.data.assignedToUserId) {
      if (
        hasPermission(req.user, "tickets.assign") ||
        hasPermission(req.user, "tickets.manage")
      ) {
        const previousAssigneeId = existing.assignedToUserId?.toString();
        const newAssigneeId = parsed.data.assignedToUserId;

        // Only log reassignment if assignee actually changed
        if (previousAssigneeId !== newAssigneeId) {
          // Use the reassignTicket service to handle notification and logging
          await reassignTicket(
            existing._id.toString(),
            newAssigneeId,
            req.user.id
          );
          // Reload the ticket to get updated data
          const updatedTicket = await TicketModel.findById(existing._id);
          if (updatedTicket) {
            // Copy over other updates
            if (parsed.data.status) updatedTicket.status = parsed.data.status;
            if (parsed.data.priority) updatedTicket.priority = parsed.data.priority;
            if (parsed.data.title) updatedTicket.title = parsed.data.title;
            if (parsed.data.description) updatedTicket.description = parsed.data.description;
            if (parsed.data.category) updatedTicket.category = parsed.data.category;
            if (parsed.data.tags) updatedTicket.tags = parsed.data.tags;
            
            await updatedTicket.save();
            
            if (parsed.data.status && parsed.data.status !== prevStatus) {
              await TicketActivityModel.create({
                ticketId: updatedTicket._id,
                type: TicketActivityType.STATUS_CHANGE,
                fromStatus: prevStatus,
                toStatus: parsed.data.status,
                performedByUserId: req.user?.id,
                performedAt: new Date(),
              });
            }
            
            if (parsed.data.priority && parsed.data.priority !== prevPriority) {
              await TicketActivityModel.create({
                ticketId: updatedTicket._id,
                type: TicketActivityType.PRIORITY_CHANGE,
                fromPriority: prevPriority,
                toPriority: parsed.data.priority,
                performedByUserId: req.user?.id,
                performedAt: new Date(),
              });
            }
            
            return res.json(updatedTicket);
          }
        } else {
          existing.assignedToUserId = newAssigneeId as any;
        }
      } else {
        throw forbidden("Insufficient permissions to assign tickets");
      }
    }

    await existing.save();

    // Log status change
    if (parsed.data.status && parsed.data.status !== prevStatus) {
      await TicketActivityModel.create({
        ticketId: existing._id,
        type: TicketActivityType.STATUS_CHANGE,
        fromStatus: prevStatus,
        toStatus: parsed.data.status,
        performedByUserId: req.user?.id,
        performedAt: new Date(),
      });
    }

    // Log priority change
    if (parsed.data.priority !== undefined && parsed.data.priority !== prevPriority) {
      await TicketActivityModel.create({
        ticketId: existing._id,
        type: TicketActivityType.PRIORITY_CHANGE,
        fromPriority: prevPriority,
        toPriority: parsed.data.priority,
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
  type: z.nativeEnum(TicketActivityType),
  note: z.string().optional(),
});

ticketsRouter.post("/:id/activities", async (req, res, next) => {
  try {
    const parsed = activitySchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid activity payload");
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    await assertTicketAccess(req.user, ticket);

    if (
      !hasPermission(req.user, "tickets.update") &&
      !hasPermission(req.user, "tickets.manage")
    ) {
      throw forbidden(
        "Insufficient permissions to add activities for this ticket"
      );
    }

    const activity = await TicketActivityModel.create({
      ticketId: ticket._id,
      type: parsed.data.type,
      note: parsed.data.note,
      performedByUserId: req.user?.id,
      performedAt: new Date(),
    });

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

ticketsRouter.get("/:id/activities", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    await assertTicketAccess(req.user, ticket);

    const activities = await TicketActivityModel.find({
      ticketId: req.params.id,
    })
      .sort({ performedAt: -1 })
      .lean();
    res.json(activities);
  } catch (err) {
    next(err);
  }
});

const resolveSchema = z.object({
  resolutionNotes: z.string().optional(),
});

ticketsRouter.post("/:id/resolve", async (req, res, next) => {
  try {
    const parsed = resolveSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid resolve payload");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    await assertTicketAccess(req.user, ticket);

    if (
      !hasPermission(req.user, "tickets.update") &&
      !hasPermission(req.user, "tickets.manage") &&
      !hasPermission(req.user, "tickets.resolve")
    ) {
      throw forbidden("Insufficient permissions to resolve tickets");
    }

    const resolvedTicket = await resolveTicket(
      req.params.id,
      req.user.id,
      parsed.data.resolutionNotes
    );

    if (!resolvedTicket) {
      throw notFound("Ticket not found");
    }

    res.json(resolvedTicket);
  } catch (err) {
    next(err);
  }
});

const reopenSchema = z.object({
  note: z.string().optional(),
});

ticketsRouter.post("/:id/reopen", async (req, res, next) => {
  try {
    const parsed = reopenSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid reopen payload");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    await assertTicketAccess(req.user, ticket);

    if (
      !hasPermission(req.user, "tickets.update") &&
      !hasPermission(req.user, "tickets.manage")
    ) {
      throw forbidden("Insufficient permissions to reopen tickets");
    }

    const prevStatus = ticket.status;

    ticket.status = TicketStatus.IN_PROGRESS;
    ticket.resolvedAt = undefined;
    ticket.resolvedByUserId = undefined;
    ticket.resolutionNotes = undefined;
    await ticket.save();

    // Log reopen activity
    await TicketActivityModel.create({
      ticketId: ticket._id,
      type: TicketActivityType.REOPENED,
      note: parsed.data.note || "Ticket reopened",
      performedByUserId: req.user.id,
      fromStatus: prevStatus,
      toStatus: TicketStatus.IN_PROGRESS,
      performedAt: new Date(),
    });

    res.json(ticket);
  } catch (err) {
    next(err);
  }
});

// Add note to ticket
const addNoteSchema = z.object({
  note: z.string().min(1, "Note cannot be empty"),
});

ticketsRouter.post("/:id/notes", async (req, res, next) => {
  try {
    const parsed = addNoteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Note is required");
    }

    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const ticket = await TicketModel.findById(req.params.id);
    if (!ticket) {
      throw notFound("Ticket not found");
    }

    await assertTicketAccess(req.user, ticket);

    if (
      !hasPermission(req.user, "tickets.update") &&
      !hasPermission(req.user, "tickets.manage")
    ) {
      throw forbidden("Insufficient permissions to add notes");
    }

    // Create activity log entry
    const activity = await TicketActivityModel.create({
      ticketId: ticket._id,
      type: TicketActivityType.NOTE,
      note: parsed.data.note,
      performedByUserId: req.user.id,
      performedAt: new Date(),
    });

    res.status(201).json(activity);
  } catch (err) {
    next(err);
  }
});

