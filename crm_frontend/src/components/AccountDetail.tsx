import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Building2, MapPin, Mail, User,
    Globe, Briefcase, FileText,
    ShieldCheck, Network, RefreshCw, Loader2,
    CalendarClock, UserPlus
} from "lucide-react";
import { AccountSetupChecklist } from "@/components/accounts/AccountSetupChecklist";
import { formatAccountTypeLabel } from "@/components/accounts/accountFormTypes";
import {
  AccountProfileCompany,
  AccountProfileLocation,
  AccountProfileCommercial,
  AccountProfileCompliance,
  AccountProfileSales,
} from "@/components/accounts/AccountProfileSections";
import { cn } from "@/lib/utils";
import { Account, updateAccount } from "@/services/accounts";
import { getFieldStyle } from "@/utils/fieldStyling";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Contact } from "@/services/contacts";
import { syncAccountFromPms } from "@/services/pmsIntegration";
import { getAccountById } from "@/services/accounts";
import { listProperties, Property } from "@/services/properties";
import { ContactManagement } from "./ContactManagement";
import { PotentialTracking } from "./PotentialTracking";
import { AccountTimeline } from "./AccountTimeline";
import { AccountLeads } from "@/components/AccountLeads";
import { AccountDocuments } from "./AccountDocuments";
import { AccountContracts } from "./AccountContracts";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { SetFollowUpDialog } from "@/components/followup/SetFollowUpDialog";

interface AccountDetailProps {
    account: Account;
    onBack: () => void;
    onEdit: () => void;
    isAdmin?: boolean;
    isSystemAdmin?: boolean;
    permissions?: string[];
    currentUserId?: string;
    /** Initial tab to show (e.g. when opening from "Add Contact" in list view) */
    initialTab?: "overview" | "contacts" | "leads" | "contracts" | "potential" | "activities" | "documents";
    /** When true, opens the add-contact dialog in the Contacts tab */
    openAddContactOnMount?: boolean;
    /** Called when the add-contact dialog has been opened (used to clear parent state) */
    onAddContactDialogOpened?: () => void;
    /** Per-contact: when true, user can create a lead (opportunity) from this contact (PAM/SAM: any; others: own only) */
    canCreateLeadFromContact?: (contact: Contact) => boolean;
    /** Optional: navigate to lead detail after creating lead from contact */
    onViewLead?: (leadId: string) => void;
    /** Called when PMS sync completes successfully; parent can refetch and pass updated account */
    onPmsSyncSuccess?: (updatedAccount: Account) => void;
    /** Called when account is updated (e.g. follow-up fields); parent can update selected account */
    onAccountUpdate?: (updatedAccount: Account) => void;
}

function getFollowUpDateStatus(date: Date | string | null | undefined): "past" | "today" | "future" | null {
    if (!date) return null;
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cmp = new Date(d);
    cmp.setHours(0, 0, 0, 0);
    if (cmp.getTime() < today.getTime()) return "past";
    if (cmp.getTime() > today.getTime()) return "future";
    return "today";
}

