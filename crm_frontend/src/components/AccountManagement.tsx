import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2, Edit, Search, Building2, MapPin, Phone, Mail, User, ChevronRight, ChevronDown, Network, GitBranch } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Check, Filter } from "lucide-react";
import {
  listAccounts,
  createAccount,
  updateAccount,
  deleteAccount,
  getAccountChildren,
  searchAccounts,
  Account,
  AccountType,
  OrganizationType
} from "@/services/accounts";
import { AccountCreationWizard } from "./AccountCreationWizard";
import { ORGANIZATION_TYPES } from "@/constants/accountData";
import { AccountDetail } from "./AccountDetail";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const AccountManagement = () => {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [orgTypeFilters, setOrgTypeFilters] = useState<OrganizationType[]>([]);
  const [cityFilter, setCityFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "hierarchy">("list");
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [childrenCache, setChildrenCache] = useState<Record<string, Account[]>>({});
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [hierarchyViewRoot, setHierarchyViewRoot] = useState<Account | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const accountsData = await listAccounts();
      setAccounts(accountsData || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load accounts";
      setError(message);
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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
    if (!confirm("Are you sure you want to delete this account? This action cannot be undone.")) return;
    try {
      await deleteAccount(accountId);
      toast({
        title: "Success",
        description: "Account deleted successfully",
      });
      await loadData();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete account";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  // Filter accounts
  const filteredAccounts = accounts.filter((account) => {
    if (orgTypeFilters.length > 0 && !orgTypeFilters.includes(account.organizationType)) {
      return false;
    }
    if (cityFilter !== "ALL" && account.city !== cityFilter) {
      return false;
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
      loadData();
    }
  };

  // Get unique cities for filter
  const uniqueCities = Array.from(new Set(accounts.map((a) => a.city).filter((c) => c))).sort();

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

    return (
      <div key={account.id} className="mb-2">
        <div
          className="flex items-center gap-2 p-3 rounded-md hover:bg-slate-50 cursor-pointer border border-slate-200"
          style={{ paddingLeft: `${level * 24 + 12}px` }}
          onClick={() => setSelectedAccount(account)}
        >
          {hasChildren ? (
            <div
              className="p-1 hover:bg-slate-200 rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                toggleAccountExpansion(account.id);
              }}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 text-slate-500" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-500" />
              )}
            </div>
          ) : (
            <div className="w-4" />
          )}
          <Building2 className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">{account.name}</span>
          <Badge variant="outline" className="ml-2 text-xs">
            {(account.type || "").replace(/_/g, " ")}
          </Badge>
          {account.city && (
            <span className="text-xs text-slate-500 ml-2">{account.city}</span>
          )}
          {level > 0 && (
            <span className="text-xs text-slate-400 ml-2">
              (Level {level + 1})
            </span>
          )}
          {hasChildren && (
            <span className="text-xs text-emerald-600 ml-2">
              ({allChildren.length} child{allChildren.length !== 1 ? 'ren' : ''})
            </span>
          )}
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenWizard(account);
              }}
            >
              <Edit className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-red-600 hover:text-red-700"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(account.id);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        {isExpanded && allChildren.map(child => renderHierarchyTree(child, level + 1))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p>Loading accounts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-1 items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Accounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <Button onClick={loadData} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (selectedAccount) {
    return (
      <AccountDetail
        account={selectedAccount}
        onBack={() => setSelectedAccount(null)}
        onEdit={() => handleOpenWizard(selectedAccount)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Account Management</h1>
          <p className="text-slate-500 mt-1">Manage travel agents, corporates, and event planners</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 border border-slate-200 rounded-none p-1">
            <Button
              variant={viewMode === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("list")}
              className={viewMode === "list" ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}
            >
              List View
            </Button>
            <Button
              variant={viewMode === "hierarchy" ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setViewMode("hierarchy");
              }}
              className={viewMode === "hierarchy" ? "bg-slate-900 hover:bg-slate-800 text-white" : ""}
            >
              <Network className="mr-2 h-4 w-4" />
              Hierarchy View
            </Button>
          </div>
          <Button
            onClick={() => handleOpenWizard()}
            className="bg-slate-900 hover:bg-slate-800 text-white rounded-none px-8 py-6 font-medium tracking-wide"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Account
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or character..."
                className="pl-10 h-10 border-slate-200 rounded-none"
                value={searchQuery}
                onChange={(e) => handleGlobalSearch(e.target.value)}
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-10 border-slate-200 rounded-none px-4 flex items-center gap-2 min-w-[180px] justify-between"
                >
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-slate-400" />
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
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Filters</span>
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
                      className="flex items-center space-x-2 p-2 hover:bg-slate-50 cursor-pointer"
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
              <SelectTrigger className="w-[180px] h-10 border-slate-200 rounded-none">
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
            {(searchQuery || orgTypeFilters.length > 0 || cityFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setOrgTypeFilters([]);
                  setCityFilter("ALL");
                }}
                className="rounded-none"
              >
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Accounts List or Hierarchy */}
      {viewMode === "hierarchy" ? (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Company Hierarchy</CardTitle>
            <CardDescription>View accounts in a hierarchical tree structure</CardDescription>
          </CardHeader>
          <CardContent>
            {rootAccounts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                <p className="text-base font-medium text-slate-900 mb-1">No accounts found</p>
                <p className="text-sm text-slate-500 mb-4">Create your first account to get started</p>
                <Button onClick={() => handleOpenWizard()} className="bg-slate-900 hover:bg-slate-800 rounded-none">
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Account
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {rootAccounts.map(root => renderHierarchyTree(root, 0))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : filteredAccounts.length === 0 ? (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-base font-medium text-slate-900 mb-1">
              {accounts.length === 0
                ? "No accounts created yet"
                : searchQuery
                  ? `No account found for "${searchQuery}"`
                  : "No accounts match your filters"}
            </p>
            <p className="text-sm text-slate-500 mb-6 text-center max-w-xs">
              {accounts.length === 0
                ? "Create your first account to get started"
                : searchQuery
                  ? "We couldn't find any account with that name. Would you like to create a new one?"
                  : "Try adjusting your filters or clear them to see all accounts"}
            </p>
            {(accounts.length === 0 || searchQuery) && (
              <Button
                onClick={() => handleOpenWizard()}
                className="bg-slate-900 hover:bg-slate-800 text-white rounded-none px-8 h-12"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create New Account
              </Button>
            )}
            {!searchQuery && accounts.length > 0 && (
              <Button
                variant="outline"
                onClick={() => {
                  setOrgTypeFilters([]);
                  setCityFilter("ALL");
                }}
                className="rounded-none px-8"
              >
                Clear Filters
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((account) => (
            <Card
              key={account.id}
              className="border-slate-200 shadow-sm hover:shadow-md transition-shadow rounded-sm cursor-pointer"
              onClick={() => setSelectedAccount(account)}
            >
              <CardHeader className="border-b border-slate-100 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-slate-900 mb-1">
                      {account.name}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="rounded-full px-3 py-1 text-xs font-bold tracking-wider uppercase border"
                      >
                        {(account.type || "").replace(/_/g, " ")}
                      </Badge>
                      {account.city && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <MapPin className="h-3 w-3" />
                          {account.city}
                        </div>
                      )}
                      {account.parentAccountId && (
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <GitBranch className="h-3 w-3" />
                          <span>Child Company</span>
                        </div>
                      )}
                      {accounts.some(a => a.parentAccountId === account.id) && (
                        <div className="flex items-center gap-1 text-xs text-emerald-600">
                          <Network className="h-3 w-3" />
                          <span>{accounts.filter(a => a.parentAccountId === account.id).length} child{accounts.filter(a => a.parentAccountId === account.id).length !== 1 ? 'ren' : ''}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none"
                      onClick={() => handleOpenWizard(account)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-none text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleDelete(account.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-6">
                {account.parentAccountId && (
                  <div className="mb-4 pb-4 border-b border-slate-100">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                      Parent Company
                    </Label>
                    <div className="flex items-center gap-2 text-sm">
                      <GitBranch className="h-4 w-4 text-slate-400" />
                      <span className="text-slate-900">
                        {accounts.find(a => a.id === account.parentAccountId)?.name || "Unknown"}
                      </span>
                    </div>
                  </div>
                )}
                {account.primaryContact && (
                  (account.primaryContact.name || account.primaryContact.phone || account.primaryContact.email) && (
                    <div className="space-y-2 mb-4">
                      <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                        Primary Contact
                      </Label>
                      {account.primaryContact.name && (
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-900">{account.primaryContact.name}</span>
                        </div>
                      )}
                      {account.primaryContact.phone && (
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{account.primaryContact.phone}</span>
                        </div>
                      )}
                      {account.primaryContact.email && (
                        <div className="flex items-center gap-2 text-sm">
                          <Mail className="h-4 w-4 text-slate-400" />
                          <span className="text-slate-600">{account.primaryContact.email}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
                {account.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2 block">
                      Notes
                    </Label>
                    <p className="text-sm text-slate-600 whitespace-pre-wrap">{account.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AccountCreationWizard
        isOpen={isWizardOpen}
        onClose={handleCloseWizard}
        editingAccount={editingAccount}
        onSuccess={loadData}
      />
    </div>
  );
};
