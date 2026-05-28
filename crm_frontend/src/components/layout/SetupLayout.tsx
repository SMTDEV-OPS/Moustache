import { ReactNode } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  Sliders,
  GitBranch,
  Target,
  Users,
  Workflow,
  Plug,
  FileText,
  Calendar,
  BarChart3,
  BookOpen,
} from "lucide-react";

const SETUP_LINKS = [
  { to: "/setup/fields", label: "Fields", icon: Sliders },
  { to: "/setup/pipelines", label: "Pipelines", icon: GitBranch },
  { to: "/setup/scoring", label: "Scoring", icon: Target },
  { to: "/setup/allocation", label: "Allocation", icon: Users },
  { to: "/setup/followups", label: "Follow-ups", icon: Workflow },
  { to: "/setup/workflows", label: "Workflows", icon: Workflow },
  { to: "/setup/integrations", label: "Integrations", icon: Plug },
  { to: "/setup/audit", label: "Audit log", icon: FileText },
  { to: "/setup/sales-targets", label: "Sales targets", icon: BarChart3 },
  { to: "/setup/holidays", label: "Holidays", icon: Calendar },
  { to: "/setup/sales-settings", label: "FY & sales", icon: Target },
  { to: "/setup/property-guide", label: "Property guide editor", icon: BookOpen },
];

interface SetupLayoutProps {
  title?: string;
  subtitle?: string;
  children: ReactNode;
}

export function SetupLayout({
  title = "Setup",
  subtitle = "Configure CRM engines and integrations",
  children,
}: SetupLayoutProps) {
  const location = useLocation();
  const isSetupRoute = location.pathname.startsWith("/setup");

  if (!isSetupRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex gap-8 animate-panel-enter">
      <aside className="w-52 shrink-0">
        <nav className="space-y-0.5 rounded-md border border-border bg-surface p-2">
          {SETUP_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-fast",
                  isActive
                    ? "bg-primary-light font-medium text-primary"
                    : "text-text-muted hover:bg-hover hover:text-text"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <PageHeader title={title} subtitle={subtitle} />
        {children}
      </div>
    </div>
  );
}
