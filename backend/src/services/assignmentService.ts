import { Types } from "mongoose";
import { LeadType, LeadStatus, ObjectId, LeadSource } from "../models/common";
import { LeadAssignmentRuleModel } from "../models/leadAssignmentRule";
import { EmployeeGroupModel } from "../models/employeeGroup";
import { UserModel } from "../models/user";
import { LeadModel } from "../models/lead";
import { UserBuddyAssignmentModel } from "../models/userBuddyAssignment";
import { logger } from "../config/logger";

import { getAvailableAgents } from "./allocationService";

// ... will add isOverflow to AssignmentResult ...
export interface AssignmentResult {
  assignedToUserId?: Types.ObjectId;
  employeeGroupId?: Types.ObjectId;
  assignmentMethod: "auto" | "manual" | "none";
  reason?: string;
  wasRedirectedToBuddy?: boolean;
  originalAssigneeId?: Types.ObjectId;
  isOverflow?: boolean;
}

export interface EligibleUser {
  id: string;
  name: string;
  email: string;
  openLeadCount: number;
  isOnline: boolean;
}

// Lean user type for queries
interface LeanUser {
  _id: ObjectId;
  name: string;
  email: string;
  isOnline?: boolean;
}

/**
 * Get the assignment rule for a given lead type
 */
export async function getAssignmentRule(leadType: LeadType) {
  return LeadAssignmentRuleModel.findOne({
    leadType,
    isActive: true,
  }).lean();
}

/**
 * Find eligible users from an employee group who are online and active
 */
export async function findEligibleUsers(
  groupId: Types.ObjectId | string,
): Promise<LeanUser[]> {
  const group = await EmployeeGroupModel.findById(groupId).lean();
  if (!group || !group.isActive) {
    return [];
  }

  const memberIds = group.memberUserIds ?? [];
  if (memberIds.length === 0) {
    return [];
  }

  // Find users who are active and online
  const query: any = {
    _id: { $in: memberIds },
    status: "ACTIVE",
    isOnline: true,
  };
  const users = await UserModel.find(query)
    .select("_id name email isOnline teamType")
    .lean();

  return users as LeanUser[];
}

/**
 * Find all active users from an employee group (for manual assignment)
 */
export async function findAllGroupUsers(
  groupId: Types.ObjectId | string,
): Promise<LeanUser[]> {
  const group = await EmployeeGroupModel.findById(groupId).lean();
  if (!group || !group.isActive) {
    return [];
  }

  const memberIds = group.memberUserIds ?? [];
  if (memberIds.length === 0) {
    return [];
  }

  const query: any = {
    _id: { $in: memberIds },
    status: "ACTIVE",
  };
  const users = await UserModel.find(query)
    .select("_id name email isOnline teamType")
    .lean();

  return users as LeanUser[];
}

/**
 * Count open leads for each user and return the user with the least count
 */
export async function getUserWithLeastLeads(
  userIds: (Types.ObjectId | string)[]
): Promise<{ userId: Types.ObjectId; count: number } | null> {
  if (userIds.length === 0) {
    return null;
  }

  // Define open statuses (leads that are still being worked on)
  const openStatuses = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUOTATION_SHARED,
    LeadStatus.PAYMENT_PENDING,
    LeadStatus.ON_HOLD,
  ];

  // Count leads per user using aggregation
  const leadCounts = await LeadModel.aggregate([
    {
      $match: {
        assignedToUserId: { $in: userIds.map((id) => new Types.ObjectId(id.toString())) },
        status: { $in: openStatuses },
      },
    },
    {
      $group: {
        _id: "$assignedToUserId",
        count: { $sum: 1 },
      },
    },
  ]);

  // Create a map of user ID to lead count
  const countMap = new Map<string, number>();
  for (const item of leadCounts) {
    countMap.set(item._id.toString(), item.count);
  }

  // Find the user with the least leads (users with no leads get count 0)
  let minCount = Infinity;
  let selectedUserId: Types.ObjectId | null = null;

  for (const userId of userIds) {
    const count = countMap.get(userId.toString()) ?? 0;
    if (count < minCount) {
      minCount = count;
      selectedUserId = new Types.ObjectId(userId.toString());
    }
  }

  if (!selectedUserId) {
    return null;
  }

  return { userId: selectedUserId, count: minCount };
}

