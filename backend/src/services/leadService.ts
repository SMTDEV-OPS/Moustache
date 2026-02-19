import { Types } from "mongoose";
import {
  LeadModel,
  ILead,
  ILeadGuestDetails,
} from "../models/lead";
import { GuestModel } from "../models/guest";
import { UserModel } from "../models/user";
import { PropertyModel } from "../models/property";
import { AccountModel } from "../models/account";
import {
  HeatLevel,
  LeadSource,
  LeadStatus,
  LeadType,
  TeamType,
} from "../models/common";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import {
  autoAssignLead as autoAssignFromRules,
  getEmployeeGroupIdForLeadType,
} from "./assignmentService";
import { notifyLeadAssigned } from "./notificationService";
import { initializeWorkflowForLead } from "./workflowExecutionService";
import { logger } from "../config/logger";

export type AssignmentMode = "auto" | "manual";

export interface CreateLeadInput {
  guestId?: string;
  guestContact?: {
    name: string;
    phone?: string;
    email?: string;
  };
  propertyId?: string;
  accountId?: string;
  source: LeadSource;
  leadType: LeadType;
  checkInDate?: Date;
  checkOutDate?: Date;
  roomsRequested?: number;
  guests?: ILeadGuestDetails;
  occasion?: string;
  heatLevel?: HeatLevel;
  // Additional form fields
  alternateContact?: string;
  occupation?: string;
  bookingSource?: string;
  specialRequests?: string;
  isCorporateBooking?: boolean;
  companyName?: string;
  gstin?: string;
  estimatedValue?: string;
  notes?: string;
  roomCategory?: string;
  roomPreference?: string;
  // New assignment options
  assignmentMode?: AssignmentMode;
  assignedToUserId?: string;
  createdByUserId?: string;
}

export interface AutoAssignResult {
  assignedToUserId?: Types.ObjectId;
  assignedTeamType?: TeamType;
  employeeGroupId?: Types.ObjectId;
  assignmentMethod: "auto" | "manual" | "legacy" | "none";
  wasRedirectedToBuddy?: boolean;
  originalAssigneeId?: Types.ObjectId;
}

function determineTeamType(source: LeadSource): TeamType {
  switch (source) {
    case LeadSource.TRAVEL_AGENT:
    case LeadSource.CORPORATE_OFFICE:
    case LeadSource.EVENT_MICE:
      return TeamType.SALES;
    default:
      return TeamType.RESERVATIONS;
  }
}

/**
 * Legacy auto-assignment (fallback when no rules are configured)
 */
async function legacyAutoAssignLead(
  leadType: LeadType,
  source: LeadSource
): Promise<AutoAssignResult> {
  const teamType = determineTeamType(source);

  // Special case: weddings – try to assign to Nancy.
  if (leadType === LeadType.WEDDING) {
    const nancy = await UserModel.findOne({
      name: /nancy/i,
      status: "ACTIVE",
    }).exec();
    if (nancy) {
      // Check for active buddy assignment
      const { resolveAssigneeWithBuddy } = await import("./assignmentService");
      const buddyResolution = await resolveAssigneeWithBuddy(nancy._id);

      return {
        assignedToUserId: buddyResolution.finalUserId,
        assignedTeamType: nancy.teamType,
        assignmentMethod: "legacy",
      };
    }
  }

  const user = await UserModel.findOne({
    teamType,
    status: "ACTIVE",
  }).exec();

  if (!user) {
    return {
      assignedToUserId: undefined,
      assignedTeamType: teamType,
      assignmentMethod: "none",
    };
  }

  // Check for active buddy assignment
  const { resolveAssigneeWithBuddy } = await import("./assignmentService");
  const buddyResolution = await resolveAssigneeWithBuddy(user._id);

  return {
    assignedToUserId: buddyResolution.finalUserId,
    assignedTeamType: user.teamType,
    assignmentMethod: "legacy",
    wasRedirectedToBuddy: buddyResolution.wasRedirected,
    originalAssigneeId: buddyResolution.wasRedirected ? user._id : undefined,
  };
}

/**
 * Perform lead assignment based on mode
 */
