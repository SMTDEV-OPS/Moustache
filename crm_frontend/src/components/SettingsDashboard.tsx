import {
    ShieldCheck,
    Building2,
    GitBranch,
    Workflow,
    Mail,
    UserPlus,
    Users,
    Settings2,
    LayoutDashboard,
    Plug
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers } from "lucide-react";

interface SettingsCategory {
    title: string;
    icon: React.ReactNode;
    items: {
        title: string;
        description: string;
        url: string;
        icon: React.ReactNode;
        requiredPermission?: string;
        requiredAdmin?: boolean;
        showIfAdminLike?: boolean;
    }[];
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
    const isAdminLike = isAdmin || userRole === "admin";
    const canManageUsers = isAdminLike || permissions.includes("users.manage");
    const canManageAccounts = isAdminLike || permissions.includes("accounts.manage");
    const canManageProperties = isAdminLike || permissions.includes("properties.manage");
    const canManageLeads = isAdminLike || permissions.includes("leads.manage") || permissions.includes("leads.view.all");
    const canManageWorkflows = isAdminLike || permissions.includes("workflows.manage");
    const canManageTemplates = isAdminLike || permissions.includes("templates.manage");

    const settingsCategories: SettingsCategory[] = [
        {
            title: "Security Control",
            icon: <ShieldCheck className="h-5 w-5 text-blue-600" />,
            items: [
                {
                    title: "Roles",
                    description: "Define your company hierarchy.",
                    url: "security/roles",
                    icon: <Users className="h-4 w-4" />,
                    requiredPermission: canManageUsers ? 'true' : 'false'
                },
                {
                    title: "Profiles",
                    description: "Control what users can do.",
                    url: "security/profiles",
                    icon: <ShieldCheck className="h-4 w-4" />,
                    requiredPermission: canManageUsers ? 'true' : 'false'
                },
                {
                    title: "Groups",
                    description: "Manage collaborative teams.",
                    url: "security/groups",
                    icon: <Users className="h-4 w-4" />,
                    requiredPermission: canManageUsers ? 'true' : 'false'
                },
                {
                    title: "Data Sharing Settings",
                    description: "Control data visibility across roles.",
                    url: "security/data-sharing",
                    icon: <Settings2 className="h-4 w-4" />,
                    requiredPermission: canManageUsers ? 'true' : 'false'
                }
            ]
        },
        {
            title: "General Administration",
            icon: <Building2 className="h-5 w-5 text-purple-600" />,
            items: [
                {
                    title: "Users",
                    description: "Create and manage CRM users, roles, and reporting structure.",
                    url: "user-management",
                    icon: <UserPlus className="h-4 w-4" />,
                    requiredPermission: canManageUsers ? 'true' : 'false'
                },
                {
                    title: "Account Management",
                    description: "Manage B2B and agent accounts.",
                    url: "account-management",
                    icon: <Building2 className="h-4 w-4" />,
                    requiredPermission: canManageAccounts ? 'true' : 'false'
                },
                {
                    title: "Property Management",
                    description: "Manage hotel properties.",
                    url: "property-management",
                    icon: <Building2 className="h-4 w-4" />,
                    requiredPermission: canManageProperties ? 'true' : 'false'
                },
                {
                    title: "Module Builder",
                    description: "Customize fields and layouts for modules.",
                    url: "module-builder",
                    icon: <Layers className="h-4 w-4" />,
                    requiredPermission: isAdminLike ? 'true' : 'false'
                },
                {
                    title: "Pipeline Management",
                    description: "Configure sales pipelines and custom stages.",
                    url: "pipeline-management",
                    icon: <GitBranch className="h-4 w-4" />,
                    requiredPermission: isAdminLike ? 'true' : 'false'
                },
                {
                    title: "Scoring Rules",
                    description: "Automate lead quality scoring based on rules.",
                    url: "scoring-rules",
                    icon: <Settings2 className="h-4 w-4" />,
                    requiredPermission: isAdminLike ? 'true' : 'false'
                }
            ]
        },
        {
            title: "Automation",
            icon: <Workflow className="h-5 w-5 text-green-600" />,
            items: [
                {
                    title: "Assignment Rules",
                    description: "Configure automatic module-based assignments.",
                    url: "assignment-rules",
                    icon: <GitBranch className="h-4 w-4" />,
                    requiredPermission: canManageLeads ? 'true' : 'false'
                },
                {
                    title: "Follow-up Workflows",
                    description: "Automated communication paths.",
                    url: "workflow-management",
                    icon: <Workflow className="h-4 w-4" />,
                    requiredPermission: canManageWorkflows ? 'true' : 'false'
                }
            ]
        },
        {
            title: "Channels & Communication",
            icon: <Mail className="h-5 w-5 text-amber-600" />,
            items: [
                {
                    title: "Message Templates",
                    description: "Reusable email, SMS, and WA templates.",
                    url: "message-templates",
                    icon: <Mail className="h-4 w-4" />,
                    requiredPermission: canManageTemplates ? 'true' : 'false'
                },
                {
                    title: "Email Provider Settings",
                    description: "Configure SMTP/IMAP settings.",
                    url: "email-provider-settings",
                    icon: <Mail className="h-4 w-4" />,
                    requiredPermission: canManageLeads ? 'true' : 'false' // Matches previous AppSidebar logic
                }
            ]
        },
        {
            title: "Integrations & Developer",
            icon: <Plug className="h-5 w-5 text-teal-600" />,
            items: [
                {
                    title: "Integration Settings",
                    description: "Configure Webhooks and External APIs.",
                    url: "integration-settings",
                    icon: <Plug className="h-4 w-4" />,
                    requiredPermission: isAdminLike || canManageUsers ? 'true' : 'false'
                },
                // Admin API console is hidden by default for now based on AppSidebar comments, 
                // but keeping it structural.
                // {
                //   title: "Admin API Console",
                //   description: "Test and debug API endpoints.",
                //   url: "admin-console",
                //   icon: <LayoutDashboard className="h-4 w-4" />,
                //   requiredPermission: canManageUsers ? 'true' : 'false'
                // }
            ]
        }
    ];

    return (
        <div className="p-6 space-y-8 animate-in fade-in zoom-in-95 duration-200">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Setup</h1>
                <p className="text-muted-foreground mt-2">
                    Manage your CRM organization settings, security, automations, and more.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {settingsCategories.map((category) => {
                    const visibleItems = category.items.filter(item => item.requiredPermission === 'true');

                    if (visibleItems.length === 0) return null;

                    return (
                        <Card key={category.title} className="h-full border-border/50 bg-card overflow-hidden hover:shadow-md transition-shadow">
                            <div className="p-4 border-b border-border/50 bg-muted/20 flex items-center gap-2">
                                {category.icon}
                                <h2 className="font-semibold text-base">{category.title}</h2>
                            </div>
                            <CardContent className="p-0">
                                <ul className="divide-y divide-border/50">
                                    {visibleItems.map((item) => (
                                        <li key={item.url}>
                                            <button
                                                onClick={() => onViewChange(item.url)}
                                                className="w-full text-left p-4 hover:bg-muted/50 transition-colors flex items-start group"
                                            >
                                                <div className="mt-0.5 mr-3 text-muted-foreground group-hover:text-primary transition-colors">
                                                    {item.icon}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                                                        {item.title}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                                        {item.description}
                                                    </p>
                                                </div>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
