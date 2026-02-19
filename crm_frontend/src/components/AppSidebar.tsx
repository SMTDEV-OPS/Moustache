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
} from "lucide-react";

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

interface AppSidebarProps {
  userRole: string;
  isAdmin?: boolean;
  permissions?: string[];
  activeView: string;
  onViewChange: (view: string) => void;
  incomingCall: boolean;
}

export function AppSidebar({
  userRole,
  isAdmin,
  permissions,
  activeView,
  onViewChange,
  incomingCall,
}: AppSidebarProps) {
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
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
      {
        title: "Call Center",
        url: "calls",
        icon: Phone,
        roles: ['callcenter']
      },
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
      {
        title: "Reports",
        url: "reports",
        icon: TrendingUp,
        roles: ['management', 'admin']
        // For backend sessions, this will be additionally gated by `reports.view` in the main app.
      },
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
    <Sidebar className="border-r bg-sidebar">
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
                    w-full justify-between px-3 py-2.5 rounded-md transition-all duration-200
                    ${activeView === "notifications" 
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                      : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                    }
                  `}
                >
                  <div className="flex items-center flex-1">
                    <Bell className={`mr-3 h-4 w-4 ${activeView === "notifications" ? 'text-primary' : ''}`} />
                    <span className="text-sm flex-1">Notifications</span>
                    <ModuleInfoButton description={moduleDescriptions["notifications"] || "Module information"} />
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
                      w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                      ${activeView === item.url 
                        ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                        : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                      }
                    `}
                  >
                    <item.icon className={`mr-3 h-4 w-4 ${activeView === item.url ? 'text-primary' : ''}`} />
                    <span className="flex-1 text-sm">{item.title}</span>
                    <div className="flex items-center gap-1 ml-2">
                      <ModuleInfoButton description={moduleDescriptions[item.url] || "Module information"} />
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
                        w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
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
                      <ModuleInfoButton description={moduleDescriptions["knowledge-properties"] || "Module information"} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}
          {(isAdminLike || canManageAccounts) && (
            <SidebarGroup className="mb-4 pb-4 border-b border-sidebar-border">
              <SidebarGroupLabel className="px-3 py-2 text-xs font-semibold text-sidebar-foreground/70 uppercase tracking-wider">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {isAdminLike && (
                    <>
                      {/* Admin API Console hidden per user request */}
                      {/* <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => onViewChange("admin-console")}
                          isActive={activeView === "admin-console"}
                          className={`
                            w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                            ${activeView === "admin-console" 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }
                          `}
                        >
                          <LayoutDashboard className={`mr-3 h-4 w-4 ${activeView === "admin-console" ? 'text-primary' : ''}`} />
                          <span className="text-sm flex-1">Admin API Console</span>
                          <ModuleInfoButton description={moduleDescriptions["admin-console"] || "Module information"} />
                        </SidebarMenuButton>
                      </SidebarMenuItem> */}
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => onViewChange("role-definition")}
                          isActive={activeView === "role-definition"}
                          className={`
                            w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                            ${activeView === "role-definition" 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }
                          `}
                        >
                          <Settings2 className={`mr-3 h-4 w-4 ${activeView === "role-definition" ? 'text-primary' : ''}`} />
                          <span className="text-sm flex-1">Role Definition</span>
                          <ModuleInfoButton description={moduleDescriptions["role-definition"] || "Module information"} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => onViewChange("user-role-management")}
                          isActive={activeView === "user-role-management"}
                          className={`
                            w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                            ${activeView === "user-role-management" 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }
                          `}
                        >
                          <UserPlus className={`mr-3 h-4 w-4 ${activeView === "user-role-management" ? 'text-primary' : ''}`} />
                          <span className="text-sm flex-1">User Role Management</span>
                          <ModuleInfoButton description={moduleDescriptions["user-role-management"] || "Module information"} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem>
                        <SidebarMenuButton
                          onClick={() => onViewChange("employee-groups")}
                          isActive={activeView === "employee-groups"}
                          className={`
                            w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                            ${activeView === "employee-groups" 
                              ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                              : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                            }
                          `}
                        >
                          <Users className={`mr-3 h-4 w-4 ${activeView === "employee-groups" ? 'text-primary' : ''}`} />
                          <span className="text-sm flex-1">Employee Groups</span>
                          <ModuleInfoButton description={moduleDescriptions["employee-groups"] || "Module information"} />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    </>
                  )}
                  {canManageAccounts && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => onViewChange("account-management")}
                        isActive={activeView === "account-management"}
                        className={`
                          w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                          ${activeView === "account-management" 
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                          }
                        `}
                      >
                        <Building2 className={`mr-3 h-4 w-4 ${activeView === "account-management" ? 'text-primary' : ''}`} />
                        <span className="text-sm flex-1">Account Management</span>
                        <ModuleInfoButton description={moduleDescriptions["account-management"] || "Module information"} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  {(isAdminLike || permissions?.includes("properties.manage")) && (
                    <SidebarMenuItem>
                      <SidebarMenuButton
                        onClick={() => onViewChange("property-management")}
                        isActive={activeView === "property-management"}
                        className={`
                          w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                          ${activeView === "property-management" 
                            ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                            : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                          }
                        `}
                      >
                        <Building2 className={`mr-3 h-4 w-4 ${activeView === "property-management" ? 'text-primary' : ''}`} />
                        <span className="text-sm flex-1">Property Management</span>
                        <ModuleInfoButton description={moduleDescriptions["property-management"] || "Module information"} />
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => onViewChange("assignment-rules")}
                      isActive={activeView === "assignment-rules"}
                      className={`
                        w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                        ${activeView === "assignment-rules" 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }
                      `}
                    >
                      <GitBranch className={`mr-3 h-4 w-4 ${activeView === "assignment-rules" ? 'text-primary' : ''}`} />
                      <span className="text-sm flex-1">Lead Assignment Rules</span>
                      <ModuleInfoButton description={moduleDescriptions["assignment-rules"] || "Module information"} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => onViewChange("workflow-management")}
                      isActive={activeView === "workflow-management"}
                      className={`
                        w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                        ${activeView === "workflow-management" 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }
                      `}
                    >
                      <Workflow className={`mr-3 h-4 w-4 ${activeView === "workflow-management" ? 'text-primary' : ''}`} />
                      <span className="text-sm flex-1">Follow-up Workflows</span>
                      <ModuleInfoButton description={moduleDescriptions["workflow-management"] || "Module information"} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => onViewChange("message-templates")}
                      isActive={activeView === "message-templates"}
                      className={`
                        w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                        ${activeView === "message-templates" 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }
                      `}
                    >
                      <Mail className={`mr-3 h-4 w-4 ${activeView === "message-templates" ? 'text-primary' : ''}`} />
                      <span className="text-sm flex-1">Message Templates</span>
                      <ModuleInfoButton description={moduleDescriptions["message-templates"] || "Module information"} />
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => onViewChange("email-provider-settings")}
                      isActive={activeView === "email-provider-settings"}
                      className={`
                        w-full justify-start px-3 py-2.5 rounded-md transition-all duration-200
                        ${activeView === "email-provider-settings" 
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm border-l-4 border-primary' 
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                        }
                      `}
                    >
                      <Mail className={`mr-3 h-4 w-4 ${activeView === "email-provider-settings" ? 'text-primary' : ''}`} />
                      <span className="text-sm flex-1">Email Provider Settings</span>
                      <ModuleInfoButton description={moduleDescriptions["email-provider-settings"] || "Module information"} />
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
                    <ModuleInfoButton description={moduleDescriptions["email-client"] || "Module information"} />
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
                    <ModuleInfoButton description={moduleDescriptions["email-settings"] || "Module information"} />
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
                    <ModuleInfoButton description={moduleDescriptions["email-health"] || "Module information"} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}