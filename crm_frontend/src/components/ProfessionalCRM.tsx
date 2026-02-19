import { useState, useEffect } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AgentDashboard } from "@/components/AgentDashboard";
import { EnhancedCallInterface } from "@/components/EnhancedCallInterface";
import ProfessionalLeadManagement from "@/components/ProfessionalLeadManagement";
import { ProfessionalTicketManagement } from "@/components/ProfessionalTicketManagement";
import KnowledgeBase from "@/components/KnowledgeBase";
import { KnowledgeBaseMain } from "@/components/knowledge/KnowledgeBaseMain";
import CCManagerDashboard from "@/components/CCManagerDashboard";
import ManagementDashboard from "@/components/ManagementDashboard";
import SalesExecutiveDashboard from "@/components/SalesExecutiveDashboard";
import SalesHeadDashboard from "@/components/SalesHeadDashboard";
import PropertyManagerDashboard from "@/components/PropertyManagerDashboard";
import Dashboard from "@/components/Dashboard";
import Reports from "@/components/Reports";
import { RoleBuilder as RoleDefinition } from "@/pages/admin/RoleBuilder";
import { UserManagement as UserRoleManagement } from "@/pages/admin/UserManagement";
import { EmployeeGroupsManagement } from "@/components/EmployeeGroupsManagement";
import { AccountManagement } from "@/components/AccountManagement";
import { PropertyManagement } from "@/components/PropertyManagement";
import { AdminApiConsole } from "@/components/AdminApiConsole";
import { AdminLeads } from "@/components/AdminLeads";
import { LeadAssignmentRules } from "@/components/LeadAssignmentRules";
import { WorkflowManagement } from "@/components/WorkflowManagement";
import { MessageTemplates } from "@/components/MessageTemplates";
import { EmailSettings } from "@/components/EmailSettings";
import { EmailHealthDashboard } from "@/components/EmailHealthDashboard";
import { EmailClient } from "@/components/EmailClient";
import { EmailProviderSettings } from "@/components/EmailProviderSettings";
import { TodaysFollowUps } from "@/components/TodaysFollowUps";
import { PersonalCalendar } from "@/components/PersonalCalendar";
import { FollowUpReminder } from "@/components/FollowUpReminder";
import { LeadDetailPage } from "@/components/LeadDetailPage";
import NotificationsPage from "@/components/NotificationsPage";
import { BuddyManagement } from "@/components/BuddyManagement";
import { TicketManagement } from "@/components/TicketManagement";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  LogOut,
  Phone,
  Search,
  User,
  Settings,
  ChevronDown,
  Menu
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProfessionalCRMProps {
  userRole: string;
  userName: string;
  onLogout: () => void;
  isAdmin?: boolean;
  permissions?: string[];
  backendUserId?: string;
}

