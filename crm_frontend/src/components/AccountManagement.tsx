import { useEffect, useState, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageShell } from "@/components/layout/PageShell";
import { PageHeader } from "@/components/shared/PageHeader";
import { FilterBar } from "@/components/patterns/FilterBar";
import { EmptyState } from "@/components/patterns/EmptyState";
import { DataTable } from "@/components/ui/data-table";
import { ErrorState } from "@/components/ui/error-state";
import { TableSkeleton } from "@/components/ui/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Search, Building2, MapPin, Phone, Mail, User, ChevronRight, ChevronDown, Network, GitBranch, UserPlus, Archive, Upload, Download, LayoutGrid } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SetFollowUpDialog } from "@/components/followup/SetFollowUpDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Filter } from "lucide-react";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountById,
  getAccountChildren,
  searchAccounts,
  importAccounts,
  Account,
  AccountType,
  OrganizationType,
  AccountStatus
} from "@/services/accounts";
import { AccountCreationWizard } from "./AccountCreationWizard";
import { WeekPlanner } from "./WeekPlanner";
import { ORGANIZATION_TYPES } from "@/constants/accountData";
import { downloadAccountImportTemplate } from "@/utils/accountImportTemplate";
import { AccountDetail } from "./AccountDetail";

const ORG_TYPE_COLORS: Record<string, { border: string; bg: string; hover: string }> = {
  CORPORATE: { border: "border-l-4 border-l-blue-500", bg: "bg-blue-50/40 dark:bg-blue-950/15", hover: "hover:bg-blue-50/70 dark:hover:bg-blue-950/25" },
  TRAVEL_AGENT: { border: "border-l-4 border-l-emerald-500", bg: "bg-emerald-50/40 dark:bg-emerald-950/15", hover: "hover:bg-emerald-50/70 dark:hover:bg-emerald-950/25" },
  EVENT_PLANNER: { border: "border-l-4 border-l-purple-500", bg: "bg-purple-50/40 dark:bg-purple-950/15", hover: "hover:bg-purple-50/70 dark:hover:bg-purple-950/25" },
  PCO: { border: "border-l-4 border-l-violet-500", bg: "bg-violet-50/40 dark:bg-violet-950/15", hover: "hover:bg-violet-50/70 dark:hover:bg-violet-950/25" },
  AIRLINE: { border: "border-l-4 border-l-sky-500", bg: "bg-sky-50/40 dark:bg-sky-950/15", hover: "hover:bg-sky-50/70 dark:hover:bg-sky-950/25" },
  GOVERNMENT: { border: "border-l-4 border-l-amber-500", bg: "bg-amber-50/40 dark:bg-amber-950/15", hover: "hover:bg-amber-50/70 dark:hover:bg-amber-950/25" },
  EMBASSY_CONSULATE: { border: "border-l-4 border-l-rose-500", bg: "bg-rose-50/40 dark:bg-rose-950/15", hover: "hover:bg-rose-50/70 dark:hover:bg-rose-950/25" },
  PSU: { border: "border-l-4 border-l-teal-500", bg: "bg-teal-50/40 dark:bg-teal-950/15", hover: "hover:bg-teal-50/70 dark:hover:bg-teal-950/25" },
  CUSTOM: { border: "border-l-4 border-l-slate-500", bg: "bg-slate-50/40 dark:bg-slate-950/15", hover: "hover:bg-slate-50/70 dark:hover:bg-slate-950/25" },
};
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { format } from "date-fns";

