import { hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { forbidden } from "./httpError";

export type AccessUser = {
  id: string;
  email: string;
  permissions?: string[];
  isAdmin?: boolean;
};

export async function assertLeadAccess(
  user: AccessUser,
  lead: { assignedToUserId?: unknown }
): Promise<void> {
  if (user.isAdmin || hasPermission(user, PERMISSIONS.LEADS.MANAGE)) {
    return;
  }

  const { AccessControlService } = await import(
    "../services/auth/AccessControlService"
  );

  const ownerId = lead.assignedToUserId
    ? String(lead.assignedToUserId)
    : undefined;
  const hasAccess = await AccessControlService.hasPermission(
    user,
    "leads",
    "read",
    { ownerId }
  );

  if (hasAccess) return;

  throw forbidden("Insufficient permissions to access this lead");
}