async function performAssignment(
  leadType: LeadType,
  source: LeadSource,
  assignmentMode: AssignmentMode = "auto",
  manualAssigneeId?: string
): Promise<AutoAssignResult> {
  // Manual assignment
  if (assignmentMode === "manual" && manualAssigneeId) {
    logger.info("[Manual Assignment] Starting manual assignment", {
      manualAssigneeId,
      leadType,
      source,
    });

    const user = await UserModel.findById(manualAssigneeId).exec();
    if (user) {
      logger.info("[Manual Assignment] Found target user", {
        manualAssigneeId,
        userName: user.name,
        userEmail: user.email,
        userStatus: user.status,
        teamType: user.teamType,
      });

      const groupId = await getEmployeeGroupIdForLeadType(leadType);

      // Check for active buddy assignment
      const { resolveAssigneeWithBuddy } = await import("./assignmentService");
      const buddyResolution = await resolveAssigneeWithBuddy(user._id);

      logger.info("[Manual Assignment] Buddy resolution result", {
        manualAssigneeId,
        originalUserId: user._id.toString(),
        finalUserId: buddyResolution.finalUserId.toString(),
        wasRedirected: buddyResolution.wasRedirected,
        reason: buddyResolution.reason,
      });

      // Get final user info for logging
      const finalUser = await UserModel.findById(buddyResolution.finalUserId)
        .select("name email")
        .lean();

      logger.info("[Manual Assignment] Final assignment decision", {
        originalUserId: user._id.toString(),
        originalUserName: user.name,
        finalUserId: buddyResolution.finalUserId.toString(),
        finalUserName: finalUser?.name,
        wasRedirected: buddyResolution.wasRedirected,
        assignmentMethod: "manual",
      });

      return {
        assignedToUserId: buddyResolution.finalUserId,
        assignedTeamType: user.teamType,
        employeeGroupId: groupId ?? undefined,
        assignmentMethod: "manual",
        wasRedirectedToBuddy: buddyResolution.wasRedirected,
        originalAssigneeId: buddyResolution.wasRedirected ? user._id : undefined,
      };
    } else {
      logger.warn("[Manual Assignment] User not found", {
        manualAssigneeId,
      });
    }
  }

  // Auto assignment using rules
  const ruleResult = await autoAssignFromRules(leadType);

  if (ruleResult.assignmentMethod === "auto" && ruleResult.assignedToUserId) {
    const user = await UserModel.findById(ruleResult.assignedToUserId).exec();
    return {
      assignedToUserId: ruleResult.assignedToUserId,
      assignedTeamType: user?.teamType,
      employeeGroupId: ruleResult.employeeGroupId,
      assignmentMethod: "auto",
      wasRedirectedToBuddy: ruleResult.wasRedirectedToBuddy,
      originalAssigneeId: ruleResult.originalAssigneeId,
    };
  }

  // Fallback to legacy assignment if no rules configured
  return legacyAutoAssignLead(leadType, source);
}

function generateLeadNumber(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");
  return `L-${y}${m}${d}-${rand}`;
}

/** Build contactDetails for a lead (inquiry snapshot) */
function buildContactDetails(
  guestContact: { name: string; phone?: string; email?: string } | undefined,
  guest: { name: string; phone?: string; email?: string } | null | undefined
): { name: string; phone?: string; email?: string } | undefined {
  if (guestContact) {
    return {
      name: guestContact.name,
      phone: guestContact.phone,
      email: guestContact.email,
    };
  }
  if (guest) {
    return {
      name: guest.name,
      phone: guest.phone,
      email: guest.email,
    };
  }
  return undefined;
}

