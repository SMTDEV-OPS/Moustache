import { Schema, model, Document, Types } from "mongoose";

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "stage_moved"
  | "assigned"
  | "score_changed"
  | "communication_sent"
  | "login"
  | "logout";

export interface IAuditLog extends Document {
  orgId?: Types.ObjectId;
  userId?: Types.ObjectId;
  entity_type: string;
  entity_id: string;
  action: AuditAction;
  old_value_json?: Record<string, any>;
  new_value_json?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    orgId: { type: Schema.Types.ObjectId, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    entity_type: { type: String, required: true, index: true },
    entity_id: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: [
        "created",
        "updated",
        "deleted",
        "stage_moved",
        "assigned",
        "score_changed",
        "communication_sent",
        "login",
        "logout",
      ],
      required: true,
    },
    old_value_json: { type: Schema.Types.Mixed },
    new_value_json: { type: Schema.Types.Mixed },
    ip_address: { type: String },
    user_agent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ orgId: 1, createdAt: -1 });
auditLogSchema.index({ entity_type: 1, entity_id: 1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });

export const AuditLogModel = model<IAuditLog>("AuditLog", auditLogSchema);
