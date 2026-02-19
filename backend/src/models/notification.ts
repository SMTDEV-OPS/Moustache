import { Schema, model, Document } from "mongoose";
import { ObjectId, UserRef, LeadRef } from "./common";

export enum NotificationType {
  LEAD_ASSIGNED = "LEAD_ASSIGNED",
  LEAD_REASSIGNED = "LEAD_REASSIGNED",
  LEAD_STATUS_CHANGED = "LEAD_STATUS_CHANGED",
  TASK_ASSIGNED = "TASK_ASSIGNED",
  TICKET_ASSIGNED = "TICKET_ASSIGNED",
  TICKET_REASSIGNED = "TICKET_REASSIGNED",
  GENERAL = "GENERAL",
  // Workflow-related notification types
  WORKFLOW_REMINDER = "WORKFLOW_REMINDER",
  WORKFLOW_AUTO_SENT = "WORKFLOW_AUTO_SENT",
  CLIENT_RESPONSE = "CLIENT_RESPONSE",
}

export interface INotificationMetadata {
  leadId?: ObjectId;
  leadNumber?: string;
  fromUserId?: ObjectId;
  fromUserName?: string;
  toUserId?: ObjectId;
  toUserName?: string;
  reassignedByUserId?: ObjectId;
  reassignedByUserName?: string;
  [key: string]: any;
}

export interface INotification extends Document {
  userId: ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: INotificationMetadata;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: { ...UserRef, required: true },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

// Compound index for efficient querying of user's unread notifications
notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const NotificationModel = model<INotification>(
  "Notification",
  notificationSchema
);

