import { Types } from "mongoose";
import { TicketModel, ITicket } from "../models/ticket";
import { UserModel } from "../models/user";
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "../models/common";
import { TicketActivityModel, TicketActivityType } from "../models/ticketActivity";
import { logger } from "../config/logger";

export type AssignmentMode = "auto" | "manual";

export interface CreateTicketInput {
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  guestId?: string;
  accountId?: string;
  propertyId?: string;
  assignedToUserId?: string;
  tags?: string[];
  assignmentMode?: AssignmentMode;
  createdByUserId?: string;
}

export interface AutoAssignResult {
  assignedToUserId?: Types.ObjectId;
  assignmentMethod: "auto" | "manual" | "none";
  wasRedirectedToBuddy?: boolean;
  originalAssigneeId?: Types.ObjectId;
}

/**
 * Simple auto-assignment - assigns to first available OPERATIONS team member
 */
async function autoAssignTicket(): Promise<AutoAssignResult> {
  const user = await UserModel.findOne({    status: "ACTIVE",
  }).exec();

  if (!user) {
    // Fallback to any active user
    const fallbackUser = await UserModel.findOne({
      status: "ACTIVE",
    }).exec();

    if (!fallbackUser) {
      return {
        assignedToUserId: undefined,        assignmentMethod: "none",
      };
    }

    // Check for active buddy assignment
    const { resolveAssigneeWithBuddy } = await import("./assignmentService");
    const buddyResolution = await resolveAssigneeWithBuddy(fallbackUser._id);

    return {
      assignedToUserId: buddyResolution.finalUserId,      assignmentMethod: "auto",
      wasRedirectedToBuddy: buddyResolution.wasRedirected,
      originalAssigneeId: buddyResolution.wasRedirected ? fallbackUser._id : undefined,
    };
  }

  // Check for active buddy assignment
  const { resolveAssigneeWithBuddy } = await import("./assignmentService");
  const buddyResolution = await resolveAssigneeWithBuddy(user._id);

  return {
    assignedToUserId: buddyResolution.finalUserId,    assignmentMethod: "auto",
    wasRedirectedToBuddy: buddyResolution.wasRedirected,
    originalAssigneeId: buddyResolution.wasRedirected ? user._id : undefined,
  };
}

/**
 * Perform ticket assignment based on mode
 */
async function performAssignment(
  assignmentMode: AssignmentMode = "auto",
  manualAssigneeId?: string
): Promise<AutoAssignResult> {
  // Manual assignment
  if (assignmentMode === "manual" && manualAssigneeId) {
    const user = await UserModel.findById(manualAssigneeId).exec();
    if (user) {
      // Check for active buddy assignment
      const { resolveAssigneeWithBuddy } = await import("./assignmentService");
      const buddyResolution = await resolveAssigneeWithBuddy(user._id);

      return {
        assignedToUserId: buddyResolution.finalUserId,        assignmentMethod: "manual",
        wasRedirectedToBuddy: buddyResolution.wasRedirected,
        originalAssigneeId: buddyResolution.wasRedirected ? user._id : undefined,
      };
    }
  }

  // Auto assignment
  return autoAssignTicket();
}

function generateTicketNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `T-${y}${m}${d}-${rand}`;
}

