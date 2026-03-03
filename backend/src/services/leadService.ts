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
  LeadStage,
  LeadType,
  TicketPriority,
  TicketStatus,
} from "../models/common";
import { TaskModel } from "../models/task";
import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import {
  autoAssignLead as autoAssignFromRules,
  getEmployeeGroupIdForLeadType,
} from "./assignmentService";
import { notifyLeadAssigned } from "./notificationService";
import { initializeWorkflowForLead } from "./workflowExecutionService";
import { logger } from "../config/logger";
import { generateTagsForLead } from "./leadTaggingService";

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
  // New fields
  budget?: number;
  bookingWindow?: string;
  customerType?: string;
}

export interface AutoAssignResult {
  assignedToUserId?: Types.ObjectId;
  employeeGroupId?: Types.ObjectId;
  assignmentMethod: "auto" | "manual" | "legacy" | "none";
  wasRedirectedToBuddy?: boolean;
  originalAssigneeId?: Types.ObjectId;
}

// Helper to calculate lead score (0-10) based on SOP 1.11
export function calculateLeadScore(lead: Partial<ILead>): number {
  let score = 0;

  // 1. Travel Date Urgency (0-3 points)
  if (lead.checkInDate) {
    const daysUntilCheckIn = Math.ceil(
      (new Date(lead.checkInDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysUntilCheckIn >= 0 && daysUntilCheckIn <= 10) score += 3;
    else if (daysUntilCheckIn > 10 && daysUntilCheckIn <= 30) score += 2;
    // else if (daysUntilCheckIn > 30 && daysUntilCheckIn <= 60) score += 1;
    else if (daysUntilCheckIn > 30) score += 1;
  }

  // 2. Budget Fit (0-2 points)
  if (lead.budget && lead.budget > 0) {
    score += 1;
  }

  // 3. Engagement Level (0-2 points)
  if (lead.contactDetails?.phone || lead.contactDetails?.email) score += 1;
  if (lead.status && lead.status !== LeadStatus.NEW) score += 1;

  // 4. Call Back Requested (0-1 point)
  if (lead.source === LeadSource.IVR) score += 1;

  // 5. Deal Size (0-2 points)
  const dealValue = parseFloat(lead.estimatedValue || "0") || lead.budget || 0;
  if (dealValue >= 50000) score += 2;
  else if (dealValue >= 20000) score += 1;

  return Math.min(score, 10);
}

// Helper to derive heat level based on SOP 1.5 & 1.11
export function deriveHeatLevel(lead: Partial<ILead>): HeatLevel {
  const score = calculateLeadScore(lead);
  if (score >= 7) return HeatLevel.HOT;
  if (score >= 4) return HeatLevel.WARM;
  return HeatLevel.COLD;
}

// Helper to schedule follow-ups based on SOP 1.8
async function scheduleFollowUps(lead: ILead) {
  if (!lead.assignedToUserId) return;

  const now = new Date();
  const tasks = [];

  if (lead.heatLevel === HeatLevel.HOT) {
    // Hot: 2 hrs and 5 hrs
    tasks.push({
      title: "Hot Lead Follow-up 1",
      description: "First follow-up for Hot lead (2 hours)",
      dueAt: new Date(now.getTime() + 2 * 60 * 60 * 1000),
    });
    tasks.push({
      title: "Hot Lead Follow-up 2",
      description: "Second follow-up for Hot lead (5 hours)",
      dueAt: new Date(now.getTime() + 5 * 60 * 60 * 1000),
    });
  } else if (lead.heatLevel === HeatLevel.WARM) {
    // Warm: 24 hrs and 48 hrs
    tasks.push({
      title: "Warm Lead Follow-up 1",
      description: "First follow-up for Warm lead (24 hours)",
      dueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000),
    });
    tasks.push({
      title: "Warm Lead Follow-up 2",
      description: "Second follow-up for Warm lead (48 hours)",
      dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    });
  } else {
    // Cold: 5 days
    tasks.push({
      title: "Cold Lead Follow-up",
      description: "Follow-up for Cold lead (5 days)",
      dueAt: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
    });
  }

  for (const t of tasks) {
    await TaskModel.create({
      title: t.title,
      description: t.description,
      status: TicketStatus.NEW,
      priority: TicketPriority.HIGH,
      assignedToUserId: lead.assignedToUserId,
      relatedTo: {
        itemType: "Lead",
        itemId: lead._id,
      },
      dueDate: t.dueAt,
      createdByUserId: lead.assignedToUserId,
    });
  }
}



/**
 * Legacy auto-assignment (fallback when no rules are configured)
 */
async function legacyAutoAssignLead(
  leadType: LeadType,
  source: LeadSource
): Promise<AutoAssignResult> {
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
        assignedToUserId: buddyResolution.finalUserId, assignmentMethod: "legacy",
      };
    }
  }

  // Legacy team-based lookup removed — use AssignmentRulesV2 engine instead
  return {
    assignedToUserId: undefined,
    assignmentMethod: "none",
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
        assignedToUserId: buddyResolution.finalUserId, employeeGroupId: groupId ?? undefined,
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
  const ruleResult = await autoAssignFromRules(leadType, source);

  if (ruleResult.assignmentMethod === "auto" && ruleResult.assignedToUserId) {
    const user = await UserModel.findById(ruleResult.assignedToUserId).exec();
    return {
      assignedToUserId: ruleResult.assignedToUserId, employeeGroupId: ruleResult.employeeGroupId,
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


  // Duplicate Detection (SOP 1.4)
  if (guestId) {
    const activeLead = await LeadModel.findOne({
      guestId,
      status: {
        $nin: [
          LeadStatus.LOST,
          LeadStatus.CLOSED_AUTO,
          LeadStatus.CONFIRMED
        ]
      }
    }).select("leadNumber status").exec();

    if (activeLead) {
      throw new Error(`Active lead exists for this guest (Lead #${activeLead.leadNumber} is ${activeLead.status}). Please manage the existing lead.`);
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

  // Prepare initial lead object for scoring/heat calculation
  const initialLeadState: Partial<ILead> = {
    checkInDate: input.checkInDate,
    budget: input.budget,
    estimatedValue: input.estimatedValue,
    contactDetails,
    status: LeadStatus.NEW,
    source: input.source
  };

  const calculatedScore = calculateLeadScore(initialLeadState);
  const calculatedHeatLevel = deriveHeatLevel({ ...initialLeadState, score: calculatedScore });

  // Generate Tags
  const loadedProperty = propertyId ? await PropertyModel.findById(propertyId).exec() : null;
  const tagInputParams: Partial<ILead> = {
    customerType: input.customerType,
    checkInDate: input.checkInDate,
    budget: input.budget,
    estimatedValue: input.estimatedValue,
    source: input.source,
    bookingWindow: input.bookingWindow,
  };
  const autoTags = generateTagsForLead(tagInputParams, loadedProperty);

  const lead = await LeadModel.create({
    leadNumber,
    guestId,
    contactDetails,
    accountId,
    propertyId,
    tags: autoTags,
    source: input.source,
    leadType: input.leadType,
    status: LeadStatus.NEW,
    stage: LeadStage.NEW_LEAD, // Initialize stage
    heatLevel: input.heatLevel ?? calculatedHeatLevel, // Use manual or calculated
    score: calculatedScore, // Set score
    budget: input.budget,
    bookingWindow: input.bookingWindow,
    customerType: input.customerType,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    roomsRequested: input.roomsRequested,
    guests: input.guests,
    occasion: input.occasion,
    isFirstTimeGuest,
    assignedToUserId: assignment.assignedToUserId, leadAssignedAt: assignment.assignedToUserId ? new Date() : undefined,
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

  // Schedule follow-ups (fire and forget)
  scheduleFollowUps(lead as unknown as ILead).catch(err => {
    logger.error("Failed to schedule follow-ups", { leadId: lead._id }, err);
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
