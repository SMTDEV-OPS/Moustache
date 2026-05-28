import mongoose, { Types } from "mongoose";
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
  assignToLeastLoadedUser,
  getEmployeeGroupIdForLeadType,
} from "./assignmentService";
import { notifyLeadAssigned } from "./notificationService";
import { incrementAgentWorkload, checkCapacityAlerts } from "./allocationService";
import { initializeWorkflowForLead } from "./workflowExecutionService";
import { logger } from "../config/logger";
import { generateTagsForLead } from "./leadTaggingService";
import { PipelineModel } from "../models/pipeline";
import { PipelineStageModel } from "../models/pipelineStage";
import { CustomFieldModel } from "../models/customField";
import { ScoringService } from "./scoringService";
import { EventEmitter } from "events";

export const leadEventBus = new EventEmitter();

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
  occasion?: string;
  // Itineraries
  hotels?: {
    hotelName?: string;
    propertyId?: string;
    checkInDate?: Date;
    checkOutDate?: Date;
    roomCategory?: string;
    roomPreference?: string;
    numberOfGuests?: string;
    rooms?: { roomCategory?: string; roomPreference?: string; numberOfGuests?: string }[];
  }[];
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
  // New assignment options
  assignmentMode?: AssignmentMode;
  assignedToUserId?: string;
  createdByUserId?: string;
  // Dynamic User custom data
  customData?: Record<string, any>;
  // New fields
  budget?: number;
  bookingWindow?: string;
  customerType?: string;
  roomsRequested?: number;
  /** Manual follow-up: skips auto follow-up rules when set */
  followUp?: {
    dueAt: Date;
    notes?: string;
  };
  /** When true, use heatLevel from input instead of scoring bucket only */
  preserveManualHeatLevel?: boolean;
}

export interface AutoAssignResult {
  assignedToUserId?: Types.ObjectId;
  employeeGroupId?: Types.ObjectId;
  assignmentMethod: "auto" | "manual" | "legacy" | "round_robin_fallback" | "none";
  wasRedirectedToBuddy?: boolean;
  originalAssigneeId?: Types.ObjectId;
  isOverflow?: boolean;
  assignmentSource?: "v2_rule" | "legacy_rule" | "round_robin_fallback" | "manual" | "overflow" | "none";
  assignmentRuleName?: string;
}

// Helper to calculate lead score (0-10) based on SOP 1.11
export async function calculateLeadScore(lead: Partial<ILead>): Promise<number> {
  return ScoringService.calculateScoreForLead(lead);
}





/**
 * Legacy auto-assignment (fallback when no rules are configured)
 */
