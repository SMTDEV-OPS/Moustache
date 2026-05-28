import {
  Shield,
  User,
  Users2,
  Share2,
  Settings,
  UserCog,
  Building2,
  Hotel,
  Blocks,
  GitBranch,
  Star,
  Zap,
  Shuffle,
  Clock,
  Workflow,
  MessageSquare,
  Mail,
  Plug,
  Code,
  FileText,
  Info,
  FileCheck,
  Calendar,
  BarChart3,
  BookOpen,
} from "lucide-react";
import { PageHeader } from "@/components/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { viewToPath } from "@/navigation/crmPaths";

interface SettingsItem {
  name: string;
  description: string;
  path: string;
  icon: any;
  setupGuide: string;
}

interface SettingsCategory {
  title: string;
  icon: any;
  items: SettingsItem[];
}

interface SettingsDashboardProps {
  onViewChange: (view: string) => void;
  isAdmin: boolean;
  permissions: string[];
  userRole: string;
}

export function SettingsDashboard({
  onViewChange,
  isAdmin,
  permissions,
  userRole,
}: SettingsDashboardProps) {
  const navigate = useNavigate();
  const isAdminLike = isAdmin || userRole === "admin";
  const canManageUsers = isAdminLike || permissions.includes("users.manage");
  const canManageAccounts = isAdminLike || permissions.includes("accounts.manage");
  const canManageProperties = isAdminLike || permissions.includes("properties.manage");
  const canManageLeads =
    isAdminLike || permissions.includes("leads.manage") || permissions.includes("leads.view.all");
  const canManageWorkflows = isAdminLike || permissions.includes("workflows.manage");
  const canManageTemplates = isAdminLike || permissions.includes("templates.manage");

  const categories: SettingsCategory[] = [
    {
      title: "Security Control",
      icon: Shield,
      items: [
        {
          name: "Roles",
          description: "Define your company hierarchy.",
          path: "setup/roles",
          icon: Shield,
          setupGuide: "Create roles (e.g. Sales, Support) to match your team structure. Assign users to roles to control access and reporting.",
        },
        {
          name: "Profiles",
          description: "Control what users can do.",
          path: "setup/profiles",
          icon: User,
          setupGuide: "Profiles define permissions: what screens and actions each role can access. Map profiles to roles after creating them.",
        },
        {
          name: "Groups",
          description: "Manage collaborative teams.",
          path: "setup/groups",
          icon: Users2,
          setupGuide: "Create groups for teams that work together. Add users to groups to enable shared visibility and collaboration.",
        },
        {
          name: "Data Sharing",
          description: "Control data visibility across roles.",
          path: "setup/data-sharing",
          icon: Share2,
          setupGuide: "Configure which records (leads, contacts) each role can see: only own, team, or all. Set sharing rules per object.",
        },
      ].filter(() => canManageUsers),
    },
    {
      title: "General Administration",
      icon: Settings,
      items: [
        {
          name: "Users",
          description: "Create and manage CRM users.",
          path: "setup/users",
          icon: UserCog,
          setupGuide: "Add users with email and assign a role. Each user gets login credentials and access based on their role's profile.",
        },
        {
          name: "Account Mgmt",
          description: "Manage B2B and agent accounts.",
          path: "setup/accounts",
          icon: Building2,
          setupGuide: "Create B2B and agent accounts for external partners. Link accounts to properties or pipelines as needed.",
        },
        {
          name: "Property Mgmt",
          description: "Manage hotel properties.",
          path: "/properties",
          icon: Hotel,
          setupGuide: "Add your hotel properties with details. Properties can be linked to leads, deals, and pipelines.",
        },
        {
          name: "Field Builder",
          description: "Define custom fields for leads and contacts.",
          path: "setup/fields",
          icon: Blocks,
          setupGuide: "Add custom fields (text, number, dropdown, etc.) for leads, contacts, and deals. Set field types and make some mandatory at pipeline stages.",
        },
        {
          name: "Pipeline Mgmt",
          description: "Configure sales pipelines and stages.",
          path: "setup/pipelines",
          icon: GitBranch,
          setupGuide: "Create stages (e.g. New, Contacted, Qualified) and order them. Mark which fields are required at each stage.",
        },
        {
          name: "Scoring Rules",
          description: "Automate lead quality scoring.",
          path: "setup/scoring",
          icon: Star,
          setupGuide: "Define score thresholds (e.g. Hot/Warm/Cold) and call quality dimensions. Leads are scored and bucketed automatically.",
        },
      ].filter((item) => {
        if (["setup/users", "setup/fields", "setup/pipelines", "setup/scoring"].includes(item.path))
          return isAdminLike;
        if (item.path === "setup/accounts") return canManageAccounts;
        if (item.path === "setup/properties") return canManageProperties;
        return true;
      }),
    },
    {
      title: "Automation",
      icon: Zap,
      items: [
        {
          name: "Assignment Rules",
          description: "Configure how leads are assigned to agents.",
          path: "setup/allocation",
          icon: Shuffle,
          setupGuide: "Choose assignment mode (round-robin or workload-based). Configure capacity and which leads are eligible for auto-assignment.",
        },
        {
          name: "Follow-up Rules",
          description: "Auto-schedule follow-ups by lead quality.",
          path: "setup/followup-rules",
          icon: Clock,
          setupGuide: "Create buckets (e.g. Hot, Warm) and set follow-up delays per bucket. Leads get tasks auto-scheduled based on their score.",
        },
        {
          name: "Workflow Builder",
          description: "Automate lead actions with event-driven workflows.",
          path: "setup/workflows",
          icon: Workflow,
          setupGuide: "Build workflows with triggers (e.g. lead created, stage changed), conditions, and actions. Test with dry run before activating.",
        },
        {
          name: "Contract Approval Rules",
          description: "Configure who approves contracts and in what order.",
          path: "setup/contract-approval-rules",
          icon: FileCheck,
          setupGuide: "Define contract approval routing with multi-step approvers by user, role, or submitter manager.",
        },
      ].filter(() => canManageLeads || canManageWorkflows || isAdminLike),
    },
    {
      title: "Accounts & Sales",
      icon: BarChart3,
      items: [
        {
          name: "Sales Targets",
          description: "Monthly org-wide targets for the accounts dashboard.",
          path: "setup/sales-targets",
          icon: BarChart3,
          setupGuide: "Enter booked-lead or revenue targets per month. Achievement is calculated automatically from CRM data.",
        },
        {
          name: "Holidays & Seasons",
          description: "Public holidays and peak seasons on the accounts calendar.",
          path: "setup/holidays",
          icon: Calendar,
          setupGuide: "Add date ranges for public holidays and seasons. They appear as highlights on the accounts dashboard calendar.",
        },
        {
          name: "FY & Sales Settings",
          description: "Financial year start and achievement metric.",
          path: "setup/sales-settings",
          icon: Settings,
          setupGuide: "Set when your financial year starts and whether targets measure booked leads or revenue.",
        },
      ].filter(() => canManageLeads || isAdminLike),
    },
    {
      title: "Knowledge Base",
      icon: BookOpen,
      items: [
        {
          name: "Edit property guide",
          description: "Section-by-section editor for hotel guides, gallery, and sharing.",
          path: "setup/property-guide",
          icon: BookOpen,
          setupGuide:
            "Edit contact, rates, amenities, photos, and policies per hotel. Enable a public share link for sales teams.",
        },
      ].filter(
        () =>
          isAdminLike ||
          permissions.includes("knowledge-base.manage") ||
          permissions.includes("knowledgebase.manage")
      ),
    },
    {
      title: "Channels & Communication",
      icon: MessageSquare,
      items: [
        {
          name: "Message Templates",
          description: "Reusable email, SMS, and WA templates.",
          path: "setup/templates",
          icon: MessageSquare,
          setupGuide: "Create templates with placeholders (e.g. {{lead.name}}) for personalization. Use in emails, SMS, and WhatsApp messages.",
        },
        {
          name: "Email Provider",
          description: "Configure SMTP/IMAP settings.",
          path: "setup/email-provider",
          icon: Mail,
          setupGuide: "Enter your SMTP host, port, and credentials to send emails from the CRM. Add IMAP for inbox sync if supported.",
        },
        {
          name: "Call Quality",
          description: "Configure call quality dimensions.",
          path: "setup/call-quality",
          icon: Star,
          setupGuide: "Define dimensions (e.g. Clarity, Empathy) and weights. Agents are scored on calls using these dimensions.",
        },
      ].filter((item) => {
        if (item.path === "setup/templates") return canManageTemplates;
        if (item.path === "setup/email-provider" || item.path === "setup/call-quality") return canManageLeads || isAdminLike;
        return true;
      }),
    },
    {
      title: "Integrations & Developer",
      icon: Plug,
      items: [
        {
          name: "Integration Hub",
          description: "Connect external services to your CRM.",
          path: "setup/integrations",
          icon: Plug,
          setupGuide: "Connect providers (e.g. calendar, CRM sync). OAuth or API keys may be required. Map fields for data sync.",
        },
        {
          name: "API & Webhooks",
          description: "Configure webhooks and external APIs.",
          path: "setup/webhooks",
          icon: Code,
          setupGuide: "Add webhook URLs to receive lead/contact events. Configure API keys and rate limits for external integrations.",
        },
        {
          name: "Audit Log",
          description: "Track all changes and actions in your CRM.",
          path: "setup/audit-log",
          icon: FileText,
          setupGuide: "View a log of who changed what and when. Filter by user, entity, or action. Use for compliance and debugging.",
        },
      ].filter(() => isAdminLike || canManageUsers),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <PageHeader
        title="Setup"
        subtitle="Manage your CRM settings, automations, and more."
      />
      <div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3"
        style={{ gap: 24 }}
      >
        {categories.map((cat) => {
          if (cat.items.length === 0) return null;
          const SectionIcon = cat.icon;
          return (
            <div
              key={cat.title}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <SectionIcon size={18} style={{ color: "var(--primary)" }} />
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: "var(--text)",
                  }}
                >
                  {cat.title}
                </span>
              </div>
              <div>
                {cat.items.map((item, idx) => {
                  const ItemIcon = item.icon;
                  const isLast = idx === cat.items.length - 1;
                  return (
                    <div
                      key={item.path}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        if (item.path.startsWith("/")) navigate(item.path);
                        else navigate(viewToPath(item.path));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          if (item.path.startsWith("/")) navigate(item.path);
                          else navigate(viewToPath(item.path));
                        }
                      }}
                      style={{
                        width: "100%",
                        minHeight: 44,
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        borderBottom: isLast ? "none" : "1px solid var(--border-light)",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        padding: "4px 0",
                      }}
                      className="hover:bg-[var(--hover)] group/row"
                    >
                      <ItemIcon size={14} className="shrink-0" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{item.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{item.description}</div>
                      </div>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button
                            type="button"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 p-1 rounded hover:bg-[var(--border-light)] opacity-70 group-hover/row:opacity-100 transition-opacity"
                            aria-label={`How to set up ${item.name}`}
                          >
                            <Info size={14} style={{ color: "var(--text-muted)" }} strokeWidth={1.5} />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          align="end"
                          className="max-w-sm"
                          style={{ border: "1px solid var(--border)" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>
                            How to set up {item.name}
                          </div>
                          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                            {item.setupGuide}
                          </p>
                        </PopoverContent>
                      </Popover>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
