import { API_BASE_URL, withAuthHeaders } from "./api";

export enum NotificationType {
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  LEAD_REASSIGNED = "LEAD_REASSIGNED",
  LEAD_STATUS_CHANGED = "LEAD_STATUS_CHANGED",
  TASK_ASSIGNED = "TASK_ASSIGNED",
  GENERAL = "GENERAL",
  WORKFLOW_REMINDER = "WORKFLOW_REMINDER",
  WORKFLOW_AUTO_SENT = "WORKFLOW_AUTO_SENT",
}

export interface NotificationMetadata {
  leadId?: string;
  leadNumber?: string;
  fromUserId?: string;
  fromUserName?: string;
  toUserId?: string;
  toUserName?: string;
  reassignedByUserId?: string;
  reassignedByUserName?: string;
  [key: string]: any;
}

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: NotificationMetadata;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  total: number;
  limit: number;
  offset: number;
}

export interface UnreadCountResponse {
  count: number;
}

export const getNotifications = async (
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }
): Promise<NotificationsResponse> => {
  const params = new URLSearchParams();
  if (options?.limit) params.append("limit", String(options.limit));
  if (options?.offset) params.append("offset", String(options.offset));
  if (options?.unreadOnly) params.append("unreadOnly", "true");

  const response = await fetch(
    `${API_BASE_URL}/notifications${params.toString() ? `?${params.toString()}` : ""}`,
    {
    headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch notifications");
  }

  return response.json();
};

export const getUnreadCount = async (): Promise<number> => {
  const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to fetch unread count");
  }

  const data: UnreadCountResponse = await response.json();
  return data.count;
};

export const markAsRead = async (notificationId: string): Promise<Notification> => {
  const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: "PATCH",
      headers: withAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to mark notification as read");
  }

  return response.json();
};

export const markAllAsRead = async (): Promise<{ markedAsRead: number }> => {
  const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Failed to mark all notifications as read");
  }

  return response.json();
};