function FollowUpDateCell({
  account,
  canEdit,
  onUpdate,
  getColorClass,
}: {
  account: Account;
  canEdit: boolean;
  onUpdate: (updated: Account) => void;
  getColorClass: (date: Date | string | null | undefined) => string;
}) {
  const [open, setOpen] = useState(false);

  const displayDate = account.followUpDate
    ? format(new Date(account.followUpDate), "dd MMM yyyy")
    : "—";
  const colorClass = account.followUpDate ? getColorClass(account.followUpDate) : "text-muted-foreground";

  if (!canEdit) {
    return <span className={cn("text-sm", colorClass)}>{displayDate}</span>;
  }

  return (
    <>
      <button
        type="button"
        className={cn(
          "text-sm text-left hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 -mx-1 inline-flex items-center gap-2",
          colorClass
        )}
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <span>{displayDate}</span>
        <span className="text-xs text-primary">Set follow-up</span>
      </button>
      <SetFollowUpDialog
        open={open}
        onOpenChange={setOpen}
        accountId={account.id}
        accountName={account.name}
        canEdit={canEdit}
        syncAccountFollowUp
        onSaved={async () => {
          const updated = await getAccountById(account.id);
          onUpdate(updated);
        }}
      />
    </>
  );
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

function getFollowUpDateColorClass(date: Date | string | null | undefined): string {
  const status = getFollowUpDateStatus(date);
  if (status === "past") return "text-red-500";
  if (status === "today") return "text-orange-500";
  if (status === "future") return "text-green-500";
  return "text-muted-foreground";
}

const getCurrentUserId = () => {
  try {
    const token = localStorage.getItem("authToken");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub || null; // standard JWT subject claim
  } catch {
    return null;
  }
};

interface AccountManagementProps {
  permissions?: string[];
  isAdmin?: boolean;
  isSystemAdmin?: boolean;
}

export const AccountManagement = ({ permissions = [], isAdmin, isSystemAdmin }: AccountManagementProps = {}) => {
  const { toast } = useToast();
  const canEditCredit = !!isAdmin || permissions?.includes("accounts.manage") || permissions?.includes("accounts.edit.credit");
  const canReadAccounts =
    !!isAdmin ||
    permissions?.includes("accounts.read") ||
    permissions?.includes("accounts.manage") ||
    permissions?.includes("accounts.access");
  const canUpdateAccounts =
    !!isAdmin || permissions?.includes("accounts.update") || permissions?.includes("accounts.manage");
  const canDeleteAccounts = !!isSystemAdmin;
  const canMarkAsNa = canUpdateAccounts; // Users who can update can mark as NA
  const canCreateAccounts = !!isAdmin; // enforced server-side too
  const canViewHierarchy =
    !!isAdmin ||
    permissions?.includes("accounts.view_hierarchy") ||
    permissions?.includes("accounts.manage") ||
    permissions?.includes("accounts.access");
  const canCreateContacts =
    !!isAdmin ||
    permissions?.includes("contacts.create") ||
    permissions?.includes("accounts.manage") ||
    permissions?.includes("accounts.access");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilters, setOrgTypeFilters] = useState<OrganizationType[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [tagsFilter, setTagsFilter] = useState<string[]>([]);
  const [hubTab, setHubTab] = useState<"directory" | "hierarchy" | "week-planner">("directory");
  const [accountScope, setAccountScope] = useState<"my" | "all">(canUpdateAccounts ? "my" : "all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, Account[]>>({});
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [addContactForAccount, setAddContactForAccount] = useState<Account | null>(null);
  const [hierarchyViewRoot, setHierarchyViewRoot] = useState<Account | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [includeNa, setIncludeNa] = useState(false);
  const [markAsNaAccount, setMarkAsNaAccount] = useState<Account | null>(null);
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState<Account | null>(null);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { row: number; reason: string }[];
  } | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    setCurrentUserId(getCurrentUserId());
  }, []);

  useEffect(() => {
    const accountId = (location.state as { accountId?: string } | null)?.accountId;
    if (!accountId || accounts.length === 0) return;
    const acc = accounts.find((a) => a.id === accountId);
    if (acc) setSelectedAccount(acc);
  }, [location.state, accounts]);

  useEffect(() => {
    const handleOpenAddAccount = () => {
      setEditingAccount(null);
      setIsWizardOpen(true);
    };
    window.addEventListener("crm:open-add-account", handleOpenAddAccount);
    return () => window.removeEventListener("crm:open-add-account", handleOpenAddAccount);
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("crm:pending-add-account") === "1") {
      sessionStorage.removeItem("crm:pending-add-account");
      setEditingAccount(null);
      setIsWizardOpen(true);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [accountScope, includeNa, statusFilter]);

  const loadData = async (): Promise<Account[]> => {
    try {
      setIsLoading(true);
      setError(null);
      const accountsData = await listAccounts({
        ...(accountScope === "my" ? { myAccounts: true } : {}),
        includeNa: includeNa || undefined,
        ...(statusFilter !== "ALL" ? { status: statusFilter as import("@/services/accounts").AccountStatus } : {}),
      });
      const list = accountsData || [];
      setAccounts(list);
      return list;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load accounts";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  const isPrimaryManager = (account: Account) =>
    currentUserId != null && account.primaryAccountManager?.userId === currentUserId;

  const isSecondaryManager = (account: Account) =>
    currentUserId != null &&
    (account.secondaryAccountManagers || []).some(sam => sam.userId === currentUserId);

  const getRowClassName = (account: Account): string | undefined => {
    const orgType = account.organizationType || "CUSTOM";
    const colors = ORG_TYPE_COLORS[orgType] || ORG_TYPE_COLORS.CUSTOM;
    let base = `${colors.border} ${colors.bg} ${colors.hover}`;
    if (account.status === "NA" || account.profileStatus === "NA") {
      base += " opacity-75";
    }
    if (accountScope === "my") {
      if (isPrimaryManager(account)) return `border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60 dark:hover:bg-blue-950/30${account.status === "NA" ? " opacity-75" : ""}`;
      if (isSecondaryManager(account)) return `border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60 dark:hover:bg-amber-950/30${account.status === "NA" ? " opacity-75" : ""}`;
    }
    return base;
  };

  const handleOpenWizard = (account?: Account) => {
    setEditingAccount(account || null);
    setIsWizardOpen(true);
  };

  const handleCloseWizard = () => {
    setIsWizardOpen(false);
    setEditingAccount(null);
  };

  const handleDelete = async (accountId: string) => {
    try {
      await deleteAccount(accountId);
      toast({ title: "Success", description: "Account deleted successfully" });
      setDeleteAccountConfirm(null);
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete account";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleMarkAsNa = async (accountId: string) => {
    try {
      await updateAccount(accountId, { profileStatus: "NA", status: "NA" });
      toast({ title: "Success", description: "Account marked as NA" });
      setMarkAsNaAccount(null);
      const list = await loadData();
      if (selectedAccount?.id === accountId) {
        const updated = list.find((a) => a.id === accountId);
        if (updated) setSelectedAccount(updated);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to mark account as NA";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    setImportLoading(true);
    try {
      const result = await importAccounts(importFile);
      setImportResult(result);
      setImportFile(null);
      if (result.imported > 0) {
        await loadData();
      }
    } catch (err: any) {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    } finally {
      setImportLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string | undefined) => {
    const s = status || "ACTIVE";
    if (s === "NA") return "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400";
    return "";
  };

  // Filter accounts (client-side for status when we have server-filtered list)
  const filteredAccounts = accounts.filter((account) => {
    const effectiveStatus = account.profileStatus === "NA" ? "NA" : (account.status || "ACTIVE");
    if (orgTypeFilters.length > 0 && !orgTypeFilters.includes(account.organizationType)) {
      return false;
    }
    if (cityFilter !== "ALL" && account.city !== cityFilter) {
      return false;
    }
    if (statusFilter !== "ALL" && effectiveStatus !== statusFilter) {
      return false;
    }
    if (tagsFilter.length > 0) {
      const accountTags = account.tags || [];
      const hasMatch = tagsFilter.some((t) => accountTags.includes(t));
      if (!hasMatch) return false;
    }
    return true;
  });

  const handleGlobalSearch = async (val: string) => {
    setSearchQuery(val);
    if (val.length > 1) {
      setIsLoading(true);
      try {
        const results = await searchAccounts(val);
        setAccounts(results || []);
      } catch (err) {
        toast({ title: "Error", description: "Search failed", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    } else if (val.length === 0) {
      void loadData();
    }
  };

  // Get unique cities and tags for filter
  const uniqueCities = Array.from(new Set(accounts.map((a) => a.city).filter((c) => c))).sort();
  const uniqueTags = Array.from(new Set(accounts.flatMap((a) => a.tags || []))).sort();

  // Toggle account expansion in hierarchy view
  const toggleAccountExpansion = async (accountId: string) => {
    const newExpanded = new Set(expandedAccounts);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
      // Load children if not cached
      if (!childrenCache[accountId]) {
        try {
          const children = await getAccountChildren(accountId);
          setChildrenCache(prev => ({ ...prev, [accountId]: children }));
        } catch (err) {
          console.error("Failed to load children:", err);
        }
      }
    }
    setExpandedAccounts(newExpanded);
  };

  // Get root accounts for hierarchy view
  const rootAccounts = accounts.filter(a => !a.parentAccountId);

  // Must be before any early returns (Rules of Hooks)
  const sortedAccounts = useMemo(() => {
    if (!sortColumn) return filteredAccounts;
    const sorted = [...filteredAccounts];
    if (sortColumn === "followUpDate") {
      sorted.sort((a, b) => {
        const da = a.followUpDate ? new Date(a.followUpDate).getTime() : 0;
        const db = b.followUpDate ? new Date(b.followUpDate).getTime() : 0;
        if (sortDirection === "asc") return da - db;
        return db - da;
      });
    }
    return sorted;
  }, [filteredAccounts, sortColumn, sortDirection]);

  const paginatedAccounts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sortedAccounts.slice(start, start + pageSize);
  }, [sortedAccounts, page, pageSize]);

  const followUpsDueToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return filteredAccounts.filter((a) => {
      if (!a.followUpDate) return false;
      const d = new Date(a.followUpDate);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
  }, [filteredAccounts]);

  // Render hierarchy tree recursively (supports unlimited levels, including 3+)
  const renderHierarchyTree = (account: Account, level: number = 0): JSX.Element => {
    // Get children from both cache and accounts list
    const cachedChildren = childrenCache[account.id] || [];
    const listChildren = accounts.filter(a => a.parentAccountId === account.id);
    // Merge and deduplicate
    const allChildren = [...listChildren];
    cachedChildren.forEach(cached => {
      if (!allChildren.find(a => a.id === cached.id)) {
        allChildren.push(cached);
      }
    });

    const hasChildren = allChildren.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const orgType = account.organizationType || "CUSTOM";
    const orgColors = ORG_TYPE_COLORS[orgType] || ORG_TYPE_COLORS.CUSTOM;
    const hierarchyRowClass = accountScope === "my" && isPrimaryManager(account)
      ? "border-l-4 border-l-blue-500 bg-blue-50/60 dark:bg-blue-950/20 hover:bg-blue-100/60"
      : accountScope === "my" && isSecondaryManager(account)
        ? "border-l-4 border-l-amber-500 bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-100/60"
        : `border-l-4 ${orgColors.border} ${orgColors.bg} ${orgColors.hover}`;

    return (
      <div key={account.id} className="mb-2">
        <div
          className={`flex items-center gap-2 p-3 rounded-md cursor-pointer border border-border ${hierarchyRowClass}`}
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => setSelectedAccount(account)}
        >
          {hasChildren ? (
            <div
              className="p-1 hover:bg-muted rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountExpansion(account.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ) : (
            <div className="w-4" />
          )}
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className={cn("font-medium text-foreground", account.status === "NA" && "line-through text-muted-foreground")}>{account.name}</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {(account.type || "").replace(/_/g, " ")}
          </Badge>
          {account.city && (
            <span className="text-xs text-muted-foreground ml-2">{account.city}</span>
          )}
          {level > 0 && (
            <span className="text-xs text-muted-foreground ml-2">
              (Level {level + 1})
            </span>
          )}
          {hasChildren && (
            <span className="text-xs text-emerald-600 ml-2">
              ({allChildren.length} child{allChildren.length !== 1 ? 'ren' : ''})
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {canCreateContacts && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Add Contact"
                onClick={(e) => {
                  e.stopPropagation();
                  setAddContactForAccount(account);
                  setSelectedAccount(account);
                }}
              >
                <UserPlus className="h-3 w-3" />
              </Button>
            )}
            {canUpdateAccounts && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Edit Account"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenWizard(account);
                }}
              >
                <Edit className="h-3 w-3" />
              </Button>
            )}
            {canMarkAsNa && !isSystemAdmin && account.status !== "NA" && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Mark as NA"
                onClick={(e) => {
                  e.stopPropagation();
                  setMarkAsNaAccount(account);
                }}
              >
                <Archive className="h-3 w-3" />
              </Button>
            )}
            {canDeleteAccounts ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-red-600 hover:text-red-700"
                title="Delete Account"
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteAccountConfirm(account);
                }}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground"
                title="Only System Admins can delete. Set status to NA instead."
                disabled
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {isExpanded && allChildren.map(child => renderHierarchyTree(child, level + 1))}
      </div>
    );
  };

  if (isLoading && accounts.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Accounts" subtitle="Travel agents, corporates, and partners" />
        <TableSkeleton rows={10} columns={6} />
      </PageShell>
    );
  }

  if (error && accounts.length === 0) {
    return (
      <PageShell>
        <PageHeader title="Accounts" />
        <ErrorState title="Error loading accounts" message={error} onRetry={() => void loadData()} />
      </PageShell>
    );
  }

  if (selectedAccount) {
    const openAddContact = addContactForAccount?.id === selectedAccount.id;
    return (
      <>
        <AccountDetail
          account={selectedAccount}
          onBack={() => { setSelectedAccount(null); setAddContactForAccount(null); }}
          onEdit={() => handleOpenWizard(selectedAccount)}
          isAdmin={isAdmin}
          isSystemAdmin={isSystemAdmin}
          permissions={permissions}
          currentUserId={currentUserId ?? undefined}
          initialTab={openAddContact ? "contacts" : undefined}
          openAddContactOnMount={openAddContact}
          onAddContactDialogOpened={() => setAddContactForAccount(null)}
          canCreateLeadFromContact={(contact) => isPrimaryManager(selectedAccount) || isSecondaryManager(selectedAccount) || (contact.createdByUserId === currentUserId)}
          onPmsSyncSuccess={(updated) => setSelectedAccount(updated)}
          onAccountUpdate={(updated) => setSelectedAccount(updated)}
        />
        <AccountCreationWizard
          isOpen={isWizardOpen}
          onClose={handleCloseWizard}
          editingAccount={editingAccount}
          onSuccess={async () => {
            const list = await loadData();
            if (editingAccount?.id === selectedAccount?.id) {
              const updated = list.find((a) => a.id === editingAccount.id);
              if (updated) setSelectedAccount(updated);
            }
          }}
        />
      </>
    );
  }

  const getPrimaryContact = (a: Account) => {
    const pc = a.primaryContact;
    if (!pc) return "—";
    return pc.name || pc.email || pc.phone || "—";
  };

  const handleAccountCreated = async (account: Account, openContacts: boolean) => {
    const list = await loadData();
    const fresh = list.find((a) => a.id === account.id) || account;
    setSelectedAccount(fresh);
    if (openContacts) {
      setAddContactForAccount(fresh);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Accounts"
        subtitle="Travel agents, corporates, and partners"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(CRM_PATHS.accountsDashboard)}
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Open dashboard
            </Button>
            {canCreateAccounts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => downloadAccountImportTemplate()}
              >
                <Download className="h-4 w-4 mr-2" />
                Download template
              </Button>
            )}
            {canCreateAccounts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportDialogOpen(true);
                  setImportResult(null);
                  setImportFile(null);
                }}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
            )}
            {canCreateAccounts && (
              <Button size="sm" onClick={() => handleOpenWizard()}>
                <Plus className="mr-2 h-4 w-4" />
                New account
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={hubTab} onValueChange={(v) => setHubTab(v as typeof hubTab)} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger value="directory" className="text-sm">
              Directory
            </TabsTrigger>
            {canViewHierarchy && (
              <TabsTrigger value="hierarchy" className="text-sm">
                <Network className="mr-1.5 h-3.5 w-3.5" />
                Hierarchy
              </TabsTrigger>
            )}
            <TabsTrigger value="week-planner" className="text-sm">
              Week planner
            </TabsTrigger>
          </TabsList>
          {canUpdateAccounts && hubTab !== "week-planner" && (
            <div className="inline-flex rounded-md border border-border bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setAccountScope("my")}
                className={cn(
                  "rounded px-3 py-1.5 font-medium transition-colors",
                  accountScope === "my" ? "bg-primary text-white" : "text-text-muted hover:text-text"
                )}
              >
                My accounts
              </button>
              <button
                type="button"
                onClick={() => setAccountScope("all")}
                className={cn(
                  "rounded px-3 py-1.5 font-medium transition-colors",
                  accountScope === "all" ? "bg-primary text-white" : "text-text-muted hover:text-text"
                )}
              >
                All accounts
              </button>
            </div>
          )}
        </div>

        <TabsContent value="week-planner" className="mt-0">
          <WeekPlanner />
        </TabsContent>

        <TabsContent value="directory" className="mt-0 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">In view</p>
                <p className="text-2xl font-semibold text-text mt-1">{filteredAccounts.length}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">Follow-ups today</p>
                <p className="text-2xl font-semibold text-text mt-1">{followUpsDueToday}</p>
              </CardContent>
            </Card>
            <Card className="border-border shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-text-muted uppercase tracking-wide">
                  {accountScope === "my" ? "My portfolio" : "Loaded"}
                </p>
                <p className="text-2xl font-semibold text-text mt-1">{accounts.length}</p>
              </CardContent>
            </Card>
          </div>

          <FilterBar
            searchValue={searchQuery}
            onSearchChange={handleGlobalSearch}
            searchPlaceholder="Search by name…"
          >

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 border-border rounded-none px-4 flex items-center gap-2 min-w-[180px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span>
                      {orgTypeFilters.length === 0
                        ? "All Organization Types"
                        : `${orgTypeFilters.length} Types Selected`}
                    </span>
                  </div>
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 rounded-none" align="start">
                <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Filters</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700"
                    onClick={() => setOrgTypeFilters([])}
                  >
                    Clear All
                  </Button>
                </div>
                <div className="max-h-[300px] overflow-y-auto p-2 space-y-1">
                  {ORGANIZATION_TYPES.map((type) => (
                    <div
                      key={type.value}
                      className="flex items-center space-x-2 p-2 hover:bg-muted cursor-pointer"
                      onClick={() => {
                        const newFilters = orgTypeFilters.includes(type.value as OrganizationType)
                          ? orgTypeFilters.filter(f => f !== type.value)
                          : [...orgTypeFilters, type.value as OrganizationType];
                        setOrgTypeFilters(newFilters);
                      }}
                    >
                      <Checkbox
                        id={`type-${type.value}`}
                        checked={orgTypeFilters.includes(type.value as OrganizationType)}
                        onCheckedChange={() => { }} // Handled by div onClick
                        className="rounded-none"
                      />
                      <Label
                        htmlFor={`type-${type.value}`}
                        className="text-sm font-medium cursor-pointer flex-1"
                      >
                        {type.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-[180px] h-10 border-border rounded-none">
                <SelectValue placeholder="All Cities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Cities</SelectItem>
                {uniqueCities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-10 border-border rounded-none">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
                <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="LEAD">Lead</SelectItem>
                <SelectItem value="PROSPECT">Prospect</SelectItem>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
                <SelectItem value="BLACKLISTED">Blacklisted</SelectItem>
                <SelectItem value="NA">NA</SelectItem>
              </SelectContent>
            </Select>
            {uniqueTags.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="h-10 border-border rounded-none px-4 flex items-center gap-2 min-w-[140px] justify-between"
                  >
                    <span>
                      {tagsFilter.length === 0 ? "All Tags" : `${tagsFilter.length} Tag(s)`}
                    </span>
                    <ChevronDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0 rounded-none" align="start">
                  <div className="p-2 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Tags</span>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] uppercase font-bold text-blue-600 hover:text-blue-700" onClick={() => setTagsFilter([])}>Clear</Button>
                  </div>
                  <div className="max-h-[200px] overflow-y-auto p-2 space-y-1">
                    {uniqueTags.map((tag) => (
                      <div
                        key={tag}
                        className="flex items-center space-x-2 p-2 hover:bg-muted cursor-pointer"
                        onClick={() => {
                          const newTags = tagsFilter.includes(tag) ? tagsFilter.filter((t) => t !== tag) : [...tagsFilter, tag];
                          setTagsFilter(newTags);
                        }}
                      >
                        <Checkbox id={`tag-${tag}`} checked={tagsFilter.includes(tag)} onCheckedChange={() => { }} className="rounded-none" />
                        <Label htmlFor={`tag-${tag}`} className="text-sm cursor-pointer flex-1">{tag}</Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            {canUpdateAccounts && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="include-na"
                  checked={includeNa}
                  onCheckedChange={(c) => setIncludeNa(!!c)}
                  className="rounded-none"
                />
                <Label htmlFor="include-na" className="text-sm cursor-pointer">Include NA</Label>
              </div>
            )}
            {(searchQuery || orgTypeFilters.length > 0 || cityFilter !== "ALL" || statusFilter !== "ALL" || tagsFilter.length > 0 || includeNa) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setOrgTypeFilters([]);
                  setCityFilter("ALL");
                  setStatusFilter("ALL");
                  setTagsFilter([]);
                  setIncludeNa(false);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterBar>

          {filteredAccounts.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-4">
                <EmptyState
                  icon={Building2}
                  title={accounts.length === 0 ? "No accounts yet" : "No matches"}
                  description={
                    accounts.length === 0
                      ? "Create your first account, then add contacts and schedule follow-ups."
                      : searchQuery
                        ? `No account found for "${searchQuery}".`
                        : "Try adjusting your filters."
                  }
                  actionLabel={canCreateAccounts ? "New account" : undefined}
                  onAction={canCreateAccounts ? () => handleOpenWizard() : undefined}
                />
              </CardContent>
            </Card>
          ) : (
        <DataTable<Account>
          sort={{
            column: sortColumn,
            direction: sortDirection,
            onSort: (col, dir) => {
              setSortColumn(col);
              setSortDirection(dir);
            },
          }}
          columns={[
            {
              id: "name", header: "Account", sticky: true, render: (a) => (
                <div className={cn("flex items-center gap-2", a.status === "NA" && "line-through text-muted-foreground")}>
                  <span className="font-medium">{a.name}</span>
                  {isPrimaryManager(a) && <Badge className="text-[10px] h-4 bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900 dark:text-blue-300 dark:border-blue-800">PAM</Badge>}
                  {isSecondaryManager(a) && <Badge className="text-[10px] h-4 bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-800">SAM</Badge>}
                </div>
              )
            },
            { id: "type", header: "Type", render: (a) => <Badge variant="outline">{(a.organizationType || a.type || "").replace(/_/g, " ")}</Badge> },
            { id: "status", header: "Status", render: (a) => (
              <Badge
                variant="outline"
                className={cn("text-xs", getStatusBadgeClass(a.profileStatus === "NA" ? "NA" : a.status))}
              >
                {(a.profileStatus === "NA" ? "NA" : (a.status || "ACTIVE"))}
              </Badge>
            ) },
            { id: "city", header: "City", render: (a) => <span className="text-muted-foreground text-sm">{a.city || "—"}</span> },
            {
              id: "followUpDate",
              header: "Follow-up Date",
              sortKey: "followUpDate",
              render: (a) => (
                <FollowUpDateCell
                  account={a}
                  canEdit={canUpdateAccounts}
                  onUpdate={(updated) => {
                    setAccounts((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
                  }}
                  getColorClass={getFollowUpDateColorClass}
                />
              ),
            },
            { id: "contact", header: "Primary Contact", render: (a) => <span className="text-sm">{getPrimaryContact(a)}</span> },
            { id: "children", header: "Subsidiaries", render: (a) => <span className="text-sm text-muted-foreground">{accounts.filter(x => x.parentAccountId === a.id).length}</span> },
          ]}
          data={paginatedAccounts}
          getRowId={(a) => a.id}
          isLoading={isLoading}
          pagination={filteredAccounts.length > 0 ? { page, pageSize, total: filteredAccounts.length, onPageChange: setPage, onPageSizeChange: (s) => { setPageSize(s); setPage(1); } } : undefined}
          emptyState={<div className="py-12 text-center"><p className="text-muted-foreground">No accounts</p></div>}
          rowClassName={getRowClassName}
          rowActions={(a) => (
            <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              {canCreateContacts && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Add Contact" onClick={() => { setAddContactForAccount(a); setSelectedAccount(a); }}><UserPlus className="h-4 w-4" /></Button>
              )}
              {canUpdateAccounts && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Edit Account" onClick={() => handleOpenWizard(a)}><Edit className="h-4 w-4" /></Button>
              )}
              {canMarkAsNa && !isSystemAdmin && a.status !== "NA" && (
                <Button variant="ghost" size="icon" className="h-8 w-8" title="Mark as NA" onClick={() => setMarkAsNaAccount(a)}><Archive className="h-4 w-4" /></Button>
              )}
              {canDeleteAccounts ? (
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Delete Account" onClick={() => setDeleteAccountConfirm(a)}><Trash2 className="h-4 w-4" /></Button>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground"
                  title="Only System Admins can delete. Set status to NA instead."
                  disabled
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          onRowClick={(a) => setSelectedAccount(a)}
        />
          )}
        </TabsContent>

        {canViewHierarchy && (
          <TabsContent value="hierarchy" className="mt-0 space-y-4">
            <FilterBar
              searchValue={searchQuery}
              onSearchChange={handleGlobalSearch}
              searchPlaceholder="Search by name…"
            />
            <p className="text-sm text-text-muted">
              Expand groups to see parent–child relationships between accounts.
            </p>
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle>Company hierarchy</CardTitle>
                <CardDescription>Parent and child account structure</CardDescription>
              </CardHeader>
              <CardContent>
                {rootAccounts.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title="No accounts found"
                    description="Create an account to build your hierarchy."
                    actionLabel={canCreateAccounts ? "New account" : undefined}
                    onAction={canCreateAccounts ? () => handleOpenWizard() : undefined}
                  />
                ) : (
                  <div className="space-y-2">
                    {rootAccounts.map((root) => renderHierarchyTree(root, 0))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <AccountCreationWizard
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        editingAccount={editingAccount}
        onSuccess={loadData}
        onCreated={({ account, openContacts }) => void handleAccountCreated(account, !!openContacts)}
      />

      <AlertDialog open={!!markAsNaAccount} onOpenChange={(open) => !open && setMarkAsNaAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark as NA</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to mark {markAsNaAccount?.name} as NA? This account will be hidden from active lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setMarkAsNaAccount(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => markAsNaAccount && handleMarkAsNa(markAsNaAccount.id)}>
              Mark as NA
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteAccountConfirm} onOpenChange={(open) => !open && setDeleteAccountConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteAccountConfirm?.name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteAccountConfirm(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteAccountConfirm && handleDelete(deleteAccountConfirm.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Import Accounts</DialogTitle>
            <DialogDescription>
              Upload a .xlsx or .csv file using the template columns. Required column: &quot;Company Name&quot;.
              Duplicate accounts will be skipped.
            </DialogDescription>
          </DialogHeader>

          {!importResult ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.csv"
                  className="hidden"
                  id="import-file-input"
                  onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                />
                <label htmlFor="import-file-input" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    {importFile ? importFile.name : "Click to select .xlsx or .csv file"}
                  </p>
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={!importFile || importLoading}>
                  {importLoading ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
                  <p className="text-2xl font-bold text-green-700">{importResult.imported}</p>
                  <p className="text-xs text-green-600">Imported</p>
                </div>
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-center">
                  <p className="text-2xl font-bold text-amber-700">{importResult.skipped}</p>
                  <p className="text-xs text-amber-600">Skipped</p>
                </div>
              </div>
              {importResult.errors.length > 0 && (
                <div className="max-h-40 overflow-y-auto rounded border text-xs p-2 space-y-1">
                  {importResult.errors.map((e, i) => (
                    <p key={i} className="text-red-600">Row {e.row}: {e.reason}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setImportDialogOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageShell>
  );
};