export const AccountDetail = ({ account, onBack, onEdit, isAdmin, isSystemAdmin, permissions = [], currentUserId, initialTab = "overview", openAddContactOnMount, onAddContactDialogOpened, canCreateLeadFromContact, onViewLead, onPmsSyncSuccess, onAccountUpdate }: AccountDetailProps) => {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState(initialTab);
    const [isSyncingPms, setIsSyncingPms] = useState(false);
    const [mappedProperties, setMappedProperties] = useState<Property[]>([]);
    const [followUpDate, setFollowUpDate] = useState<Date | undefined | null>(
        account.followUpDate ? new Date(account.followUpDate) : null
    );
    const [followUpNote, setFollowUpNote] = useState(account.followUpNote ?? "");
    const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
    const [triggerAddContact, setTriggerAddContact] = useState(!!openAddContactOnMount);
    const [followUpDialogOpen, setFollowUpDialogOpen] = useState(false);

    useEffect(() => {
        setFollowUpDate(account.followUpDate ? new Date(account.followUpDate) : null);
        setFollowUpNote(account.followUpNote ?? "");
    }, [account.id, account.followUpDate, account.followUpNote]);

    useEffect(() => {
        const loadProperties = async () => {
            if (!account.propertyIds?.length) {
                setMappedProperties([]);
                return;
            }
            try {
                const allProperties = await listProperties();
                const selected = allProperties.filter((p) => account.propertyIds?.includes(p._id));
                setMappedProperties(selected);
            } catch {
                setMappedProperties([]);
            }
        };
        void loadProperties();
    }, [account.propertyIds]);

    const handleSaveFollowUp = async () => {
        try {
            setIsSavingFollowUp(true);
            const payload = {
                followUpDate: followUpDate ? followUpDate.toISOString().split("T")[0] : null,
                followUpNote: followUpNote || "",
            };
            const updated = await updateAccount(account.id, payload);
            toast({ title: "Saved", description: "Follow-up updated" });
            onAccountUpdate?.(updated);
        } catch (err: unknown) {
            toast({
                title: "Error",
                description: err instanceof Error ? err.message : "Failed to save follow-up",
                variant: "destructive",
            });
        } finally {
            setIsSavingFollowUp(false);
        }
    };

    const canUpdateAccounts =
        !!isAdmin || permissions.includes("accounts.update") || permissions.includes("accounts.manage") || permissions.includes("accounts.access");
    const canManageActivities =
        !!isAdmin || permissions.includes("accounts.manage_activities") || permissions.includes("accounts.manage") || permissions.includes("accounts.access");
    const canAddContactActivities =
        canManageActivities || permissions.includes("contacts.update_all") || permissions.includes("contacts.update_own");
    const canManageDocuments =
        !!isAdmin || permissions.includes("accounts.manage_documents") || permissions.includes("accounts.manage") || permissions.includes("accounts.access");
    const canManageNotes =
        !!isAdmin || permissions.includes("accounts.manage_notes") || permissions.includes("accounts.manage") || permissions.includes("accounts.access");
    const canViewDeals = canUpdateAccounts;
    const canViewContracts = canUpdateAccounts;
    const canViewPotential = canUpdateAccounts;
    const canSeeActivitiesTab = canManageActivities || canAddContactActivities;

    const handlePmsSync = async () => {
        try {
            setIsSyncingPms(true);
            const result = await syncAccountFromPms(account.id);
            toast({
                title: result.status === "placeholder" ? "PMS Integration" : "Sync Complete",
                description: result.message,
            });
            if (onPmsSyncSuccess) {
                const updated = await getAccountById(account.id);
                onPmsSyncSuccess(updated);
            }
        } catch (err: any) {
            toast({
                title: "Sync Failed",
                description: err.message || "Unable to sync from PMS",
                variant: "destructive",
            });
        } finally {
            setIsSyncingPms(false);
        }
    };

    return (
        <PageShell
            breadcrumbs={[{ label: "← Back to Accounts", onClick: () => onBack?.() }, { label: account.name }]}
            actions={
                canUpdateAccounts ? (
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        Edit profile
                    </Button>
                ) : undefined
            }
        >
            <div className="flex flex-col lg:flex-row gap-6 items-start pb-6 border-b border-border">
                <div className="h-16 w-16 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-2xl font-semibold shrink-0">
                    {account.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-semibold text-text tracking-tight">{account.name}</h1>
                        {account.status && (
                            <Badge variant="outline" className="capitalize font-normal">
                                {account.status.toLowerCase()}
                            </Badge>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-text-muted">
                        {account.organizationType && (
                            <span>{account.organizationType.replace(/_/g, " ")}</span>
                        )}
                        {account.city && (
                            <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {account.city}
                                {account.state ? `, ${account.state}` : ""}
                            </span>
                        )}
                        {account.website && (
                            <span className="flex items-center gap-1">
                                <Globe className="h-3.5 w-3.5" />
                                {account.website}
                            </span>
                        )}
                    </div>
                    {mappedProperties.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                            {mappedProperties.map((property) => (
                                <TooltipProvider key={property._id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="font-normal cursor-help">
                                                {property.name}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>
                                                {property.location?.city || "Unknown city"} · {property.code}
                                            </p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-row lg:flex-col gap-4 lg:gap-3 lg:items-end lg:text-right shrink-0">
                    <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[140px]">
                        <span className="text-xs text-text-muted block">Account type</span>
                        <p className="text-sm font-semibold text-text mt-0.5">
                            {formatAccountTypeLabel(account.accountType)}
                        </p>
                    </div>
                    <div className="rounded-lg border border-border bg-surface px-4 py-3 min-w-[140px]">
                        <span className="text-xs text-text-muted block">Follow-up</span>
                        <p
                            className={cn(
                                "text-sm font-semibold mt-0.5",
                                getFollowUpDateStatus(account.followUpDate) === "past" && "text-destructive",
                                getFollowUpDateStatus(account.followUpDate) === "today" && "text-amber-600",
                                getFollowUpDateStatus(account.followUpDate) === "future" && "text-emerald-600",
                                !account.followUpDate && "text-text-muted font-normal"
                            )}
                        >
                            {account.followUpDate
                                ? format(new Date(account.followUpDate), "dd MMM yyyy")
                                : "Not set"}
                        </p>
                    </div>
                </div>
            </div>

            {canUpdateAccounts && (
                <div className="flex flex-wrap gap-2 pb-4 border-b border-border">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            setActiveTab("contacts");
                            setTriggerAddContact(true);
                        }}
                    >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                        Add contact
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setFollowUpDialogOpen(true)}
                    >
                        <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
                        Set follow-up
                    </Button>
                </div>
            )}

            <SetFollowUpDialog
                open={followUpDialogOpen}
                onOpenChange={setFollowUpDialogOpen}
                accountId={account.id}
                accountName={account.name}
                canEdit={canUpdateAccounts}
                onAddContact={() => {
                    setFollowUpDialogOpen(false);
                    setActiveTab("contacts");
                    setTriggerAddContact(true);
                }}
                onSaved={async () => {
                    try {
                        const updated = await getAccountById(account.id);
                        onAccountUpdate?.(updated);
                    } catch {
                        /* account refresh optional */
                    }
                }}
            />

            <AccountSetupChecklist
                account={account}
                onAddContact={() => {
                    setActiveTab("contacts");
                    setTriggerAddContact(true);
                }}
                onSetFollowUp={() => setFollowUpDialogOpen(true)}
                onGoToContacts={() => setActiveTab("contacts")}
                onGoToLeads={() => setActiveTab("leads")}
            />

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "contacts" | "leads" | "contracts" | "potential" | "activities" | "documents")} className="w-full">
                <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-12 p-0 gap-6">
                    <TabsTrigger
                        value="overview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Profile
                    </TabsTrigger>
                    <TabsTrigger
                        value="contacts"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Contacts
                    </TabsTrigger>
                    {canViewDeals && (
                        <TabsTrigger
                            value="leads"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                        >
                            Leads
                        </TabsTrigger>
                    )}
                    {canViewContracts && (
                        <TabsTrigger
                            value="contracts"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                        >
                            Contracts
                        </TabsTrigger>
                    )}
                    {canSeeActivitiesTab && (
                        <TabsTrigger
                            value="activities"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                        >
                            Activities
                        </TabsTrigger>
                    )}
                    {canManageDocuments && (
                        <TabsTrigger
                            value="documents"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                        >
                            Documents
                        </TabsTrigger>
                    )}
                    {canViewPotential && (
                        <TabsTrigger
                            value="potential"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                        >
                        Market potential
                    </TabsTrigger>
                )}
            </TabsList>

                <TabsContent value="overview" className="pt-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-4">
                            <AccountProfileCompany account={account} />
                            <AccountProfileLocation account={account} />
                            <AccountProfileCommercial account={account} />
                        </div>
                        <div className="space-y-4">
                            <AccountProfileCompliance
                                account={account}
                                syncAction={
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePmsSync}
                                        disabled={isSyncingPms}
                                    >
                                        {isSyncingPms ? (
                                            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                                        ) : (
                                            <RefreshCw className="mr-1.5 h-3 w-3" />
                                        )}
                                        Sync from PMS
                                    </Button>
                                }
                            />
                            <AccountProfileSales account={account} />
                            {canUpdateAccounts && (
                                <div className="rounded-lg border border-border bg-surface p-4 space-y-4">
                                    <h3 className="text-sm font-semibold text-text flex items-center gap-2">
                                        <CalendarClock className="h-4 w-4 text-text-muted" />
                                        Follow-up
                                    </h3>
                                    <div className="space-y-2">
                                        <label className="text-xs text-text-muted">Date</label>
                                        <DatePicker
                                            value={followUpDate}
                                            onChange={(d) => setFollowUpDate(d ?? null)}
                                            placeholder="Pick a date"
                                            className="w-full"
                                        />
                                        {followUpDate && (
                                            <p
                                                className={cn(
                                                    "text-sm",
                                                    getFollowUpDateStatus(followUpDate) === "past" && "text-destructive",
                                                    getFollowUpDateStatus(followUpDate) === "today" && "text-amber-600",
                                                    getFollowUpDateStatus(followUpDate) === "future" && "text-emerald-600"
                                                )}
                                            >
                                                {format(followUpDate, "PPP")}
                                            </p>
                                        )}
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs text-text-muted">Note</label>
                                        <Input
                                            placeholder="Follow-up note…"
                                            value={followUpNote}
                                            onChange={(e) => setFollowUpNote(e.target.value)}
                                        />
                                    </div>
                                    <Button size="sm" onClick={handleSaveFollowUp} disabled={isSavingFollowUp}>
                                        {isSavingFollowUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Save follow-up
                                    </Button>
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="contacts" className="pt-6">
                    <ContactManagement
                        accountId={account.id}
                        permissions={permissions}
                        isAdmin={isAdmin}
                        isSystemAdmin={isSystemAdmin}
                        currentUserId={currentUserId}
                        openAddContactOnMount={openAddContactOnMount || triggerAddContact}
                        onAddContactDialogOpened={() => {
                            setTriggerAddContact(false);
                            onAddContactDialogOpened?.();
                        }}
                        canCreateLeadFromContact={canCreateLeadFromContact}
                        accountName={account.name}
                        onViewLead={onViewLead}
                    />
                </TabsContent>

                {canViewDeals && (
                    <TabsContent value="leads" className="pt-6">
                        <AccountLeads
                          accountId={account.id}
                          accountName={account.name}
                          isSystemAdmin={isSystemAdmin}
                        />
                    </TabsContent>
                )}
                {canViewContracts && (
                    <TabsContent value="contracts" className="pt-6">
                        <AccountContracts accountId={account.id} canManage={!!isAdmin || permissions.includes("accounts.manage")} />
                    </TabsContent>
                )}
                {canViewPotential && (
                    <TabsContent value="potential" className="pt-6">
                        <PotentialTracking accountId={account.id} />
                    </TabsContent>
                )}

                {canSeeActivitiesTab && (
                    <TabsContent value="activities" className="pt-6">
                        <AccountTimeline
                            accountId={account.id}
                            useUnifiedTimeline={false}
                            canAddNote={false}
                            canAddActivity={canAddContactActivities}
                        />
                    </TabsContent>
                )}

                {canManageDocuments && (
                    <TabsContent value="documents" className="pt-6">
                        <AccountDocuments accountId={account.id} />
                    </TabsContent>
                )}
            </Tabs>
        </PageShell>
    );
};