/**
 * Auto-assign a lead based on lead type rules
 */
export async function autoAssignLead(
  leadType: LeadType,
  source?: LeadSource,
  orgId?: string
): Promise<AssignmentResult> {
  // Get the assignment rule for this lead type
  const rule = await getAssignmentRule(leadType);

  if (!rule) {
    return {
      assignmentMethod: "none",
      reason: `No active assignment rule found for lead type: ${leadType}`,
    };
  }

  let eligibleUsers = await findEligibleUsers(rule.employeeGroupId);

  // If no online users, fall back to all active users in the group
  if (eligibleUsers.length === 0) {
    eligibleUsers = await findAllGroupUsers(rule.employeeGroupId);

    if (eligibleUsers.length === 0) {
      return {
        employeeGroupId: rule.employeeGroupId,
        assignmentMethod: "none",
        reason: `No active users found in the assigned employee group`,
      };
    }
  }

  // Apply capacity filtering if orgId is present
  if (orgId) {
    const availableAgentIds = await getAvailableAgents(orgId, rule.employeeGroupId.toString());
    const availableSet = new Set(availableAgentIds.map(id => id.toString()));

    eligibleUsers = eligibleUsers.filter(u => availableSet.has(u._id.toString()));

    if (eligibleUsers.length === 0) {
      return {
        employeeGroupId: rule.employeeGroupId,
        assignmentMethod: "none",
        reason: `Capacity reached. No available agents under capacity.`,
        isOverflow: true
      };
    }
  }

  const userIds = eligibleUsers.map((u) => u._id);

  // Get the user with the least leads
  const result = await getUserWithLeastLeads(userIds);

  if (!result) {
    return {
      employeeGroupId: rule.employeeGroupId,
      assignmentMethod: "none",
      reason: "Could not determine user with least leads",
    };
  }

  // Check if the selected user has an active buddy assignment
  const buddyResolution = await resolveAssigneeWithBuddy(result.userId);

  let reason = `Auto-assigned to user with ${result.count} open leads`;
  if (buddyResolution.wasRedirected) {
    reason += `. Redirected to buddy due to unavailability${buddyResolution.reason ? ` (${buddyResolution.reason})` : ""}`;
  }

  return {
    assignedToUserId: buddyResolution.finalUserId,
    employeeGroupId: rule.employeeGroupId,
    assignmentMethod: "auto",
    reason: reason,
    wasRedirectedToBuddy: buddyResolution.wasRedirected,
    originalAssigneeId: buddyResolution.wasRedirected ? result.userId : undefined,
  };
}

/**
 * Get eligible users for manual assignment based on lead type
 */
export async function getEligibleUsersForManualAssignment(
  leadType: LeadType,
  source?: LeadSource
): Promise<EligibleUser[]> {
  const rule = await getAssignmentRule(leadType);

  if (!rule) {
    return [];
  }

  const users = await findAllGroupUsers(rule.employeeGroupId);

  if (users.length === 0) {
    return [];
  }

  const userIds = users.map((u) => u._id);

  // Get lead counts for all users
  const openStatuses = [
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUOTATION_SHARED,
    LeadStatus.PAYMENT_PENDING,
    LeadStatus.ON_HOLD,
  ];

  const leadCounts = await LeadModel.aggregate([
    {
      $match: {
        assignedToUserId: { $in: userIds },
        status: { $in: openStatuses },
      },
    },
    {
      $group: {
        _id: "$assignedToUserId",
        count: { $sum: 1 },
      },
    },
  ]);

  const countMap = new Map<string, number>();
  for (const item of leadCounts) {
    countMap.set(item._id.toString(), item.count);
  }

  return users.map((user) => ({
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    openLeadCount: countMap.get(user._id.toString()) ?? 0,
    isOnline: user.isOnline ?? false,
  }));
}

/**
 * Check if a user has an active buddy assignment
 * Returns the buddy user ID if user is unavailable, null otherwise
 */