async function legacyAutoAssignLead(
  leadType: LeadType,
  source: LeadSource
): Promise<AutoAssignResult> {
  logger.warn('Legacy named-user assignment removed. Configure an AssignmentRuleV2 for this lead type.');

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
  input: CreateLeadInput,
  orgId?: string
): Promise<AutoAssignResult> {
  const { leadType, source, assignmentMode = "auto", assignedToUserId: manualAssigneeId } = input;

  console.log('[Assignment Debug] Starting assignment for lead', {
    leadType: input.leadType,
    source: input.source,
    assignmentMode: input.assignmentMode,
    manualAssigneeId: input.assignedToUserId
  });

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

      console.log('[Assignment Debug] Returning:', { assignedToUserId: buddyResolution.finalUserId, assignmentMethod: 'manual' });
      return {
        assignedToUserId: buddyResolution.finalUserId, employeeGroupId: groupId ?? undefined,
        assignmentMethod: "manual",
        wasRedirectedToBuddy: buddyResolution.wasRedirected,
        originalAssigneeId: buddyResolution.wasRedirected ? user._id : undefined,
        assignmentSource: "manual",
      };
    } else {
      logger.warn("[Manual Assignment] User not found", {
        manualAssigneeId,
      });
    }
  }

  // Try V2 Assignment Engine first
  const { tryV2Assignment } = await import("./assignmentService");
  const v2Agent = await tryV2Assignment(input, orgId);
  
  if (v2Agent) {
    if (v2Agent.assignmentMethod === "auto" && v2Agent.assignedToUserId) {
      console.log('[Assignment Debug] Returning:', { assignedToUserId: v2Agent.assignedToUserId, assignmentMethod: 'auto', assignmentSource: 'v2_rule' });
      return {
        assignedToUserId: v2Agent.assignedToUserId,
        employeeGroupId: v2Agent.employeeGroupId,
        assignmentMethod: "auto",
        wasRedirectedToBuddy: v2Agent.wasRedirectedToBuddy,
        originalAssigneeId: v2Agent.originalAssigneeId,
        assignmentSource: "v2_rule",
        assignmentRuleName: v2Agent.assignmentRuleName,
      };
    }
    if (v2Agent.isOverflow) {
      return {
        assignedToUserId: undefined,
        employeeGroupId: v2Agent.employeeGroupId,
        assignmentMethod: "none",
        isOverflow: true,
        assignmentSource: "overflow",
        assignmentRuleName: v2Agent.assignmentRuleName,
      };
    }
  }

  // Fallback: Auto assignment using legacy rules
  const ruleResult = await autoAssignFromRules(leadType, source, orgId);

  if (ruleResult.assignmentMethod === "auto" && ruleResult.assignedToUserId) {
    console.log('[Assignment Debug] Returning:', { assignedToUserId: ruleResult.assignedToUserId, assignmentMethod: 'auto', assignmentSource: 'legacy_rule' });
    return {
      assignedToUserId: ruleResult.assignedToUserId, employeeGroupId: ruleResult.employeeGroupId,
      assignmentMethod: "auto",
      wasRedirectedToBuddy: ruleResult.wasRedirectedToBuddy,
      originalAssigneeId: ruleResult.originalAssigneeId,
      assignmentSource: "legacy_rule",
    };
  }

  // At this point V2 failed and legacy failed
  // This is where fallback must be

  const activeUsers = await UserModel.find({ status: 'ACTIVE' })
    .select('_id name email')
    .lean();

  if (!activeUsers || activeUsers.length === 0) {
    logger.warn('[Assignment] No active users in system');
    console.log('[Assignment Debug] Returning:', { assignedToUserId: undefined, assignmentMethod: 'none' });
    return { assignedToUserId: undefined, assignmentMethod: 'none', assignmentSource: 'none' };
  }

  // Count open leads per user to find least loaded
  const openCounts = await LeadModel.aggregate([
    { 
      $match: { 
        assignedToUserId: { $in: activeUsers.map(u => u._id) },
        status: { $nin: ['LOST', 'CLOSED_AUTO', 'CONFIRMED'] }
      }
    },
    { $group: { _id: '$assignedToUserId', count: { $sum: 1 } } }
  ]);

  const countMap = new Map(openCounts.map(c => [c._id.toString(), c.count]));

  let selectedUser = activeUsers[0];
  let minCount = countMap.get(activeUsers[0]._id.toString()) ?? 0;

  for (const user of activeUsers) {
    const c = countMap.get(user._id.toString()) ?? 0;
    if (c < minCount) {
      selectedUser = user;
      minCount = c;
    }
  }

  logger.info(`[Assignment] Round-robin fallback → ${(selectedUser as any).name}`);
  console.log('[Assignment Debug] Fallback assigned to:', (selectedUser as any).name);
  console.log('[Assignment Debug] Returning:', { assignedToUserId: selectedUser._id.toString(), assignmentMethod: 'round_robin_fallback' });

  return {
    assignedToUserId: selectedUser._id.toString() as any,
    assignmentMethod: 'round_robin_fallback',
    assignmentSource: 'round_robin_fallback',
  };
}

/**
 * Dry-run assignment: returns what assignee would be chosen without creating a lead.
 * Use for testing/debugging the V2 allocation engine.
 */
export async function dryRunAssignment(input: CreateLeadInput, orgId?: string): Promise<AutoAssignResult> {
  return performAssignment(input, orgId);
}

