import {
  LayoutDashboard,
  Phone,
  Users,
  Ticket,
  TrendingUp,
  BookOpen,
  Calendar,
  MessageSquare,
  Building2,
  FileText,
  Download,
  Globe,
  Settings2,
  UserPlus,
  ListTodo,
  GitBranch,
  Workflow,
  Mail,
  CalendarClock,
  CalendarDays,
  Bell,
  UserCheck,
  Activity,
  Plug,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { getUnreadCount } from "@/services/notifications";
import { ModuleInfoButton } from "./ModuleInfoButton";
import { Search, LogOut, Settings, User, ChevronUp, BellRing } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarHeader, SidebarFooter, SidebarInput, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

import { cn } from "@/lib/utils";

interface AppSidebarProps {
  userRole: string;
  isAdmin?: boolean;
  permissions?: string[];
  activeView: string;
  onViewChange: (view: string) => void;
  incomingCall: boolean;
  userName: string;
  onLogout: () => void;
  simulateIncomingCall?: () => void;
}

export function AppSidebar({
  userRole,
  isAdmin,
  permissions,
  activeView,
  onViewChange,
  incomingCall,
  userName,
  onLogout,
  simulateIncomingCall,
}: AppSidebarProps) {
  const { state } = useSidebar();
  const { theme, setTheme } = useTheme();
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const isDark = theme === "dark";
  const hasUsersManagePermission = permissions?.includes("users.manage");
  const canManageAccounts = !!isAdmin || permissions?.includes("accounts.manage");
  const isAdminLike = !!isAdmin || userRole === "admin";
  const isBackendSession = Array.isArray(permissions) && permissions.length > 0;
  const canAssignBuddy = !!isAdmin || permissions?.includes("buddies.assign");
  const canViewBuddyHistory = !!isAdmin || permissions?.includes("buddies.view.history");
  const canViewBuddyReports = !!isAdmin || permissions?.includes("buddies.view.reports");
  const canAccessBuddy = canAssignBuddy || canViewBuddyHistory || canViewBuddyReports;

  // Module descriptions for info buttons
  const moduleDescriptions: Record<string, string> = {
    "dashboard": "View your lead overview, statistics, and recent activity. Track total leads, hot leads, confirmed bookings, and pending actions. Filter by your leads, team leads, or all leads.",
    "calls": "Handle incoming calls from potential guests. View caller information, create leads, and manage call center operations. Access real-time call handling tools.",
    "admin-leads": "Manage all leads in the CRM system. View, create, edit, and assign leads. Track lead status, heat levels, and follow-up activities. Filter and search leads by various criteria.",
    "todays-followups": "View and manage all follow-up tasks scheduled for today. See leads that require immediate attention and track follow-up completion status.",
    "my-calendar": "View your personal calendar with scheduled follow-ups, meetings, and tasks. Manage your daily schedule and upcoming activities.",
    "reports": "Access comprehensive reports and analytics. View conversion rates, response times, lead sources, team performance, and other business metrics.",
    "buddy-management": "Manage buddy assignments for lead coverage. Assign backup team members, view buddy history, and generate buddy reports for team collaboration.",
    "ticket-management": "Create and manage support tickets. Track customer issues, assign tickets to team members, and monitor ticket resolution status.",
    "knowledge-properties": "Access property information, fact sheets, templates, and resources. Browse the knowledge base for quick reference during customer interactions.",
    "admin-console": "Admin API console for testing and debugging API endpoints. Access backend functionality and system administration tools.",
    "role-definition": "Define and manage user roles and permissions. Create custom roles, assign permissions, and configure access levels for different user types.",
    "user-role-management": "Manage users and their role assignments. Create users, assign roles, update user information, and control user access to the system.",
    "employee-groups": "Organize employees into groups for better team management. Create groups, assign members, and manage group-based permissions and workflows.",
    "account-management": "Manage travel agent and corporate accounts. Create accounts, add contacts, track account relationships, and manage account-specific settings.",
    "property-management": "Manage hotel properties in the system. Add properties, configure settings, set availability, and manage property-specific information.",
    "assignment-rules": "Configure automatic lead assignment rules. Set up rules based on lead source, property, region, or other criteria to automatically assign leads to team members.",
    "workflow-management": "Create and manage automated follow-up workflows. Define multi-step workflows that automatically send communications and reminders based on lead status and timing.",
    "message-templates": "Create and manage reusable message templates for emails, SMS, and WhatsApp. Standardize communications and speed up response times.",
    "email-provider-settings": "Configure email provider settings and integrations. Set up SMTP, IMAP, and other email service configurations for sending and receiving emails.",
    "email-client": "Access your integrated email client. Send and receive emails directly from the CRM, view email history, and manage email communications with leads.",
    "email-settings": "Configure personal email settings, signatures, and preferences. Customize your email experience within the CRM system.",
    "email-health": "Monitor email health metrics and delivery status. Track email open rates, bounce rates, and overall email system performance.",
    "notifications": "View system notifications and alerts. Stay updated on important events, follow-up reminders, and system messages.",
    "integration-settings": "Configure Webhooks and External APIs for capturing leads into the CRM.",
    "profile-definition": "Define feature access profiles. These profiles dictate what actions users can perform across different modules.",
  };

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadNotificationCount(count);
      } catch (error) {
        console.error("Failed to load unread notification count:", error);
      }
    };

    void loadUnreadCount();
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      void loadUnreadCount();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const getMenuItems = () => {
    const baseItems = [
      {
        title: "Dashboard",
        url: "dashboard",
        icon: LayoutDashboard,
        roles: ['callcenter', 'ccmanager', 'saleshead', 'salesexecutive', 'management', 'propertymanager1', 'admin']
      }
    ];

    const roleSpecificItems = [
      /*{
        title: "Call Center",
        url: "calls",
        icon: Phone,
        roles: ['callcenter']
      },*/
      {
        title: "Leads",
        url: "admin-leads",
        icon: Users,
        roles: [] // Permission-based for backend sessions
      },
      {
        title: "Follow Ups",
        url: "todays-followups",
        icon: CalendarClock,
        roles: ['callcenter', 'salesexecutive', 'saleshead', 'ccmanager', 'management', 'admin']
      },
      {
        title: "My Calendar",
        url: "my-calendar",
        icon: CalendarDays,
        roles: ['callcenter', 'salesexecutive', 'saleshead', 'ccmanager', 'management', 'admin']
      },
      /*{
        title: "Reports",
        url: "reports",
        icon: TrendingUp,
        roles: ['management', 'admin']
        // For backend sessions, this will be additionally gated by `reports.view` in the main app.
      },*/
      {
        title: "Buddy",
        url: "buddy-management",
        icon: UserCheck,
        roles: [] // Permission-based for backend sessions
      },
      {
        title: "Tickets",
        url: "ticket-management",
        icon: Ticket,
        roles: [] // Permission-based for backend sessions
      },
    ];

    return [...baseItems, ...roleSpecificItems].filter((item) => {
      // Admins always see all navigation items
      if (isAdminLike) {
        return true;
      }

      // Backend CRM users: show items based on permissions
      if (isBackendSession) {
        // Call Center – requires callcenter.access permission
        if (item.url === "calls") {
          return permissions?.includes("callcenter.access");
        }

        // Lead CRM module – show whenever user has any lead view/control permission.
        if (item.url === "admin-leads") {
          return permissions?.some((p) =>
            p === "leads.manage" ||
            p === "leads.view.own" ||
            p === "leads.view.team" ||
            p === "leads.view.all"
          );
        }

        // Reports – requires explicit reporting permission
        if (item.url === "reports") {
          return permissions?.includes("reports.view");
        }

        // Buddy – requires any buddy permission
        if (item.url === "buddy-management") {
          return canAccessBuddy;
        }

        // Tickets – requires any ticket view/control permission
        if (item.url === "ticket-management") {
          return permissions?.some((p) =>
            p === "tickets.manage" ||
            p === "tickets.view.own" ||
            p === "tickets.view.team" ||
            p === "tickets.view.all"
          );
        }

        // In backend session we do not use demo \"leads\" route – hide it.
        if (item.url === "leads") {
          return false;
        }

        // Always allow dashboard for backend sessions
        if (item.url === "dashboard") {
          return true;
        }

        // Always show follow-up pages for backend sessions
        if (item.url === "todays-followups" || item.url === "my-calendar") {
          return true;
        }

        // Always show dashboard for backend sessions
        if (item.url === "dashboard") {
          return true;
        }

        // Hide other demo-only items for backend sessions
        return false;
      }

      // Demo mode: use role-based visibility
      return item.roles.includes(userRole);
    });
  };

  const menuItems = getMenuItems();
  const hasKnowledgeAccess = [
    "callcenter",
    "ccmanager",
    "saleshead",
    "salesexecutive",
    "management",
    "propertymanager1",
    "admin",
  ].includes(userRole);


  return (
    <Sidebar collapsible="icon" className="border-r bg-sidebar">
      {/* Sidebar Header: Logo & Search */}
      <SidebarHeader className="bg-sidebar border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3 px-1">
          <div className="flex items-center justify-center h-24 w-24 rounded-md bg-primary/10">
            <img
              src="/lovable-uploads/postcard-logo.png"
              alt="Logo"
              className="h-20 w-auto"
            />
          </div>
          {state === "expanded" && (
            <div className="flex flex-col">
              <span className="font-bold text-base tracking-tight">{import.meta.env.VITE_HOTEL_BRAND || "Moustache CRM"}</span>
              <span className="text-[10px] text-muted-foreground">AGENCY DEMO</span>
            </div>
          )}
        </div>

        {state === "expanded" && (
          <div className="mt-4 px-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <SidebarInput
                placeholder="Search..."
                className="pl-8 h-9 bg-sidebar-accent/30 border-sidebar-border/50 focus:bg-sidebar-accent focus:border-primary/50 transition-colors"
              />
            </div>
          </div>
        )}
      </SidebarHeader>
      <SidebarContent className="p-3">
        {/* Notifications Section */}
        <SidebarGroup className="mb-4 pb-4 border-b border-sidebar-border">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewChange("notifications")}
                  isActive={activeView === "notifications"}
                  className={`
                    group w-full justify-between px-3 py-2.5 rounded-md transition-all duration-200
                    ${activeView === "notifications"
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }
                  `}
                >
                  <div className="flex items-center flex-1">
                    <Bell className={`mr-3 h-4 w-4 ${activeView === "notifications" ? 'text-primary' : ''}`} />
                    <span className="text-sm flex-1">Notifications</span>
                    <ModuleInfoButton description={moduleDescriptions["notifications"] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </div>
                  {unreadNotificationCount > 0 && (
                    <Badge className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0 h-5 min-w-[20px] flex items-center justify-center">
                      {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                    </Badge>
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation Section */}
        <SidebarGroup className="mb-4 pb-4 border-b border-sidebar-border">
          <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item, index) => (
                <SidebarMenuItem key={`${item.url}-${index}`}>
                  <SidebarMenuButton
                    onClick={() => onViewChange(item.url)}
                    isActive={activeView === item.url}
                    className={`
                      group w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                      ${activeView === item.url
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }
                    `}
                  >
                    <item.icon className={`mr-3 h-4 w-4 ${activeView === item.url ? 'text-primary' : ''}`} />
                    <span className="flex-1 text-sm">{item.title}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <ModuleInfoButton description={moduleDescriptions[item.url] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                      {item.url === "calls" && incomingCall && (
                        <Badge className="bg-red-500 h-2 w-2 p-0 animate-pulse border-0" />
                      )}
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Knowledge Base Section */}
        {hasKnowledgeAccess && (
          <SidebarGroup className="mb-4 pb-4 border-b border-sidebar-border">
            <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
              Resources
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => onViewChange("knowledge-properties")}
                    isActive={
                      activeView === "knowledge-properties" ||
                      activeView === "knowledge-factsheets" ||
                      activeView === "knowledge-templates" ||
                      activeView === "knowledge-resources"
                    }
                    className={`
                        group w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                        ${(activeView === "knowledge-properties" ||
                        activeView === "knowledge-factsheets" ||
                        activeView === "knowledge-templates" ||
                        activeView === "knowledge-resources")
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }
                      `}
                  >
                    <BookOpen className={`mr-3 h-4 w-4 ${(activeView === "knowledge-properties" ||
                      activeView === "knowledge-factsheets" ||
                      activeView === "knowledge-templates" ||
                      activeView === "knowledge-resources") ? 'text-primary' : ''}`} />
                    <span className="text-sm flex-1">Knowledge Base</span>
                    <ModuleInfoButton description={moduleDescriptions["knowledge-properties"] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}


        {/* Email - Available to all users */}
        <SidebarGroup className="mb-0">
          <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
            Email
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewChange("email-client")}
                  isActive={activeView === "email-client"}
                  className={`
                      w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                      ${activeView === "email-client"
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }
                    `}
                >
                  <Mail className={`mr-3 h-4 w-4 ${activeView === "email-client" ? 'text-primary' : ''}`} />
                  <span className="text-sm flex-1">Email Client</span>
                  <ModuleInfoButton description={moduleDescriptions["email-client"] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewChange("email-settings")}
                  isActive={activeView === "email-settings"}
                  className={`
                      w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                      ${activeView === "email-settings"
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }
                    `}
                >
                  <Settings2 className={`mr-3 h-4 w-4 ${activeView === "email-settings" ? 'text-primary' : ''}`} />
                  <span className="text-sm flex-1">Email Settings</span>
                  <ModuleInfoButton description={moduleDescriptions["email-settings"] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => onViewChange("email-health")}
                  isActive={activeView === "email-health"}
                  className={`
                      w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                      ${activeView === "email-health"
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary'
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }
                    `}
                >
                  <Activity className={`mr-3 h-4 w-4 ${activeView === "email-health" ? 'text-primary' : ''}`} />
                  <span className="text-sm flex-1">Email Health</span>
                  <ModuleInfoButton description={moduleDescriptions["email-health"] || "Module information"} className="opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-4 bg-sidebar">
        {state === "expanded" ? (
          <div className="flex flex-col gap-4">
            {/* Quick Actions */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground"
                  onClick={() => setTheme(isDark ? "light" : "dark")}
                  title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                  aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
                >
                  {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </Button>
                {userRole === 'callcenter' && simulateIncomingCall && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 hover:bg-sidebar-accent text-green-600 hover:text-green-700"
                    onClick={simulateIncomingCall}
                    title="Simulate Call"
                  >
                    <Phone className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="w-full justify-start px-2 hover:bg-sidebar-accent h-auto py-2">
                  <div className="flex items-center gap-3 text-left">
                    <Avatar className="h-8 w-8 border border-sidebar-border">
                      <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                        {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="text-sm font-medium truncate text-sidebar-foreground">{userName}</span>
                      <span className="text-xs text-muted-foreground truncate capitalize">
                        {userRole === 'callcenter' ? 'Call Center' : userRole}
                      </span>
                    </div>
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56" side="right">
                <DropdownMenuLabel>My Account</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onViewChange("email-settings")}>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewChange("settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Setup / Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-sidebar-accent text-sidebar-foreground"
              onClick={() => setTheme(isDark ? "light" : "dark")}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8 border border-sidebar-border">
                    <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs font-medium">
                      {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="right" className="w-48">
                <DropdownMenuLabel className="truncate">{userName}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onViewChange("email-settings")}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onViewChange("settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Setup / Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}