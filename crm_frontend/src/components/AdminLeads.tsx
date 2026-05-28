import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CRM_PATHS } from "@/navigation/crmPaths";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createLead, getLeadDetail, Lead, LeadDetail, listLeads, updateLead, getEligibleAssignees, EligibleAssignee, AssignmentMode, getLeadContactInfo } from "@/services/leads";
import { listFilters, applyFilter, type SavedFilter } from "@/services/filters";
import { listProperties } from "@/services/properties";
import { listUsers, User } from "@/services/users";
import { listAccounts, Account, AccountType } from "@/services/accounts";
import { CustomFieldsService, CustomFieldDefinition } from "@/services/customFields";
import { PipelineService, PipelineStage } from "@/services/pipelines";
import { Search, Filter, User as UserIcon, Calendar, Flame, Users, Zap, Plus, Phone, Mail, MessageCircle, CalendarPlus, Video, Trash2, Hotel, MoreVertical, FileText, Edit, UserPlus, ChevronLeft, ChevronRight, Snowflake, BedDouble } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LeadWorkflowDisplay } from "@/components/LeadWorkflowDisplay";
import { listEmails, EmailMessage, sendEmail } from "@/services/email";
import { sendEmailFromLead, type SendEmailPayload } from "@/services/communications";
import { EmailComposer } from "@/components/EmailComposer";
import { ScheduleFollowUpDialog } from "@/components/ScheduleFollowUpDialog";
import { SendQuotationDialog } from "@/components/SendQuotationDialog";
import { listQuotations, Quotation } from "@/services/quotations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  IndianRupee,
} from "lucide-react";
import { PageHeader, Badge as SharedBadge, Button as SharedButton, Input as SharedInput, Select as SharedSelect } from "@/components/shared";

const getScoreColor = (score: number) => {
  if (score >= 7) return "text-green-600";
  if (score >= 4) return "text-orange-600";
  return "text-red-600";
};

/**
 * Quotations Tab Component
 */
