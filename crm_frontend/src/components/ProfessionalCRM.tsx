import { useState, useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getUnreadCount } from "@/services/notifications";
import { getTaskSummary } from "@/services/tasks";
import { AppShell, Sidebar, CommandPalette, SetupLayout } from "@/components/layout";
import { pathnameToView, viewToPath, CRM_PATHS } from "@/navigation/crmPaths";
import { CallCenterView } from "@/components/CallCenterView";
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
import { AccountsDashboard } from "@/components/accounts/AccountsDashboard";
import { SalesTargetsSetup } from "@/pages/setup/SalesTargetsSetup";
import { HolidaysSetup } from "@/pages/setup/HolidaysSetup";
import { SalesSettingsSetup } from "@/pages/setup/SalesSettingsSetup";
import { PropertyGuideEditorSetup } from "@/pages/setup/PropertyGuideEditorSetup";
import { AdminApiConsole } from "@/components/AdminApiConsole";
import { AdminLeads } from "@/components/AdminLeads";
import { WorkflowManagement } from "@/components/WorkflowManagement";
import { MessageTemplates } from "@/components/MessageTemplates";
import { EmailSettings } from "@/components/EmailSettings";
import { EmailHealthDashboard } from "@/components/EmailHealthDashboard";
import { EmailClient } from "@/components/EmailClient";
import { EmailProviderSettings } from "@/components/EmailProviderSettings";
import { TodaysFollowUps } from "@/components/TodaysFollowUps";
import { PersonalCalendar } from "@/components/PersonalCalendar";
import { WeekPlanner } from "@/components/WeekPlanner";
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
import { LeadAllocationPage } from "@/pages/setup/LeadAllocationPage";
import { IntegrationHub } from "@/pages/setup/IntegrationHub";
import { AuditLog } from "@/pages/setup/AuditLog";
import { ContractApprovalRules } from "@/pages/setup/ContractApprovalRules";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import FollowUpReminder from "@/components/FollowUpReminder";

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
  const location = useLocation();
  const navigate = useNavigate();
  const { view: activeView, leadId: selectedLeadId } = pathnameToView(location.pathname);
  const previousView =
    (location.state as { from?: string } | null)?.from ?? "admin-leads";
  const [incomingCall, setIncomingCall] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const setActiveView = useCallback(
    (view: string) => {
      navigate(viewToPath(view, selectedLeadId ?? undefined));
    },
    [navigate, selectedLeadId]
  );

  const navigateToLead = useCallback(
    (leadId: string, fromView: string) => {
      if (!leadId) return;
      navigate(viewToPath("lead-detail", leadId), { state: { from: fromView } });
    },
    [navigate]
  );
  const { data: taskSummary } = useQuery({
    queryKey: ["task-summary"],
    queryFn: getTaskSummary,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const followupsBadgeCount =
    (taskSummary?.overdue ?? 0) + (taskSummary?.dueToday ?? 0);

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

  useEffect(() => {
    const handleNavigateAccount = () => {
      navigate(CRM_PATHS.accounts);
    };
    window.addEventListener("crm:navigate-account", handleNavigateAccount);
    return () => window.removeEventListener("crm:navigate-account", handleNavigateAccount);
  }, [navigate]);

  const canManageUsers = !!isAdmin || permissions?.includes("users.manage");
  const canManageAccounts = true;
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
  const openSharedAddLeadForm = () => {
    sessionStorage.setItem("crm:pending-add-lead", "1");
    navigate(CRM_PATHS.leads);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("crm:open-add-lead"));
    }, 150);
  };

  const openSharedAddAccountForm = () => {
    sessionStorage.setItem("crm:pending-add-account", "1");
    navigate(CRM_PATHS.accounts);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("crm:open-add-account"));
    }, 150);
  };

  const renderContent = () => {
    switch (activeView) {
      case 'dashboard':
        // Use the new unified Dashboard component for all users
        return (
          <Dashboard
            onViewLead={(leadId) => navigateToLead(leadId, "dashboard")}
            onViewAllLeads={() => navigate(CRM_PATHS.leads)}
            onViewAccount={(accountId) => navigate(CRM_PATHS.accounts, { state: { accountId } })}
            onNavigateFollowUps={() => navigate(CRM_PATHS.followUps)}
            onNavigateAccounts={() => navigate(CRM_PATHS.accounts)}
            onNavigateCalls={() => navigate(CRM_PATHS.calls)}
          />
        );
      case 'calls':
        return (
          <CallCenterView
            incomingCall={incomingCall}
            agentName={userName}
            onOpenLeadForm={openSharedAddLeadForm}
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
            onViewLead={(leadId) => leadId && navigateToLead(leadId, "todays-followups")}
          />
        );
      case 'my-calendar':
        return (
          <PersonalCalendar
            userName={userName}
            backendUserId={backendUserId}
            isAdmin={isAdmin}
            permissions={permissions}
            onViewLead={(leadId) => leadId && navigateToLead(leadId, "my-calendar")}
          />
        );
      case "week-planner":
        return <WeekPlanner />;
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
            onViewChange={(view) => navigate(viewToPath(view))}
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
        return (
          <AccountManagement
            isAdmin={isAdmin}
            isSystemAdmin={isAdmin}
            permissions={permissions}
          />
        );
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
        return <LeadAllocationPage />;
      case 'setup/contract-approval-rules':
        if (!canManageAccounts && !isAdmin) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage contract approval rules.
            </div>
          );
        }
        return <ContractApprovalRules />;
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
      case 'accounts-dashboard':
        if (!canManageAccounts) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to view the accounts dashboard.
            </div>
          );
        }
        return <AccountsDashboard />;
      case 'account-management':
        if (!canManageAccounts) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage accounts.
            </div>
          );
        }
        return (
          <AccountManagement
            isAdmin={isAdmin}
            isSystemAdmin={isAdmin}
            permissions={permissions}
          />
        );
      case 'setup/sales-targets':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage sales targets.
            </div>
          );
        }
        return <SalesTargetsSetup />;
      case 'setup/holidays':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage holidays.
            </div>
          );
        }
        return <HolidaysSetup />;
      case 'setup/sales-settings':
        if (!isAdmin && !permissions?.includes("leads.manage")) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to manage sales settings.
            </div>
          );
        }
        return <SalesSettingsSetup />;
      case 'setup/knowledge-import':
      case 'setup/property-guide':
        if (
          !isAdmin &&
          !permissions?.includes("knowledge-base.manage") &&
          !permissions?.includes("knowledgebase.manage")
        ) {
          return (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              You do not have permission to edit property guides.
            </div>
          );
        }
        return <PropertyGuideEditorSetup />;
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
            onViewLead={(leadId) => navigateToLead(leadId, "admin-leads")}
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
            onBack={() => navigate(viewToPath(previousView))}
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
        return <LeadAllocationPage />;
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
            onViewLead={(leadId) => navigateToLead(leadId, "notifications")}
          />
        );
      default:
        return (
          <Dashboard
            onViewLead={(leadId) => navigateToLead(leadId, "dashboard")}
            onViewAllLeads={() => navigate(CRM_PATHS.leads)}
            onViewAccount={(accountId) => navigate(CRM_PATHS.accounts, { state: { accountId } })}
            onNavigateFollowUps={() => navigate(CRM_PATHS.followUps)}
            onNavigateAccounts={() => navigate(CRM_PATHS.accounts)}
            onNavigateCalls={() => navigate(CRM_PATHS.calls)}
          />
        );
    }
  };

  const isSettingsView = [
    'security/roles', 'security/profiles', 'security/groups', 'security/data-sharing',
    'user-management',
    'assignment-rules', 'workflow-management', 'message-templates',
    'email-provider-settings', 'integration-settings', 'pipeline-management', 'module-builder', 'scoring-rules',
    'setup/roles', 'setup/profiles', 'setup/groups', 'setup/data-sharing',
    'setup/users', 'setup/accounts', 'setup/fields', 'setup/pipelines',
    'setup/scoring', 'setup/allocation', 'setup/contract-approval-rules', 'setup/followup-rules', 'setup/workflows',
    'setup/templates', 'setup/email-provider', 'setup/call-quality', 'setup/integrations',
    'setup/webhooks', 'setup/audit-log',
    'setup/sales-targets', 'setup/holidays', 'setup/sales-settings', 'setup/knowledge-import', 'setup/property-guide',
  ].includes(activeView);

  const isSetupRoute = activeView.startsWith("setup/");

  return (
    <>
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <AppShell
        onOpenCommandPalette={() => setCommandOpen(true)}
        onQuickCreateLead={openSharedAddLeadForm}
        onQuickCreateAccount={openSharedAddAccountForm}
        sidebar={
          <Sidebar
            userName={userName}
            userRole={userRole}
            roleDisplay={userRole === "callcenter" ? "Call Center" : userRole}
            onLogout={onLogout}
            unreadCount={unreadCount}
            isAdmin={!!isAdmin}
            permissions={permissions || []}
            followupsBadgeCount={followupsBadgeCount}
            hasOverdueFollowups={(taskSummary?.overdue ?? 0) > 0}
          />
        }
      >
        <div className="mb-4 flex justify-end">
          <FollowUpReminder
            onNavigateToFollowUps={() => navigate(CRM_PATHS.followUps)}
            onViewLead={(leadId) => leadId && navigateToLead(leadId, activeView)}
          />
        </div>
        {isSettingsView && !isSetupRoute && (
          <div className="mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(CRM_PATHS.settings)}
              className="text-text-muted hover:text-text"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Settings
            </Button>
          </div>
        )}
        {isSetupRoute ? (
          <SetupLayout>{renderContent()}</SetupLayout>
        ) : (
          renderContent()
        )}
      </AppShell>
    </>
  );
};