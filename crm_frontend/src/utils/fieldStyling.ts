/**
 * Returns Tailwind classes for system-synced (PMS) fields vs normal fields.
 */
export function getFieldStyle(fieldName: string, systemSyncedFields?: string[]): string {
  return systemSyncedFields?.includes(fieldName)
    ? "text-blue-700 bg-blue-50 border border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800"
    : "";
}

export function getSyncedFieldClass(isSynced: boolean): string {
  return isSynced
    ? "text-blue-700 bg-blue-50 border border-blue-200 dark:text-blue-300 dark:bg-blue-950/30 dark:border-blue-800"
    : "";
}