const QuotationsTab = ({
  leadId,
  onSendNew,
}: {
  leadId: string;
  onSendNew: () => void;
}) => {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadQuotations = async () => {
      try {
        setIsLoading(true);
        const data = await listQuotations(leadId);
        setQuotations(data);
      } catch (err) {
        console.error("Failed to load quotations:", err);
      } finally {
        setIsLoading(false);
      }
    };

    void loadQuotations();
  }, [leadId]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "SENT":
        return <Clock className="h-4 w-4 text-blue-500" />;
      case "ACCEPTED":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "REJECTED":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "REVISED":
        return <RefreshCw className="h-4 w-4 text-orange-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-blue-100 text-blue-800";
      case "ACCEPTED":
        return "bg-green-100 text-green-800";
      case "REJECTED":
        return "bg-red-100 text-red-800";
      case "REVISED":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-muted-foreground">Loading quotation history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Quotation History</h3>
        <Button size="sm" onClick={onSendNew}>
          <FileText className="h-4 w-4 mr-2" />
          Send New Quotation
        </Button>
      </div>

      {quotations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center border rounded-lg bg-muted/20">
          <FileText className="h-12 w-12 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">No quotations sent yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Create and send your first quotation to this lead
          </p>
          <Button size="sm" className="mt-4" onClick={onSendNew}>
            Send First Quotation
          </Button>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-3">
            {quotations.map((quote) => (
              <Card key={quote.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(quote.status)}
                    <span className="font-medium">Version {quote.versionNumber}</span>
                    <Badge className={getStatusColor(quote.status)}>
                      {quote.status}
                    </Badge>
                  </div>
                  <div className="text-right text-sm text-muted-foreground">
                    {quote.sentAt && (
                      <div className="flex items-center gap-1">
                        {quote.sentVia === "EMAIL" ? (
                          <Mail className="h-3 w-3" />
                        ) : (
                          <MessageCircle className="h-3 w-3" />
                        )}
                        {new Date(quote.sentAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Rooms:</span>{" "}
                    <span className="font-medium">{quote.rooms || 1}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Rate:</span>{" "}
                    <span className="font-medium">
                      {quote.rate ? formatCurrency(quote.rate) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Taxes:</span>{" "}
                    <span className="font-medium">
                      {quote.taxes ? formatCurrency(quote.taxes) : "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Total:</span>{" "}
                    <span className="font-medium text-primary">
                      {formatCurrency((quote.rate || 0) * (quote.rooms || 1) + (quote.taxes || 0))}
                    </span>
                  </div>
                </div>

                {quote.sentTo && (
                  <div className="text-sm mt-2 text-muted-foreground">
                    <span>Sent to: </span>
                    <span className="text-foreground">
                      {quote.sentTo.name}
                      {quote.sentTo.email && ` (${quote.sentTo.email})`}
                      {quote.sentTo.phone && ` - ${quote.sentTo.phone}`}
                    </span>
                  </div>
                )}

                {quote.inclusions && (
                  <div className="text-sm mt-2">
                    <span className="text-muted-foreground">Inclusions: </span>
                    <span className="whitespace-pre-line">{quote.inclusions}</span>
                  </div>
                )}

                {quote.specialPackages && (
                  <div className="text-sm mt-1">
                    <span className="text-muted-foreground">Special Packages: </span>
                    <span className="whitespace-pre-line">{quote.specialPackages}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
};

interface AdminLeadsProps {
  canManageUsers?: boolean;
  permissions?: string[];
  isAdmin?: boolean;
  onViewLead?: (leadId: string) => void;
}

export const AdminLeads = ({ canManageUsers, permissions, isAdmin, onViewLead }: AdminLeadsProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();

  const openAddLeadWizard = () => {
    sessionStorage.setItem("crm:pending-add-lead", "1");
    navigate(CRM_PATHS.leads);
    window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("crm:open-add-lead"));
    }, 150);
  };
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedDetail, setSelectedDetail] = useState<LeadDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isAssigning, setIsAssigning] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [assignUserId, setAssignUserId] = useState<string>("");

  // Account state
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("");

  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assigningLeadId, setAssigningLeadId] = useState<string | null>(null);

  // Email state
  const [leadEmails, setLeadEmails] = useState<EmailMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isComposeEmailOpen, setIsComposeEmailOpen] = useState(false);

  // Schedule follow-up state
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [schedulingLead, setSchedulingLead] = useState<Lead | null>(null);
  const [scheduleType, setScheduleType] = useState<"call" | "email" | "whatsapp" | "meeting">("call");

  // Quotation state
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);
  const [quotationLead, setQuotationLead] = useState<Lead | null>(null);

  // Zoho-like search & filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [heatFilter, setHeatFilter] = useState<string>("ALL");
  const [sourceFilter, setSourceFilter] = useState<string>("ALL");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("ALL");
  const [stageFilter, setStageFilter] = useState<string>("ALL");
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);

  const [activeScope, setActiveScope] = useState<"own" | "team" | "all">("own");

  // Saved filters & pagination
  const [useSavedFilter, setUseSavedFilter] = useState(false);
  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [filterResultData, setFilterResultData] = useState<Lead[]>([]);
  const [filterResultTotal, setFilterResultTotal] = useState(0);
  const [filterResultPage, setFilterResultPage] = useState(1);
  const [savedFiltersOpen, setSavedFiltersOpen] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [clientPage, setClientPage] = useState(1);
  const PAGE_SIZE = 25;

  // Strict permission checks - users must have explicit permissions
  useEffect(() => {
    const loadStages = async () => {
      try {
        setIsLoadingStages(true);
        const defaultPipeline = await PipelineService.getDefaultPipeline("leads");
        if (defaultPipeline) {
          setPipelineStages(defaultPipeline.stages);
        }
      } catch (error) {
        console.error("Failed to load pipeline stages", error);
      } finally {
        setIsLoadingStages(false);
      }
    };
    loadStages();
  }, []);

  // Debug: Log permissions to help diagnose issues
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.log("[AdminLeads] Permission check:", {
        isAdmin,
        permissions,
        permissionsArray: permissions || [],
      });
    }
  }, [isAdmin, permissions]);

  // Strict permission checks - only show tabs user explicitly has permission for
  const canViewOwn =
    (isAdmin === true) ||
    (Array.isArray(permissions) && (
      permissions.includes("leads.manage") ||
      permissions.includes("leads.view.own") ||
      permissions.includes("leads.view.all")
    ));
  const canViewTeam =
    (isAdmin === true) ||
    (Array.isArray(permissions) && (
      permissions.includes("leads.manage") ||
      permissions.includes("leads.view.team")
    ));
  const canViewAll =
    (isAdmin === true) ||
    (Array.isArray(permissions) && (
      permissions.includes("leads.manage") ||
      permissions.includes("leads.view.all")
    ));

  // Ensure default scope is something the user can actually view
  // Use useEffect to avoid state updates during render
  useEffect(() => {
    if (!canViewOwn && !canViewTeam && !canViewAll) {
      // No valid scope - leave as is
      return;
    }
    if (!canViewOwn && activeScope === "own") {
      setActiveScope(canViewTeam ? "team" : "all");
    } else if (!canViewTeam && activeScope === "team") {
      setActiveScope(canViewOwn ? "own" : "all");
    } else if (!canViewAll && activeScope === "all") {
      setActiveScope(canViewOwn ? "own" : canViewTeam ? "team" : "own");
    }
  }, [canViewOwn, canViewTeam, canViewAll, activeScope]);

  // Hotel entry type for multiple hotels; each hotel can have multiple rooms
  interface RoomEntry {
    roomCategory: string;
    roomPreference: string;
    adults: string;
    children: string;
  }

  interface HotelEntry {
    hotelName: string;
    checkInDate: string;
    checkOutDate: string;
    rooms: RoomEntry[];
  }

  const emptyRoom: RoomEntry = {
    roomCategory: "",
    roomPreference: "",
    adults: "",
    children: "",
  };

  const emptyHotel: HotelEntry = {
    hotelName: "",
    checkInDate: "",
    checkOutDate: "",
    rooms: [{ ...emptyRoom }],
  };

  const [hotels, setHotels] = useState<HotelEntry[]>([{ ...emptyHotel }]);

  const addHotel = () => {
    setHotels([...hotels, { ...emptyHotel }]);
  };

  const removeHotel = (index: number) => {
    if (hotels.length > 1) {
      setHotels(hotels.filter((_, i) => i !== index));
    }
  };

  const updateHotel = (index: number, field: keyof HotelEntry, value: string | RoomEntry[]) => {
    const updated = [...hotels];
    updated[index] = { ...updated[index], [field]: value };
    setHotels(updated);
  };

  const addRoom = (hotelIndex: number) => {
    const updated = [...hotels];
    updated[hotelIndex] = { ...updated[hotelIndex], rooms: [...updated[hotelIndex].rooms, { ...emptyRoom }] };
    setHotels(updated);
  };

  const removeRoom = (hotelIndex: number, roomIndex: number) => {
    const updated = [...hotels];
    if (updated[hotelIndex].rooms.length <= 1) return;
    updated[hotelIndex] = { ...updated[hotelIndex], rooms: updated[hotelIndex].rooms.filter((_, i) => i !== roomIndex) };
    setHotels(updated);
  };

  const updateRoom = (hotelIndex: number, roomIndex: number, field: keyof RoomEntry, value: string) => {
    const updated = [...hotels];
    updated[hotelIndex].rooms[roomIndex] = { ...updated[hotelIndex].rooms[roomIndex], [field]: value };
    setHotels(updated);
  };

  const [form, setForm] = useState({
    firstName: "",
    middleName: "",
    lastName: "",
    guestPhone: "",
    alternateContact: "",
    guestEmail: "",
    occupation: "",
    specialRequests: "",
    isCorporateBooking: "no",
    companyName: "",
    gstin: "",
    propertyId: "",
    source: "BRAND_WEBSITE",
    leadType: "STAY",
    estimatedValue: "",
    notes: "",
    occasion: "",
    heatLevel: "WARM",
    accountId: "",
    customerType: "",
    bookingWindow: "",
    budget: "",
    customData: {} as Record<string, any>,
  });

  // Assignment mode state
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("auto");
  const [manualAssigneeId, setManualAssigneeId] = useState<string>("");
  const [eligibleAssignees, setEligibleAssignees] = useState<EligibleAssignee[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);

  // Custom Fields state
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  // Lead types for dropdown
  const LEAD_TYPES = [
    { value: "STAY", label: "Stay" },
    { value: "DINING", label: "Dining" },
    { value: "INFORMATION", label: "Information" },
    { value: "MICE", label: "MICE" },
    { value: "WEDDING", label: "Wedding" },
  ];

  // Lead sources for dropdown - all sources from requirements
  const LEAD_SOURCES = [
    { value: "DIRECT_CALL", label: "Direct Call" },
    { value: "UNIT", label: "Unit" },
    { value: "EMAIL", label: "Email" },
    { value: "REPEAT_GUEST", label: "Repeat Guest" },
    { value: "REFERRAL", label: "Referral" },
    { value: "CORPORATE_OFFICE", label: "Corporate Office" },
    { value: "BRAND_WEBSITE", label: "Brand Website" },
    { value: "SOCIAL", label: "Social Media (Instagram, WhatsApp)" },
    { value: "VIP_MR_CHOPRA", label: "Mr. Chopra (VIP Guest)" },
    { value: "TRAVEL_AGENT", label: "Travel Agents & Corporates" },
    { value: "WALK_IN", label: "Walk-ins" },
    { value: "EVENT_MICE", label: "Events & MICE" },
  ];

  // Load eligible assignees when lead type changes and manual mode is selected
  useEffect(() => {
    if (assignmentMode === "manual" && form.leadType) {
      void loadEligibleAssignees(form.leadType);
    }
  }, [assignmentMode, form.leadType]);

  const loadEligibleAssignees = async (leadType: string) => {
    try {
      setIsLoadingEligible(true);
      const assignees = await getEligibleAssignees(leadType);
      setEligibleAssignees(assignees);
      setManualAssigneeId(""); // Reset selection when lead type changes
    } catch (err) {
      console.error("Failed to load eligible assignees:", err);
      setEligibleAssignees([]);
    } finally {
      setIsLoadingEligible(false);
    }
  };

  useEffect(() => {
    setUseSavedFilter(false);
    setActiveFilterId(null);
    void loadLeads();
    if (canManageUsers) {
      void loadUsers();
    }
    // Load accounts on mount, but don't fail if it errors
    loadAccounts().catch((err) => {
      console.error("Failed to load accounts on mount:", err);
      setAccounts([]);
    });
    void loadCustomFields();
  }, [canManageUsers, activeScope]);

  // Derive orgId for saved filters: from first lead or first property
  useEffect(() => {
    const resolveOrgId = async () => {
      if (leads.length > 0) {
        const first = leads[0] as Lead & { orgId?: string };
        if (first?.orgId) {
          setOrgId(first.orgId);
          return;
        }
      }
      try {
        const props = await listProperties();
        if (props.length > 0 && props[0]._id) {
          setOrgId(props[0]._id);
        }
      } catch {
        // ignore
      }
    };
    void resolveOrgId();
  }, [leads]);

  // Load saved filters when panel opens
  useEffect(() => {
    if (savedFiltersOpen && orgId) {
      listFilters("lead", orgId)
        .then(setSavedFilters)
        .catch(() => setSavedFilters([]));
    }
  }, [savedFiltersOpen, orgId]);

  const loadCustomFields = async () => {
    try {
      setIsLoadingFields(true);
      const fields = await CustomFieldsService.getActiveFieldsForModule("leads");
      // Sort fields by order
      setCustomFields(fields.sort((a, b) => a.order - b.order));
    } catch (err) {
      console.error("Failed to load custom fields:", err);
      setCustomFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  };

  // Refresh custom fields on dialog open so Field Builder changes reflect immediately.
  useEffect(() => {
    if (!isCreateDialogOpen) return;
    void loadCustomFields();
  }, [isCreateDialogOpen]);

  // Note: Accounts are loaded once on mount, not on source change
  // This prevents infinite loops and render issues

  const loadAccounts = useCallback(async () => {
    try {
      setIsLoadingAccounts(true);
      const allAccounts = await listAccounts();
      setAccounts(allAccounts || []);
    } catch (err) {
      console.error("Failed to load accounts:", err);
      setAccounts([]);
      // Don't show error toast for account loading - it's optional
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  // Memoize filtered accounts to prevent re-render issues
  const filteredAccounts = useMemo(() => {
    const showAccountSection =
      form.source === "TRAVEL_AGENT" ||
      form.source === "CORPORATE_OFFICE" ||
      form.source === "EVENT_MICE" ||
      form.isCorporateBooking === "yes";

    if (!showAccountSection || !Array.isArray(accounts) || accounts.length === 0) {
      return [];
    }

    try {
      return accounts.filter((acc) => {
        if (!acc || !acc.type) return false;
        if (form.source === "TRAVEL_AGENT") {
          return acc.type === "TRAVEL_AGENT";
        } else if (form.source === "CORPORATE_OFFICE" || form.isCorporateBooking === "yes") {
          return acc.type === "CORPORATE";
        } else if (form.source === "EVENT_MICE") {
          return acc.type === "EVENT_PLANNER";
        }
        return true;
      });
    } catch (err) {
      console.error("Error filtering accounts:", err);
      return [];
    }
  }, [accounts, form.source, form.isCorporateBooking]);

  const loadLeads = async () => {
    try {
      setIsLoadingList(true);
      const data = await listLeads({ scope: activeScope });
      setLeads(data);
      // Don't auto-select the first lead - let user choose which lead to view
    } catch (err) {
      const description =
        err instanceof Error ? err.message : "Unable to load leads";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingList(false);
    }
  };

  const loadUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const all = await listUsers();
      const active = all.filter((u) => u.status === "ACTIVE");
      setUsers(active);
    } catch (err) {
      const description =
        err instanceof Error ? err.message : "Unable to load users";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (statusFilter !== "ALL" && lead.status !== statusFilter) {
        return false;
      }
      if (stageFilter !== "ALL" && lead.stageId !== stageFilter) {
        return false;
      }
      if (heatFilter !== "ALL" && lead.heatLevel !== heatFilter) {
        return false;
      }
      if (sourceFilter !== "ALL" && lead.source !== sourceFilter) {
        return false;
      }
      if (assigneeFilter !== "ALL" && lead.assignedToUserId !== assigneeFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const assignedUser = users.find((u) => u.id === lead.assignedToUserId);
        const assignedName = assignedUser?.name || assignedUser?.email || "";
        const { name: guestName, phone: guestPhone, email: guestEmail } = getLeadContactInfo(lead);

        const haystack = [
          lead.leadNumber ?? lead.id,
          lead.source,
          lead.leadType,
          lead.propertyId ?? "",
          assignedName,
          guestName,
          guestPhone,
          guestEmail,
        ]
          .join(" ")
          .toLowerCase();

        return haystack.includes(q);
      }

      return true;
    });
  }, [leads, users, statusFilter, stageFilter, heatFilter, sourceFilter, assigneeFilter, searchQuery]);

  const resetFilters = () => {
    setStatusFilter("ALL");
    setStageFilter("ALL");
    setHeatFilter("ALL");
    setSourceFilter("ALL");
    setAssigneeFilter("ALL");
    setSearchQuery("");
    setUseSavedFilter(false);
    setClientPage(1);
  };

  const handleApplySavedFilter = async (filterId: string) => {
    if (!orgId) return;
    try {
      const result = await applyFilter<Lead & { _id?: string }>(filterId, {
        orgId,
        scope: activeScope,
        page: 1,
        limit: PAGE_SIZE,
      });
      const mapped = (result.data || []).map((l) => ({
        ...l,
        id: (l as any).id ?? (l as any)._id,
      })) as Lead[];
      setFilterResultData(mapped);
      setFilterResultTotal(result.total);
      setFilterResultPage(1);
      setActiveFilterId(filterId);
      setUseSavedFilter(true);
      setSavedFiltersOpen(false);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to apply filter",
        variant: "destructive",
      });
    }
  };

  const handleSavedFilterPage = async (page: number) => {
    if (!orgId || !activeFilterId) return;
    try {
      const result = await applyFilter<Lead & { _id?: string }>(activeFilterId, {
        orgId,
        scope: activeScope,
        page,
        limit: PAGE_SIZE,
      });
      const mapped = (result.data || []).map((l) => ({
        ...l,
        id: (l as any).id ?? (l as any)._id,
      })) as Lead[];
      setFilterResultData(mapped);
      setFilterResultTotal(result.total);
      setFilterResultPage(page);
    } catch {
      // ignore
    }
  };

  const clearSavedFilter = () => {
    setUseSavedFilter(false);
    setActiveFilterId(null);
    setFilterResultData([]);
    setFilterResultTotal(0);
    setFilterResultPage(1);
    setClientPage(1);
  };

  const loadLeadEmails = async (leadId: string) => {
    try {
      setIsLoadingEmails(true);
      const result = await listEmails({ search: leadId, limit: 100 });
      // Filter emails that are linked to this lead or contain the guest email
      const filtered = result.messages.filter(
        (email) => email.linkedLeadId === leadId
      );
      setLeadEmails(filtered);
    } catch (err) {
      // Ignore errors - emails might not be available
      setLeadEmails([]);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const selectLead = async (id: string) => {
    setSelectedLeadId(id);
    // If onViewLead callback is provided, use it to navigate to detail page
    if (onViewLead) {
      onViewLead(id);
      return;
    }
    // Otherwise, fall back to dialog (for backward compatibility)
    try {
      setIsLoadingDetail(true);
      const detail = await getLeadDetail(id);
      setSelectedDetail(detail);
      setAssignUserId(
        detail.lead.assignedToUserId ? String(detail.lead.assignedToUserId) : ""
      );
      setIsDetailDialogOpen(true);
      void loadLeadEmails(id);
    } catch (err) {
      const description =
        err instanceof Error ? err.message : "Unable to load lead details";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const onChange = (
    field: keyof typeof form,
    value: string
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreate = async () => {
    const guestFullName = `${form.firstName} ${form.middleName ? form.middleName + " " : ""}${form.lastName}`.trim();

    if (!form.firstName || !form.lastName || !form.source || !form.leadType) {
      toast({
        title: "Missing required fields",
        description: "Guest first name, last name, source, and lead type are required.",
        variant: "destructive",
      });
      return;
    }

    // Validate custom required fields
    const missingCustomRequired = customFields.filter(f => f.isRequired && !form.customData[f.fieldName]);
    if (missingCustomRequired.length > 0) {
      toast({
        title: "Missing required fields",
        description: `Please fill in: ${missingCustomRequired.map(f => f.label).join(", ")}`,
        variant: "destructive",
      });
      return;
    }

    // Get primary hotel data
    const primaryHotel = hotels[0];

    try {
      setIsCreating(true);

      // Build hotels array for itineraries (one per hotel, each with multiple rooms)
      const hotelsPayload = hotels
        .filter((h) => h.hotelName && h.checkInDate && h.checkOutDate)
        .map((h) => {
          const rooms = (h.rooms || []).map((r) => ({
            roomCategory: r.roomCategory || undefined,
            roomPreference: r.roomPreference || undefined,
            numberOfGuests: r.adults || r.children
              ? `${r.adults || 0} Adults${r.children ? `, ${r.children} Children` : ""}`
              : undefined,
          }));
          return {
            hotelName: h.hotelName || undefined,
            checkInDate: h.checkInDate ? new Date(h.checkInDate) : undefined,
            checkOutDate: h.checkOutDate ? new Date(h.checkOutDate) : undefined,
            rooms: rooms.length > 0 ? rooms : [{ roomCategory: undefined, roomPreference: undefined, numberOfGuests: undefined }],
          };
        });

      const payload = {
        guestContact: {
          name: guestFullName,
          phone: form.guestPhone || undefined,
          email: form.guestEmail || undefined,
        },
        propertyId: form.propertyId || undefined,
        accountId: form.accountId || selectedAccountId || undefined,
        source: form.source,
        leadType: form.leadType,
        occasion: form.occasion || undefined,
        heatLevel: form.heatLevel as any,
        alternateContact: form.alternateContact || undefined,
        occupation: form.occupation || undefined,
        specialRequests: form.specialRequests || undefined,
        isCorporateBooking: form.isCorporateBooking === "yes" ? true : undefined,
        companyName: form.companyName || undefined,
        gstin: form.gstin || undefined,
        estimatedValue: form.estimatedValue || undefined,
        notes: form.notes || undefined,
        customerType: form.customerType || undefined,
        bookingWindow: form.bookingWindow || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        assignmentMode: assignmentMode,
        assignedToUserId: assignmentMode === "manual" && manualAssigneeId ? manualAssigneeId : undefined,
        customData: Object.keys(form.customData).length > 0 ? form.customData : undefined,
        hotels: hotelsPayload.length > 0 ? hotelsPayload : undefined,
      };

      const newLead = await createLead(payload);
      setLeads((prev) => [newLead, ...prev]);
      toast({
        title: "Lead created",
        description: `Lead ${newLead.leadNumber} created successfully.`,
      });

      // Reset some fields but keep context like source/leadType/heat
      setForm((prev) => ({
        ...prev,
        firstName: "",
        middleName: "",
        lastName: "",
        guestPhone: "",
        alternateContact: "",
        guestEmail: "",
        occupation: "",
        specialRequests: "",
        isCorporateBooking: "no",
        companyName: "",
        gstin: "",
        estimatedValue: "",
        notes: "",
        customerType: "",
        bookingWindow: "",
        budget: "",
        customData: {},
      }));
      // Reset hotels
      setHotels([{ ...emptyHotel }]);

      // Reset assignment mode
      setAssignmentMode("auto");
      setManualAssigneeId("");
      setSelectedAccountId("");
      setForm((prev) => ({ ...prev, accountId: "" }));

      // Close dialog on success
      setIsCreateDialogOpen(false);

      // Navigate to new lead if onViewLead callback is provided
      if (onViewLead) {
        onViewLead(newLead.id);
      } else {
        void selectLead(newLead.id);
      }
    } catch (err) {
      const description =
        err instanceof Error ? err.message : "Unable to create lead";
      toast({
        title: "Error",
        description,
        variant: "destructive",
      });
      // Don't close dialog on error - let user fix the form
      // Re-throw error so calling code knows it failed
      throw err;
    } finally {
      setIsCreating(false);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "NEW":
        return "outline";
      case "TENTATIVE":
        return "secondary";
      case "CONFIRMED":
        return "default";
      case "LOST":
      case "CLOSED_AUTO":
        return "destructive";
      default:
        return "outline";
    }
  };

  // Helper functions for badge colors matching the screenshot
  const getStatusBadgeColor = (status: string) => {
    const styles: Record<string, string> = {
      NEW: "bg-blue-50 text-blue-600 border-blue-200",
      CONTACTED: "bg-purple-50 text-purple-600 border-purple-200",
      QUOTATION_SHARED: "bg-amber-50 text-amber-600 border-amber-200",
      PAYMENT_PENDING: "bg-yellow-50 text-yellow-600 border-yellow-200",
      CONFIRMED: "bg-emerald-50 text-emerald-600 border-emerald-200",
      LOST: "bg-slate-100 text-slate-500 border-slate-200",
      CLOSED_AUTO: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || styles.NEW;
  };

  const getHeatBadgeColor = (heat: string) => {
    const styles: Record<string, string> = {
      HOT: "bg-rose-50 text-rose-600 border-rose-200",
      WARM: "bg-amber-50 text-amber-600 border-amber-200",
      COLD: "bg-slate-100 text-slate-500 border-slate-200",
      NOT_INTERESTED: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[heat] || styles.WARM;
  };

  const getHeatIcon = (heat: string) => {
    switch (heat) {
      case "HOT":
        return <Flame className="h-4 w-4 text-rose-500" />;
      case "WARM":
        return <Flame className="h-4 w-4 text-amber-500" />;
      case "COLD":
        return <Flame className="h-4 w-4 text-slate-400" />;
      default:
        return <Flame className="h-4 w-4 text-amber-500" />;
    }
  };

  const getGuestName = (lead: Lead): string => {
    const { name } = getLeadContactInfo(lead);
    if (name && name.trim() !== "") {
      return name.trim();
    }
    if (lead.leadNumber) {
      return `Lead #${lead.leadNumber}`;
    }
    return `Lead #${lead.id}`;
  };

  const getGuestPhone = (lead: Lead): string => {
    return getLeadContactInfo(lead).phone;
  };

  const getPropertyName = (lead: Lead): string => {
    if (typeof lead.propertyId === "object" && lead.propertyId !== null) {
      return (lead.propertyId as any).name || String(lead.propertyId);
    }
    return lead.propertyId || "—";
  };

  const formatTravelDates = (lead: Lead): string => {
    if (lead.checkInDate) {
      const d = new Date(lead.checkInDate);
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    }
    return "—";
  };

  // Badge variant helpers per spec
  const getSourceBadgeVariant = (source: string): "src_ivr" | "src_whatsapp" | "src_website" | "src_call" | "src_email" | "default" => {
    if (source === "IVR" || source === "IVR_LIVE") return "src_ivr";
    if (source === "WHATSAPP") return "src_whatsapp";
    if (source === "BRAND_WEBSITE") return "src_website";
    if (source === "DIRECT_CALL") return "src_call";
    if (source === "EMAIL") return "src_email";
    return "default";
  };

  const getStageBadgeVariant = (stage: PipelineStage | undefined, status: string): "stage_new" | "stage_active" | "stage_terminal" | "default" => {
    if (!stage) return "default";
    const name = (stage.name || "").toLowerCase();
    if (name.includes("new")) return "stage_new";
    if (stage.isTerminal || stage.terminalType === "WON" || stage.terminalType === "LOST" || name.includes("booked") || name.includes("won") || name.includes("lost") || name.includes("closed")) return "stage_terminal";
    return "stage_active";
  };

  const displayLeads = useSavedFilter ? filterResultData : filteredLeads;
  const totalLeads = useSavedFilter ? filterResultTotal : filteredLeads.length;
  const paginatedLeads = useSavedFilter
    ? displayLeads
    : displayLeads.slice((clientPage - 1) * PAGE_SIZE, clientPage * PAGE_SIZE);
  const totalPages = Math.ceil(totalLeads / PAGE_SIZE);
  const currentPageNum = useSavedFilter ? filterResultPage : clientPage;
  const paginationStart = totalLeads === 0 ? 0 : (currentPageNum - 1) * PAGE_SIZE + 1;
  const paginationEnd = totalLeads === 0 ? 0 : Math.min(currentPageNum * PAGE_SIZE, totalLeads);

  return (
    <div className="space-y-0">
      <PageHeader
        title="Leads"
        subtitle="Manage and track all hotel inquiries"
        actions={
          <SharedButton variant="primary" icon={Plus} onClick={openAddLeadWizard}>
            New Lead
          </SharedButton>
        }
      />

      {/* Tab Bar - simple underline, no pill */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--border)",
          marginBottom: 16,
        }}
      >
        {canViewOwn && (
          <button
            type="button"
            onClick={() => setActiveScope("own")}
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 14,
              color: activeScope === "own" ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              borderBottom: `2px solid ${activeScope === "own" ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              fontWeight: activeScope === "own" ? 500 : 400,
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
            }}
          >
            My Leads
          </button>
        )}
        {canViewTeam && (
          <button
            type="button"
            onClick={() => setActiveScope("team")}
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 14,
              color: activeScope === "team" ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              borderBottom: `2px solid ${activeScope === "team" ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              fontWeight: activeScope === "team" ? 500 : 400,
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
            }}
          >
            My Team Leads
          </button>
        )}
        {canViewAll && (
          <button
            type="button"
            onClick={() => setActiveScope("all")}
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 14,
              color: activeScope === "all" ? "var(--primary)" : "var(--text-muted)",
              cursor: "pointer",
              borderBottom: `2px solid ${activeScope === "all" ? "var(--primary)" : "transparent"}`,
              marginBottom: -1,
              fontWeight: activeScope === "all" ? 500 : 400,
              background: "none",
              borderTop: "none",
              borderLeft: "none",
              borderRight: "none",
            }}
          >
            All Leads
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          alignItems: "center",
        }}
      >
        <div style={{ flex: 1, maxWidth: 400 }}>
          <SharedInput
            icon={Search}
            placeholder="Search by name, email, phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ width: 140 }}>
          <SharedSelect
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
          >
            <option value="ALL">All pipeline stages</option>
            {pipelineStages.map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </SharedSelect>
        </div>
        <div style={{ width: 120 }}>
          <SharedSelect
            value={heatFilter}
            onChange={(e) => setHeatFilter(e.target.value)}
          >
            <option value="ALL">All Heat</option>
            <option value="HOT">Hot</option>
            <option value="WARM">Warm</option>
            <option value="COLD">Cold</option>
          </SharedSelect>
        </div>
        <div style={{ width: 140 }}>
          <SharedSelect
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="ALL">All Sources</option>
            {["DIRECT_CALL", "EMAIL", "BRAND_WEBSITE", "WHATSAPP", "IVR", "IVR_LIVE", "UNIT", "REPEAT_GUEST", "REFERRAL", "CORPORATE_OFFICE", "SOCIAL", "VIP_MR_CHOPRA", "TRAVEL_AGENT", "WALK_IN", "EVENT_MICE", "MANUAL", "CSV_UPLOAD"].map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </SharedSelect>
        </div>
        <SharedButton variant="secondary" icon={Filter} size="sm" onClick={() => setSavedFiltersOpen(true)}>
          Filters
        </SharedButton>
      </div>

      {/* Saved Filters Slide-Over */}
      {savedFiltersOpen && (
        <>
          <div
            role="presentation"
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 40,
              background: "transparent",
            }}
            onClick={() => setSavedFiltersOpen(false)}
            aria-hidden
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 320,
              background: "var(--surface)",
              borderLeft: "1px solid var(--border)",
              zIndex: 50,
              overflowY: "auto",
              padding: 16,
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 500, marginBottom: 12, color: "var(--text)" }}>Saved Filters</p>
            {savedFilters.length === 0 && !orgId && (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No saved filters available.</p>
            )}
            {savedFilters.map((f) => (
              <button
                key={f._id}
                type="button"
                onClick={() => void handleApplySavedFilter(f._id)}
                style={{
                  display: "block",
                  width: "100%",
                  height: 36,
                  padding: "0 12px",
                  fontSize: 14,
                  textAlign: "left",
                  color: "var(--text)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  borderRadius: "var(--radius)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {f.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Leads Table */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
        }}
      >
        {isLoadingList && !useSavedFilter ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 0",
              gap: 12,
            }}
          >
            <RefreshCw style={{ width: 32, height: 32, color: "var(--text-faint)" }} className="animate-spin" />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Loading leads...</p>
          </div>
        ) : paginatedLeads.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "48px 0",
              gap: 12,
            }}
          >
            <Users style={{ width: 40, height: 40, color: "var(--text-faint)" }} />
            <p style={{ fontSize: 15, fontWeight: 500, color: "var(--text)", marginTop: 12 }}>
              No leads found
            </p>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Try adjusting your filters or add a new lead.
            </p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      height: 36,
                      background: "var(--bg)",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Guest</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Hotel</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Source</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Travel Dates</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Heat</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Stage</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Assigned</th>
                    <th style={{ fontSize: 12, fontWeight: 500, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", padding: "0 16px", textAlign: "left" }}>Score</th>
                    <th style={{ width: 40 }} />
                  </tr>
                </thead>
                <tbody>
                  {paginatedLeads.map((lead) => {
                    const assignedUser = users.find((u) => u.id === lead.assignedToUserId);
                    const guestName = getGuestName(lead);
                    const guestPhone = getGuestPhone(lead);
                    const propertyName = getPropertyName(lead);
                    const travelDates = formatTravelDates(lead);
                    const stage = pipelineStages.find((s) => s._id === lead.stageId);
                    const score = lead.score ?? 0;
                    const scoreStyle =
                      score >= 7 ? { fontWeight: 600, color: "#ef4444" } as React.CSSProperties :
                      score >= 4 ? { fontWeight: 600, color: "#f59e0b" } as React.CSSProperties :
                      { fontWeight: 400, color: "var(--text-muted)" } as React.CSSProperties;

                    const initials = guestName
                      .split(/\s+/)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2) || "?";

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => void selectLead(lead.id)}
                        style={{
                          height: 52,
                          borderBottom: "1px solid var(--border-light)",
                          cursor: "pointer",
                          transition: "background 120ms ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "var(--hover)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <td style={{ padding: "0 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: "50%",
                                background: "var(--primary-light)",
                                color: "var(--primary)",
                                fontSize: 12,
                                fontWeight: 600,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {initials}
                            </div>
                            <div>
                              <span style={{ display: "block", fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{guestName}</span>
                              {guestPhone && (
                                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)" }}>{guestPhone}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "0 16px", fontSize: 13, color: "var(--text)" }}>
                          {propertyName === "—" ? (
                            <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>—</span>
                          ) : (
                            propertyName
                          )}
                        </td>
                        <td style={{ padding: "0 16px" }}>
                          <SharedBadge
                            label={lead.source.replace(/_/g, " ")}
                            variant={getSourceBadgeVariant(lead.source)}
                          />
                        </td>
                        <td style={{ padding: "0 16px", fontSize: 13, color: "var(--text)" }}>
                          {travelDates === "—" ? (
                            <span style={{ color: "var(--text-faint)", fontStyle: "italic" }}>—</span>
                          ) : (
                            travelDates
                          )}
                        </td>
                        <td style={{ padding: "0 16px" }}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            {lead.heatLevel === "HOT" && <Flame size={12} style={{ flexShrink: 0 }} />}
                            {lead.heatLevel === "WARM" && <Flame size={12} style={{ flexShrink: 0 }} />}
                            {lead.heatLevel === "COLD" && <Snowflake size={12} style={{ flexShrink: 0 }} />}
                            <SharedBadge
                              label={lead.heatLevel === "NOT_INTERESTED" ? "Not Interested" : lead.heatLevel.toLowerCase()}
                              variant={
                                lead.heatLevel === "HOT" ? "heat_hot" :
                                lead.heatLevel === "WARM" ? "heat_warm" :
                                lead.heatLevel === "COLD" ? "heat_cold" : "default"
                              }
                            />
                          </span>
                        </td>
                        <td style={{ padding: "0 16px" }}>
                          <SharedBadge
                            label={stage ? stage.name : (lead.status || "").replace(/_/g, " ")}
                            variant={getStageBadgeVariant(stage, lead.status || "")}
                          />
                        </td>
                        <td style={{ padding: "0 16px", fontSize: 13, color: assignedUser ? "var(--text)" : "var(--text-faint)" }}>
                          {assignedUser ? assignedUser.name || assignedUser.email : (
                            <span style={{ fontStyle: "italic" }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: "0 16px" }}>
                          <span style={scoreStyle}>{score}/10</span>
                        </td>
                        <td
                          style={{ padding: "0 16px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div
                            style={{
                              opacity: 0,
                              transition: "opacity 120ms ease",
                            }}
                            className="leads-row-menu-trigger"
                          >
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  style={{
                                    background: "none",
                                    border: "none",
                                    padding: 4,
                                    cursor: "pointer",
                                    color: "var(--text-faint)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  <MoreVertical size={16} />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" style={{ boxShadow: "var(--shadow)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}>
                                <DropdownMenuItem
                                  onClick={() => void selectLead(lead.id)}
                                  style={{ fontSize: 13, height: 32, padding: "0 14px" }}
                                >
                                  View Lead
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    void selectLead(lead.id);
                                  }}
                                  style={{ fontSize: 13, height: 32, padding: "0 14px" }}
                                >
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAssigningLeadId(lead.id);
                                    setAssignUserId(lead.assignedToUserId ?? "");
                                    setIsAssignDialogOpen(true);
                                  }}
                                  style={{ fontSize: 13, height: 32, padding: "0 14px" }}
                                >
                                  Reassign
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={async () => {
                                    const lostStage = pipelineStages.find((s) => s.terminalType === "LOST" || (s.name || "").toLowerCase().includes("lost"));
                                    try {
                                      await updateLead(lead.id, lostStage ? { stageId: lostStage._id } : { status: "LOST" as const });
                                      toast({ title: "Lead updated", description: "Lead marked as lost." });
                                      void loadLeads();
                                      if (useSavedFilter) clearSavedFilter();
                                    } catch (err) {
                                      toast({ title: "Error", description: err instanceof Error ? err.message : "Unable to update lead", variant: "destructive" });
                                    }
                                  }}
                                  style={{ fontSize: 13, height: 32, padding: "0 14px" }}
                                >
                                  Mark as Lost
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "12px 16px",
                borderTop: "1px solid var(--border-light)",
              }}
            >
              <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                Showing {totalLeads === 0 ? 0 : paginationStart}–{paginationEnd} of {totalLeads} leads
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <SharedButton
                  variant="secondary"
                  size="sm"
                  icon={ChevronLeft}
                  onClick={() => {
                    if (useSavedFilter && activeFilterId) {
                      void handleSavedFilterPage(filterResultPage - 1);
                    } else {
                      setClientPage((p) => Math.max(1, p - 1));
                    }
                  }}
                  disabled={paginationStart <= 1}
                />
                <SharedButton
                  variant="secondary"
                  size="sm"
                  icon={ChevronRight}
                  onClick={() => {
                    if (useSavedFilter && activeFilterId) {
                      void handleSavedFilterPage(filterResultPage + 1);
                    } else {
                      setClientPage((p) => Math.min(totalPages, p + 1));
                    }
                  }}
                  disabled={paginationEnd >= totalLeads || totalLeads === 0}
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Lead Details Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedDetail
                ? `Lead #${selectedDetail.lead.leadNumber ?? selectedDetail.lead.id}`
                : "Lead Details"}
            </DialogTitle>
            <DialogDescription>
              View and manage lead details, timeline, communications, and workflow
            </DialogDescription>
          </DialogHeader>
          {isLoadingDetail && (
            <p className="text-sm text-muted-foreground">Loading lead details...</p>
          )}
          {!isLoadingDetail && !selectedDetail && (
            <p className="text-sm text-muted-foreground">
              Select a lead from the list to view its details.
            </p>
          )}
          {!isLoadingDetail && selectedDetail && (
            <Tabs defaultValue="details" className="w-full">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="timeline">Timeline</TabsTrigger>
                <TabsTrigger value="emails">Emails</TabsTrigger>
                <TabsTrigger value="quotations">Quotations</TabsTrigger>
                <TabsTrigger value="workflow">Workflow</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-4 text-sm mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      Lead #{selectedDetail.lead.leadNumber ?? selectedDetail.lead.id}
                    </p>
                    <p className="text-muted-foreground">
                      Source: {selectedDetail.lead.source} • Type: {selectedDetail.lead.leadType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={statusBadgeVariant(selectedDetail.lead.status)}>
                      {selectedDetail.lead.status}
                    </Badge>
                    <Badge variant="outline">Heat: {selectedDetail.lead.heatLevel}</Badge>
                  </div>
                </div>

                {/* Quick Schedule Actions */}
                <div className="flex flex-wrap gap-2 p-3 bg-muted/30 rounded-lg border">
                  <span className="text-xs text-muted-foreground self-center mr-2">Quick Schedule:</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setSchedulingLead(selectedDetail.lead as Lead);
                      setScheduleType("call");
                      setIsScheduleDialogOpen(true);
                    }}
                  >
                    <Phone className="h-3 w-3 mr-1 text-green-600" />
                    Call
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setSchedulingLead(selectedDetail.lead as Lead);
                      setScheduleType("email");
                      setIsScheduleDialogOpen(true);
                    }}
                  >
                    <Mail className="h-3 w-3 mr-1 text-blue-600" />
                    Email
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setSchedulingLead(selectedDetail.lead as Lead);
                      setScheduleType("whatsapp");
                      setIsScheduleDialogOpen(true);
                    }}
                  >
                    <MessageCircle className="h-3 w-3 mr-1 text-emerald-600" />
                    WhatsApp
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setQuotationLead(selectedDetail.lead as Lead);
                      setIsQuotationDialogOpen(true);
                    }}
                  >
                    <FileText className="h-3 w-3 mr-1 text-amber-600" />
                    Send Quotation
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8"
                    onClick={() => {
                      setSchedulingLead(selectedDetail.lead as Lead);
                      setScheduleType("meeting");
                      setIsScheduleDialogOpen(true);
                    }}
                  >
                    <Video className="h-3 w-3 mr-1 text-purple-600" />
                    Meeting
                  </Button>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  <div>
                    <p className="text-xs text-muted-foreground">Property</p>
                    <p className="font-medium">
                      {selectedDetail.lead.propertyId ?? "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stay</p>
                    <p className="font-medium">
                      {selectedDetail.lead.checkInDate
                        ? new Date(selectedDetail.lead.checkInDate).toLocaleDateString()
                        : "-"}{" "}
                      –{" "}
                      {selectedDetail.lead.checkOutDate
                        ? new Date(selectedDetail.lead.checkOutDate).toLocaleDateString()
                        : "-"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Rooms / Guests</p>
                    <p className="font-medium">
                      {selectedDetail.lead.roomsRequested ?? "-"} rooms •{" "}
                      {selectedDetail.lead.guests?.adults ?? 0} adults /{" "}
                      {selectedDetail.lead.guests?.children ?? 0} children
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Created at</p>
                    <p className="font-medium">
                      {selectedDetail.lead.createdAt
                        ? new Date(selectedDetail.lead.createdAt).toLocaleString()
                        : "-"}
                    </p>
                  </div>
                  {selectedDetail.lead.accountId && (
                    <div>
                      <p className="text-xs text-muted-foreground">Account</p>
                      <p className="font-medium">
                        {typeof selectedDetail.lead.accountId === "object" && selectedDetail.lead.accountId !== null
                          ? (selectedDetail.lead.accountId as any).name || "-"
                          : "-"}
                        {typeof selectedDetail.lead.accountId === "object" && selectedDetail.lead.accountId !== null && (selectedDetail.lead.accountId as any).type && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({(selectedDetail.lead.accountId as any).type.replace(/_/g, " ")})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  {selectedDetail.lead.occasion && (
                    <div className="md:col-span-2">
                      <p className="text-xs text-muted-foreground">Occasion</p>
                      <p className="font-medium">{selectedDetail.lead.occasion}</p>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="timeline" className="mt-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Activities & Communications
                  </p>
                  <ScrollArea className="h-80 rounded-md border p-3">
                    <div className="space-y-3">
                      {selectedDetail.activities.map((a) => (
                        <div
                          key={a._id}
                          className="rounded border bg-muted/50 p-2"
                        >
                          <p className="text-xs font-semibold">Activity: {a.type}</p>
                          {a.note && (
                            <p className="text-xs text-muted-foreground">{a.note}</p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {a.performedAt
                              ? new Date(a.performedAt).toLocaleString()
                              : ""}
                          </p>
                        </div>
                      ))}
                      {selectedDetail.communications.map((c) => (
                        <div
                          key={c._id}
                          className="rounded border bg-muted/30 p-2"
                        >
                          <p className="text-xs font-semibold">
                            {c.channel} • {c.direction}
                          </p>
                          {c.summary && (
                            <p className="text-xs text-muted-foreground">
                              {c.summary}
                            </p>
                          )}
                          <p className="text-[11px] text-muted-foreground">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleString()
                              : ""}
                          </p>
                        </div>
                      ))}
                      {selectedDetail.activities.length === 0 &&
                        selectedDetail.communications.length === 0 && (
                          <p className="text-xs text-muted-foreground">
                            No timeline entries yet for this lead.
                          </p>
                        )}
                    </div>
                  </ScrollArea>
                </div>
              </TabsContent>

              <TabsContent value="emails" className="mt-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Emails related to this lead
                    </p>
                    <Button
                      size="sm"
                      onClick={() => setIsComposeEmailOpen(true)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Compose Email
                    </Button>
                  </div>
                  {isLoadingEmails ? (
                    <div className="text-center py-8 text-muted-foreground">Loading emails...</div>
                  ) : leadEmails.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No emails found for this lead
                    </div>
                  ) : (
                    <ScrollArea className="h-80 rounded-md border p-3">
                      <div className="space-y-3">
                        {leadEmails.map((email) => (
                          <Card key={email.id}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {email.from.name || email.from.email}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {email.subject}
                                  </p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {email.folder}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                                {email.snippet}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {email.receivedAt || email.sentAt
                                  ? new Date(email.receivedAt || email.sentAt || "").toLocaleString()
                                  : ""}
                              </p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="quotations" className="mt-4">
                <QuotationsTab
                  leadId={selectedDetail.lead.id}
                  onSendNew={() => {
                    setQuotationLead(selectedDetail.lead as Lead);
                    setIsQuotationDialogOpen(true);
                  }}
                />
              </TabsContent>

              <TabsContent value="workflow" className="mt-4">
                <LeadWorkflowDisplay leadId={selectedDetail.lead.id} />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Compose Email Dialog */}
      <EmailComposer
        open={isComposeEmailOpen}
        onOpenChange={setIsComposeEmailOpen}
        onSend={async (payload) => {
          try {
            // Use lead-specific endpoint if a lead is selected, otherwise use generic endpoint
            if (selectedLeadId) {
              await sendEmailFromLead(selectedLeadId, payload);
            } else {
              await sendEmail(payload);
            }
            toast({
              title: "Success",
              description: "Email sent successfully",
            });
            setIsComposeEmailOpen(false);
            if (selectedLeadId) {
              void loadLeadEmails(selectedLeadId);
            }
          } catch (err) {
            toast({
              title: "Error",
              description: err instanceof Error ? err.message : "Failed to send email",
              variant: "destructive",
            });
          }
        }}
      />

      {/* Assign Lead Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Lead</DialogTitle>
            <DialogDescription>
              Choose a user to assign this lead to
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Choose a user to assign this lead to.
            </p>
            <div className="space-y-2">
              <label className="text-xs font-medium">Assignee</label>
              <Select
                value={assignUserId}
                onValueChange={setAssignUserId}
                disabled={isLoadingUsers}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      isLoadingUsers ? "Loading users..." : "Select user"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!assigningLeadId || !assignUserId || isAssigning}
                onClick={async () => {
                  if (!assigningLeadId || !assignUserId) return;
                  try {
                    setIsAssigning(true);
                    const updated = await updateLead(assigningLeadId, {
                      assignedToUserId: assignUserId,
                    });
                    setLeads((prev) =>
                      prev.map((l) => (l.id === updated.id ? updated : l))
                    );
                    if (selectedLeadId === updated.id) {
                      const detail = await getLeadDetail(updated.id);
                      setSelectedDetail(detail);
                    }
                    toast({
                      title: "Lead assigned",
                      description:
                        "Lead has been assigned to the selected user.",
                    });
                    setIsAssignDialogOpen(false);
                    setAssigningLeadId(null);
                  } catch (err) {
                    const description =
                      err instanceof Error
                        ? err.message
                        : "Unable to assign lead";
                    toast({
                      title: "Error",
                      description,
                      variant: "destructive",
                    });
                  } finally {
                    setIsAssigning(false);
                  }
                }}
              >
                {isAssigning ? "Assigning..." : "Assign"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Lead</DialogTitle>
            <DialogDescription>
              Create a new lead with comprehensive details for better tracking and conversion
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Guest Name Section */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Guest First Name *</label>
                <Input
                  value={form.firstName}
                  onChange={(e) => onChange("firstName", e.target.value)}
                  placeholder="Guest First Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Guest Middle Name</label>
                <Input
                  value={form.middleName}
                  onChange={(e) => onChange("middleName", e.target.value)}
                  placeholder="Guest Middle Name"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Guest Last Name *</label>
                <Input
                  value={form.lastName}
                  onChange={(e) => onChange("lastName", e.target.value)}
                  placeholder="Guest Last Name"
                />
              </div>
            </div>

            {/* Multiple Hotels Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <Hotel className="h-4 w-4" />
                  Hotel Bookings
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addHotel}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Another Hotel
                </Button>
              </div>

              {hotels.map((hotel, index) => (
                <div key={index} className="relative p-4 border rounded-lg bg-muted/30 space-y-4">
                  {hotels.length > 1 && (
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">Hotel {index + 1}</Badge>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeHotel(index)}
                        className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-medium">Hotel Name</label>
                    <Select
                      value={hotel.hotelName || undefined}
                      onValueChange={(value) => updateHotel(index, "hotelName", value === "NONE" ? "" : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Hotel (Optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">None</SelectItem>
                        <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                        <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                        <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                        <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Check In Date *</label>
                      <Input
                        type="date"
                        value={hotel.checkInDate}
                        onChange={(e) => updateHotel(index, "checkInDate", e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Check Out Date *</label>
                      <Input
                        type="date"
                        value={hotel.checkOutDate}
                        min={hotel.checkInDate || undefined}
                        onChange={(e) => updateHotel(index, "checkOutDate", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Multiple rooms per hotel */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-medium flex items-center gap-2">
                        <BedDouble className="h-3 w-3" />
                        Rooms
                      </h4>
                      <Button type="button" variant="outline" size="sm" onClick={() => addRoom(index)} className="h-7 text-xs">
                        <Plus className="h-3 w-3 mr-1" />
                        Add Room
                      </Button>
                    </div>
                    {hotel.rooms.map((room, roomIdx) => (
                      <div key={roomIdx} className="pl-3 border-l-2 border-muted space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Room {roomIdx + 1}</span>
                          {hotel.rooms.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeRoom(index, roomIdx)}
                              className="h-6 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <div className="grid gap-3 md:grid-cols-4">
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Room Category *</label>
                            <Select
                              value={room.roomCategory}
                              onValueChange={(v) => updateRoom(index, roomIdx, "roomCategory", v)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue placeholder="Select" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Standard Room">Standard Room</SelectItem>
                                <SelectItem value="Deluxe Room">Deluxe Room</SelectItem>
                                <SelectItem value="Suite">Suite</SelectItem>
                                <SelectItem value="Villa">Villa</SelectItem>
                                <SelectItem value="Pool Villa">Pool Villa</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Preference</label>
                            <Input
                              className="h-8"
                              value={room.roomPreference}
                              onChange={(e) => updateRoom(index, roomIdx, "roomPreference", e.target.value)}
                              placeholder="e.g. Sea view"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Adults *</label>
                            <Input
                              type="number"
                              min="0"
                              className="h-8"
                              value={room.adults}
                              onChange={(e) => updateRoom(index, roomIdx, "adults", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Children</label>
                            <Input
                              type="number"
                              min="0"
                              className="h-8"
                              value={room.children}
                              onChange={(e) => updateRoom(index, roomIdx, "children", e.target.value)}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Contact Details */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">Guest Contact Number *</label>
                <Input
                  value={form.guestPhone}
                  onChange={(e) => onChange("guestPhone", e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Alternate Contact</label>
                <Input
                  value={form.alternateContact}
                  onChange={(e) => onChange("alternateContact", e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">Guest Email *</label>
                <Input
                  type="email"
                  value={form.guestEmail}
                  onChange={(e) => onChange("guestEmail", e.target.value)}
                  placeholder="guest@example.com"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Occupation</label>
                <Input
                  value={form.occupation}
                  onChange={(e) => onChange("occupation", e.target.value)}
                  placeholder="e.g., Business, Professional"
                />
              </div>
            </div>

            {/* Special Requests */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Special Requests</label>
              <Textarea
                rows={3}
                value={form.specialRequests}
                onChange={(e) => onChange("specialRequests", e.target.value)}
                placeholder="Any special requirements, dietary restrictions, accessibility needs..."
              />
            </div>

            {/* Corporate Booking Section */}
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center gap-4">
                <label className="text-xs font-medium">Is this a Corporate Booking?</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="corporateBooking"
                      value="yes"
                      checked={form.isCorporateBooking === "yes"}
                      onChange={() => onChange("isCorporateBooking", "yes")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">Yes</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="corporateBooking"
                      value="no"
                      checked={form.isCorporateBooking === "no"}
                      onChange={() => onChange("isCorporateBooking", "no")}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">No</span>
                  </label>
                </div>
              </div>

              {form.isCorporateBooking === "yes" && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Company Name</label>
                    <Input
                      value={form.companyName}
                      onChange={(e) => onChange("companyName", e.target.value)}
                      placeholder="Company Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">GSTIN</label>
                    <Input
                      value={form.gstin}
                      onChange={(e) => onChange("gstin", e.target.value)}
                      placeholder="GSTIN Number"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Lead Type and Source */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium">Lead Type *</label>
                <Select
                  value={form.leadType}
                  onValueChange={(value) => onChange("leadType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select lead type" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Source *</label>
                <Select
                  value={form.source}
                  onValueChange={(value) => {
                    onChange("source", value);
                    // Reset account selection when source changes to non-B2B sources
                    if (value !== "TRAVEL_AGENT" && value !== "CORPORATE_OFFICE" && value !== "EVENT_MICE") {
                      setSelectedAccountId("");
                      setForm((prev) => ({ ...prev, accountId: "" }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEAD_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tag Dimensions (SOP 1.2, 1.3, 1.5 fields) */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-xs font-medium">Customer Type</label>
                <Select
                  value={form.customerType}
                  onValueChange={(value) => onChange("customerType", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="B2C">B2C</SelectItem>
                    <SelectItem value="B2B">B2B</SelectItem>
                    <SelectItem value="Corporate">Corporate</SelectItem>
                    <SelectItem value="Influencer">Influencer</SelectItem>
                    <SelectItem value="NRI">NRI</SelectItem>
                    <SelectItem value="HNI">HNI</SelectItem>
                    <SelectItem value="Reference">Reference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Booking Window</label>
                <Select
                  value={form.bookingWindow}
                  onValueChange={(value) => onChange("bookingWindow", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Booking Window" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Within 5 hrs">Within 5 hrs</SelectItem>
                    <SelectItem value="6-12 hrs">6-12 hrs</SelectItem>
                    <SelectItem value="13-24 hrs">13-24 hrs</SelectItem>
                    <SelectItem value="Next Day">Next Day</SelectItem>
                    <SelectItem value="2-7 days">2-7 days</SelectItem>
                    <SelectItem value="1-4 weeks">1-4 weeks</SelectItem>
                    <SelectItem value="1-3 months">1-3 months</SelectItem>
                    <SelectItem value="3+ months">3+ months</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Budget</label>
                <Input
                  type="number"
                  value={form.budget}
                  onChange={(e) => onChange("budget", e.target.value)}
                  placeholder="Total or per night budget"
                />
              </div>
            </div>

            {/* Dynamic Custom Fields Section */}
            {customFields.length > 0 && (
              <>
                <div className="border-t border-slate-200 mt-6 pt-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Additional Information</h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {customFields.map(field => (
                      <div key={field._id} className="space-y-2">
                        <label className="text-xs font-medium flex gap-1">
                          {field.label} {field.isRequired && <span className="text-red-500">*</span>}
                        </label>
                        {field.dataType === "TEXT" && (
                          <Input
                            placeholder={field.label}
                            value={form.customData[field.fieldName] || ""}
                            onChange={e => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: e.target.value } }))}
                          />
                        )}
                        {field.dataType === "NUMBER" && (
                          <Input
                            type="number"
                            placeholder={field.label}
                            value={form.customData[field.fieldName] || ""}
                            onChange={e => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: Number(e.target.value) || "" } }))}
                          />
                        )}
                        {field.dataType === "TEXTAREA" && (
                          <Textarea
                            placeholder={field.label}
                            value={form.customData[field.fieldName] || ""}
                            onChange={e => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: e.target.value } }))}
                          />
                        )}
                        {field.dataType === "DATE" && (
                          <Input
                            type="date"
                            value={form.customData[field.fieldName] || ""}
                            onChange={e => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: e.target.value } }))}
                          />
                        )}
                        {field.dataType === "BOOLEAN" && (
                          <div className="flex items-center h-10 space-x-2">
                            <Switch
                              checked={!!form.customData[field.fieldName]}
                              onCheckedChange={checked => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: checked } }))}
                            />
                          </div>
                        )}
                        {field.dataType === "DROPDOWN" && (
                          <Select
                            value={form.customData[field.fieldName] || ""}
                            onValueChange={value => setForm(prev => ({ ...prev, customData: { ...prev.customData, [field.fieldName]: value } }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${field.label}`} />
                            </SelectTrigger>
                            <SelectContent>
                              {field.options?.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Account Selection - Show for B2B sources */}
            {(form.source === "TRAVEL_AGENT" ||
              form.source === "CORPORATE_OFFICE" ||
              form.source === "EVENT_MICE" ||
              form.isCorporateBooking === "yes") && (
                <div className="space-y-2 border rounded-lg p-4 bg-slate-50/50">
                  <label className="text-xs font-medium">
                    Account {form.source === "TRAVEL_AGENT" || form.source === "CORPORATE_OFFICE" || form.source === "EVENT_MICE" ? "(Optional - will auto-link if company name matches)" : "(Optional)"}
                  </label>
                  {isLoadingAccounts ? (
                    <p className="text-xs text-muted-foreground">Loading accounts...</p>
                  ) : (
                    <Select
                      value={selectedAccountId || form.accountId || undefined}
                      onValueChange={(value) => {
                        // Handle "none" value to clear selection
                        if (value === "none") {
                          setSelectedAccountId("");
                          setForm((prev) => ({ ...prev, accountId: "" }));
                        } else {
                          setSelectedAccountId(value);
                          setForm((prev) => ({ ...prev, accountId: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select account (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (Create without account)</SelectItem>
                        {filteredAccounts.length > 0 ? (
                          filteredAccounts
                            .map((account) => {
                              const accountId = account.id || (account as any)._id;
                              // Skip accounts without valid ID or with empty string ID
                              if (!accountId || accountId === "") return null;
                              const accountName = account.name || "Unnamed Account";
                              const accountType = account.type ? account.type.replace(/_/g, " ") : "";
                              return (
                                <SelectItem key={accountId} value={accountId}>
                                  <div className="flex items-center justify-between gap-4">
                                    <span>{accountName}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {accountType}
                                      {account.city && ` • ${account.city}`}
                                    </span>
                                  </div>
                                </SelectItem>
                              );
                            })
                            .filter((item) => item !== null)
                        ) : (
                          <div className="px-2 py-1.5 text-sm text-muted-foreground">
                            No accounts available
                          </div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {form.source === "TRAVEL_AGENT" || form.source === "CORPORATE_OFFICE" || form.source === "EVENT_MICE"
                      ? "If you enter a company name below and it matches an existing account, the lead will be automatically linked."
                      : "Link this lead to an existing account for better relationship tracking."}
                  </p>
                </div>
              )}

            {/* Estimated Value */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Estimated Booking Value</label>
              <Input
                value={form.estimatedValue}
                onChange={(e) => onChange("estimatedValue", e.target.value)}
                placeholder="e.g., ₹25,000"
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-xs font-medium">Notes</label>
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => onChange("notes", e.target.value)}
                placeholder="Enter any additional notes..."
              />
            </div>

            {/* Assignment Mode Section */}
            <div className="border rounded-lg p-4 space-y-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Assignment Mode</Label>
                  <p className="text-xs text-muted-foreground">
                    {assignmentMode === "auto"
                      ? "Lead will be auto-assigned to the user with least workload"
                      : "Manually select a user to assign this lead to"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs ${assignmentMode === "auto" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    <Zap className="h-3 w-3 inline mr-1" />
                    Auto
                  </span>
                  <Switch
                    checked={assignmentMode === "manual"}
                    onCheckedChange={(checked) => {
                      setAssignmentMode(checked ? "manual" : "auto");
                      if (!checked) {
                        setManualAssigneeId("");
                      }
                    }}
                  />
                  <span className={`text-xs ${assignmentMode === "manual" ? "text-primary font-medium" : "text-muted-foreground"}`}>
                    <Users className="h-3 w-3 inline mr-1" />
                    Manual
                  </span>
                </div>
              </div>

              {assignmentMode === "manual" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium">Select Assignee</label>
                  {isLoadingEligible ? (
                    <p className="text-xs text-muted-foreground">Loading eligible users...</p>
                  ) : eligibleAssignees.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No assignment rule configured for this lead type. Create a rule in Lead Assignment Rules first.
                    </p>
                  ) : (
                    <Select
                      value={manualAssigneeId}
                      onValueChange={setManualAssigneeId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleAssignees.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex items-center justify-between w-full gap-4">
                              <span>{user.name}</span>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className={user.isOnline ? "text-green-600" : "text-gray-400"}>
                                  {user.isOnline ? "● Online" : "○ Offline"}
                                </span>
                                <span>({user.openLeadCount} leads)</span>
                              </div>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  try {
                    await handleCreate();
                    // Dialog will be closed in handleCreate on success
                  } catch (err) {
                    // Error is already handled in handleCreate, dialog stays open
                    // User can fix errors and try again
                  }
                }}
                disabled={isCreating}
              >
                {isCreating ? "Creating..." : "Create Lead"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <ScheduleFollowUpDialog
        open={isScheduleDialogOpen}
        onOpenChange={(open) => {
          setIsScheduleDialogOpen(open);
          if (!open) {
            setSchedulingLead(null);
          }
        }}
        leadId={schedulingLead?.id}
        leadNumber={schedulingLead?.leadNumber}
        defaultFollowUpType={scheduleType}
        pauseWorkflowOnSchedule={true}
        onSuccess={() => {
          toast({
            title: "Success",
            description: `${scheduleType === "meeting" ? "Meeting" : "Follow-up"} scheduled successfully`,
          });
        }}
      />

      {/* Send Quotation Dialog */}
      <SendQuotationDialog
        open={isQuotationDialogOpen}
        onOpenChange={(open) => {
          setIsQuotationDialogOpen(open);
          if (!open) {
            setQuotationLead(null);
          }
        }}
        lead={quotationLead}
        leadDetail={selectedDetail}
        onQuotationSent={() => {
          toast({
            title: "Success",
            description: "Quotation sent successfully",
          });
          // Reload lead details to reflect the new quotation
          if (quotationLead?.id) {
            void selectLead(quotationLead.id);
          }
        }}
      />
    </div >
  );
};


