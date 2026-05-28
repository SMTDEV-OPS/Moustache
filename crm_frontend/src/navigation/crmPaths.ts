/** CRM route paths — single source of truth for URL navigation */

export const CRM_PATHS = {
  dashboard: "/",
  calls: "/calls",
  leads: "/leads",
  leadDetail: (id: string) => `/leads/${id}`,
  followUps: "/follow-ups",
  calendar: "/calendar",
  weekPlanner: "/week-planner",
  accounts: "/accounts",
  accountsDashboard: "/accounts/dashboard",
  tickets: "/tickets",
  reports: "/reports",
  buddy: "/buddy",
  knowledge: "/knowledge",
  email: "/email",
  emailSettings: "/email/settings",
  emailHealth: "/email/health",
  notifications: "/notifications",
  settings: "/settings",
  setupFields: "/setup/fields",
  setupPipelines: "/setup/pipelines",
  setupScoring: "/setup/scoring",
  setupAllocation: "/setup/allocation",
  setupFollowups: "/setup/followups",
  setupWorkflows: "/setup/workflows",
  setupIntegrations: "/setup/integrations",
  setupAudit: "/setup/audit",
  setupUsers: "/setup/users",
  setupRoles: "/setup/roles",
  setupProfiles: "/setup/profiles",
  setupGroups: "/setup/groups",
  setupSalesTargets: "/setup/sales-targets",
  setupHolidays: "/setup/holidays",
  setupSalesSettings: "/setup/sales-settings",
  setupKnowledgeImport: "/setup/knowledge-import",
  setupPropertyGuide: "/setup/property-guide",
} as const;

/** Legacy activeView id from pathname */
export function pathnameToView(pathname: string): { view: string; leadId?: string } {
  const p = pathname.replace(/\/$/, "") || "/";

  if (p === "/" || p === "/dashboard") return { view: "dashboard" };
  if (p === "/calls") return { view: "calls" };
  if (p.startsWith("/leads/")) {
    const id = p.slice("/leads/".length);
    if (id) return { view: "lead-detail", leadId: id };
  }
  if (p === "/leads") return { view: "leads" };
  if (p === "/follow-ups") return { view: "todays-followups" };
  if (p === "/calendar") return { view: "my-calendar" };
  if (p === "/week-planner") return { view: "week-planner" };
  if (p === "/accounts/dashboard") return { view: "accounts-dashboard" };
  if (p === "/accounts") return { view: "account-management" };
  if (p === "/tickets") return { view: "ticket-management" };
  if (p === "/reports") return { view: "reports" };
  if (p === "/buddy") return { view: "buddy-management" };
  if (p.startsWith("/knowledge")) return { view: "knowledge-properties" };
  if (p === "/email") return { view: "email-client" };
  if (p === "/email/settings") return { view: "email-settings" };
  if (p === "/email/health") return { view: "email-health" };
  if (p === "/notifications") return { view: "notifications" };
  if (p === "/settings") return { view: "settings" };
  if (p.startsWith("/setup/")) {
    const sub = p.replace("/setup/", "");
    return { view: `setup/${sub}` };
  }
  if (p === "/security/roles") return { view: "security/roles" };
  if (p === "/security/profiles") return { view: "security/profiles" };
  if (p === "/security/groups") return { view: "security/groups" };
  if (p === "/users") return { view: "user-management" };

  return { view: "dashboard" };
}

export function viewToPath(view: string, leadId?: string): string {
  switch (view) {
    case "dashboard":
      return CRM_PATHS.dashboard;
    case "calls":
      return CRM_PATHS.calls;
    case "admin-leads":
    case "leads":
      return CRM_PATHS.leads;
    case "lead-detail":
      return leadId ? CRM_PATHS.leadDetail(leadId) : CRM_PATHS.leads;
    case "todays-followups":
      return CRM_PATHS.followUps;
    case "my-calendar":
      return CRM_PATHS.calendar;
    case "week-planner":
      return CRM_PATHS.weekPlanner;
    case "account-management":
      return CRM_PATHS.accounts;
    case "accounts-dashboard":
      return CRM_PATHS.accountsDashboard;
    case "ticket-management":
    case "tickets":
      return CRM_PATHS.tickets;
    case "reports":
      return CRM_PATHS.reports;
    case "buddy-management":
      return CRM_PATHS.buddy;
    case "knowledge-properties":
    case "knowledge-factsheets":
    case "knowledge-templates":
    case "knowledge-resources":
    case "knowledge":
      return CRM_PATHS.knowledge;
    case "email-client":
      return CRM_PATHS.email;
    case "email-settings":
      return CRM_PATHS.emailSettings;
    case "email-health":
      return CRM_PATHS.emailHealth;
    case "notifications":
      return CRM_PATHS.notifications;
    case "settings":
      return CRM_PATHS.settings;
    case "user-management":
      return CRM_PATHS.setupUsers;
    case "security/roles":
      return CRM_PATHS.setupRoles;
    case "security/profiles":
      return CRM_PATHS.setupProfiles;
    case "security/groups":
      return CRM_PATHS.setupGroups;
    default:
      if (view.startsWith("setup/")) return `/setup/${view.replace("setup/", "")}`;
      return CRM_PATHS.dashboard;
  }
}
