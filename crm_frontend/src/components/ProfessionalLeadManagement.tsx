import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Search, Filter, Plus, Mail, Calendar as CalendarIcon, Clock, User as UserIcon, TrendingUp, Eye, Users, AlertTriangle, FileText, Edit, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { calculateStayNights, formatInr, parseDealAmount } from "@/lib/leadDates";
import { EmailDialog } from "@/components/communication/EmailDialog";
import {
  listLeads,
  Lead,
  getLeadContactInfo,
  getLeadDetail,
  updateLead,
  type LeadDetail,
  type HeatLevel,
} from "@/services/leads";
import { LeadDetailPage } from "@/components/LeadDetailPage";
import { EditLeadDetailsDialog, type LeadTripDetails } from "@/components/EditLeadDetailsDialog";
import { listUsers, User } from "@/services/users";
import { PipelineService, PipelineStage } from "@/services/pipelines";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SendQuotationDialog } from "@/components/SendQuotationDialog";
import { AddLeadWizard } from "@/components/leads/AddLeadWizard";
import { useLeadForm } from "@/components/leads/useLeadForm";

interface ProfessionalLeadManagementProps {
  userRole: string;
  userName: string;
  backendUserId?: string;
  permissions?: string[];
}

const ProfessionalLeadManagement = ({
  userRole,
  userName,
  backendUserId,
  permissions,
}: ProfessionalLeadManagementProps) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [viewLeadId, setViewLeadId] = useState<string | null>(null);
  const [editLeadDetail, setEditLeadDetail] = useState<LeadDetail | null>(null);
  const [isEditLeadOpen, setIsEditLeadOpen] = useState(false);
  const [isLoadingEditLead, setIsLoadingEditLead] = useState(false);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get("q") || "");
  const [selectedFilters, setSelectedFilters] = useState({
    status: "all",

    stage: "all",
    source: "all",
    property: "all",
    temperature: "all",
    bookingType: "all",
    assignedTo: userRole === 'callcenter' ? userName : "all"
  });

  const [scope, setScope] = useState<"own" | "team">("own");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const {
    form,
    hotelFields,
    hotelOptions,
    customFields,
    customData,
    setCustomData,
    isSubmitting,
    addNewHotel,
    removeHotel,
    addRoom,
    removeRoom,
    refreshCustomFields,
    resetForm,
    submitLead,
  } = useLeadForm();

  const canViewTeamLeads =
    !!permissions?.includes("leads.view.team") ||
    !!permissions?.includes("leads.manage");

  const agentName = userRole === 'callcenter' ? userName : '';

  const sortedPipelineStages = useMemo(
    () => [...pipelineStages].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [pipelineStages]
  );

  useEffect(() => {
    if (!backendUserId) {
      setLeads([]);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoadingLeads(true);
        setLoadError(null);
        const [leadData, usersData] = await Promise.all([
          listLeads({ scope }),
          listUsers(),
        ]);
        setLeads(leadData);
        setUserList(usersData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load leads";
        setLoadError(message);
        const anyToast = toast as any;
        if (typeof anyToast.error === "function") {
          anyToast.error(message);
        } else {
          toast(message);
        }
      } finally {
        setIsLoadingLeads(false);
      }
    };

    void fetchData();

    const fetchStages = async () => {
      try {
        setIsLoadingStages(true);
        const defaultPipeline = await PipelineService.getDefaultPipeline("leads");
        if (defaultPipeline) {
          setPipelineStages(defaultPipeline.stages);
        }
      } catch (err) {
        console.error("Failed to fetch pipeline stages", err);
      } finally {
        setIsLoadingStages(false);
      }
    };
    void fetchStages();
    void refreshCustomFields();
  }, [backendUserId, scope]);

  useEffect(() => {
    if (isAddLeadOpen) void refreshCustomFields();
  }, [isAddLeadOpen]);

  useEffect(() => {
    const handleOpenAddLead = () => {
      setIsAddLeadOpen(true);
    };
    window.addEventListener("crm:open-add-lead", handleOpenAddLead);
    return () => window.removeEventListener("crm:open-add-lead", handleOpenAddLead);
  }, []);

  // Open wizard after navigation from TopBar / Call Center (event may fire before mount)
  useEffect(() => {
    if (sessionStorage.getItem("crm:pending-add-lead") === "1") {
      sessionStorage.removeItem("crm:pending-add-lead");
      setIsAddLeadOpen(true);
    }
  }, []);

  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailLead, setEmailLead] = useState<{ name: string; email: string } | null>(null);
  const [showQuotationDialog, setShowQuotationDialog] = useState(false);
  const [quotationLead, setQuotationLead] = useState<Lead | null>(null);
  const [quotationContext, setQuotationContext] = useState<{
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    propertyName?: string;
  } | null>(null);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [callbackLead, setCallbackLead] = useState<{ name: string } | null>(null);
  const [callbackDate, setCallbackDate] = useState<Date | undefined>(new Date());
  const [callbackTime, setCallbackTime] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");

  const refreshLeads = async () => {
    if (!backendUserId) return;
    try {
      const leadData = await listLeads({ scope });
      setLeads(leadData);
    } catch (err) {
      console.error("Failed to refresh leads", err);
    }
  };

  const displayDate = (value: string) => (value?.trim() ? value : "—");

  const openEditLead = async (leadId: string) => {
    try {
      setIsLoadingEditLead(true);
      const detail = await getLeadDetail(leadId);
      setEditLeadDetail(detail);
      setIsEditLeadOpen(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to load lead for editing");
    } finally {
      setIsLoadingEditLead(false);
    }
  };

  const handleSaveEditLead = async (details: LeadTripDetails) => {
    if (!editLeadDetail?.lead) return;
    const payload = {
      hotels: [
        {
          checkInDate: details.checkInDate,
          checkOutDate: details.checkOutDate,
          numberOfGuests: details.guests
            ? `${details.guests.adults || 0} Adults, ${details.guests.children || 0} Children`
            : `${details.roomsRequested || 1} Rooms`,
        },
      ],
      occasion: details.occasion,
      budget: details.budget ? Number(details.budget) : undefined,
      customerType: details.customerType || undefined,
      bookingWindow: details.bookingWindow || undefined,
      notes: details.notes || undefined,
      source: details.source || undefined,
      heatLevel: (details.heatLevel as HeatLevel) || undefined,
      customData: {
        ...(details.customData || {}),
        ...(details.budget != null && details.budget !== "" && { budget: String(details.budget) }),
        ...(details.customerType && { customer_type: details.customerType }),
        ...(details.bookingWindow && { booking_window: details.bookingWindow }),
      },
    };
    await updateLead(editLeadDetail.lead.id, payload);
    await refreshLeads();
    toast.success("Lead updated");
  };

  // Leads mapped from backend for UI consumption
  const allLeads = leads.map((lead) => {
    const assignedUser = userList.find(
      (u) => u.id === lead.assignedToUserId
    );
    const assignedName =
      assignedUser?.name || assignedUser?.email || "Unassigned";

    let primaryCheckIn = "";
    let primaryCheckOut = "";

    if (lead.itineraries && lead.itineraries.length > 0) {
      // Find earliest check-in
      const sortedItineraries = [...lead.itineraries].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
      });
      const firstItinerary = sortedItineraries[0];
      if (firstItinerary.checkInDate) {
        primaryCheckIn = firstItinerary.checkInDate.slice(0, 10);
      }
      if (firstItinerary.checkOutDate) {
        primaryCheckOut = firstItinerary.checkOutDate.slice(0, 10);
      }
    }

    const checkIn = primaryCheckIn;
    const checkOut = primaryCheckOut;

    const temperature =
      lead.heatLevel === "HOT"
        ? "Hot"
        : lead.heatLevel === "WARM"
          ? "Warm"
          : lead.heatLevel === "COLD"
            ? "Cold"
            : "Cold";

    const dealAmount = parseDealAmount(lead.estimatedValue, lead.budget);
    const nights = calculateStayNights(checkIn, checkOut);

    const stage = pipelineStages.find(s => s._id === lead.stageId);
    const stageName = stage ? stage.name : "N/A";

    const contact = getLeadContactInfo(lead);
    const propertyObj =
      typeof lead.propertyId === "object" && lead.propertyId !== null
        ? (lead.propertyId as { name?: string })
        : null;
    const hotelFromItinerary =
      lead.itineraries?.map((it) => it.hotelName).filter(Boolean).join(" ") || "";
    const propertyName =
      propertyObj?.name ||
      lead.itineraries?.[0]?.hotelName ||
      (typeof lead.propertyId === "string" ? lead.propertyId : "N/A");

    return {
      id: lead.id,
      name: contact.name || lead.leadNumber || lead.id,
      phone: contact.phone,
      email: contact.email,
      property: propertyName,
      bookingSource: lead.bookingSource || "",
      pmsReservationId: lead.pmsReservationId || "",
      companyName: lead.companyName || "",
      hotelNames: hotelFromItinerary,
      source: lead.source,
      checkIn,
      checkOut,
      budget: dealAmount > 0 ? formatInr(dealAmount) : "—",
      dealAmount,
      nights,
      status: lead.status,
      stage: stageName,
      stageId: lead.stageId,
      temperature,
      bookingType: "Direct Customer",
      assignedTo: assignedName,
      lastContact: "",
      nextFollowUp: undefined as string | undefined,
      workingDays: 0,
      workingHours: 0,
      score: lead.score || 0,
      conversationHistory: [] as {
        date: string;
        time: string;
        type: string;
        agent: string;
        notes: string;
        disposition: string;
      }[],
    };
  });

  // Filter leads based on filters
  const filteredLeads = allLeads.filter(lead => {
    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const haystack = [
        lead.name,
        lead.phone,
        lead.email,
        lead.property,
        lead.source,
        lead.bookingSource,
        lead.pmsReservationId,
        lead.companyName,
        lead.hotelNames,
        lead.id,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }

    // Status filter
    if (selectedFilters.status !== "all" && lead.status !== selectedFilters.status) {
      return false;
    }

    // Stage filter
    if (selectedFilters.stage !== "all" && lead.stageId !== selectedFilters.stage) {
      return false;
    }

    // Source filter
    if (selectedFilters.source !== "all" && lead.source !== selectedFilters.source) {
      return false;
    }

    // Property filter
    if (selectedFilters.property !== "all" && lead.property !== selectedFilters.property) {
      return false;
    }

    // Temperature filter
    if (selectedFilters.temperature !== "all" && lead.temperature !== selectedFilters.temperature) {
      return false;
    }

    // Booking type filter
    if (selectedFilters.bookingType !== "all" && lead.bookingType !== selectedFilters.bookingType) {
      return false;
    }

    // Assigned to filter (for managers)
    if (selectedFilters.assignedTo !== "all" && lead.assignedTo !== selectedFilters.assignedTo) {
      return false;
    }

    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTemperatureColor = (temperature: string) => {
    switch (temperature) {
      case "Hot":
        return "bg-red-100 text-red-800 border-red-200";
      case "Warm":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Cold":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBookingTypeColor = (bookingType: string) => {
    switch (bookingType) {
      case "Confirmed Booking":
        return "bg-green-100 text-green-800 border-green-200";
      case "Tentative Booking":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Corporate Booking":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Amendment":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Direct Customer":
        return "bg-teal-100 text-teal-800 border-teal-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const clearFilters = () => {
    setSelectedFilters({
      status: "all",
      source: "all",
      stage: "all",
      property: "all",
      temperature: "all",
      bookingType: "all",
      assignedTo: userRole === 'callcenter' ? agentName : "all"
    });
    setSearchQuery("");
  };

  const handleAssignLead = (leadId: string, assignTo: string) => {
    toast.success(`Lead assigned to ${assignTo}`);
    // In real implementation, this would update the lead assignment
  };

  const renderLeadCard = (
    lead: (typeof allLeads)[number],
    options?: { accentBorder?: boolean; showDue?: boolean }
  ) => (
    <Card
      key={lead.id}
      className={cn(
        "hover:shadow-md transition-shadow",
        options?.accentBorder && "border-l-4 border-l-orange-500"
      )}
    >
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 flex-1 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0 space-y-1">
              <h3 className="font-semibold text-lg truncate">{lead.name}</h3>
              <p className="text-sm text-muted-foreground">{lead.phone || "—"}</p>
              <p className="text-sm text-muted-foreground">
                <span
                  className="underline cursor-pointer hover:text-blue-600"
                  onClick={() => {
                    setEmailLead({ name: lead.name, email: lead.email });
                    setShowEmailDialog(true);
                  }}
                >
                  {lead.email || "—"}
                </span>
              </p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {lead.stage && lead.stage !== "N/A" && (
                  <Badge variant="outline" className="border-blue-200 text-blue-800 bg-blue-50">
                    {lead.stage.replace(/_/g, " ")}
                  </Badge>
                )}
                <Badge className={getTemperatureColor(lead.temperature)}>{lead.temperature}</Badge>
                <Badge className={getBookingTypeColor(lead.bookingType)}>{lead.bookingType}</Badge>
              </div>
            </div>

            <div className="min-w-0 space-y-1">
              <p className="font-medium truncate">{lead.property || "—"}</p>
              <p className="text-sm text-muted-foreground">Check-in: {displayDate(lead.checkIn)}</p>
              <p className="text-sm text-muted-foreground">Check-out: {displayDate(lead.checkOut)}</p>
              <p className="text-sm text-muted-foreground">Guest Budget: {lead.budget}</p>
              <p className="text-sm text-muted-foreground">Total nights: {lead.nights}</p>
              <p className="text-sm font-medium text-green-600">
                Total Deal Value: {formatInr(lead.dealAmount)}
              </p>
            </div>

            <div className="min-w-0 space-y-1">
              <p className="text-sm text-muted-foreground">
                <Clock className="h-3 w-3 inline mr-1" />
                Working: {lead.workingDays}d {lead.workingHours}h
              </p>
              <p className="text-sm text-muted-foreground">Last: {lead.lastContact || "—"}</p>
              {options?.showDue ? (
                <p className="text-sm text-orange-600 font-medium">
                  Due: {lead.nextFollowUp || "—"}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">Next: {lead.nextFollowUp || "—"}</p>
              )}
              <div className="flex items-center space-x-1 text-sm pt-1">
                <UserIcon className="h-3 w-3 shrink-0" />
                <span className="text-muted-foreground">Assigned:</span>
                <span className="font-medium truncate">{lead.assignedTo}</span>
              </div>
              {userRole !== "callcenter" && (
                <Select onValueChange={(value) => handleAssignLead(lead.id, value)}>
                  <SelectTrigger className="w-full text-xs mt-1">
                    <SelectValue placeholder="Reassign to..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userList.map((user) => (
                      <SelectItem key={user.id} value={user.name || user.email}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0 w-full xl:w-[11rem]">
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setCallbackLead({ name: lead.name });
                setShowCallbackDialog(true);
              }}
            >
              Schedule Call back
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => {
                setEmailLead({ name: lead.name, email: lead.email });
                setShowEmailDialog(true);
              }}
            >
              <Mail className="h-4 w-4 mr-2" />
              Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => openQuotationForLead(lead.id, lead.property)}
            >
              <FileText className="h-4 w-4 mr-2" />
              Send Quotation
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              onClick={() => setViewLeadId(lead.id)}
            >
              <Eye className="h-4 w-4 mr-2" />
              View
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full justify-start"
              disabled={isLoadingEditLead}
              onClick={() => void openEditLead(lead.id)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const openQuotationForLead = (leadId: string, propertyName?: string) => {
    const targetLead = leads.find((item) => item.id === leadId);
    if (!targetLead) {
      toast.error("Lead details not found for quotation");
      return;
    }

    const contact = getLeadContactInfo(targetLead);
    setQuotationLead(targetLead);
    setQuotationContext({
      guestName: contact.name || targetLead.leadNumber,
      guestEmail: contact.email || undefined,
      guestPhone: contact.phone || undefined,
      propertyName,
    });
    setShowQuotationDialog(true);
  };

  const onSubmit = async (data: Parameters<typeof submitLead>[0]) => {
    try {
      await submitLead(data);

      toast.success("Lead created successfully!");
      setIsAddLeadOpen(false);
      resetForm();

      const fetchData = async () => {
        try {
          setIsLoadingLeads(true);
          setLoadError(null);
          const [leadData, usersData] = await Promise.all([
            listLeads({ scope }),
            listUsers(),
          ]);
          setLeads(leadData);
          setUserList(usersData);
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Unable to load leads";
          setLoadError(message);
          toast.error(message);
        } finally {
          setIsLoadingLeads(false);
        }
      };
      void fetchData();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create lead");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {userRole === 'callcenter' ? 'My Leads' : 'Lead Management'}
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'callcenter'
              ? 'Manage your assigned leads and track progress'
              : 'Comprehensive lead management and assignment'
            }
          </p>
        </div>

        <AddLeadWizard
          open={isAddLeadOpen}
          onOpenChange={setIsAddLeadOpen}
          trigger={
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          }
          form={form}
          hotelFields={hotelFields}
          onAddHotel={addNewHotel}
          onRemoveHotel={removeHotel}
          onAddRoom={addRoom}
          onRemoveRoom={removeRoom}
          hotelOptions={hotelOptions}
          customFields={customFields}
          customData={customData}
          setCustomData={setCustomData}
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leads">My Leads</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          {!backendUserId ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Backend user session not detected. Please login using backend
                  credentials to view your leads.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Scope selector and Filters */}
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {scope === "own" ? "My Leads" : "My Team Leads"}
                    </div>
                    {canViewTeamLeads && (
                      <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setScope("own")}
                          className={cn(
                            "px-2 py-1 rounded-sm",
                            scope === "own"
                              ? "bg-background font-semibold"
                              : "opacity-70"
                          )}
                        >
                          My Leads
                        </button>
                        <button
                          type="button"
                          onClick={() => setScope("team")}
                          className={cn(
                            "px-2 py-1 rounded-sm",
                            scope === "team"
                              ? "bg-background font-semibold"
                              : "opacity-70"
                          )}
                        >
                          My Team Leads
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col lg:flex-row gap-4">
                    {/* Search */}
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search leads by name, phone, email, or property..."
                        value={searchQuery}
                        onChange={(e) => {
                          const v = e.target.value;
                          setSearchQuery(v);
                          if (v.trim()) {
                            setSearchParams({ q: v.trim() }, { replace: true });
                          } else {
                            setSearchParams({}, { replace: true });
                          }
                        }}
                        className="pl-9"
                      />
                    </div>

                    {/* Filters */}
                    <div className="flex gap-2">
                      <Select value={selectedFilters.status} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, status: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="NEW">New</SelectItem>
                          <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                          <SelectItem value="TENTATIVE">Tentative</SelectItem>
                          <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                          <SelectItem value="LOST">Lost</SelectItem>
                          <SelectItem value="CLOSED_AUTO">Auto Closed</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={selectedFilters.stage}
                        onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, stage: value }))}
                        disabled={isLoadingStages}
                      >
                        <SelectTrigger className="w-44">
                          <SelectValue
                            placeholder={
                              isLoadingStages ? "Loading stages…" : "Pipeline stage"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All pipeline stages</SelectItem>
                          {sortedPipelineStages.length === 0 && !isLoadingStages ? (
                            <SelectItem value="__none" disabled>
                              Configure stages in Setup → Pipelines
                            </SelectItem>
                          ) : (
                            sortedPipelineStages.map((stage) => (
                              <SelectItem key={stage._id} value={stage._id}>
                                {stage.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>

                      <Select value={selectedFilters.property} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, property: value }))}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Properties</SelectItem>
                          <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                          <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                          <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                          <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                          <SelectItem value="Postcard Coonoor">Postcard Coonoor</SelectItem>
                        </SelectContent>
                      </Select>



                      <Select value={selectedFilters.source} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, source: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          <SelectItem value="DIRECT_CALL">Direct Call</SelectItem>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="BRAND_WEBSITE">Website</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="TRAVEL_AGENT">Travel Agent</SelectItem>
                          <SelectItem value="OTA">OTA</SelectItem>
                          <SelectItem value="REFERRAL">Referral</SelectItem>
                          <SelectItem value="SOCIAL">Social Media</SelectItem>
                          <SelectItem value="WALK_IN">Walk In</SelectItem>
                          <SelectItem value="IVR">IVR</SelectItem>
                          <SelectItem value="MANUAL">Manual</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={selectedFilters.temperature} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, temperature: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Temperature" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Temperature</SelectItem>
                          <SelectItem value="Hot">Hot</SelectItem>
                          <SelectItem value="Warm">Warm</SelectItem>
                          <SelectItem value="Cold">Cold</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={selectedFilters.bookingType} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, bookingType: value }))}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Booking Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="Tentative Booking">Tentative Booking</SelectItem>
                          <SelectItem value="Amendment">Amendment</SelectItem>
                          <SelectItem value="Corporate Booking">Corporate Booking</SelectItem>
                          <SelectItem value="Direct Customer">Direct Customer</SelectItem>
                          <SelectItem value="Confirmed Booking">Confirmed Booking</SelectItem>
                        </SelectContent>
                      </Select>

                      {userRole !== 'callcenter' && (
                        <Select
                          value={selectedFilters.assignedTo}
                          onValueChange={(value) =>
                            setSelectedFilters((prev) => ({
                              ...prev,
                              assignedTo: value,
                            }))
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Assigned To" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Agents</SelectItem>
                            {userList.map((user) => (
                              <SelectItem
                                key={user.id}
                                value={user.name || user.email}
                              >
                                {user.name || user.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}

                      <Button variant="outline" onClick={clearFilters}>
                        <Filter className="h-4 w-4 mr-2" />
                        Clear
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 text-sm text-muted-foreground">
                    {isLoadingLeads
                      ? "Loading leads..."
                      : `Showing ${filteredLeads.length} of ${allLeads.length} leads`}
                    {loadError && (
                      <span className="ml-2 text-red-600">
                        ({loadError})
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Leads Grid */}
              <div className="space-y-4">
                {filteredLeads.map((lead) => renderLeadCard(lead))}
              </div>

              {filteredLeads.length === 0 && !isLoadingLeads && (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No leads found</h3>
                    <p className="text-muted-foreground">Try adjusting your filters or search criteria</p>
                    <Button variant="outline" className="mt-4" onClick={clearFilters}>
                      Clear all filters
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="followups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups Due</CardTitle>
              <CardDescription>Leads requiring immediate attention and follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {allLeads.filter(lead => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length} follow-ups due
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {allLeads
              .filter((lead) => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date())
              .map((lead) => renderLeadCard(lead, { accentBorder: true, showDue: true }))}
          </div>

          {allLeads.filter(lead => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No follow-ups due</h3>
                <p className="text-muted-foreground">All caught up! Great work.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs >

      {/* Schedule Callback Dialog */}
      < Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog} >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Call back for {callbackLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Callback Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {callbackDate ? format(callbackDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={callbackDate}
                    onSelect={setCallbackDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Callback Time</Label>
              <Input
                type="time"
                value={callbackTime}
                onChange={(e) => setCallbackTime(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Add callback notes..."
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowCallbackDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Callback scheduled");
                  setShowCallbackDialog(false);
                  setCallbackTime("");
                  setCallbackNotes("");
                }}
              >
                Schedule Callback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog >

      {/* Email Dialog */}
      < EmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        guestEmail={emailLead?.email}
        guestName={emailLead?.name}
      />

      <SendQuotationDialog
        open={showQuotationDialog}
        onOpenChange={setShowQuotationDialog}
        lead={quotationLead}
        guestName={quotationContext?.guestName}
        guestEmail={quotationContext?.guestEmail}
        guestPhone={quotationContext?.guestPhone}
        propertyName={quotationContext?.propertyName}
      />

      <Dialog open={!!viewLeadId} onOpenChange={(open) => !open && setViewLeadId(null)}>
        <DialogContent className="max-w-[min(1200px,95vw)] h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between border-b px-4 py-3 shrink-0 space-y-0">
            <DialogTitle>Lead details</DialogTitle>
            <Button variant="ghost" size="icon" onClick={() => setViewLeadId(null)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto">
            {viewLeadId && (
              <LeadDetailPage
                leadId={viewLeadId}
                onBack={() => setViewLeadId(null)}
                embedded
                permissions={permissions}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {editLeadDetail?.lead && (
        <EditLeadDetailsDialog
          open={isEditLeadOpen}
          onOpenChange={(open) => {
            setIsEditLeadOpen(open);
            if (!open) setEditLeadDetail(null);
          }}
          customFields={customFields as any[]}
          currentDetails={{
            checkInDate: editLeadDetail.lead.itineraries?.[0]?.checkInDate,
            checkOutDate: editLeadDetail.lead.itineraries?.[0]?.checkOutDate,
            roomsRequested: (editLeadDetail.lead as { roomsRequested?: number }).roomsRequested,
            guests: editLeadDetail.lead.guests,
            occasion: (editLeadDetail.lead as { occasion?: string }).occasion,
            customData: editLeadDetail.lead.customData,
            budget: editLeadDetail.lead.budget ?? editLeadDetail.lead.estimatedValue,
            customerType: editLeadDetail.lead.customerType,
            bookingWindow: editLeadDetail.lead.bookingWindow,
            notes: editLeadDetail.lead.notes,
            source: editLeadDetail.lead.source,
            heatLevel: editLeadDetail.lead.heatLevel,
          }}
          onSave={handleSaveEditLead}
        />
      )}
    </div >
  );
};

export default ProfessionalLeadManagement;