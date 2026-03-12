import { Request } from "express";
import { Types } from "mongoose";
import { AuditLogModel, AuditAction } from "../models/auditLog";
import { logger } from "../config/logger";

export type AuditOverrides = {
  userId?: string;
  orgId?: string;
  ip?: string;
  userAgent?: string;
};

/**
 * Fire-and-forget audit logging. Never blocks the main request.
 * Never throws - logs errors to console only.
 */
export function logAudit(
  action: AuditAction,
  entity_type: string,
  entity_id: string,
  old_value: Record<string, any> | null,
  new_value: Record<string, any> | null,
  req?: Request,
  overrides?: AuditOverrides
): void {
  const userId = overrides?.userId || (req as any)?.user?.id;
  const userIdObj = userId ? new Types.ObjectId(userId) : undefined;
  const orgId = overrides?.orgId ||
    (req?.query?.orgId as string) ||
    (req?.body?.orgId as string) ||
    (req?.headers?.["x-org-id"] as string);
  const orgIdObj = orgId && /^[a-fA-F0-9]{24}$/.test(orgId)
    ? new Types.ObjectId(orgId)
    : undefined;
  const ip = overrides?.ip ?? req?.ip ?? req?.socket?.remoteAddress ?? (req?.headers?.["x-forwarded-for"] as string) ?? undefined;
  const userAgent = overrides?.userAgent ?? req?.get?.("user-agent") ?? undefined;

  setImmediate(() => {
    AuditLogModel.create({
      orgId: orgIdObj,
      userId: userIdObj,
      entity_type,
      entity_id,
      action,
      old_value_json: old_value ?? undefined,
      new_value_json: new_value ?? undefined,
      ip_address: ip,
      user_agent: userAgent,
    }).catch((err) => {
      logger.error("Audit log write failed", { error: err?.message, entity_type, entity_id, action });
    });
  });
}
