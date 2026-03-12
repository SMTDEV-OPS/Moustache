import { AccessControlService } from "../services/auth/AccessControlService";
import { hasPermission } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { Types } from "mongoose";
import { forbidden } from "../utils/httpError";

type AccessUser = {
  id: string;
  permissions?: string[];
  isAdmin?: boolean;
};

/**
 * Build base Mongoose filter for leads based on user's data scope (E7).
 * - own: assignedToUserId = userId
 * - team: assignedToUserId in descendants
 * - all: no assignee filter (admin/manage)
 */
export async function buildLeadQueryForUser(
  orgId: string | Types.ObjectId,
  userId: string,
  user: AccessUser,
  scope: "own" | "team" | "all" = "own"
): Promise<Record<string, any>> {
  const oid = typeof orgId === "string" ? new Types.ObjectId(orgId) : orgId;

  const base: Record<string, any> = { orgId: oid };

  if (scope === "all") {
    const hasAll =
      user.isAdmin || hasPermission(user as any, PERMISSIONS.LEADS.MANAGE);
    if (!hasAll) {
      throw forbidden("Insufficient permissions for all leads scope");
    }
    return base;
  }

  if (scope === "own") {
    base.assignedToUserId = new Types.ObjectId(userId);
    return base;
  }

  if (scope === "team") {
    const descendantIds = await AccessControlService.getDescendants(userId);
    if (descendantIds.length === 0) {
      base.assignedToUserId = new Types.ObjectId("000000000000000000000000");
      return base;
    }
    base.assignedToUserId = {
      $in: descendantIds.map((id) => new Types.ObjectId(id)),
    };
    return base;
  }

  base.assignedToUserId = new Types.ObjectId(userId);
  return base;
}
