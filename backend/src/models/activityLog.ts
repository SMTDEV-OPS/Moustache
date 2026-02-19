import { Schema, model, Document } from "mongoose";
import { UserRef } from "./common";

export interface IActivityLog extends Document {
  type: string;
  entityId?: string;
  userId?: any;
  action: string;
  metadata?: any;
  createdAt: Date;
}

const activityLogSchema = new Schema<IActivityLog>(
  {
    type: { type: String, required: true },
    entityId: { type: String },
    userId: UserRef,
    action: { type: String, required: true },
    metadata: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: true } }
);

activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ type: 1, createdAt: -1 });

export const ActivityLogModel = model<IActivityLog>(
  "ActivityLog",
  activityLogSchema
);