export async function createTicket(input: CreateTicketInput): Promise<ITicket> {
  // Resolve propertyId if provided
  let propertyId: Types.ObjectId | undefined;
  if (input.propertyId) {
    if (Types.ObjectId.isValid(input.propertyId)) {
      const { PropertyModel } = await import("../models/property");
      const property = await PropertyModel.findById(input.propertyId).exec();
      if (!property) {
        logger.warn(`Property with ID ${input.propertyId} not found. Creating ticket without property.`);
      } else {
        propertyId = property._id;
      }
    }
  }

  // Resolve accountId if provided
  let accountId: Types.ObjectId | undefined;
  if (input.accountId) {
    if (Types.ObjectId.isValid(input.accountId)) {
      const { AccountModel } = await import("../models/account");
      const account = await AccountModel.findById(input.accountId).exec();
      if (!account) {
        logger.warn(`Account with ID ${input.accountId} not found. Creating ticket without account.`);
      } else {
        accountId = account._id;
      }
    }
  }

  // Resolve guestId if provided
  let guestId: Types.ObjectId | undefined;
  if (input.guestId) {
    if (Types.ObjectId.isValid(input.guestId)) {
      const { GuestModel } = await import("../models/guest");
      const guest = await GuestModel.findById(input.guestId).exec();
      if (!guest) {
        logger.warn(`Guest with ID ${input.guestId} not found. Creating ticket without guest.`);
      } else {
        guestId = guest._id;
      }
    }
  }

  // Perform assignment based on mode
  const assignment = await performAssignment(
    input.assignmentMode ?? "auto",
    input.assignedToUserId
  );

  const ticketNumber = generateTicketNumber();

  const ticket = await TicketModel.create({
    ticketNumber,
    title: input.title,
    description: input.description,
    category: input.category,
    priority: input.priority ?? TicketPriority.MEDIUM,
    status: TicketStatus.NEW,
    guestId,
    accountId,
    propertyId,
    assignedToUserId: assignment.assignedToUserId,    createdByUserId: input.createdByUserId,
    tags: input.tags ?? [],
  });

  // Log ticket creation activity
  await TicketActivityModel.create({
    ticketId: ticket._id,
    type: TicketActivityType.TICKET_CREATED,
    note: "Ticket created",
    performedByUserId: input.createdByUserId,
    performedAt: new Date(),
  });

  // Log assignment activity
  if (assignment.assignedToUserId) {
    const assignmentType =
      assignment.assignmentMethod === "auto"
        ? TicketActivityType.AUTO_ASSIGNED
        : TicketActivityType.MANUAL_ASSIGNED;

    const isAuto = assignmentType === TicketActivityType.AUTO_ASSIGNED;

    await TicketActivityModel.create({
      ticketId: ticket._id,
      type: assignmentType,
      note: isAuto
        ? "Ticket auto-assigned"
        : "Ticket manually assigned",
      performedByUserId: input.createdByUserId,
      toUserId: assignment.assignedToUserId,
      assignedByUserId: isAuto ? undefined : input.createdByUserId,
      performedAt: new Date(),
    });

    // Send notification to assigned user
    try {
      let assignedByName: string | undefined;
      if (!isAuto && input.createdByUserId) {
        const assignedByUser = await UserModel.findById(input.createdByUserId)
          .select("name")
          .lean();
        assignedByName = assignedByUser?.name;
      }

      // Get original assignee name if redirected to buddy
      let originalAssigneeName: string | undefined;
      if (assignment.wasRedirectedToBuddy && assignment.originalAssigneeId) {
        const originalUser = await UserModel.findById(assignment.originalAssigneeId)
          .select("name")
          .lean();
        originalAssigneeName = originalUser?.name;
      }

      const { notifyTicketAssigned } = await import("./notificationService");
      await notifyTicketAssigned(
        assignment.assignedToUserId,
        ticket._id,
        ticketNumber,
        assignedByName,
        assignment.wasRedirectedToBuddy,
        originalAssigneeName
      );
    } catch (error) {
      // Log error but don't fail the ticket creation
      logger.error("Failed to send assignment notification", {
        ticketId: ticket._id.toString(),
        ticketNumber,
        assignedToUserId: assignment.assignedToUserId?.toString(),
      }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  return ticket;
}

/**
 * Reassign a ticket to a different user
 */
export async function reassignTicket(
  ticketId: string,
  newAssigneeId: string,
  reassignedByUserId: string
): Promise<ITicket | null> {
  logger.info("[Reassign Ticket] Starting ticket reassignment", {
    ticketId,
    newAssigneeId,
    reassignedByUserId,
  });

  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) {
    logger.warn("[Reassign Ticket] Ticket not found", {
      ticketId,
    });
    return null;
  }

  const previousAssigneeId = ticket.assignedToUserId;

  logger.info("[Reassign Ticket] Current ticket assignment", {
    ticketId,
    ticketNumber: ticket.ticketNumber,
    previousAssigneeId: previousAssigneeId?.toString(),
    newAssigneeId,
  });

  // Check for active buddy assignment
  const { resolveAssigneeWithBuddy } = await import("./assignmentService");
  const buddyResolution = await resolveAssigneeWithBuddy(newAssigneeId);

  // Ensure finalAssigneeId is a proper ObjectId instance
  let finalAssigneeId: Types.ObjectId;
  if (buddyResolution.finalUserId instanceof Types.ObjectId) {
    finalAssigneeId = buddyResolution.finalUserId;
  } else if (typeof buddyResolution.finalUserId === 'string') {
    finalAssigneeId = new Types.ObjectId(buddyResolution.finalUserId);
  } else {
    const userIdStr = (buddyResolution.finalUserId as any)?._id?.toString() ||
      (buddyResolution.finalUserId as any)?.toString();
    finalAssigneeId = new Types.ObjectId(userIdStr);
  }

  // Update the ticket
  ticket.assignedToUserId = finalAssigneeId;
  await ticket.save();

  // Get user names for activity log
  const [previousUser, finalUser, originalUser, reassignedByUser] = await Promise.all([
    previousAssigneeId
      ? UserModel.findById(previousAssigneeId).select("name").lean()
      : null,
    UserModel.findById(finalAssigneeId).select("name").lean(),
    UserModel.findById(newAssigneeId).select("name").lean(),
    UserModel.findById(reassignedByUserId).select("name").lean(),
  ]);

  // Log reassignment activity
  const note = buddyResolution.wasRedirected
    ? previousUser
      ? `Ticket reassigned from ${previousUser.name} to ${originalUser?.name} (redirected to buddy ${finalUser?.name} due to unavailability)`
      : `Ticket assigned to ${originalUser?.name} (redirected to buddy ${finalUser?.name} due to unavailability)`
    : previousUser
      ? `Ticket reassigned from ${previousUser.name} to ${finalUser?.name}`
      : `Ticket assigned to ${finalUser?.name}`;

  await TicketActivityModel.create({
    ticketId: ticket._id,
    type: TicketActivityType.REASSIGNED,
    note,
    performedByUserId: reassignedByUserId,
    fromUserId: previousAssigneeId,
    toUserId: finalAssigneeId,
    assignedByUserId: reassignedByUserId,
    performedAt: new Date(),
  });

  // Send notification to final assignee
  try {
    const finalAssigneeIdStr = finalAssigneeId.toString();
    const { notifyTicketAssigned } = await import("./notificationService");
    await notifyTicketAssigned(
      finalAssigneeIdStr,
      ticket._id.toString(),
      ticket.ticketNumber,
      reassignedByUser?.name,
      buddyResolution.wasRedirected,
      originalUser?.name
    );
  } catch (error) {
    logger.error("Failed to send reassignment notification", {
      ticketId: ticket._id.toString(),
      ticketNumber: ticket.ticketNumber,
      previousAssigneeId: previousAssigneeId?.toString(),
      newAssigneeId,
      finalAssigneeId: finalAssigneeId.toString(),
      reassignedByUserId,
    }, error instanceof Error ? error : new Error(String(error)));
  }

  return ticket;
}

/**
 * Resolve a ticket
 */
export async function resolveTicket(
  ticketId: string,
  resolvedByUserId: string,
  resolutionNotes?: string
): Promise<ITicket | null> {
  const ticket = await TicketModel.findById(ticketId);
  if (!ticket) {
    return null;
  }

  const previousStatus = ticket.status;

  ticket.status = TicketStatus.RESOLVED;
  ticket.resolvedAt = new Date();
  ticket.resolvedByUserId = new Types.ObjectId(resolvedByUserId);
  if (resolutionNotes) {
    ticket.resolutionNotes = resolutionNotes;
  }

  await ticket.save();

  // Log resolution activity
  await TicketActivityModel.create({
    ticketId: ticket._id,
    type: TicketActivityType.RESOLVED,
    note: resolutionNotes || "Ticket resolved",
    performedByUserId: resolvedByUserId,
    fromStatus: previousStatus,
    toStatus: TicketStatus.RESOLVED,
    performedAt: new Date(),
  });

  return ticket;
}