export async function checkActiveBuddyAssignment(
  userId: Types.ObjectId | string
): Promise<{ buddyUserId: Types.ObjectId; reason?: string } | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const userIdStr = userId.toString();

  logger.info("[Buddy Check] Checking active buddy assignment", {
    userId: userIdStr,
    today: today.toISOString(),
    todayDateString: today.toDateString(),
    todayTimestamp: today.getTime(),
  });

  // First, get all buddy assignments for this user to see what exists
  const allAssignments = await UserBuddyAssignmentModel.find({
    userId: userId,
  })
    .populate("userId", "name email")
    .populate("buddyUserId", "name email")
    .lean();

  logger.info("[Buddy Check] Found buddy assignments for user", {
    userId: userIdStr,
    totalAssignments: allAssignments.length,
    assignments: allAssignments.map((a) => {
      const fromDate = a.effectiveFrom ? new Date(a.effectiveFrom) : null;
      const toDate = a.effectiveTo ? new Date(a.effectiveTo) : null;
      const fromDateNormalized = fromDate ? new Date(fromDate) : null;
      if (fromDateNormalized) fromDateNormalized.setHours(0, 0, 0, 0);
      const toDateNormalized = toDate ? new Date(toDate) : null;
      if (toDateNormalized) toDateNormalized.setHours(0, 0, 0, 0);

      return {
        assignmentId: a._id.toString(),
        buddyUserId: a.buddyUserId?.toString(),
        buddyName: (a.buddyUserId as any)?.name,
        effectiveFrom: a.effectiveFrom?.toISOString(),
        effectiveFromNormalized: fromDateNormalized?.toISOString(),
        effectiveTo: a.effectiveTo?.toISOString() || null,
        effectiveToNormalized: toDateNormalized?.toISOString() || null,
        reason: a.reason,
        isFromBeforeOrEqualToday: fromDateNormalized ? fromDateNormalized <= today : false,
        isToAfterOrEqualToday: toDateNormalized ? toDateNormalized >= today : a.effectiveTo === null,
      };
    }),
  });

  // Use end of today for comparison to include assignments that start today
  const endOfToday = new Date(today);
  endOfToday.setHours(23, 59, 59, 999);

  const query = {
    userId: userId,
    effectiveFrom: { $lte: endOfToday },
    $or: [
      { effectiveTo: { $gte: today } },
      { effectiveTo: null },
    ],
  };

  logger.info("[Buddy Check] Executing query for active assignment", {
    userId: userIdStr,
    query: {
      userId: userIdStr,
      effectiveFrom: { $lte: endOfToday.toISOString() },
      $or: [
        { effectiveTo: { $gte: today.toISOString() } },
        { effectiveTo: null },
      ],
    },
    today: today.toISOString(),
    endOfToday: endOfToday.toISOString(),
  });

  const assignment = await UserBuddyAssignmentModel.findOne(query)
    .populate("buddyUserId", "name email status")
    .lean();

  if (assignment) {
    const buddy = assignment.buddyUserId as any;
    // Extract the actual ObjectId - handle both populated object and direct ObjectId
    const buddyUserIdObj = buddy?._id ? buddy._id : assignment.buddyUserId;
    const buddyUserIdStr = buddyUserIdObj?.toString() || (assignment.buddyUserId as any)?.toString();

    logger.info("[Buddy Check] Active buddy assignment found", {
      userId: userIdStr,
      assignmentId: assignment._id.toString(),
      buddyUserId: buddyUserIdStr,
      buddyName: buddy?.name,
      buddyStatus: buddy?.status,
      effectiveFrom: assignment.effectiveFrom?.toISOString(),
      effectiveTo: assignment.effectiveTo?.toISOString() || null,
      reason: assignment.reason,
    });

    // Extract the actual ObjectId - handle both populated object and direct ObjectId
    let buddyUserId: Types.ObjectId;
    if (buddy?._id) {
      // Populated object case - extract _id
      buddyUserId = new Types.ObjectId(buddy._id.toString());
    } else if (assignment.buddyUserId instanceof Types.ObjectId) {
      // Already an ObjectId
      buddyUserId = assignment.buddyUserId;
    } else {
      // String or other - convert to ObjectId
      buddyUserId = new Types.ObjectId(assignment.buddyUserId.toString());
    }

    logger.info("[Buddy Check] Returning buddy assignment", {
      userId: userIdStr,
      buddyUserId: buddyUserId.toString(),
      buddyUserIdHex: buddyUserId.toHexString(),
      reason: assignment.reason,
    });

    return {
      buddyUserId: buddyUserId,
      reason: assignment.reason,
    };
  }

  logger.info("[Buddy Check] No active buddy assignment found", {
    userId: userIdStr,
    today: today.toISOString(),
  });

  return null;
}

