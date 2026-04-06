/**
 * Server returns `editableLeadFields` from GET /leads/:id (PATCH body keys the user may send).
 * When undefined, fall back to legacy permission checks in the UI.
 */
export function canEditLeadField(
  editableLeadFields: string[] | undefined,
  fieldKey: string,
  legacyAllow: boolean
): boolean {
  if (editableLeadFields === undefined) return legacyAllow;
  return editableLeadFields.includes(fieldKey);
}

/**
 * Whether the user's role/profile grants changing lead assignee (matches backend getEditableLeadFieldKeys for `assignedToUserId`).
 */
export function canReassignLeadByProfile(
  permissions: string[] | undefined,
  isAdmin?: boolean
): boolean {
  if (isAdmin) return true;
  const perms = permissions ?? [];
  if (perms.includes("leads.manage")) return true;
  if (perms.includes("leads.reassign")) return true;
  if (perms.includes("leads.field.assignment")) return true;
  if (perms.includes("leads.update")) {
    const hasGranular = perms.some((p) => p.startsWith("leads.field."));
    if (!hasGranular) return true;
  }
  return false;
}
