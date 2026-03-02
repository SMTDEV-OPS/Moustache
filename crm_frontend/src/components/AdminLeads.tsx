import { useEffect, useMemo, useState, useCallback } from "react";
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
import { listUsers, User } from "@/services/users";
import { listAccounts, Account, AccountType } from "@/services/accounts";
import { Search, Filter, User as UserIcon, Calendar, Flame, Users, Zap, Plus, Phone, Mail, MessageCircle, CalendarPlus, Video, Trash2, Hotel, MoreVertical, FileText, Edit, UserPlus } from "lucide-react";
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

// Quotations Tab Component
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

  const [activeScope, setActiveScope] = useState<"own" | "team" | "all">("own");

  // Strict permission checks - users must have explicit permissions
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

  // Hotel entry type for multiple hotels
  interface HotelEntry {
    hotelName: string;
    checkInDate: string;
    checkOutDate: string;
    roomCategory: string;
    roomPreference: string;
    rooms: string;
    adults: string;
    children: string;
  }

  const emptyHotel: HotelEntry = {
    hotelName: "",
    checkInDate: "",
    checkOutDate: "",
    roomCategory: "",
    roomPreference: "",
    rooms: "1",
    adults: "",
    children: "",
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

  const updateHotel = (index: number, field: keyof HotelEntry, value: string) => {
    const updated = [...hotels];
    updated[index] = { ...updated[index], [field]: value };
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
  });

  // Assignment mode state
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>("auto");
  const [manualAssigneeId, setManualAssigneeId] = useState<string>("");
  const [eligibleAssignees, setEligibleAssignees] = useState<EligibleAssignee[]>([]);
  const [isLoadingEligible, setIsLoadingEligible] = useState(false);

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
    void loadLeads();
    if (canManageUsers) {
      void loadUsers();
    }
    // Load accounts on mount, but don't fail if it errors
    loadAccounts().catch((err) => {
      console.error("Failed to load accounts on mount:", err);
      // Set empty array as fallback
      setAccounts([]);
    });
  }, [canManageUsers, activeScope]);

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
  }, [leads, users, statusFilter, heatFilter, sourceFilter, assigneeFilter, searchQuery]);

  const resetFilters = () => {
    setStatusFilter("ALL");
    setHeatFilter("ALL");
    setSourceFilter("ALL");
    setAssigneeFilter("ALL");
    setSearchQuery("");
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

    // Get primary hotel data
    const primaryHotel = hotels[0];

    try {
      setIsCreating(true);

      const payload = {
        guestContact: {
          name: guestFullName,
          phone: form.guestPhone || undefined,
          email: form.guestEmail || undefined,
        },
        propertyId: (form.propertyId || (primaryHotel?.hotelName && primaryHotel.hotelName !== "" ? primaryHotel.hotelName : undefined)) || undefined,
        accountId: form.accountId || selectedAccountId || undefined,
        source: form.source,
        leadType: form.leadType,
        checkInDate: primaryHotel?.checkInDate
          ? new Date(primaryHotel.checkInDate).toISOString()
          : undefined,
        checkOutDate: primaryHotel?.checkOutDate
          ? new Date(primaryHotel.checkOutDate).toISOString()
          : undefined,
        roomsRequested: primaryHotel?.rooms ? Number(primaryHotel.rooms) : (hotels.length || undefined),
        guests: (primaryHotel?.adults || primaryHotel?.children)
          ? {
            adults: primaryHotel.adults ? Number(primaryHotel.adults) : undefined,
            children: primaryHotel.children ? Number(primaryHotel.children) : undefined,
          }
          : undefined,
        occasion: form.occasion || undefined,
        heatLevel: form.heatLevel as any,
        // Additional form fields - send separately
        alternateContact: form.alternateContact || undefined,
        occupation: form.occupation || undefined,
        specialRequests: form.specialRequests || undefined,
        isCorporateBooking: form.isCorporateBooking === "yes" ? true : undefined,
        companyName: form.companyName || undefined,
        gstin: form.gstin || undefined,
        estimatedValue: form.estimatedValue || undefined,
        notes: form.notes || undefined,
        roomCategory: primaryHotel?.roomCategory || undefined,
        roomPreference: primaryHotel?.roomPreference || undefined,
        customerType: form.customerType || undefined,
        bookingWindow: form.bookingWindow || undefined,
        budget: form.budget ? Number(form.budget) : undefined,
        // Assignment options
        assignmentMode: assignmentMode,
        assignedToUserId: assignmentMode === "manual" && manualAssigneeId ? manualAssigneeId : undefined,
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
      const checkIn = new Date(lead.checkInDate).toISOString().split('T')[0];
      return checkIn;
    }
    return "—";
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Leads</h1>
          <p className="text-slate-500 mt-1">Manage and track all hotel inquiries</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs
            value={activeScope}
            onValueChange={(value) =>
              setActiveScope(value as "own" | "team" | "all")
            }
          >
            <TabsList className="h-10">
              {canViewOwn && (
                <TabsTrigger value="own" className="px-4">My Leads</TabsTrigger>
              )}
              {canViewTeam && (
                <TabsTrigger value="team" className="px-4">My Team Leads</TabsTrigger>
              )}
              {canViewAll && (
                <TabsTrigger value="all" className="px-4">All Leads</TabsTrigger>
              )}
            </TabsList>
          </Tabs>
          <Button
            size="default"
            onClick={() => setIsCreateDialogOpen(true)}
            className="h-10 font-medium bg-slate-900 hover:bg-slate-800 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Lead
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, email, phone..."
                className="pl-10 h-10 border-slate-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={setStatusFilter}
            >
              <SelectTrigger className="w-[140px] h-10 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="NEW">New</SelectItem>
                <SelectItem value="CONTACTED">Contacted</SelectItem>
                <SelectItem value="QUOTATION_SHARED">Quotation Shared</SelectItem>
                <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="LOST">Lost</SelectItem>
                <SelectItem value="CLOSED_AUTO">Auto Closed</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={heatFilter}
              onValueChange={setHeatFilter}
            >
              <SelectTrigger className="w-[140px] h-10 border-slate-200">
                <SelectValue placeholder="Heat Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Heat</SelectItem>
                <SelectItem value="HOT">Hot</SelectItem>
                <SelectItem value="WARM">Warm</SelectItem>
                <SelectItem value="COLD">Cold</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={sourceFilter}
              onValueChange={setSourceFilter}
            >
              <SelectTrigger className="w-[150px] h-10 border-slate-200">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sources</SelectItem>
                {Array.from(new Set(leads.map(l => l.source))).map((source) => (
                  <SelectItem key={source} value={source}>
                    {source.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          {isLoadingList ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">Loading leads...</p>
            </div>
          ) : filteredLeads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-4 opacity-50" />
              <p className="text-base font-medium text-slate-900 mb-1">No leads found</p>
              <p className="text-sm text-slate-500 mb-4">
                {searchQuery || statusFilter !== "ALL" || heatFilter !== "ALL" || sourceFilter !== "ALL"
                  ? "Try adjusting your filters"
                  : "Create your first lead to get started"}
              </p>
              {!searchQuery && statusFilter === "ALL" && heatFilter === "ALL" && sourceFilter === "ALL" && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="mt-2 bg-slate-900 hover:bg-slate-800">
                  <Plus className="h-4 w-4 mr-2" />
                  New Lead
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Guest</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Hotel</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Travel Dates</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Heat</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="text-left p-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLeads.map((lead) => {
                    const assignedUser = users.find((u) => u.id === lead.assignedToUserId);
                    const guestName = getGuestName(lead);
                    const guestPhone = getGuestPhone(lead);
                    const propertyName = getPropertyName(lead);
                    const travelDates = formatTravelDates(lead);

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => void selectLead(lead.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-slate-900 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                              {guestName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">{guestName}</p>
                              {guestPhone && (
                                <p className="text-sm text-slate-500 truncate">{guestPhone}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-slate-600">{propertyName}</td>
                        <td className="p-4 text-slate-600 capitalize">{lead.source.replace(/_/g, " ")}</td>
                        <td className="p-4 text-slate-600">
                          {travelDates !== "—" ? (
                            <span className="font-mono text-sm">{travelDates}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {getHeatIcon(lead.heatLevel)}
                            <Badge variant="outline" className={`${getHeatBadgeColor(lead.heatLevel)} text-xs font-medium`}>
                              {lead.heatLevel.toLowerCase()}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className={`${getStatusBadgeColor(lead.status)} text-xs font-medium`}>
                            {lead.status.replace(/_/g, " ").toLowerCase()}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {assignedUser ? assignedUser.name || assignedUser.email : "Unassigned"}
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                              <DropdownMenuItem
                                onClick={() => {
                                  void selectLead(lead.id);
                                }}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setSchedulingLead(lead);
                                  setScheduleType("call");
                                  setIsScheduleDialogOpen(true);
                                }}
                              >
                                <Phone className="h-4 w-4 mr-2 text-green-600" />
                                Schedule Call
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setQuotationLead(lead);
                                  setIsQuotationDialogOpen(true);
                                }}
                              >
                                <FileText className="h-4 w-4 mr-2 text-amber-600" />
                                Send Quotation
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setAssigningLeadId(lead.id);
                                  setAssignUserId(lead.assignedToUserId ?? "");
                                  setIsAssignDialogOpen(true);
                                }}
                              >
                                <UserPlus className="h-4 w-4 mr-2 text-indigo-600" />
                                Assign Lead
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
                        <SelectItem value="Moustache Goa">Moustache Goa</SelectItem>
                        <SelectItem value="Moustache Kerala">Moustache Kerala</SelectItem>
                        <SelectItem value="Moustache Rajasthan">Moustache Rajasthan</SelectItem>
                        <SelectItem value="Moustache Mumbai">Moustache Mumbai</SelectItem>
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
                        onChange={(e) => updateHotel(index, "checkOutDate", e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Number of Rooms *</label>
                      <Input
                        type="number"
                        min="1"
                        value={hotel.rooms}
                        onChange={(e) => updateHotel(index, "rooms", e.target.value)}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Room Category *</label>
                      <Select
                        value={hotel.roomCategory}
                        onValueChange={(value) => updateHotel(index, "roomCategory", value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Room Category" />
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
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Room Preference</label>
                      <Input
                        value={hotel.roomPreference}
                        onChange={(e) => updateHotel(index, "roomPreference", e.target.value)}
                        placeholder="e.g., Sea view, Garden view"
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Adults *</label>
                      <Input
                        type="number"
                        min="0"
                        value={hotel.adults}
                        onChange={(e) => updateHotel(index, "adults", e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Children</label>
                      <Input
                        type="number"
                        min="0"
                        value={hotel.children}
                        onChange={(e) => updateHotel(index, "children", e.target.value)}
                        placeholder="0"
                      />
                    </div>
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
                    <SelectItem value="Within 24 hrs">Within 24 hrs</SelectItem>
                    <SelectItem value="Yet to decide final plan">Yet to decide final plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium">Auto-Tag Budget</label>
                <Input
                  type="number"
                  value={form.budget}
                  onChange={(e) => onChange("budget", e.target.value)}
                  placeholder="e.g. 15000"
                />
              </div>
            </div>

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
              <label className="text-xs font-medium">Estimated Value</label>
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
    </div>
  );
};