/** Resolve default org ID for allocation when lead has no property/account (e.g. bulk CSV) */
async function getDefaultOrgId(): Promise<Types.ObjectId | undefined> {
  const envId = process.env.DEFAULT_ORG_ID;
  if (envId && Types.ObjectId.isValid(envId)) {
    return new Types.ObjectId(envId);
  }
  const firstProperty = await PropertyModel.findOne().select("_id").lean();
  if (firstProperty) return firstProperty._id as Types.ObjectId;
  const firstAccount = await AccountModel.findOne().select("_id").lean();
  if (firstAccount) return firstAccount._id as Types.ObjectId;
  return undefined;
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
    const normalizedName = name?.trim();

    if (!normalizedName) {
      throw new Error("Guest name is required");
    }
    if (!normalizedPhone && !normalizedEmail) {
      throw new Error("At least one contact method (phone or email) is required");
    }

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
        name: normalizedName,
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

  const orgIdForLead = propertyId || accountId || (await getDefaultOrgId());

  // Perform assignment based on mode
  const assignment = await performAssignment(
    input,
    orgIdForLead?.toString()
  );

  const leadNumber = generateLeadNumber();
  const contactDetails = buildContactDetails(input.guestContact, guest);

  // Extract primary dates for scoring (use earliest checkin)
  let earliestCheckIn: Date | undefined;
  if (input.hotels && input.hotels.length > 0) {
    const dates = input.hotels
      .map(h => h.checkInDate)
      .filter((d): d is Date => d !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());
    if (dates.length > 0) earliestCheckIn = dates[0];
  }

  const inputCustomData = input.customData || {};
  const inputCustomMap = typeof inputCustomData === "object" && !(inputCustomData instanceof Map)
    ? inputCustomData as Record<string, any>
    : {};
  const budgetForScoring = input.budget ?? inputCustomMap.budget;
  const customerTypeForScoring = input.customerType ?? inputCustomMap.customer_type ?? inputCustomMap.customerType;
  const bookingWindowForScoring = input.bookingWindow ?? inputCustomMap.booking_window ?? inputCustomMap.bookingWindow;

  const customDataMap = input.customData ? new Map(Object.entries(input.customData)) : new Map<string, any>();

  const budgetValue = input.budget ?? customDataMap.get("budget") ?? (input.customData as any)?.budget;
  const bookingWindowValue = input.bookingWindow ?? customDataMap.get("booking_window") ?? customDataMap.get("bookingWindow") ?? (input.customData as any)?.booking_window ?? (input.customData as any)?.bookingWindow;
  const customerTypeValue = input.customerType ?? customDataMap.get("customer_type") ?? customDataMap.get("customerType") ?? (input.customData as any)?.customer_type ?? (input.customData as any)?.customerType;

  // Prepare initial lead object for scoring/heat calculation
  const initialLeadState: any = {
    budget: budgetValue != null ? Number(budgetValue) : undefined,
    bookingWindow: bookingWindowValue,
    customerType: customerTypeValue,
    estimatedValue: input.estimatedValue,
    contactDetails,
    status: LeadStatus.NEW,
    source: input.source,
    ...(earliestCheckIn && {
      itineraries: [{ checkInDate: earliestCheckIn }],
      checkInDate: earliestCheckIn,
    }),
    customData: input.customData ? new Map(Object.entries(input.customData)) : new Map(),
    ...(input.customData?.budget && { budget: Number(input.customData.budget) }),
    ...(input.customData?.booking_window && { bookingWindow: input.customData.booking_window }),
    ...(input.customData?.customer_type && { customerType: input.customData.customer_type }),
  };

  const calculatedScore = await calculateLeadScore(initialLeadState);
  const { bucket, color, thresholdId } = await ScoringService.evaluateThreshold(orgIdForLead?.toString(), calculatedScore);

  // Generate Tags
  const loadedProperty = propertyId ? await PropertyModel.findById(propertyId).exec() : null;
  const tagInputParams: Partial<ILead> = {
    customerType: input.customerType,
    budget: input.budget,
    estimatedValue: input.estimatedValue,
    source: input.source,
    bookingWindow: input.bookingWindow,
  };
  const autoTags = generateTagsForLead(tagInputParams, loadedProperty);

  // Determine default stageId
  let defaultStageId: Types.ObjectId | undefined;
  const pipeline = await PipelineModel.findOne({ module: "leads", isDefault: true }).exec();
  if (pipeline) {
    const stage = await PipelineStageModel.findOne({ pipelineId: pipeline._id }).sort({ order: 1 }).exec();
    if (stage) defaultStageId = stage._id as Types.ObjectId;
  }

  // (Variables moved above)

  const lead = await LeadModel.create({
    leadNumber,
    guestId,
    contactDetails,
    accountId,
    propertyId,
    orgId: orgIdForLead,
    tags: autoTags,
    source: input.source,
    leadType: input.leadType,
    status: assignment.isOverflow ? LeadStatus.UNASSIGNED_OVERFLOW : LeadStatus.NEW,
    stageId: defaultStageId, // Dynamically assigned stage
    heatLevel: input.preserveManualHeatLevel && input.heatLevel ? input.heatLevel : (input.heatLevel ?? bucket),
    color,
    thresholdId,
    score: calculatedScore, // Set score
    assignedToUserId: assignment.assignedToUserId, leadAssignedAt: assignment.assignedToUserId ? new Date() : undefined,
    assignmentSource: assignment.assignmentSource,
    assignmentRuleName: assignment.assignmentRuleName,
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
    occasion: input.occasion,
    roomsRequested: input.roomsRequested,
    budget: budgetValue != null ? Number(budgetValue) || 0 : undefined,
    bookingWindow: bookingWindowValue,
    customerType: customerTypeValue,
    customData: input.customData && Object.keys(input.customData).length > 0 ? customDataMap : undefined,
  });

  // Create Itineraries (Line Items) - one per hotel; each hotel can have multiple rooms
  if (input.hotels && input.hotels.length > 0) {
    const { LeadItineraryModel } = await import("../models/leadItinerary");
    const itinerariesToInsert = input.hotels.map((hotel) => {
      const rooms = hotel.rooms && hotel.rooms.length > 0
        ? hotel.rooms.map((r) => ({
            roomCategory: r.roomCategory,
            roomPreference: r.roomPreference,
            numberOfGuests: r.numberOfGuests,
          }))
        : hotel.roomCategory || hotel.roomPreference || hotel.numberOfGuests
          ? [{ roomCategory: hotel.roomCategory, roomPreference: hotel.roomPreference, numberOfGuests: hotel.numberOfGuests }]
          : [];
      return {
        leadId: lead._id,
        hotelName: hotel.hotelName,
        propertyId: hotel.propertyId && Types.ObjectId.isValid(hotel.propertyId) ? new Types.ObjectId(hotel.propertyId) : undefined,
        checkInDate: hotel.checkInDate,
        checkOutDate: hotel.checkOutDate,
        roomCategory: rooms[0]?.roomCategory ?? hotel.roomCategory,
        roomPreference: rooms[0]?.roomPreference ?? hotel.roomPreference,
        numberOfGuests: rooms[0]?.numberOfGuests ?? hotel.numberOfGuests,
        rooms,
      };
    });
    await LeadItineraryModel.insertMany(itinerariesToInsert);
  }

  if (input.followUp?.dueAt) {
    const ownerId = assignment.assignedToUserId ?? input.createdByUserId;
    if (ownerId) {
      await TaskModel.create({
        title: "Field sales follow-up",
        description: input.followUp.notes || undefined,
        ownerUserId: ownerId,
        createdByUserId: input.createdByUserId,
        leadId: lead._id,
        accountId: accountId ?? undefined,
        orgId: orgIdForLead,
        dueAt: input.followUp.dueAt,
        type: "followup",
        isAutoGenerated: false,
      });
    }
  } else {
    const heatForFollowup = input.preserveManualHeatLevel && input.heatLevel ? input.heatLevel : bucket;
    import("./followupService").then(({ FollowupService }) => {
      FollowupService.generateFollowupTasks(lead._id.toString(), heatForFollowup, orgIdForLead?.toString()).catch((err) => {
        logger.error("Failed to schedule follow-ups via FollowupService", { leadId: lead._id }, err);
      });
    });
  }

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

  leadEventBus.emit("lead.created", {
    leadId: lead._id.toString(),
    leadNumber,
    orgId: orgIdForLead?.toString(),
  });

  // Log assignment activity
  if (assignment.assignedToUserId) {
    const assignmentType =
      assignment.assignmentMethod === "auto" ||
      assignment.assignmentMethod === "legacy" ||
      assignment.assignmentMethod === "round_robin_fallback"
        ? LeadActivityType.AUTO_ASSIGNED
        : LeadActivityType.MANUAL_ASSIGNED;

    const isAuto = assignmentType === LeadActivityType.AUTO_ASSIGNED;

    const assignmentNote = assignment.assignmentSource === "v2_rule" && assignment.assignmentRuleName
      ? `Lead auto-assigned by rule: ${assignment.assignmentRuleName}`
      : assignment.assignmentSource === "legacy_rule"
        ? "Lead auto-assigned by legacy rule (lead type)"
        : assignment.assignmentSource === "round_robin_fallback"
          ? "Lead auto-assigned (round-robin fallback)"
          : isAuto
            ? "Lead auto-assigned based on rules"
            : "Lead manually assigned";
    await LeadActivityModel.create({
      leadId: lead._id,
      type: assignmentType,
      note: assignmentNote,
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
  } else if (assignment.isOverflow) {
    // Log overflow activity
    await LeadActivityModel.create({
      leadId: lead._id,
      type: LeadActivityType.AUTO_ASSIGNED,
      note: "Lead overflowed to queue due to agent capacity limits",
      performedByUserId: input.createdByUserId,
      employeeGroupId: assignment.employeeGroupId,
      performedAt: new Date(),
    });

    leadEventBus.emit("lead.overflow_queued", {
      leadId: lead._id.toString(),
      leadNumber,
      orgId: orgIdForLead?.toString(),
    });
  }

  // Increment workload for the assigned agent
  if (assignment.assignedToUserId && orgIdForLead) {
    incrementAgentWorkload(orgIdForLead.toString(), assignment.assignedToUserId.toString()).catch(err => {
      logger.error("Failed to increment workload", err);
    });
    checkCapacityAlerts(orgIdForLead.toString()).catch(err => {
      logger.error("Failed to check capacity alerts", err);
    });
  }

  return lead;
}

export async function getLeadById(id: string): Promise<ILead | null> {
  return await LeadModel.findById(id)
    .populate("stageId", "name isTerminal order")
    .populate("itineraries") // Populate Line Items
    .exec();
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
  lead.assignmentSource = "manual";
  lead.assignmentRuleName = undefined; // Clear rule name on manual reassign
  await lead.save();

  // Increment workload for the new assignee (manual reassignment)
  const orgId = lead.orgId ?? lead.propertyId ?? lead.accountId;
  if (orgId) {
    incrementAgentWorkload(orgId.toString(), finalAssigneeId.toString()).catch(err => {
      logger.error("Failed to increment workload on reassignment", { leadId }, err);
    });
    checkCapacityAlerts(orgId.toString()).catch(err => {
      logger.error("Failed to check capacity alerts", err);
    });
  }

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

/**
 * Validate moving a lead to a new pipeline stage.
 * Checks for mandatory fields and terminal stage rules.
 */
export async function validateStageMove(leadId: string, targetStageId: string, orgId?: string): Promise<{
  allowed: boolean;
  missingFields?: { id: string, name: string, slug: string }[];
  reason?: 'already_terminal' | 'stage_not_found' | 'lead_not_found';
}> {
  const lead = await LeadModel.findById(leadId).exec();
  if (!lead) return { allowed: false, reason: 'lead_not_found' };

  const targetStage = await PipelineStageModel.findById(targetStageId).exec();
  if (!targetStage) return { allowed: false, reason: 'stage_not_found' };

  // Terminal rule check: Cannot move from a terminal stage to another stage
  if (lead.stageId && lead.stageId.toString() !== targetStageId.toString()) {
    const currentStage = await PipelineStageModel.findById(lead.stageId).exec();
    if (currentStage && currentStage.isTerminal) {
      return { allowed: false, reason: 'already_terminal' };
    }
  }

  // Check mandatory fields
  if (targetStage.mandatory_fields_json && targetStage.mandatory_fields_json.length > 0) {
    const mandatoryFieldIds = targetStage.mandatory_fields_json;

    // Fetch fields by ID or slug
    const fields = await CustomFieldModel.find({
      $or: [
        { _id: { $in: mandatoryFieldIds.filter((f: string) => {
          try { new mongoose.Types.ObjectId(f); return true; } 
          catch { return false; }
        })}},
        { slug: { $in: mandatoryFieldIds } }
      ]
    }).lean();

    // Check lead has value for each field
    const missingFieldNames: string[] = [];
    for (const field of fields) {
      const value = (lead as any)[field.slug] 
        ?? lead.customData?.get?.(field.slug)
        ?? (lead.customData as any)?.[field.slug]
        ?? lead.customData?.get?.(field.name);
      
      if (value === undefined || value === null || value === '') {
        missingFieldNames.push(field.name || field.slug);
      }
    }

    if (missingFieldNames.length > 0) {
      return { 
        allowed: false, 
        missingFields: missingFieldNames.map(m => ({ id: '', name: m, slug: '' })),
        reason: `Please fill: ${missingFieldNames.join(', ')}` as any
      };
    }
  }

  return { allowed: true };
}
