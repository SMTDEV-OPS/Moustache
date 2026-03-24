import { ProfileModel } from "../models/profile";
import { PERMISSIONS } from "../constants/permissions";

// Setup permission keys from permissions.ts (all .manage keys for admin/setup screens)
const ALL_SETUP_KEYS = [
  PERMISSIONS.SETTINGS.MANAGE,
  PERMISSIONS.USERS.MANAGE,
  PERMISSIONS.ROLES.MANAGE,
  PERMISSIONS.REPORTS.MANAGE,
  PERMISSIONS.GROUPS.MANAGE,
  PERMISSIONS.REGIONS.MANAGE,
  PERMISSIONS.ASSIGNMENT_RULES.MANAGE,
  PERMISSIONS.WORKFLOWS.MANAGE,
  PERMISSIONS.TEMPLATES.MANAGE,
  PERMISSIONS.KNOWLEDGE_BASE.MANAGE,
  PERMISSIONS.PMS.MANAGE,
  PERMISSIONS.NOTIFICATIONS.MANAGE,
  PERMISSIONS.BUDDIES.MANAGE,
  PERMISSIONS.CONGLOMERATES.MANAGE,
  PERMISSIONS.ACCOUNT_POTENTIALS.MANAGE,
  PERMISSIONS.HOTEL_BRANDS.MANAGE,
  PERMISSIONS.ACCOUNTS.ASSIGN_MANAGERS,
  PERMISSIONS.ACCOUNTS.VIEW_HIERARCHY,
  PERMISSIONS.ACCOUNTS.MANAGE_ACTIVITIES,
  PERMISSIONS.ACCOUNTS.MANAGE_NOTES,
  PERMISSIONS.ACCOUNTS.MANAGE_DOCUMENTS,
];

const ALL_MODULES = [
  "leads", "users", "roles", "reports", "accounts", "contacts",
  "properties", "tasks", "tickets", "guests", "reservations",
  "communications", "quotations", "payment-links", "workflows",
  "templates", "knowledge-base", "pms", "regions", "groups",
  "assignment-rules", "notifications", "email", "buddies",
];

/** Full module + setup permissions for the Admin profile (used by seedAdmin + ensureDefaultProfiles). */
export function getFullAdminProfileData(): {
  modulePermissions: Array<{
    module: string;
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
  }>;
  setupPermissions: Array<{ key: string; enabled: boolean }>;
} {
  const allAccess = ALL_MODULES.map((m) => ({
    module: m,
    view: true,
    create: true,
    edit: true,
    delete: true,
  }));
  const fullSetupKeys = ALL_SETUP_KEYS.map((k) => ({ key: k, enabled: true }));
  return { modulePermissions: allAccess, setupPermissions: fullSetupKeys };
}

export async function ensureDefaultProfiles() {
  const count = await ProfileModel.countDocuments();
  if (count > 0) {
    console.log("[Profiles] Already seeded — skipping");
    return;
  }

  const { modulePermissions: allAccess, setupPermissions: fullSetupKeys } = getFullAdminProfileData();

  const readOnly = ALL_MODULES.map((m) => ({
    module: m,
    view: true,
    create: false,
    edit: false,
    delete: false,
  }));

  const salesAccess = ALL_MODULES.map((m) => ({
    module: m,
    view: ["leads", "tasks", "guests", "communications", "templates", "knowledge-base", "quotations"].includes(m),
    create: ["leads", "tasks", "communications", "quotations"].includes(m),
    edit: ["leads", "tasks"].includes(m),
    delete: false,
  }));

  const tlAccess = ALL_MODULES.map((m) => ({
    module: m,
    view: !["roles", "conglomerates", "account-potentials"].includes(m),
    create: ["leads", "tasks", "communications", "quotations"].includes(m),
    edit: ["leads", "tasks", "users"].includes(m),
    delete: ["tasks"].includes(m),
  }));

  const managerAccess = ALL_MODULES.map((m) => ({
    module: m,
    view: true,
    create: true,
    edit: true,
    delete: ["leads", "tasks", "communications"].includes(m),
  }));

  const noSetupKeys = ALL_SETUP_KEYS.map((k) => ({ key: k, enabled: false }));
  const managerSetupKeys = ALL_SETUP_KEYS.map((k) => ({
    key: k,
    enabled: ["settings.manage", "users.manage", "reports.manage"].includes(k),
  }));
  const tlSetupKeys = ALL_SETUP_KEYS.map((k) => ({
    key: k,
    enabled: ["reports.manage"].includes(k),
  }));

  await ProfileModel.insertMany([
    {
      name: "Admin",
      description: "Full system access",
      isSystemProfile: true,
      modulePermissions: allAccess,
      setupPermissions: fullSetupKeys,
    },
    {
      name: "Manager",
      description: "Full leads access and user management",
      isSystemProfile: false,
      modulePermissions: managerAccess,
      setupPermissions: managerSetupKeys,
    },
    {
      name: "Team Lead",
      description: "Team visibility and task assignment",
      isSystemProfile: false,
      modulePermissions: tlAccess,
      setupPermissions: tlSetupKeys,
    },
    {
      name: "Sales Executive",
      description: "Access to assigned leads and tasks only",
      isSystemProfile: false,
      modulePermissions: salesAccess,
      setupPermissions: noSetupKeys,
    },
  ]);

  console.log("[Profiles] Seeded 4 default profiles");
}
