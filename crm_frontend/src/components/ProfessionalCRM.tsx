import { useState, useEffect } from "react";
import { getUnreadCount } from "@/services/notifications";
import { AppShell, Sidebar } from "@/components/layout";
import { AgentDashboard } from "@/components/AgentDashboard";
import { EnhancedCallInterface } from "@/components/EnhancedCallInterface";
import ProfessionalLeadManagement from "@/components/ProfessionalLeadManagement";
import { ProfessionalTicketManagement } from "@/components/ProfessionalTicketManagement";
import { KnowledgeBaseMain } from "@/components/knowledge/KnowledgeBaseMain";
import Dashboard from "@/components/Dashboard";
import SalesExecutiveDashboard from "@/components/SalesExecutiveDashboard";
import Reports from "@/components/Reports";
import { ProfileBuilder } from "@/pages/admin/ProfileBuilder";
import { RoleBuilder } from "@/pages/admin/RoleBuilder";
import { UserManagement as UserRoleManagement } from "@/pages/admin/UserManagement";
import { RolesManager } from "./settings/security/RolesManager";
import { ProfilesManager } from "./settings/security/ProfilesManager";
import { GroupsManager } from "./settings/security/GroupsManager";
import { DataSharingManager } from "./settings/security/DataSharingManager";
import { EmployeeGroupsManagement } from "@/components/EmployeeGroupsManagement";
import { AccountManagement } from "@/components/AccountManagement";
import { PropertyManagement } from "@/components/PropertyManagement";
import { AdminApiConsole } from "@/components/AdminApiConsole";
import { AdminLeads } from "@/components/AdminLeads";
import AssignmentRulesManager from "@/pages/admin/AssignmentRulesManager";
import { WorkflowManagement } from "@/components/WorkflowManagement";
import { MessageTemplates } from "@/components/MessageTemplates";
import { EmailSettings } from "@/components/EmailSettings";
import { EmailHealthDashboard } from "@/components/EmailHealthDashboard";
import { EmailClient } from "@/components/EmailClient";
import { EmailProviderSettings } from "@/components/EmailProviderSettings";
import { TodaysFollowUps } from "@/components/TodaysFollowUps";
import { PersonalCalendar } from "@/components/PersonalCalendar";
import { LeadDetailPage } from "@/components/LeadDetailPage";
import NotificationsPage from "@/components/NotificationsPage";
import { BuddyManagement } from "@/components/BuddyManagement";
import { TicketManagement } from "@/components/TicketManagement";
import { IntegrationSettings } from "@/components/IntegrationSettings";
import { SettingsDashboard } from "@/components/SettingsDashboard";
import { PipelineManagement } from "@/components/PipelineManagement";
import { ModuleBuilder } from "@/pages/settings/ModuleBuilder";
import { ScoringRuleManagement } from "@/components/ScoringRuleManagement";
import { FieldBuilder } from "@/pages/setup/FieldBuilder";
import { PipelineBuilder } from "@/pages/setup/PipelineBuilder";
import { ScoringEngine } from "@/pages/setup/ScoringEngine";
import { FollowupRules } from "@/pages/setup/FollowupRules";
import { WorkflowBuilder } from "@/pages/setup/WorkflowBuilder";
import { AllocationRules } from "@/pages/setup/AllocationRules";
import { IntegrationHub } from "@/pages/setup/IntegrationHub";
import { AuditLog } from "@/pages/setup/AuditLog";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const loadUnreadCount = async () => {
      try {
        const count = await getUnreadCount();
        setUnreadCount(count);
      } catch {
        setUnreadCount(0);
      }
    };
    void loadUnreadCount();
    const interval = setInterval(() => void loadUnreadCount(), 30000);
    return () => clearInterval(interval);
  }, []);

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
    property: "Moustache Goa",
    interactionHistory: [
      { date: "2024-06-10", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Inquiry about booking for July" },
      { date: "2024-06-08", type: "Email", channel: "Email", agent: "Harleen Mehta", summary: "Follow-up on spa services" },
      { date: "2024-05-20", type: "Call", channel: "Phone", agent: "Harleen Mehta", summary: "Post-stay feedback call" },
    ]
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
      case 'ticket-management': {
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
      }
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
        return (
          <KnowledgeBaseMain
            isAdmin={!!isAdmin}
            permissions={permissions || []}
          />
        );
      case 'settings':
        return (
          <SettingsDashboard
            onViewChange={setActiveView}
            isAdmin={!!isAdmin}
            permissions={permissions || []}
            userRole={userRole}
          />
        );
      case 'security/roles':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage roles.
            </div>
          );
        }
        return <RolesManager />;
      case 'user-management':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage users.
            </div>
          );
        }
        return <UserRoleManagement />;
      case 'security/profiles':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage profiles.
            </div>
          );
        }
        return <ProfilesManager />;
      case 'security/groups':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage groups.
            </div>
          );
        }
        return <GroupsManager />;
      case 'security/data-sharing':
      case 'setup/data-sharing':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage data sharing.
            </div>
          );
        }
        return <DataSharingManager />;
      case 'setup/roles':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage roles.
            </div>
          );
        }
        return <RolesManager />;
      case 'setup/profiles':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage profiles.
            </div>
          );
        }
        return <ProfilesManager />;
      case 'setup/groups':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage groups.
            </div>
          );
        }
        return <GroupsManager />;
      case 'setup/users':
        if (!canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage users.
            </div>
          );
        }
        return <UserRoleManagement />;
      case 'setup/accounts':
        if (!canManageAccounts) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage accounts.
            </div>
          );
        }
        return <AccountManagement />;
      case 'setup/properties':
        if (!isAdmin && !permissions?.includes("properties.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage properties.
            </div>
          );
        }
        return <PropertyManagement />;
      case 'setup/fields':
        if (!isAdmin) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage fields.
            </div>
          );
        }
        return <FieldBuilder />;
      case 'setup/pipelines':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage pipelines.
            </div>
          );
        }
        return <PipelineBuilder />;
      case 'setup/scoring':
      case 'setup/call-quality':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage scoring.
            </div>
          );
        }
        return <ScoringEngine />;
      case 'setup/allocation':
        if (!canManageLeads && !isAdmin) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage allocation.
            </div>
          );
        }
        return <AllocationRules />;
      case 'setup/followup-rules':
        if (!canManageLeads && !canManageWorkflows) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage follow-up rules.
            </div>
          );
        }
        return <FollowupRules />;
      case 'setup/workflows':
        if (!canManageWorkflows) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage workflows.
            </div>
          );
        }
        return <WorkflowBuilder />;
      case 'setup/templates':
        if (!canManageTemplates) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage templates.
            </div>
          );
        }
        return <MessageTemplates />;
      case 'setup/email-provider':
        if (!canManageLeads) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage email provider.
            </div>
          );
        }
        return <EmailProviderSettings />;
      case 'setup/integrations':
        if (!isAdmin && !canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage integrations.
            </div>
          );
        }
        return <IntegrationHub />;
      case 'setup/webhooks':
        return <IntegrationSettings />;
      case 'setup/audit-log':
        if (!isAdmin && !canManageUsers) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to view audit log.
            </div>
          );
        }
        return <AuditLog />;
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
      case 'integration-settings':
        return <IntegrationSettings />;
      case 'pipeline-management':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage pipelines.
            </div>
          );
        }
        return <PipelineManagement />;
      case 'module-builder':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage modules.
            </div>
          );
        }
        return <ModuleBuilder />;
      case 'scoring-rules':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage scoring rules.
            </div>
          );
        }
        return <ScoringRuleManagement />;
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
              You do not have permission to manage assignment rules.
            </div>
          );
        }
        return <AssignmentRulesManager module="leads" />;
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

  const isSettingsView = [
    'security/roles', 'security/profiles', 'security/groups', 'security/data-sharing',
    'user-management', 'account-management', 'property-management',
    'assignment-rules', 'workflow-management', 'message-templates',
    'email-provider-settings', 'integration-settings', 'pipeline-management', 'module-builder', 'scoring-rules',
    'setup/roles', 'setup/profiles', 'setup/groups', 'setup/data-sharing',
    'setup/users', 'setup/accounts', 'setup/properties', 'setup/fields', 'setup/pipelines',
    'setup/scoring', 'setup/allocation', 'setup/followup-rules', 'setup/workflows',
    'setup/templates', 'setup/email-provider', 'setup/call-quality', 'setup/integrations',
    'setup/webhooks', 'setup/audit-log',
  ].includes(activeView);

  return (
    <AppShell
      sidebar={
        <Sidebar
          activeView={activeView}
          onViewChange={setActiveView}
          userName={userName}
          userRole={userRole}
          roleDisplay={userRole === "callcenter" ? "Call Center" : userRole}
          onLogout={onLogout}
          unreadCount={unreadCount}
          isAdmin={!!isAdmin}
          permissions={permissions || []}
        />
      }
    >
      {isSettingsView && (
        <div className="-mt-1 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveView("settings")}
            className="text-text-muted hover:text-text"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </div>
      )}
      {renderContent()}
    </AppShell>
  );
};