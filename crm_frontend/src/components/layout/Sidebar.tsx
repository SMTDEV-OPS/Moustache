import { useState, useRef, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  LayoutGrid,
  Phone,
  Users,
  Ticket,
  BookOpen,
  Building2,
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
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { CRM_PATHS } from "@/navigation/crmPaths";

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  roles: string[];
  permissionCheck?: (perms: string[], isAdmin: boolean) => boolean;
}

interface SidebarProps {
  userName: string;
  userRole: string;
  roleDisplay: string;
  onLogout: () => void;
  unreadCount: number;
  isAdmin?: boolean;
  permissions?: string[];
  followupsBadgeCount?: number;
  hasOverdueFollowups?: boolean;
}

export function Sidebar({
  userName,
  userRole,
  roleDisplay,
  onLogout,
  unreadCount,
  isAdmin,
  permissions = [],
  followupsBadgeCount = 0,
  hasOverdueFollowups = false,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const isAdminLike = !!isAdmin || userRole === "admin";
  const isBackendSession = permissions.length > 0;
  const canAssignBuddy = !!isAdmin || permissions.includes("buddies.assign");
  const canViewBuddyHistory = !!isAdmin || permissions.includes("buddies.view.history");
  const canViewBuddyReports = !!isAdmin || permissions.includes("buddies.view.reports");
  const canAccessBuddy = canAssignBuddy || canViewBuddyHistory || canViewBuddyReports;

  const hasKnowledgeAccess =
    ["callcenter", "ccmanager", "saleshead", "salesexecutive", "management", "propertymanager1", "admin"].includes(
      userRole
    ) || isAdminLike;

  const filterItem = (item: NavItem) => {
    if (isAdminLike) return true;
    if (item.permissionCheck) return item.permissionCheck(permissions, !!isAdmin);
    if (isBackendSession) {
      if (item.path === CRM_PATHS.calls) return permissions.includes("callcenter.access");
      if (item.path === CRM_PATHS.leads) {
        return permissions.some(
          (p) =>
            p === "leads.manage" ||
            p === "leads.view.own" ||
            p === "leads.view.team" ||
            p === "leads.view.all"
        );
      }
      if (item.path === CRM_PATHS.accounts || item.path === CRM_PATHS.accountsDashboard) return true;
      if (item.path === CRM_PATHS.reports) return permissions.includes("reports.view");
      if (item.path === CRM_PATHS.buddy) return canAccessBuddy;
      if (item.path === CRM_PATHS.tickets) {
        return permissions.some(
          (p) =>
            p === "tickets.manage" ||
            p === "tickets.view.own" ||
            p === "tickets.view.team" ||
            p === "tickets.view.all"
        );
      }
      if (
        item.path === CRM_PATHS.dashboard ||
        item.path === CRM_PATHS.followUps
      ) {
        return true;
      }
      return false;
    }
    return item.roles.includes(userRole);
  };

  const navItems: NavItem[] = [
    { title: "Dashboard", path: CRM_PATHS.dashboard, icon: LayoutDashboard, roles: ["callcenter", "ccmanager", "saleshead", "salesexecutive", "management", "propertymanager1", "admin"] },
    { title: "Call Center", path: CRM_PATHS.calls, icon: Phone, roles: ["callcenter"] },
    { title: "Leads", path: CRM_PATHS.leads, icon: Users, roles: [] },
    { title: "Accounts", path: CRM_PATHS.accounts, icon: Building2, roles: [] },
    { title: "Accounts Dashboard", path: CRM_PATHS.accountsDashboard, icon: LayoutGrid, roles: [] },
    { title: "Follow Ups", path: CRM_PATHS.followUps, icon: Clock, roles: ["callcenter", "salesexecutive", "saleshead", "ccmanager", "management", "admin"] },
    { title: "Reports", path: CRM_PATHS.reports, icon: BarChart2, roles: ["management", "admin"] },
    { title: "Buddy", path: CRM_PATHS.buddy, icon: UserCheck, roles: [] },
    { title: "Tickets", path: CRM_PATHS.tickets, icon: Ticket, roles: [] },
  ].filter(filterItem);

  const emailItems = [
    { title: "Email Client", path: CRM_PATHS.email, icon: Mail },
    { title: "Email Settings", path: CRM_PATHS.emailSettings, icon: Settings2 },
    { title: "Email Health", path: CRM_PATHS.emailHealth, icon: Activity },
  ];

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

  const NavItemLink = ({ item }: { item: NavItem }) => {
    const Icon = item.icon;
    return (
      <NavLink
        to={item.path}
        end={item.path === CRM_PATHS.dashboard}
        className={({ isActive }) =>
          cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-3")
        }
        title={collapsed ? item.title : undefined}
      >
        <Icon className={cn("nav-icon h-4 w-4 shrink-0", collapsed && "mx-auto")} strokeWidth={1.5} />
        {!collapsed && (
          <>
            <span className="truncate">{item.title}</span>
            {item.path === CRM_PATHS.followUps && followupsBadgeCount > 0 && (
              <span
                className={cn(
                  "ml-auto text-xs px-1.5 py-0.5 rounded-sm font-medium tabular-nums",
                  hasOverdueFollowups ? "bg-red-600 text-white" : "bg-white/15 text-white"
                )}
              >
                {followupsBadgeCount}
              </span>
            )}
          </>
        )}
      </NavLink>
    );
  };

  const SectionLabel = ({ children }: { children: string }) =>
    collapsed ? null : (
      <div className="px-5 pt-4 pb-1.5 text-[10px] font-medium uppercase tracking-widest text-white/35">
        {children}
      </div>
    );

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-base",
        collapsed ? "w-16" : "w-[248px]"
      )}
    >
      <div className={cn("flex h-[72px] shrink-0 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "justify-between px-5")}>
        {!collapsed && (
          <img
            src="/lovable-uploads/postcard-logo.png"
            alt={import.meta.env.VITE_HOTEL_BRAND || "CRM"}
            className="h-10 w-auto"
          />
        )}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="rounded p-1.5 text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
            aria-label={isDark ? "Light mode" : "Dark mode"}
          >
            {isDark ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={() => navigate(CRM_PATHS.notifications)}
              className="relative rounded p-1.5 text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
              aria-label="Notifications"
            >
              <Bell size={18} strokeWidth={1.5} />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="rounded p-1.5 text-white/50 transition-colors hover:bg-sidebar-accent hover:text-white"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} strokeWidth={1.5} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-1">
        <SectionLabel>Navigation</SectionLabel>
        {navItems.map((item) => (
          <NavItemLink key={item.path} item={item} />
        ))}

        {(isAdminLike || permissions.includes("settings.manage")) && (
          <>
            <SectionLabel>Admin</SectionLabel>
            <NavLink
              to={CRM_PATHS.settings}
              className={({ isActive }) =>
                cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-3")
              }
            >
              <Settings className="nav-icon h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>Setup</span>}
            </NavLink>
          </>
        )}

        {hasKnowledgeAccess && (
          <>
            <SectionLabel>Resources</SectionLabel>
            <NavLink
              to={CRM_PATHS.knowledge}
              className={({ isActive }) =>
                cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-3")
              }
            >
              <BookOpen className="nav-icon h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>Knowledge</span>}
            </NavLink>
          </>
        )}

        <SectionLabel>Email</SectionLabel>
        {emailItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                cn("nav-item", isActive && "nav-item-active", collapsed && "justify-center px-3")
              }
              title={collapsed ? item.title : undefined}
            >
              <Icon className="nav-icon h-4 w-4 shrink-0" strokeWidth={1.5} />
              {!collapsed && <span>{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div ref={userMenuRef} className="relative shrink-0 border-t border-sidebar-border">
        <button
          type="button"
          onClick={() => setUserMenuOpen((o) => !o)}
          className={cn(
            "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sidebar-accent",
            collapsed && "justify-center"
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs font-semibold text-white">
            {initials || "?"}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white/90">{userName || "User"}</div>
                <div className="truncate text-[11px] text-white/40">{roleDisplay}</div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/35" />
            </>
          )}
        </button>

        {userMenuOpen && !collapsed && (
          <div
            className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-md border border-sidebar-border shadow-md"
            style={{ backgroundColor: "var(--sidebar-menu-elevated)" }}
          >
            <button
              type="button"
              onClick={() => {
                navigate(CRM_PATHS.emailSettings);
                setUserMenuOpen(false);
              }}
              className="flex h-9 w-full items-center gap-2 px-4 text-sm text-white/75 transition-colors hover:bg-white/8"
            >
              <User size={14} strokeWidth={1.5} />
              Profile
            </button>
            <button
              type="button"
              onClick={() => {
                navigate(CRM_PATHS.settings);
                setUserMenuOpen(false);
              }}
              className="flex h-9 w-full items-center gap-2 px-4 text-sm text-white/75 transition-colors hover:bg-white/8"
            >
              <Settings size={14} strokeWidth={1.5} />
              Settings
            </button>
            <button
              type="button"
              onClick={() => {
                onLogout();
                setUserMenuOpen(false);
              }}
              className="flex h-9 w-full items-center gap-2 px-4 text-sm text-red-300 transition-colors hover:bg-white/8"
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
