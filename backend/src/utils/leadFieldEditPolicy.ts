import { hasPermission } from "../middleware/auth";
import type { AuthUser } from "../middleware/auth";
import { PERMISSIONS } from "../constants/permissions";
import { forbidden } from "./httpError";

/** Top-level PATCH /leads/:id body keys we support (matches leadUpdateSchema). */
export const ALL_LEAD_PATCH_KEYS = [
  "status",
  "source",
  "heatLevel",
  "callStatus",
  "notes",
  "assignedToUserId",
  "stageId",
  "budget",
  "bookingWindow",
  "customerType",
  "contactDetails",
  "customData",
  "hotels",
  "checkIn",
  "checkOut",
  "roomTypeId",
  "roomTypeName",
  "ratePlanId",
  "ratePlanName",
  "roomCategory",
  "adults",
  "children",
  "estimatedRate",
] as const;

export type LeadPatchKey = (typeof ALL_LEAD_PATCH_KEYS)[number];

/** Maps granular permission → which PATCH keys it unlocks. */
const FIELD_GROUP_PERMISSION_KEYS: Record<string, readonly LeadPatchKey[]> = {
  [PERMISSIONS.LEADS.FIELD_CONTACT]: ["contactDetails"],
  [PERMISSIONS.LEADS.FIELD_NOTES]: ["notes"],
  [PERMISSIONS.LEADS.FIELD_STATUS]: ["status"],
  [PERMISSIONS.LEADS.FIELD_SOURCE]: ["source"],
  [PERMISSIONS.LEADS.FIELD_HEAT]: ["heatLevel"],
  [PERMISSIONS.LEADS.FIELD_CALL_STATUS]: ["callStatus"],
  [PERMISSIONS.LEADS.FIELD_ASSIGNMENT]: ["assignedToUserId"],
  [PERMISSIONS.LEADS.REASSIGN]: ["assignedToUserId"],
  [PERMISSIONS.LEADS.FIELD_PIPELINE]: ["stageId"],
  [PERMISSIONS.LEADS.FIELD_BOOKING]: [
    "hotels",
    "checkIn",
    "checkOut",
    "roomTypeId",
    "roomTypeName",
    "ratePlanId",
    "ratePlanName",
    "roomCategory",
    "adults",
    "children",
    "estimatedRate",
  ],
  [PERMISSIONS.LEADS.FIELD_COMMERCIAL]: ["budget", "bookingWindow", "customerType"],
  [PERMISSIONS.LEADS.FIELD_CUSTOM]: ["customData"],
};

const GRANULAR_FIELD_PERMISSIONS = Object.keys(FIELD_GROUP_PERMISSION_KEYS) as string[];

function userHasAnyGranularFieldPermission(user: AuthUser): boolean {
  return GRANULAR_FIELD_PERMISSIONS.some((p) => hasPermission(user, p));
}

/**
 * Keys this user may send on PATCH /leads/:id.
 * - `leads.manage` → all keys.
 * - `leads.update` with **no** `leads.field.*` permissions → all keys (legacy behaviour).
 * - Otherwise → union of keys allowed by each `leads.field.*` permission the user has.
 */
export function getEditableLeadFieldKeys(user: AuthUser | undefined): LeadPatchKey[] {
  if (!user) return [];

  if (user.isAdmin || hasPermission(user, PERMISSIONS.LEADS.MANAGE)) {
    return [...ALL_LEAD_PATCH_KEYS];
  }

  const hasUpdate = hasPermission(user, PERMISSIONS.LEADS.UPDATE);
  const hasGranular = userHasAnyGranularFieldPermission(user);

  if (hasUpdate && !hasGranular) {
    // Legacy behaviour: `leads.update` used to unlock all patch keys.
    // Security tightening: assignee changes must be explicitly granted via `leads.reassign`
    // (or `leads.field.assignment`) even when the user has broad update access.
    return ALL_LEAD_PATCH_KEYS.filter(
      (k) => k !== "assignedToUserId"
    ) as LeadPatchKey[];
  }

  const allowed = new Set<LeadPatchKey>();
  for (const [perm, keys] of Object.entries(FIELD_GROUP_PERMISSION_KEYS)) {
    if (hasPermission(user, perm)) {
      keys.forEach((k) => allowed.add(k));
    }
  }
  return Array.from(allowed);
}

/** True if user may call PATCH /leads/:id at all (before per-field checks). */
export function canAccessLeadPatch(user: AuthUser | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  if (hasPermission(user, PERMISSIONS.LEADS.MANAGE)) return true;
  if (hasPermission(user, PERMISSIONS.LEADS.UPDATE)) return true;
  return userHasAnyGranularFieldPermission(user);
}

/**
 * Throws 403 if the parsed body contains keys the user is not allowed to change.
 */
export function enforceLeadFieldPermissions(
  user: AuthUser | undefined,
  body: Record<string, unknown>
): void {
  const present = (ALL_LEAD_PATCH_KEYS as readonly string[]).filter(
    (k) => body[k] !== undefined
  ) as LeadPatchKey[];
  if (present.length === 0) return;

  const allowed = new Set(getEditableLeadFieldKeys(user));
  const denied = present.filter((k) => !allowed.has(k));
  if (denied.length > 0) {
    throw forbidden(
      `You cannot update: ${denied.join(", ")}. Ask an administrator for the right field permissions.`
    );
  }
}