export async function createLead(input: CreateLeadInput): Promise<ILead> {
  let guestId: Types.ObjectId | undefined;

  if (input.guestId) {
    guestId = new Types.ObjectId(input.guestId);
  } else if (input.guestContact) {
    // Import phone utilities
    const { normalizePhone, normalizeEmail } = await import("../utils/phoneUtils");

    // Search for existing guest by email OR phone before creating new one
    const { phone, email, name } = input.guestContact;

    // Normalize contact details
    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = normalizeEmail(email);

    // Search for existing guest by email OR phone (including secondaries)
    let existingGuest = null;
    if (normalizedEmail) {
      existingGuest = await GuestModel.findOne({
        $or: [
          { email: normalizedEmail },
          { secondaryEmails: normalizedEmail }
        ]
      }).exec();
    }
    if (!existingGuest && normalizedPhone) {
      existingGuest = await GuestModel.findOne({
        $or: [
          { phone: normalizedPhone },
          { secondaryPhones: normalizedPhone }
        ]
      }).exec();
    }

    if (existingGuest) {
      // Link to existing guest
      guestId = existingGuest._id;

      // Smart Guest updates: merge new contact info
      let hasChanges = false;

      // Handle phone number
      if (normalizedPhone) {
        if (!existingGuest.phone) {
          // Primary phone is empty, use this one
          existingGuest.phone = normalizedPhone;
          hasChanges = true;
        } else if (
          existingGuest.phone !== normalizedPhone &&
          !(existingGuest.secondaryPhones || []).includes(normalizedPhone)
        ) {
          // New phone number, add to secondaries
          if (!existingGuest.secondaryPhones) {
            existingGuest.secondaryPhones = [];
          }
          existingGuest.secondaryPhones.push(normalizedPhone);
          hasChanges = true;
        }
      }

      // Handle email
      if (normalizedEmail) {
        if (!existingGuest.email) {
          // Primary email is empty, use this one
          existingGuest.email = normalizedEmail;
          hasChanges = true;
        } else if (
          existingGuest.email !== normalizedEmail &&
          !(existingGuest.secondaryEmails || []).includes(normalizedEmail)
        ) {
          // New email, add to secondaries
          if (!existingGuest.secondaryEmails) {
            existingGuest.secondaryEmails = [];
          }
          existingGuest.secondaryEmails.push(normalizedEmail);
          hasChanges = true;
        }
      }

      // Handle name update
      if (name && (!existingGuest.name || existingGuest.name.trim() === "")) {
        existingGuest.name = name;
        hasChanges = true;
      }

      existingGuest.lastSeenAt = new Date();

      if (hasChanges) {
        await existingGuest.save();
      }
    } else {
      // Create new guest if not found
      const guest = await GuestModel.create({
        name,
        phone: normalizedPhone,
        email: normalizedEmail,
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      });
      guestId = guest._id;
    }
  }


  // Resolve propertyId - handle both ObjectId strings and property names
  let propertyId: Types.ObjectId | undefined;
  if (input.propertyId) {
    // Check if it's a valid ObjectId
    if (Types.ObjectId.isValid(input.propertyId)) {
      propertyId = new Types.ObjectId(input.propertyId);
      // Verify the property exists
      const property = await PropertyModel.findById(propertyId).exec();
      if (!property) {
        throw new Error(`Property with ID ${input.propertyId} not found`);
      }
    } else {
      // Try to find property by name (case-insensitive)
      const property = await PropertyModel.findOne({
        name: { $regex: new RegExp(`^${input.propertyId}$`, "i") },
        status: "ACTIVE",
      }).exec();
      if (!property) {
        // Property not found - log warning but don't fail, make propertyId optional
        console.warn(`Property with name "${input.propertyId}" not found. Creating lead without property.`);
        propertyId = undefined;
      } else {
        propertyId = property._id;
      }
    }
  }

  // Resolve accountId - auto-link account based on source and company name
  let accountId: Types.ObjectId | undefined;

  // If accountId is explicitly provided, use it
  if (input.accountId) {
    if (Types.ObjectId.isValid(input.accountId)) {
      const account = await AccountModel.findById(input.accountId).exec();
      if (account) {
        accountId = account._id;
      } else {
        logger.warn(`Account with ID ${input.accountId} not found. Creating lead without account.`);
      }
    }
  } else {
    // Auto-link account based on source and company name
    const shouldAutoLinkAccount =
      input.source === LeadSource.TRAVEL_AGENT ||
      input.source === LeadSource.CORPORATE_OFFICE ||
      input.source === LeadSource.EVENT_MICE ||
      input.isCorporateBooking === true;

    if (shouldAutoLinkAccount && input.companyName) {
      // Determine account type based on source
      let accountType: "TRAVEL_AGENT" | "CORPORATE" | "EVENT_PLANNER" | "OTHER" = "OTHER";
      if (input.source === LeadSource.TRAVEL_AGENT) {
        accountType = "TRAVEL_AGENT";
      } else if (input.source === LeadSource.CORPORATE_OFFICE || input.isCorporateBooking) {
        accountType = "CORPORATE";
      } else if (input.source === LeadSource.EVENT_MICE) {
        accountType = "EVENT_PLANNER";
      }

      // Try to find existing account by name and type
      const existingAccount = await AccountModel.findOne({
        name: { $regex: new RegExp(`^${input.companyName}$`, "i") },
        type: accountType,
      }).exec();

      if (existingAccount) {
        accountId = existingAccount._id;
        logger.info(`Auto-linked lead to existing account: ${existingAccount.name} (${existingAccount.type})`);
      } else {
        // Optionally create a new account if company name is provided
        // For now, we'll just log and not auto-create accounts
        logger.info(`Account "${input.companyName}" not found. Lead created without account link.`);
      }
    }
  }

  const guest = guestId && (await GuestModel.findById(guestId).exec());
  const isFirstTimeGuest =
    guest != null &&
    guest.totalLeadsCount === 0 &&
    guest.totalReservationsCount === 0;

  // Perform assignment based on mode
  const assignment = await performAssignment(
    input.leadType,
    input.source,
    input.assignmentMode ?? "auto",
    input.assignedToUserId
  );

  const leadNumber = generateLeadNumber();
  const contactDetails = buildContactDetails(input.guestContact, guest);

  const lead = await LeadModel.create({
    leadNumber,
    guestId,
    contactDetails,
    accountId,
    propertyId,
    source: input.source,
    leadType: input.leadType,
    status: LeadStatus.NEW,
    heatLevel: input.heatLevel ?? HeatLevel.WARM,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomsRequested: input.roomsRequested,
    guests: input.guests,
    occasion: input.occasion,
    isFirstTimeGuest,
    assignedToUserId: assignment.assignedToUserId,
    assignedTeamType: assignment.assignedTeamType,
    leadAssignedAt: assignment.assignedToUserId ? new Date() : undefined,
    // Additional form fields
    alternateContact: input.alternateContact,
    occupation: input.occupation,
    bookingSource: input.bookingSource,
    specialRequests: input.specialRequests,
    isCorporateBooking: input.isCorporateBooking ?? false,
    companyName: input.companyName,
    gstin: input.gstin,
    estimatedValue: input.estimatedValue,
    notes: input.notes,
    roomCategory: input.roomCategory,
    roomPreference: input.roomPreference,
  });

  if (guest) {
    guest.totalLeadsCount += 1;
    guest.lastSeenAt = new Date();
    await guest.save();
  }

  // Log lead creation activity
  await LeadActivityModel.create({
    leadId: lead._id,
    type: LeadActivityType.LEAD_CREATED,
    note: "Lead created",
    performedByUserId: input.createdByUserId,
    performedAt: new Date(),
  });

  // Log assignment activity
  if (assignment.assignedToUserId) {
    const assignmentType =
      assignment.assignmentMethod === "auto" || assignment.assignmentMethod === "legacy"
        ? LeadActivityType.AUTO_ASSIGNED
        : LeadActivityType.MANUAL_ASSIGNED;

    const isAuto = assignmentType === LeadActivityType.AUTO_ASSIGNED;

    await LeadActivityModel.create({
      leadId: lead._id,
      type: assignmentType,
      note: isAuto
        ? "Lead auto-assigned based on rules"
        : "Lead manually assigned",
      performedByUserId: input.createdByUserId,
      toUserId: assignment.assignedToUserId,
      assignedByUserId: isAuto ? undefined : input.createdByUserId,
      employeeGroupId: assignment.employeeGroupId,
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

      await notifyLeadAssigned(
        assignment.assignedToUserId,
        lead._id,
        leadNumber,
        assignedByName,
        assignment.wasRedirectedToBuddy,
        originalAssigneeName
      );
    } catch (error) {
      // Log error but don't fail the lead creation
      logger.error("Failed to send assignment notification", {
        leadId: lead._id.toString(),
        leadNumber,
        assignedToUserId: assignment.assignedToUserId?.toString(),
      }, error instanceof Error ? error : new Error(String(error)));
    }

    // Initialize workflow for the lead after assignment
    try {
      await initializeWorkflowForLead(lead._id);
    } catch (error) {
      // Log error but don't fail the lead creation
      logger.error("Failed to initialize workflow for lead", {
        leadId: lead._id.toString(),
        leadNumber,
      }, error instanceof Error ? error : new Error(String(error)));
    }
  }

  return lead;
}

/**
 * Reassign a lead to a different user
 */
export async function reassignLead(
  leadId: string,
  newAssigneeId: string,
  reassignedByUserId: string
): Promise<ILead | null> {
  logger.info("[Reassign Lead] Starting lead reassignment", {
    leadId,
    newAssigneeId,
    reassignedByUserId,
  });

  const lead = await LeadModel.findById(leadId);
  if (!lead) {
    logger.warn("[Reassign Lead] Lead not found", {
      leadId,
    });
    return null;
  }

  const previousAssigneeId = lead.assignedToUserId;

  logger.info("[Reassign Lead] Current lead assignment", {
    leadId,
    leadNumber: lead.leadNumber,
    previousAssigneeId: previousAssigneeId?.toString(),
    newAssigneeId,
  });

  // Check for active buddy assignment
  const { resolveAssigneeWithBuddy } = await import("./assignmentService");
  const buddyResolution = await resolveAssigneeWithBuddy(newAssigneeId);

  // Ensure finalAssigneeId is a proper ObjectId instance
  // Handle case where finalUserId might be an ObjectId, string, or populated object
  let finalAssigneeId: Types.ObjectId;
  if (buddyResolution.finalUserId instanceof Types.ObjectId) {
    finalAssigneeId = buddyResolution.finalUserId;
  } else if (typeof buddyResolution.finalUserId === 'string') {
    finalAssigneeId = new Types.ObjectId(buddyResolution.finalUserId);
  } else {
    // Handle populated object case
    const userIdStr = (buddyResolution.finalUserId as any)?._id?.toString() ||
      (buddyResolution.finalUserId as any)?.toString();
    finalAssigneeId = new Types.ObjectId(userIdStr);
  }

  logger.info("[Reassign Lead] Buddy resolution result", {
    leadId,
    newAssigneeId,
    finalAssigneeId: finalAssigneeId.toString(),
    finalAssigneeIdHex: finalAssigneeId.toHexString(),
    finalAssigneeIdType: typeof finalAssigneeId,
    finalAssigneeIdConstructor: finalAssigneeId.constructor.name,
    wasRedirected: buddyResolution.wasRedirected,
    reason: buddyResolution.reason,
  });

  // Update the lead
  lead.assignedToUserId = finalAssigneeId;
  lead.leadAssignedAt = new Date();
  await lead.save();

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
      ? `Lead reassigned from ${previousUser.name} to ${originalUser?.name} (redirected to buddy ${finalUser?.name} due to unavailability)`
      : `Lead assigned to ${originalUser?.name} (redirected to buddy ${finalUser?.name} due to unavailability)`
    : previousUser
      ? `Lead reassigned from ${previousUser.name} to ${finalUser?.name}`
      : `Lead assigned to ${finalUser?.name}`;

  await LeadActivityModel.create({
    leadId: lead._id,
    type: LeadActivityType.REASSIGNED,
    note,
    performedByUserId: reassignedByUserId,
    fromUserId: previousAssigneeId,
    toUserId: finalAssigneeId,
    assignedByUserId: reassignedByUserId,
    performedAt: new Date(),
  });

  // Send notification to final assignee (buddy if redirected)
  try {
    // Ensure we pass a proper string, not an ObjectId object
    const finalAssigneeIdStr = finalAssigneeId.toString();
    logger.info("[Reassign Lead] Sending notification", {
      leadId: lead._id.toString(),
      finalAssigneeIdStr,
      finalAssigneeIdStrLength: finalAssigneeIdStr.length,
      isHexString: /^[0-9a-fA-F]{24}$/.test(finalAssigneeIdStr),
      wasRedirected: buddyResolution.wasRedirected,
      originalAssigneeName: originalUser?.name,
    });

    await notifyLeadAssigned(
      finalAssigneeIdStr,
      lead._id.toString(),
      lead.leadNumber,
      reassignedByUser?.name,
      buddyResolution.wasRedirected,
      originalUser?.name
    );
  } catch (error) {
    logger.error("Failed to send reassignment notification", {
      leadId: lead._id.toString(),
      leadNumber: lead.leadNumber,
      previousAssigneeId: previousAssigneeId?.toString(),
      newAssigneeId,
      finalAssigneeId: finalAssigneeId.toString(),
      finalAssigneeIdType: typeof finalAssigneeId,
      reassignedByUserId,
    }, error instanceof Error ? error : new Error(String(error)));
  }

  return lead;
}
