import { useState, useRef, useEffect } from "react";
import {
  LayoutDashboard,
  Phone,
  Users,
  Ticket,
  BookOpen,
  Calendar,
  Settings2,
  Mail,
  Bell,
  UserCheck,
  Activity,
  BarChart2,
  Clock,
  ChevronDown,
  LogOut,
  User,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  roles: string[];
}

interface SidebarProps {
  activeView: string;
  onViewChange: (view: string) => void;
  userName: string;
  userRole: string;
  roleDisplay: string;
  onLogout: () => void;
  unreadCount: number;
  isAdmin?: boolean;
  permissions?: string[];
}

export function Sidebar({
  activeView,
  onViewChange,
  userName,
  userRole,
  roleDisplay,
  onLogout,
  unreadCount,
  isAdmin,
  permissions = [],
}: SidebarProps) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const isAdminLike = !!isAdmin || userRole === "admin";
  const isBackendSession = Array.isArray(permissions) && permissions.length > 0;
  const canAssignBuddy = !!isAdmin || permissions.includes("buddies.assign");
  const canViewBuddyHistory = !!isAdmin || permissions.includes("buddies.view.history");
  const canViewBuddyReports = !!isAdmin || permissions.includes("buddies.view.reports");
  const canAccessBuddy = canAssignBuddy || canViewBuddyHistory || canViewBuddyReports;

  const hasKnowledgeAccess = [
    "callcenter",
    "ccmanager",
    "saleshead",
    "salesexecutive",
    "management",
    "propertymanager1",
    "admin",
  ].includes(userRole);

  const getMenuItems = (): NavItem[] => {
    const items: NavItem[] = [
      { title: "Dashboard", url: "dashboard", icon: LayoutDashboard, roles: ["callcenter", "ccmanager", "saleshead", "salesexecutive", "management", "propertymanager1", "admin"] },
      { title: "Call Center", url: "calls", icon: Phone, roles: ["callcenter"] },
      { title: "Leads", url: "admin-leads", icon: Users, roles: [] },
      { title: "Follow Ups", url: "todays-followups", icon: Clock, roles: ["callcenter", "salesexecutive", "saleshead", "ccmanager", "management", "admin"] },
      { title: "My Calendar", url: "my-calendar", icon: Calendar, roles: ["callcenter", "salesexecutive", "saleshead", "ccmanager", "management", "admin"] },
      { title: "Reports", url: "reports", icon: BarChart2, roles: ["management", "admin"] },
      { title: "Buddy", url: "buddy-management", icon: UserCheck, roles: [] },
      { title: "Tickets", url: "ticket-management", icon: Ticket, roles: [] },
    ];

    return items.filter((item) => {
      if (isAdminLike) return true;
      if (isBackendSession) {
        if (item.url === "calls") return permissions.includes("callcenter.access");
        if (item.url === "admin-leads") {
          return permissions.some(
            (p) =>
              p === "leads.manage" ||
              p === "leads.view.own" ||
              p === "leads.view.team" ||
              p === "leads.view.all"
          );
        }
        if (item.url === "reports") return permissions.includes("reports.view");
        if (item.url === "buddy-management") return canAccessBuddy;
        if (item.url === "ticket-management") {
          return permissions.some(
            (p) =>
              p === "tickets.manage" ||
              p === "tickets.view.own" ||
              p === "tickets.view.team" ||
              p === "tickets.view.all"
          );
        }
        if (item.url === "leads") return false;
        if (item.url === "dashboard" || item.url === "todays-followups" || item.url === "my-calendar") return true;
        return false;
      }
      return item.roles.includes(userRole);
    });
  };

  const menuItems = getMenuItems();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    if (userMenuOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [userMenuOpen]);

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const isKnowledgeActive =
    activeView === "knowledge-properties" ||
    activeView === "knowledge-factsheets" ||
    activeView === "knowledge-templates" ||
    activeView === "knowledge-resources";

  const isSetupActive = activeView === "settings" || activeView.startsWith("setup/");

  return (
    <aside
      className="w-[240px] shrink-0 flex flex-col bg-surface border-r border-border"
      style={{ width: 240 }}
    >
      {/* Logo area */}
      <div
        className="flex items-center justify-between px-5 shrink-0"
        style={{ height: 56 }}
      >
        <img
          src="/lovable-uploads/moustache-logo.png"
          alt="Moustache CRM"
          className="h-6 w-auto"
        />
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="p-1.5 text-text-muted hover:bg-hover rounded transition-colors duration-150"
            title={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          <button
            type="button"
            onClick={() => onViewChange("notifications")}
            className="relative p-1.5 text-text-muted hover:bg-hover rounded transition-colors duration-150"
            aria-label="Notifications"
          >
            <Bell size={18} strokeWidth={1.5} />
            {unreadCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center w-[18px] h-[18px] rounded-full bg-primary text-white text-[10px] font-medium"
                style={{ fontSize: 10 }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Nav content */}
      <nav className="flex-1 overflow-y-auto">
        {/* Navigation */}
        <div>
          <div
            className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-faint px-5"
            style={{ paddingTop: 16, paddingBottom: 6 }}
          >
            NAVIGATION
          </div>
          {menuItems.map((item) => {
            const isActive = activeView === item.url;
            const Icon = item.icon;
            return (
              <button
                key={item.url}
                type="button"
                onClick={() => onViewChange(item.url)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-9 px-5 text-left text-sm transition-colors duration-150",
                  isActive
                    ? "bg-primary-light text-primary font-medium border-l-2 border-primary"
                    : "text-text-muted hover:bg-hover [&>svg]:text-text-muted"
                )}
                style={{ paddingLeft: 20, paddingRight: 12 }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={cn(isActive ? "text-primary" : "text-text-muted")}
                />
                <span className={cn(isActive && "text-primary font-medium")}>
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>

        {/* Setup - shown when admin-like or has settings access */}
        {(isAdminLike || permissions.includes("settings.manage")) && (
          <div>
            <div
              className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-faint px-5"
              style={{ paddingTop: 16, paddingBottom: 6 }}
            >
              SETTINGS
            </div>
            <button
              type="button"
              onClick={() => onViewChange("settings")}
              className={cn(
                "w-full flex items-center gap-2.5 h-9 px-5 text-left text-sm transition-colors duration-150",
                isSetupActive
                  ? "bg-primary-light text-primary font-medium border-l-2 border-primary"
                  : "text-text-muted hover:bg-hover"
              )}
              style={{ paddingLeft: 20, paddingRight: 12 }}
            >
              <Settings
                size={16}
                strokeWidth={1.5}
                className={cn(isSetupActive ? "text-primary" : "text-text-muted")}
              />
              <span className={cn(isSetupActive && "text-primary font-medium")}>
                Setup
              </span>
            </button>
          </div>
        )}

        {/* Resources */}
        {hasKnowledgeAccess && (
          <div>
            <div
              className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-faint px-5"
              style={{ paddingTop: 16, paddingBottom: 6 }}
            >
              RESOURCES
            </div>
            <button
              type="button"
              onClick={() => onViewChange("knowledge-properties")}
              className={cn(
                "w-full flex items-center gap-2.5 h-9 px-5 text-left text-sm transition-colors duration-150",
                isKnowledgeActive
                  ? "bg-primary-light text-primary font-medium border-l-2 border-primary"
                  : "text-text-muted hover:bg-hover"
              )}
              style={{ paddingLeft: 20, paddingRight: 12 }}
            >
              <BookOpen
                size={16}
                strokeWidth={1.5}
                className={cn(isKnowledgeActive ? "text-primary" : "text-text-muted")}
              />
              <span className={cn(isKnowledgeActive && "text-primary font-medium")}>
                Knowledge Base
              </span>
            </button>
          </div>
        )}

        {/* Email */}
        <div>
          <div
            className="text-[10px] font-medium uppercase tracking-[0.08em] text-text-faint px-5"
            style={{ paddingTop: 16, paddingBottom: 6 }}
          >
            EMAIL
          </div>
          {[
            { title: "Email Client", url: "email-client", icon: Mail },
            { title: "Email Settings", url: "email-settings", icon: Settings2 },
            { title: "Email Health", url: "email-health", icon: Activity },
          ].map((item) => {
            const isActive = activeView === item.url;
            const Icon = item.icon;
            return (
              <button
                key={item.url}
                type="button"
                onClick={() => onViewChange(item.url)}
                className={cn(
                  "w-full flex items-center gap-2.5 h-9 px-5 text-left text-sm transition-colors duration-150",
                  isActive
                    ? "bg-primary-light text-primary font-medium border-l-2 border-primary"
                    : "text-text-muted hover:bg-hover"
                )}
                style={{ paddingLeft: 20, paddingRight: 12 }}
              >
                <Icon
                  size={16}
                  strokeWidth={1.5}
                  className={cn(isActive ? "text-primary" : "text-text-muted")}
                />
                <span className={cn(isActive && "text-primary font-medium")}>
                  {item.title}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div
        ref={userMenuRef}
        className="shrink-0 border-t border-border relative"
        style={{ height: 56 }}
      >
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          className="w-full h-full flex items-center gap-3 px-4 text-left hover:bg-hover transition-colors duration-150"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-primary-light text-primary text-xs font-semibold"
            style={{ fontSize: 12 }}
          >
            {initials || "?"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-medium text-text truncate" style={{ fontSize: 13 }}>
              {userName || "User"}
            </div>
            <div className="text-[11px] text-text-muted truncate" style={{ fontSize: 11 }}>
              {roleDisplay}
            </div>
          </div>
          <ChevronDown size={14} className="shrink-0 text-text-muted" />
        </button>

        {userMenuOpen && (
          <div
            className="absolute bottom-full left-4 right-4 mb-1 bg-surface border border-border rounded-md shadow"
            style={{
              boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <button
              type="button"
              onClick={() => {
                onViewChange("email-settings");
                setUserMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 h-9 px-4 text-sm text-text hover:bg-hover transition-colors duration-150"
            >
              <User size={14} strokeWidth={1.5} />
              Profile
            </button>
            <button
              type="button"
              onClick={() => {
                onViewChange("settings");
                setUserMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 h-9 px-4 text-sm text-text hover:bg-hover transition-colors duration-150"
            >
              <Settings size={14} strokeWidth={1.5} />
              Setup / Settings
            </button>
            <button
              type="button"
              onClick={() => {
                onLogout();
                setUserMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 h-9 px-4 text-sm text-destructive hover:bg-hover transition-colors duration-150"
            >
              <LogOut size={14} strokeWidth={1.5} />
              Log out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