export const ProfessionalCRM = ({
  userRole,
  userName,
  onLogout,
  isAdmin,
  permissions,
  backendUserId,
}: ProfessionalCRMProps) => {
  const [activeView, setActiveView] = useState(userRole === 'callcenter' ? 'dashboard' : 'dashboard');
  const [incomingCall, setIncomingCall] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [previousView, setPreviousView] = useState<string>('dashboard');
  const [pendingLeadView, setPendingLeadView] = useState<string | null>(null);

  // Debug: Log navigation state changes
  useEffect(() => {
    console.log("ProfessionalCRM - activeView changed to:", activeView);
    console.log("ProfessionalCRM - selectedLeadId:", selectedLeadId);
  }, [activeView, selectedLeadId]);

  // Handle pending lead view navigation after state is set
  useEffect(() => {
    if (pendingLeadView === "lead-detail" && selectedLeadId) {
      console.log("ProfessionalCRM - Navigating to lead-detail with leadId:", selectedLeadId);
      setActiveView("lead-detail");
      setPendingLeadView(null);
    }
  }, [pendingLeadView, selectedLeadId]);

  const mockGuest = {
    id: "G001",
    name: "Priya Sharma",
    phone: "+91 98765 43210",
    email: "priya.sharma@email.com",
    loyaltyStatus: "Gold",
    totalStays: 8,
    lastStay: "2024-05-15",
    preferences: ["Ocean view", "Late checkout", "Quiet room"],
    property: "Postcard Goa",
    interactionHistory: [
      { date: "2024-06-10", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Inquiry about booking for July" },
      { date: "2024-06-08", type: "Email", channel: "Email", agent: "Harleen Mehta", summary: "Follow-up on spa services" },
      { date: "2024-05-20", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Post-stay feedback call" },
    ]
  };

  const simulateIncomingCall = () => {
    setIncomingCall(true);
    setActiveView("calls");
  };

  const canManageUsers = !!isAdmin || permissions?.includes("users.manage");
  const canManageAccounts = !!isAdmin || permissions?.includes("accounts.manage");
  const canViewReports = !!isAdmin || permissions?.includes("reports.view");
  const canManageLeads =
    !!isAdmin ||
    permissions?.includes("leads.manage") ||
    permissions?.includes("leads.view.all");
  const canManageWorkflows = !!isAdmin || permissions?.includes("workflows.manage");
  const canManageTemplates = !!isAdmin || permissions?.includes("templates.manage");
  const canAssignBuddy = !!isAdmin || permissions?.includes("buddies.assign");
  const canViewBuddyHistory = !!isAdmin || permissions?.includes("buddies.view.history");
  const canViewBuddyReports = !!isAdmin || permissions?.includes("buddies.view.reports");
  const canAccessBuddy = canAssignBuddy || canViewBuddyHistory || canViewBuddyReports;

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        // Use the new unified Dashboard component for all users
        return (
          <Dashboard
            onViewLead={(leadId) => {
              if (!leadId) {
                console.error("Dashboard - Invalid leadId:", leadId);
                return;
              }
              console.log("Dashboard - onViewLead called with leadId:", leadId);
              setPreviousView("dashboard");
              setSelectedLeadId(leadId);
              setPendingLeadView("lead-detail");
            }}
            onViewAllLeads={() => {
              setActiveView("admin-leads");
            }}
          />
        );
      case 'calls':
        return (
          <EnhancedCallInterface
            guest={mockGuest}
            incomingCall={incomingCall}
            onCallEnd={() => setIncomingCall(false)}
            agentName={userName}
          />
        );
      case 'leads':
        return (
          <ProfessionalLeadManagement
            userRole={userRole}
            userName={userName}
            backendUserId={backendUserId}
            permissions={permissions}
          />
        );
      case 'followups':
        return <SalesExecutiveDashboard userName={userName} defaultTab="follow-ups" />;
      case 'todays-followups':
        return (
          <TodaysFollowUps
            userName={userName}
            backendUserId={backendUserId}
            onViewLead={(leadId) => {
              console.log("TodaysFollowUps - onViewLead called with leadId:", leadId);
              if (leadId) {
                setPreviousView("todays-followups");
                setSelectedLeadId(leadId);
                setPendingLeadView("lead-detail");
              } else {
                console.error("TodaysFollowUps - Invalid leadId:", leadId);
              }
            }}
          />
        );
      case 'my-calendar':
        return (
          <PersonalCalendar
            userName={userName}
            backendUserId={backendUserId}
            isAdmin={isAdmin}
            permissions={permissions}
            onViewLead={(leadId) => {
              console.log("PersonalCalendar - onViewLead called with leadId:", leadId);
              if (leadId) {
                setPreviousView("my-calendar");
                setSelectedLeadId(leadId);
                setPendingLeadView("lead-detail");
              } else {
                console.error("PersonalCalendar - Invalid leadId:", leadId);
              }
            }}
          />
        );
      case 'tickets':
        return <ProfessionalTicketManagement userRole={userRole} agentName={userName} />;
      case 'ticket-management':
        // Ticket CRM – available to any backend user with ticket view/control permissions.
        const canManageTickets =
          !!isAdmin ||
          permissions?.includes("tickets.manage") ||
          permissions?.includes("tickets.view.all");
        const canViewTickets =
          canManageTickets ||
          permissions?.includes("tickets.view.own") ||
          permissions?.includes("tickets.view.team");
        if (!canViewTickets) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to access the Ticket Management module.
            </div>
          );
        }
        return <TicketManagement permissions={permissions} isAdmin={isAdmin} />;
      case 'reports':
        // Show comprehensive reports dashboard only when the user has reporting permission
        if (canViewReports || userRole === 'management' || userRole === 'admin') {
          return <Reports userName={userName} />;
        }
        return (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            You do not have permission to view reports.
          </div>
        );
      case 'knowledge':
      case 'knowledge-properties':
      case 'knowledge-factsheets':
      case 'knowledge-templates':
      case 'knowledge-resources':
        return <KnowledgeBaseMain isAdmin={isAdmin} permissions={permissions} />;
      case 'role-definition':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage roles.
            </div>
          );
        }
        return <RoleDefinition />;
      case 'user-role-management':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage users.
            </div>
          );
        }
        return <UserRoleManagement />;
      case 'employee-groups':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage employee groups.
            </div>
          );
        }
        return <EmployeeGroupsManagement />;
      case 'account-management':
        if (!canManageAccounts) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage accounts.
            </div>
          );
        }
        return <AccountManagement />;
      case 'property-management':
        if (!isAdmin && !permissions?.includes("properties.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage properties.
            </div>
          );
        }
        return <PropertyManagement />;
      case 'admin-console':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to access the admin console.
            </div>
          );
        }
        return <AdminApiConsole />;
      case 'admin-leads':
        // Lead CRM – available to any backend user with lead view/control permissions.
        if (
          !(
            canManageLeads ||
            permissions?.includes("leads.view.own") ||
            permissions?.includes("leads.view.team")
          )
        ) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to access the Lead CRM module.
            </div>
          );
        }
        return (
          <AdminLeads
            canManageUsers={canManageUsers}
            permissions={permissions}
            isAdmin={!!isAdmin}
            onViewLead={(leadId) => {
              if (!leadId) {
                console.error("AdminLeads - Invalid leadId:", leadId);
                return;
              }
              setPreviousView("admin-leads");
              setSelectedLeadId(leadId);
              setPendingLeadView("lead-detail");
            }}
          />
        );
      case 'lead-detail':
        if (!selectedLeadId) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No lead selected. Please go back and select a lead.
            </div>
          );
        }
        return (
          <LeadDetailPage
            leadId={selectedLeadId}
            onBack={() => {
              setSelectedLeadId(null);
              setActiveView(previousView);
            }}
            permissions={permissions}
            isAdmin={!!isAdmin}
          />
        );
      case 'assignment-rules':
        if (!canManageLeads) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage lead assignment rules.
            </div>
          );
        }
        return <LeadAssignmentRules />;
      case 'workflow-management':
        if (!canManageWorkflows) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage workflows.
            </div>
          );
        }
        return <WorkflowManagement />;
      case 'message-templates':
        if (!canManageTemplates) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage message templates.
            </div>
          );
        }
        return <MessageTemplates />;
      case 'email-settings':
        return <EmailSettings />;
      case 'email-health':
        return <EmailHealthDashboard />;
      case 'email-provider-settings':
        if (!canManageLeads) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage email provider settings.
            </div>
          );
        }
        return <EmailProviderSettings />;
      case 'buddy-management':
        if (!canAccessBuddy) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to access buddy management.
            </div>
          );
        }
        return <BuddyManagement
          canAssignBuddy={canAssignBuddy}
          canViewHistory={canViewBuddyHistory}
          canViewReports={canViewBuddyReports}
          backendUserId={backendUserId}
        />;
      case 'email-client':
        return <EmailClient />;
      case 'notifications':
        return (
          <NotificationsPage
            onViewLead={(leadId) => {
              if (!leadId) {
                console.error("NotificationsPage - Invalid leadId:", leadId);
                return;
              }
              setPreviousView("notifications");
              setSelectedLeadId(leadId);
              setPendingLeadView("lead-detail");
            }}
          />
        );
      default:
        return <AgentDashboard userName={userName} userRole={userRole} />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          userRole={userRole}
          isAdmin={!!isAdmin}
          permissions={permissions}
          activeView={activeView}
          onViewChange={setActiveView}
          incomingCall={incomingCall}
        />

        <div className="flex-1 flex flex-col">
          {/* Professional Header */}
          <header className="h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 px-6 flex items-center justify-between sticky top-0 z-40">
            <div className="flex items-center flex-1 gap-6">
              {/* Logo - Hidden on mobile, shown on desktop */}
              <div className="hidden md:flex items-center gap-3">
                <img
                  src="/lovable-uploads/e26310ec-726d-4063-b241-25a7abbba814.png"
                  alt="Postcard CRM"
                  className="h-8 w-auto"
                />
                <Badge variant="outline" className="text-xs font-medium">
                  CRM - DEMO
                </Badge>
              </div>

              {/* Global Search */}
              <div className="flex-1 max-w-xl">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search leads, contacts, tasks..."
                    className="pl-10 h-9 w-full bg-muted/50 border-muted focus:bg-background"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Call Center Simulate Call Button */}
              {userRole === 'callcenter' && (
                <Button
                  onClick={simulateIncomingCall}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Simulate Call</span>
                </Button>
              )}

              {/* Follow-up Reminder */}
              <FollowUpReminder
                onViewLead={(leadId) => {
                  setActiveView("admin-leads");
                }}
                onNavigateToFollowUps={() => {
                  setActiveView("todays-followups");
                }}
              />

              {/* Notifications */}
              <NotificationBell />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-9 px-2 gap-2 hover:bg-muted"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                        {userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden md:flex flex-col items-start">
                      <span className="text-sm font-medium leading-none">{userName}</span>
                      <span className="text-xs text-muted-foreground capitalize leading-none mt-0.5">
                        {userRole === 'callcenter' ? 'Call Center Agent' :
                          userRole === 'ccmanager' ? 'CC Manager' :
                            userRole === 'salesexecutive' ? 'Sales Executive' :
                              userRole === 'saleshead' ? 'Sales Head' :
                                userRole === 'management' ? 'Management' :
                                  userRole.startsWith('propertymanager') ? 'Property Manager' : userRole}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{userName}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {userRole === 'callcenter' ? 'Call Center Agent' :
                          userRole === 'ccmanager' ? 'CC Manager' :
                            userRole === 'salesexecutive' ? 'Sales Executive' :
                              userRole === 'saleshead' ? 'Sales Head' :
                                userRole === 'management' ? 'Management' :
                                  userRole.startsWith('propertymanager') ? 'Property Manager' : userRole}
                      </p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveView("email-settings")}>
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setActiveView("email-settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Preferences</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-6">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};