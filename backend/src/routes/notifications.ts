import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "../services/notificationService";
import { badRequest, notFound } from "../utils/httpError";

export const notificationsRouter = Router();

// All notification operations require authentication
notificationsRouter.use(requireAuth);

// Get notifications for the current user
notificationsRouter.get("/", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const { limit, offset, unreadOnly } = req.query;

    const options = {
      limit: limit ? parseInt(String(limit), 10) : 20,
      offset: offset ? parseInt(String(offset), 10) : 0,
      unreadOnly: unreadOnly === "true",
    };

    const result = await getNotifications(req.user.id, options);

    res.json({
      notifications: result.notifications.map((n) => ({
        id: n._id,
        type: n.type,
        title: n.title,
        message: n.message,
        metadata: n.metadata,
        isRead: n.isRead,
        createdAt: n.createdAt,
      })),
      total: result.total,
      limit: options.limit,
      offset: options.offset,
    });
  } catch (err) {
    next(err);
  }
});

// Get unread notification count
notificationsRouter.get("/unread-count", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const count = await getUnreadCount(req.user.id);

    res.json({ count });
  } catch (err) {
    next(err);
  }
});

// Mark a notification as read
notificationsRouter.patch("/:id/read", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const notification = await markAsRead(req.params.id, req.user.id);

    if (!notification) {
      throw notFound("Notification not found");
    }

    res.json({
      id: notification._id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      metadata: notification.metadata,
      isRead: notification.isRead,
      createdAt: notification.createdAt,
    });
  } catch (err) {
    next(err);
  }
});

// Mark all notifications as read
notificationsRouter.patch("/read-all", async (req, res, next) => {
  try {
    if (!req.user) {
      throw badRequest("Missing authenticated user");
    }

    const count = await markAllAsRead(req.user.id);

    res.json({ markedAsRead: count });
  } catch (err) {
    next(err);
  }
});