/**
 * Resolve final assignee considering buddy assignments
 * If the target user has an active buddy assignment, returns the buddy instead
 */
export async function resolveAssigneeWithBuddy(
  targetUserId: Types.ObjectId | string
): Promise<{ finalUserId: Types.ObjectId; wasRedirected: boolean; reason?: string }> {
  const targetUserIdStr = targetUserId.toString();

  logger.info("[Buddy Resolution] Starting buddy resolution", {
    targetUserId: targetUserIdStr,
  });

  // Get target user info for logging
  const targetUser = await UserModel.findById(targetUserId)
    .select("name email status")
    .lean();

  logger.info("[Buddy Resolution] Target user info", {
    targetUserId: targetUserIdStr,
    targetUserName: targetUser?.name,
    targetUserEmail: targetUser?.email,
    targetUserStatus: targetUser?.status,
  });

  const buddyCheck = await checkActiveBuddyAssignment(targetUserId);

  if (buddyCheck) {
    const buddyUserIdStr = buddyCheck.buddyUserId.toString();

    logger.info("[Buddy Resolution] Buddy check returned assignment", {
      targetUserId: targetUserIdStr,
      buddyUserId: buddyUserIdStr,
      reason: buddyCheck.reason,
    });

    // Verify buddy is active
    const buddy = await UserModel.findById(buddyCheck.buddyUserId)
      .select("name email status")
      .lean();

    logger.info("[Buddy Resolution] Buddy user info", {
      buddyUserId: buddyUserIdStr,
      buddyName: buddy?.name,
      buddyEmail: buddy?.email,
      buddyStatus: buddy?.status,
    });

    if (buddy && buddy.status === "ACTIVE") {
      logger.info("[Buddy Resolution] Redirecting to buddy", {
        targetUserId: targetUserIdStr,
        targetUserName: targetUser?.name,
        buddyUserId: buddyUserIdStr,
        buddyName: buddy.name,
        reason: buddyCheck.reason,
      });

      // Ensure we return a proper ObjectId instance
      // Handle case where buddyUserId might be ObjectId or string
      let finalBuddyId: Types.ObjectId;
      const buddyUserIdValue = buddyCheck.buddyUserId;
      if (buddyUserIdValue instanceof Types.ObjectId) {
        finalBuddyId = buddyUserIdValue;
      } else {
        const buddyUserIdStr = typeof buddyUserIdValue === 'string'
          ? buddyUserIdValue
          : String(buddyUserIdValue);
        finalBuddyId = new Types.ObjectId(buddyUserIdStr);
      }

      logger.info("[Buddy Resolution] Returning final user ID", {
        targetUserId: targetUserIdStr,
        finalBuddyId: finalBuddyId.toString(),
        finalBuddyIdHex: finalBuddyId.toHexString(),
        wasRedirected: true,
      });

      return {
        finalUserId: finalBuddyId,
        wasRedirected: true,
        reason: buddyCheck.reason,
      };
    } else {
      logger.warn("[Buddy Resolution] Buddy is not active, using original user", {
        targetUserId: targetUserIdStr,
        buddyUserId: buddyUserIdStr,
        buddyStatus: buddy?.status || "NOT_FOUND",
      });
    }
  } else {
    logger.info("[Buddy Resolution] No buddy assignment found, using original user", {
      targetUserId: targetUserIdStr,
      targetUserName: targetUser?.name,
    });
  }

  logger.info("[Buddy Resolution] Final decision: using original user", {
    targetUserId: targetUserIdStr,
    targetUserName: targetUser?.name,
  });

  return {
    finalUserId: new Types.ObjectId(targetUserIdStr),
    wasRedirected: false,
  };
}

/**
 * Get the employee group ID for a given lead type (for logging purposes)
 */
export async function getEmployeeGroupIdForLeadType(
  leadType: LeadType
): Promise<Types.ObjectId | null> {
  const rule = await getAssignmentRule(leadType);
  return rule ? rule.employeeGroupId : null;
}

