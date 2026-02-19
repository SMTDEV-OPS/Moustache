import { Types } from "mongoose";
import {
  NotificationModel,
  INotification,
  NotificationType,
  INotificationMetadata,
} from "../models/notification";
import { getIO } from "../websocket";
import { ObjectId } from "../models/common";
import { logger } from "../config/logger";

// Re-export NotificationType for convenience
export { NotificationType };

export interface CreateNotificationInput {
  userId: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: INotificationMetadata;
}

// Lean notification type for queries
export interface LeanNotification {
  _id: ObjectId;
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: INotificationMetadata;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Create a notification and emit it via WebSocket
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<INotification> {
  const notification = await NotificationModel.create({
    userId: new Types.ObjectId(input.userId.toString()),
    type: input.type,
    title: input.title,
    message: input.message,
    metadata: input.metadata ?? {},
    isRead: false,
  });

  // Emit notification via WebSocket
  emitNotification(notification);

  return notification;
}

/**
 * Emit a notification via WebSocket to the specific user
 */
export function emitNotification(notification: INotification): void {
  try {
    const io = getIO();
    if (io) {
      // Emit to user's personal room
      const userId = notification.userId.toString();
      io.to(`user:${userId}`).emit("notification:new", {
        id: notification._id.toString(),
        type: notification.type,
        title: notification.title,
        message: notification.message,
        metadata: notification.metadata,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
      });
    }
  } catch (error) {
    // Log error but don't throw - notification is still saved
    logger.error("Failed to emit notification via WebSocket", {
      notificationId: notification._id.toString(),
      userId: notification.userId.toString(),
      type: notification.type,
    }, error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Get notifications for a user with pagination
 */
export async function getNotifications(
  userId: Types.ObjectId | string,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<{ notifications: LeanNotification[]; total: number }> {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const filter: Record<string, unknown> = {
    userId: new Types.ObjectId(userId.toString()),
  };

  if (unreadOnly) {
    filter.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    NotificationModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean(),
    NotificationModel.countDocuments(filter),
  ]);

  return { notifications: notifications as LeanNotification[], total };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(
  userId: Types.ObjectId | string
): Promise<number> {
  return NotificationModel.countDocuments({
    userId: new Types.ObjectId(userId.toString()),
    isRead: false,
  });
}

/**
 * Mark a notification as read
 */
export async function markAsRead(
  notificationId: Types.ObjectId | string,
  userId: Types.ObjectId | string
): Promise<LeanNotification | null> {
  const result = await NotificationModel.findOneAndUpdate(
    {
      _id: new Types.ObjectId(notificationId.toString()),
      userId: new Types.ObjectId(userId.toString()),
    },
    { isRead: true },
    { new: true }
  ).lean();
  
  return result as LeanNotification | null;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(
  userId: Types.ObjectId | string
): Promise<number> {
  const result = await NotificationModel.updateMany(
    {
      userId: new Types.ObjectId(userId.toString()),
      isRead: false,
    },
    { isRead: true }
  );

  return result.modifiedCount;
}

/**
 * Create a lead assignment notification
 */
export async function notifyLeadAssigned(
  userId: Types.ObjectId | string,
  leadId: Types.ObjectId | string,
  leadNumber: string,
  assignedByUserName?: string,
  isBuddyRedirect?: boolean,
  originalAssigneeName?: string
): Promise<INotification> {
  const isAutoAssigned = !assignedByUserName;
  
  let message: string;
  if (isBuddyRedirect && originalAssigneeName) {
    message = `Lead ${leadNumber} has been assigned to you as a buddy for ${originalAssigneeName} (who is currently unavailable).`;
  } else if (isAutoAssigned) {
    message = `Lead ${leadNumber} has been automatically assigned to you.`;
  } else {
    message = `Lead ${leadNumber} has been assigned to you by ${assignedByUserName}.`;
  }
  
  return createNotification({
    userId,
    type: NotificationType.LEAD_ASSIGNED,
    title: isBuddyRedirect ? "Lead Assigned (Buddy)" : "New Lead Assigned",
    message,
    metadata: {
      leadId: new Types.ObjectId(leadId.toString()),
      leadNumber,
      assignedByUserName,
      isBuddyRedirect,
      originalAssigneeName,
    },
  });
}

/**
 * Create a buddy assignment notification
 */
export async function notifyBuddyAssigned(
  buddyUserId: Types.ObjectId | string,
  assignedByUserId: Types.ObjectId | string,
  assignedByUserName: string,
  effectiveFrom: Date,
  effectiveTo?: Date,
  reason?: string
): Promise<INotification> {
  const fromDateStr = effectiveFrom.toLocaleDateString();
  const toDateStr = effectiveTo ? effectiveTo.toLocaleDateString() : "ongoing";
  const dateRange = effectiveTo 
    ? `from ${fromDateStr} to ${toDateStr}`
    : `starting ${fromDateStr}`;
  
  const reasonText = reason ? ` Reason: ${reason}` : "";
  
  return createNotification({
    userId: buddyUserId,
    type: NotificationType.GENERAL,
    title: "Buddy Assignment",
    message: `${assignedByUserName} has assigned you as their buddy ${dateRange}. You will receive their leads during this period.${reasonText}`,
    metadata: {
      fromUserId: new Types.ObjectId(assignedByUserId.toString()),
      fromUserName: assignedByUserName,
      effectiveFrom: effectiveFrom,
      effectiveTo: effectiveTo,
      reason: reason,
    },
  });
}

/**
 * Create a buddy assignment cancellation notification
 */
export async function notifyBuddyCancelled(
  buddyUserId: Types.ObjectId | string,
  cancelledByUserId: Types.ObjectId | string,
  cancelledByUserName: string
): Promise<INotification> {
  return createNotification({
    userId: buddyUserId,
    type: NotificationType.GENERAL,
    title: "Buddy Assignment Cancelled",
    message: `${cancelledByUserName} has cancelled your buddy assignment. You will no longer receive their leads.`,
    metadata: {
      fromUserId: new Types.ObjectId(cancelledByUserId.toString()),
      fromUserName: cancelledByUserName,
    },
  });
}

/**
 * Create a lead reassignment notification
 */
export async function notifyLeadReassigned(
  userId: Types.ObjectId | string,
  leadId: Types.ObjectId | string,
  leadNumber: string,
  reassignedByUserName: string,
  fromUserName?: string
): Promise<INotification> {
  return createNotification({
    userId,
    type: NotificationType.LEAD_REASSIGNED,
    title: "Lead Reassigned to You",
    message: fromUserName
      ? `Lead ${leadNumber} has been reassigned to you from ${fromUserName} by ${reassignedByUserName}.`
      : `Lead ${leadNumber} has been reassigned to you by ${reassignedByUserName}.`,
    metadata: {
      leadId: new Types.ObjectId(leadId.toString()),
      leadNumber,
      reassignedByUserName,
      fromUserName,
    },
  });
}

/**
 * Create a ticket assignment notification
 */
export async function notifyTicketAssigned(
  userId: Types.ObjectId | string,
  ticketId: Types.ObjectId | string,
  ticketNumber: string,
  assignedByUserName?: string,
  isBuddyRedirect?: boolean,
  originalAssigneeName?: string
): Promise<INotification> {
  const isAutoAssigned = !assignedByUserName;
  
  let message: string;
  if (isBuddyRedirect && originalAssigneeName) {
    message = `Ticket ${ticketNumber} has been assigned to you as a buddy for ${originalAssigneeName} (who is currently unavailable).`;
  } else if (isAutoAssigned) {
    message = `Ticket ${ticketNumber} has been automatically assigned to you.`;
  } else {
    message = `Ticket ${ticketNumber} has been assigned to you by ${assignedByUserName}.`;
  }
  
  return createNotification({
    userId,
    type: NotificationType.TICKET_ASSIGNED,
    title: isBuddyRedirect ? "Ticket Assigned (Buddy)" : "New Ticket Assigned",
    message,
    metadata: {
      ticketId: new Types.ObjectId(ticketId.toString()),
      ticketNumber,
      assignedByUserName,
      isBuddyRedirect,
      originalAssigneeName,
    },
  });
}

