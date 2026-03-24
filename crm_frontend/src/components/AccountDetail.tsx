import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Building2, MapPin, Phone, Mail, User,
    ArrowLeft, Globe, Briefcase, FileText,
    ShieldCheck, Network, Database, RefreshCw, Loader2,
    CalendarClock
} from "lucide-react";
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
            actions={canUpdateAccounts ? <Button onClick={onEdit}>Edit Account Profile</Button> : undefined}
        >
            {/* Profile Summary */}
            <div className="flex flex-col md:flex-row gap-6 items-start pb-6 border-b border-border">
                <div className="h-20 w-20 rounded-xl bg-primary flex items-center justify-center text-primary-foreground text-3xl font-bold shrink-0 shadow-lg">
                    {account.name.charAt(0)}
                </div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h1 className="text-3xl font-bold text-foreground tracking-tight">{account.name}</h1>
                        <Badge variant="outline" className="rounded-full bg-muted text-xs font-bold uppercase tracking-wider text-muted-foreground border-border px-3">
                            {(account.organizationType || "").replace(/_/g, " ")}
                        </Badge>
                        {account.status && (
                            <Badge
                                variant="outline"
                                className={cn(
                                    "rounded-full text-xs font-bold uppercase tracking-wider px-3",
                                    account.status === "ACTIVE" && "bg-emerald-100 text-emerald-800 border-emerald-200",
                                    account.status === "PROSPECT" && "bg-amber-100 text-amber-800 border-amber-200",
                                    account.status === "LEAD" && "bg-blue-100 text-blue-800 border-blue-200",
                                    account.status === "INACTIVE" && "bg-slate-100 text-slate-600 border-slate-200",
                                    account.status === "BLACKLISTED" && "bg-red-100 text-red-800 border-red-200"
                                )}
                            >
                                {account.status}
                            </Badge>
                        )}
                        {(account.tags || []).length > 0 && (
                            <div className="flex flex-wrap gap-1">
                                {account.tags!.map((t) => (
                                    <Badge key={t} variant="secondary" className="text-xs font-normal">{t}</Badge>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                        {account.city && <div className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{account.city}, {account.state}</div>}
                        {account.website && <div className="flex items-center gap-1.5"><Globe className="h-4 w-4" />{account.website}</div>}
                        {account.accountLevel && <div className="flex items-center gap-1.5"><Network className="h-4 w-4" />{account.accountLevel} Level</div>}
                    </div>
                    {mappedProperties.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Properties</span>
                            {mappedProperties.map((property) => (
                                <TooltipProvider key={property._id}>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Badge variant="secondary" className="cursor-help">
                                                {property.name}
                                            </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>{property.location?.city || "Unknown city"} · {property.code}</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            ))}
                        </div>
                    )}
                </div>
                <div className="flex flex-col items-end gap-2 text-right">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account Type</span>
                    <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 px-4 py-1.5 text-xs font-bold">
                        {account.accountType || "RETENTION"}
                    </Badge>
                    <div className="pt-2">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Follow Up</span>
                        <div
                            className={cn(
                                "text-sm font-semibold",
                                getFollowUpDateStatus(account.followUpDate) === "past" && "text-red-500",
                                getFollowUpDateStatus(account.followUpDate) === "today" && "text-amber-500",
                                getFollowUpDateStatus(account.followUpDate) === "future" && "text-green-500",
                                !account.followUpDate && "text-muted-foreground"
                            )}
                        >
                            {account.followUpDate ? format(new Date(account.followUpDate), "dd MMM yyyy") : "Not set"}
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabbed Content */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "overview" | "contacts" | "leads" | "contracts" | "potential" | "activities" | "documents")} className="w-full">
                <TabsList className="bg-transparent border-b border-border rounded-none w-full justify-start h-12 p-0 gap-6">
                    <TabsTrigger
                        value="overview"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full px-1"
                    >
                        Detailed Overview
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
                            Market Potential
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="overview" className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <Card className="col-span-2 shadow-sm border-border">
                            <CardHeader>
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-muted-foreground" /> Company Profile
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="grid grid-cols-2 gap-y-6">
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Legal Name</label>
                                    <p className="font-medium text-foreground">{account.name}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Organization Type</label>
                                    <p className="font-medium text-foreground">{account.organizationType}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Industry</label>
                                    <p className="font-medium text-foreground">{account.industry || "Not Specified"}</p>
                                    <p className="text-xs text-muted-foreground">{account.industrySubCategory}</p>
                                </section>
                                <section className="space-y-1">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Industry Size</label>
                                    <Badge variant="secondary" className="bg-muted text-muted-foreground">{account.industryStatus || "MEDIUM"}</Badge>
                                </section>
                                <section className="space-y-1 col-span-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Address</label>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className={cn(
                                            "leading-relaxed rounded px-2 py-1 -mx-2 -my-1",
                                            ["addressLine1", "addressLine2", "city", "state", "country", "zip"].some(f => account.systemSyncedFields?.includes(f))
                                                ? "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30"
                                                : "text-foreground"
                                        )}>
                                            {account.locality && `${account.locality}, `}
                                            {account.city}, {account.state}<br />
                                            {account.country}, {account.zip}
                                        </p>
                                        {["addressLine1", "addressLine2", "city", "state", "country", "zip"].some(f => account.systemSyncedFields?.includes(f)) && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                                            ⚙ System
                                                        </Badge>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>This field was synced from PMS. Manual edits will override system data.</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </section>
                            </CardContent>
                        </Card>

                        <div className="space-y-6">
                            <Card className="shadow-sm border-border">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <ShieldCheck className="h-4 w-4 text-muted-foreground" /> Compliance Details
                                        </CardTitle>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePmsSync}
                                            disabled={isSyncingPms}
                                            className="text-xs"
                                        >
                                            {isSyncingPms ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1.5 h-3 w-3" />}
                                            Sync from PMS
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-sm text-muted-foreground">GSTIN</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-sm font-bold font-mono rounded px-2 py-0.5",
                                                getFieldStyle("gstin", account.systemSyncedFields) || "text-foreground"
                                            )}>{account.gstin || "N/A"}</span>
                                            {account.systemSyncedFields?.includes("gstin") && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                                                ⚙ System
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>This field was synced from PMS. Manual edits will override system data.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-sm text-muted-foreground">PAN</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-sm font-bold font-mono rounded px-2 py-0.5",
                                                getFieldStyle("panNumber", account.systemSyncedFields) || "text-foreground"
                                            )}>{account.panNumber || "N/A"}</span>
                                            {account.systemSyncedFields?.includes("panNumber") && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                                                ⚙ System
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>This field was synced from PMS. Manual edits will override system data.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <span className="text-sm text-muted-foreground">PMS ID</span>
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-sm font-bold rounded px-2 py-0.5",
                                                getFieldStyle("pmsProfileId", account.systemSyncedFields) || "text-foreground"
                                            )}>{account.pmsProfileId || "Not Linked"}</span>
                                            {account.systemSyncedFields?.includes("pmsProfileId") && (
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800">
                                                                ⚙ System
                                                            </Badge>
                                                        </TooltipTrigger>
                                                        <TooltipContent>
                                                            <p>This field was synced from PMS. Manual edits will override system data.</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                </TooltipProvider>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card className="shadow-sm border-border">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Briefcase className="h-4 w-4 text-muted-foreground" /> Sales Assignment
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-bold text-blue-600 uppercase">Primary Owner (PAM)</label>
                                        <p className="text-sm font-bold">{account.primaryAccountManager?.name || "Unassigned"}</p>
                                        <p className="text-xs text-muted-foreground">{account.primaryAccountManager?.city}</p>
                                    </div>
                                    {account.secondaryAccountManagers && account.secondaryAccountManagers.length > 0 && (
                                        <div className="space-y-1">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Secondary Owners (SAM)</label>
                                            <ul className="text-xs space-y-1">
                                                {account.secondaryAccountManagers.map((sam, i) => (
                                                    <li key={i} className="font-medium">{sam.name} ({sam.city})</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {canUpdateAccounts && (
                                <Card className="shadow-sm border-border">
                                    <CardHeader>
                                        <CardTitle className="text-base flex items-center gap-2">
                                            <CalendarClock className="h-4 w-4 text-muted-foreground" /> Follow-up
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Follow-up Date</label>
                                            <DatePicker
                                                value={followUpDate}
                                                onChange={(d) => setFollowUpDate(d ?? null)}
                                                placeholder="Pick a date"
                                                className="w-full"
                                            />
                                            {followUpDate && (
                                                <p className={cn(
                                                    "text-sm font-medium",
                                                    getFollowUpDateStatus(followUpDate) === "past" && "text-red-500",
                                                    getFollowUpDateStatus(followUpDate) === "today" && "text-orange-500",
                                                    getFollowUpDateStatus(followUpDate) === "future" && "text-green-500"
                                                )}>
                                                    {format(followUpDate, "PPP")}
                                                    {getFollowUpDateStatus(followUpDate) === "past" && " (Overdue)"}
                                                    {getFollowUpDateStatus(followUpDate) === "today" && " (Today)"}
                                                    {getFollowUpDateStatus(followUpDate) === "future" && " (Upcoming)"}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Note</label>
                                            <Input
                                                placeholder="Follow-up note..."
                                                value={followUpNote}
                                                onChange={(e) => setFollowUpNote(e.target.value)}
                                                className="text-sm"
                                            />
                                        </div>
                                        <Button
                                            size="sm"
                                            onClick={handleSaveFollowUp}
                                            disabled={isSavingFollowUp}
                                        >
                                            {isSavingFollowUp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            {isSavingFollowUp ? "Saving..." : "Save"}
                                        </Button>
                                    </CardContent>
                                </Card>
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
                        openAddContactOnMount={openAddContactOnMount}
                        onAddContactDialogOpened={onAddContactDialogOpened}
                        canCreateLeadFromContact={canCreateLeadFromContact}
                        accountName={account.name}
                        onViewLead={onViewLead}
                    />
                </TabsContent>

                {canViewDeals && (
                    <TabsContent value="leads" className="pt-6">
                        <AccountLeads accountId={account.id} isSystemAdmin={isSystemAdmin} />
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
