import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { useToast } from "./use-toast";
import { ToastAction } from "@/components/ui/toast";
import { getAuthToken, API_BASE_URL } from "@/services/api";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  Notification,
} from "@/services/notifications";

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
}

export function useNotifications(): UseNotificationsResult {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const [notifResponse, count] = await Promise.all([
        getNotifications({ limit: 20 }),
        getUnreadCount(),
      ]);
      setNotifications(notifResponse.notifications);
      setUnreadCount(count);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch notifications");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Mark a notification as read
  const markNotificationAsRead = useCallback(async (id: string) => {
    try {
      await markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  }, []);

  // Mark all notifications as read
  const markAllNotificationsAsRead = useCallback(async () => {
    try {
      await markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
    }
  }, []);

  // Set up WebSocket connection
  useEffect(() => {
    const token = getAuthToken();
    
    // If no token, disconnect any existing socket and return
    if (!token) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Derive WebSocket URL from API URL
    const wsUrl = API_BASE_URL.replace(/^http/, "ws").replace(/\/api$/, "");

    // Disconnect existing socket if any
    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const socket = io(wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
    });

    socket.on("disconnect", () => {
    });

    socket.on("notification:new", (notification: Notification) => {
      // Add to notifications list
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      const accountId = notification.metadata?.accountId as string | undefined;
      const accountName = notification.metadata?.accountName as string | undefined;
      const isAccountReminder = notification.type === "TASK_ASSIGNED" && !!accountId;

      // Show toast
      toast({
        title: isAccountReminder
          ? `Reminder: ${notification.title}${accountName ? ` - ${accountName}` : ""}`
          : notification.title,
        description: notification.message,
        action: isAccountReminder ? (
          <ToastAction
            altText="View account"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("crm:navigate-account", {
                  detail: { accountId },
                })
              )
            }
          >
            View Account
          </ToastAction>
        ) : undefined,
      });
    });

    socket.on("connect_error", (err) => {
      console.error("WebSocket connection error:", err.message);
    });

    // Fetch initial notifications
    void fetchNotifications();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [fetchNotifications, toast]);

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    refresh: fetchNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  };
}

