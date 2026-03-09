import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Phone, Mail, MessageCircle, Video, FileText, Calendar, User as UserIcon, Hotel, Flame, Clock, CheckCircle, XCircle, RefreshCw, IndianRupee, Loader2, Edit, Save, Building2, Users, ThermometerSun, MessageSquare } from "lucide-react";
import { getLeadDetail, LeadDetail, LeadActivity, LeadCommunication, updateLead, addLeadNote, LeadStatus, HeatLevel, getLeadContactInfo, LeadContactDetails } from "@/services/leads";
import { PipelineService, PipelineStage } from "@/services/pipelines";
import { listEmails, EmailMessage } from "@/services/email";
import { EmailComposer } from "@/components/EmailComposer";
import { ScheduleFollowUpDialog } from "@/components/ScheduleFollowUpDialog";
import { SendQuotationDialog } from "@/components/SendQuotationDialog";
import { listQuotations, Quotation } from "@/services/quotations";
import { LeadWorkflowDisplay } from "@/components/LeadWorkflowDisplay";
import { listUsers, User } from "@/services/users";
import { formatDistanceToNow, format } from "date-fns";
import { getPaymentLinksForLead, createPaymentLink, type PaymentLink } from "@/services/paymentLinks";
import { getCommunicationTimeline, updateCallStatus, sendEmailFromLead, type CommunicationTimelineItem, type SendEmailPayload } from "@/services/communications";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { EditContactDetailsDialog } from "@/components/EditContactDetailsDialog";
import { EditLeadDetailsDialog, LeadTripDetails } from "@/components/EditLeadDetailsDialog";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { CustomFieldsService, CustomFieldDefinition } from "@/services/customFields";

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
  permissions?: string[];
  isAdmin?: boolean;
}

// Helper function to get user name from activity (handles both populated objects and string IDs)
const getUserName = (userId: string | { _id: string; name: string; email?: string } | undefined, users: User[]): string => {
  if (!userId) return "System";
  if (typeof userId === "object" && userId !== null) {
    return userId.name || "Unknown User";
  }
  const user = users.find(u => u.id === userId);
  return user?.name || "Unknown User";
};

// Helper function to format timeline messages in a user-friendly way
const formatTimelineMessage = (activity: LeadActivity, users: User[]): string => {
  const performedByName = getUserName(activity.performedByUserId, users);

  switch (activity.type) {
    case "LEAD_CREATED":
      return `Lead was created`;

    case "STATUS_CHANGE":
      if (activity.fromStatus && activity.toStatus) {
        return `Status changed from ${activity.fromStatus} to ${activity.toStatus}`;
      }
      return `Status changed to ${activity.toStatus || "unknown"}`;

    case "AUTO_ASSIGNED":
      const autoAssignedToName = getUserName(activity.toUserId, users);
      return `Lead automatically assigned to ${autoAssignedToName}`;

    case "MANUAL_ASSIGNED":
      const manualAssignedToName = getUserName(activity.toUserId, users);
      const assignedByName = getUserName(activity.assignedByUserId, users);
      return `Lead assigned to ${manualAssignedToName}${activity.assignedByUserId ? ` by ${assignedByName}` : ""}`;

    case "REASSIGNED":
      const reassignedFromName = getUserName(activity.fromUserId, users);
      const reassignedToName = getUserName(activity.toUserId, users);
      const reassignedByName = getUserName(activity.assignedByUserId, users);
      return `Lead reassigned from ${reassignedFromName} to ${reassignedToName}${activity.assignedByUserId ? ` by ${reassignedByName}` : ""}`;

    case "FOLLOW_UP":
      return `Follow-up scheduled${activity.dueAt ? ` for ${format(new Date(activity.dueAt), "MMM d, yyyy 'at' h:mm a")}` : ""}`;

    case "NOTE":
      return activity.note || "Note added";

    case "QUOTE_SENT":
      return `Quotation sent`;

    case "PAYMENT_LINK_SENT":
      return `Payment link sent`;

    case "PAYMENT_RECEIVED":
      return `Payment received`;

    case "CLIENT_RESPONSE":
      return `Client response received`;

    default:
      return activity.note || activity.type;
  }
};

// Helper function to format communication messages
const formatCommunicationMessage = (comm: LeadCommunication, users: User[]): string => {
  const performedBy = users.find(u => u.id === comm.performedByUserId);
  const performedByName = performedBy?.name || "System";

  const channelNames: Record<string, string> = {
    CALL: "Phone Call",
    EMAIL: "Email",
    WHATSAPP: "WhatsApp",
    SMS: "SMS",
  };

  const directionNames: Record<string, string> = {
    INBOUND: "Incoming",
    OUTBOUND: "Outgoing",
  };

  const channel = channelNames[comm.channel] || comm.channel;
  const direction = directionNames[comm.direction] || comm.direction;

  let message = `${direction} ${channel}`;
  if (comm.disposition) {
    message += ` - ${comm.disposition}`;
  }
  if (comm.summary) {
    message += `: ${comm.summary}`;
  }
  if (performedBy) {
    message += ` (by ${performedByName})`;
  }

  return message;
};

// Helper function to get icon for activity type
const getActivityIcon = (type: string) => {
  switch (type) {
    case "LEAD_CREATED":
      return <CheckCircle className="h-4 w-4 text-blue-500" />;
    case "AUTO_ASSIGNED":
    case "MANUAL_ASSIGNED":
    case "REASSIGNED":
      return <UserIcon className="h-4 w-4 text-green-500" />;
    case "STATUS_CHANGE":
      return <RefreshCw className="h-4 w-4 text-purple-500" />;
    case "FOLLOW_UP":
      return <Calendar className="h-4 w-4 text-orange-500" />;
    case "NOTE":
      return <FileText className="h-4 w-4 text-gray-500" />;
    case "QUOTE_SENT":
      return <FileText className="h-4 w-4 text-amber-500" />;
    case "PAYMENT_LINK_SENT":
      return <IndianRupee className="h-4 w-4 text-green-500" />;
    case "PAYMENT_RECEIVED":
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case "CLIENT_RESPONSE":
      return <Mail className="h-4 w-4 text-blue-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

// Helper function to get icon for communication channel
const getCommunicationIcon = (channel: string) => {
  switch (channel) {
    case "CALL":
      return <Phone className="h-4 w-4 text-green-600" />;
    case "EMAIL":
      return <Mail className="h-4 w-4 text-blue-600" />;
    case "WHATSAPP":
      return <MessageCircle className="h-4 w-4 text-emerald-600" />;
    case "SMS":
      return <MessageCircle className="h-4 w-4 text-purple-600" />;
    default:
      return <MessageCircle className="h-4 w-4 text-gray-500" />;
  }
};

export const LeadDetailPage = ({ leadId, onBack, permissions, isAdmin }: LeadDetailPageProps) => {
  const { toast } = useToast();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [leadEmails, setLeadEmails] = useState<EmailMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isComposeEmailOpen, setIsComposeEmailOpen] = useState(false);

  // Custom fields state
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleType, setScheduleType] = useState<"call" | "email" | "whatsapp" | "meeting">("call");
  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);
  const [paymentLinks, setPaymentLinks] = useState<PaymentLink[]>([]);
  const [isLoadingPaymentLinks, setIsLoadingPaymentLinks] = useState(false);
  const [communicationTimeline, setCommunicationTimeline] = useState<CommunicationTimelineItem[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);

  // State for editable fields - must be declared before any early returns
  const [editingStatus, setEditingStatus] = useState(false);
  const [localStatus, setLocalStatus] = useState<LeadStatus>("NEW");
  const [localStage, setLocalStage] = useState<string>("");
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [localClosedReason, setLocalClosedReason] = useState<string>("");
  const [localHeatLevel, setLocalHeatLevel] = useState<HeatLevel>("WARM");
  const [localCallStatus, setLocalCallStatus] = useState<string>("");
  const [localNotes, setLocalNotes] = useState<string>("");
  const [isSavingStatus, setIsSavingStatus] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [activityNote, setActivityNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isEditContactDialogOpen, setIsEditContactDialogOpen] = useState(false);
  const [isEditLeadDetailsDialogOpen, setIsEditLeadDetailsDialogOpen] = useState(false);
  const [isCreateBookingDialogOpen, setIsCreateBookingDialogOpen] = useState(false);

  // Permission checks
  const canUpdate = !!isAdmin || permissions?.includes("leads.update") || permissions?.includes("leads.manage");
  const canAssign = !!isAdmin || permissions?.includes("leads.assign") || permissions?.includes("leads.manage");

  useEffect(() => {
    void loadLeadDetail();
    void loadUsers();
    void loadPaymentLinks();
    void loadCommunicationTimeline();
    void loadCustomFieldsData();
    void loadPipeline();
  }, [leadId]);

  // Update local state when lead changes - must be before any early returns
  useEffect(() => {
    if (leadDetail) {
      const lead = leadDetail.lead;
      setLocalStatus(lead.status);
      setLocalStage(lead.stageId || "");
      setLocalClosedReason(lead.closedReason || "");
      setLocalHeatLevel(lead.heatLevel);
      setLocalCallStatus((lead as any).callStatus || "");
      setLocalNotes(lead.notes || "");
    }
  }, [leadDetail]);

  const loadLeadDetail = async () => {
    try {
      setIsLoading(true);
      const detail = await getLeadDetail(leadId);
      setLeadDetail(detail);
      void loadLeadEmails(leadId);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Unable to load lead details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPipeline = async () => {
    try {
      const defaultPipeline = await PipelineService.getDefaultPipeline("leads");
      if (defaultPipeline && defaultPipeline.stages) {
        setPipelineStages(defaultPipeline.stages);
      }
    } catch (err) {
      console.error("Failed to load pipeline stages", err);
    }
  };

  const loadUsers = async () => {
    try {
      const allUsers = await listUsers();
      setUsers(allUsers);
    } catch (err) {
      console.error("Failed to load users:", err);
    }
  };

  const loadLeadEmails = async (leadId: string) => {
    try {
      setIsLoadingEmails(true);
      const result = await listEmails({ search: leadId, limit: 100 });
      const filtered = result.messages.filter(
        (email) => email.linkedLeadId === leadId
      );
      setLeadEmails(filtered);
    } catch (err) {
      setLeadEmails([]);
    } finally {
      setIsLoadingEmails(false);
    }
  };

  const loadPaymentLinks = async () => {
    try {
      setIsLoadingPaymentLinks(true);
      const links = await getPaymentLinksForLead(leadId);
      setPaymentLinks(links);
    } catch (err) {
      console.error("Failed to load payment links:", err);
      setPaymentLinks([]);
    } finally {
      setIsLoadingPaymentLinks(false);
    }
  };

  const loadCustomFieldsData = async () => {
    try {
      setIsLoadingFields(true);
      const fields = await CustomFieldsService.getActiveFieldsForModule("leads");
      setCustomFields(fields.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error("Failed to load custom fields:", error);
      setCustomFields([]);
    } finally {
      setIsLoadingFields(false);
    }
  };

  const loadCommunicationTimeline = async () => {
    try {
      setIsLoadingTimeline(true);
      const timeline = await getCommunicationTimeline(leadId);
      setCommunicationTimeline(timeline);
    } catch (err) {
      console.error("Failed to load communication timeline:", err);
      setCommunicationTimeline([]);
    } finally {
      setIsLoadingTimeline(false);
    }
  };


  // Always include activities, and merge with communications if available
  const timelineItems = leadDetail
    ? [
      // Always include activities from leadDetail
      ...leadDetail.activities
        .filter((a) => a.type !== "REMINDER_TRIGGERED")
        .map((activity) => ({
          type: "activity" as const,
          data: activity,
          timestamp: activity.performedAt ? new Date(activity.performedAt).getTime() : 0,
        })),
      // Include communications from communicationTimeline if available, otherwise from leadDetail
      ...(communicationTimeline.length > 0
        ? communicationTimeline.map((item) => ({
          type: item.type as "communication" | "email",
          data: item,
          timestamp: item.createdAt || item.receivedAt || item.sentAt
            ? new Date(item.createdAt || item.receivedAt || item.sentAt || "").getTime()
            : 0,
        }))
        : leadDetail.communications.map((comm) => ({
          type: "communication" as const,
          data: comm,
          timestamp: comm.createdAt ? new Date(comm.createdAt).getTime() : 0,
        }))),
    ].sort((a, b) => b.timestamp - a.timestamp)
    : [];

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (!leadDetail) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Lead not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const lead = leadDetail.lead;
  const assignedUser = users.find((u) => u.id === lead.assignedToUserId);

  // Prefer contactDetails (inquiry snapshot), fall back to guest
  const { name: guestName, email: guestEmail, phone: guestPhone } = getLeadContactInfo(lead);

  // Helper function to get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "CONTACTED":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "QUOTATION_SHARED":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "PAYMENT_PENDING":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "CONFIRMED":
        return "bg-green-100 text-green-800 border-green-200";
      case "LOST":
        return "bg-red-100 text-red-800 border-red-200";
      case "CLOSED_AUTO":
        return "bg-gray-100 text-gray-800 border-gray-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  // Helper function to get heat level badge color and icon
  const getHeatLevelBadge = (heat: string) => {
    switch (heat) {
      case "HOT":
        return { color: "bg-red-100 text-red-800 border-red-200", icon: <Flame className="h-3 w-3 text-red-600" /> };
      case "WARM":
        return { color: "bg-orange-100 text-orange-800 border-orange-200", icon: <ThermometerSun className="h-3 w-3 text-orange-600" /> };
      case "COLD":
        return { color: "bg-blue-100 text-blue-800 border-blue-200", icon: <ThermometerSun className="h-3 w-3 text-blue-600" /> };
      case "NOT_INTERESTED":
        return { color: "bg-gray-100 text-gray-800 border-gray-200", icon: <XCircle className="h-3 w-3 text-gray-600" /> };
      default:
        return { color: "bg-gray-100 text-gray-800 border-gray-200", icon: <ThermometerSun className="h-3 w-3 text-gray-600" /> };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 7) return "bg-green-100 text-green-800 border-green-200";
    if (score >= 4) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const getStageLabel = (stageId: string) => {
    const stage = pipelineStages.find(s => s._id === stageId);
    return stage?.name || "Unknown Stage";
  };

  const handleStatusChange = async () => {
    // MANDATORY DATA VALIDATION (SOP 1.9)
    if (["PAYMENT_REQUEST", "BOOKED"].includes(localStage)) {
      const missingFields: string[] = [];
      const lead = leadDetail?.lead;
      if (!lead?.checkInDate) missingFields.push("Check-in Date");
      if (!lead?.checkOutDate) missingFields.push("Check-out Date");
      if (!lead?.guests?.adults && !lead?.guests?.children) missingFields.push("Guest Count");

      if (missingFields.length > 0) {
        toast({
          title: "Missing Mandatory Data",
          description: `Please fill the following fields before moving to ${getStageLabel(localStage)}: ${missingFields.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      setIsSavingStatus(true);
      const currentTerminalType = pipelineStages.find(s => s._id === localStage)?.terminalType;

      await updateLead(leadId, {
        status: localStatus,
        stageId: localStage,
        closedReason: currentTerminalType === "LOST" ? localClosedReason : undefined,
        heatLevel: localHeatLevel,
        callStatus: localCallStatus || undefined,
      });

      await loadLeadDetail();
      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsSavingStatus(false);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setIsSavingNotes(true);
      await updateLead(leadId, {
        notes: localNotes,
      });
      await loadLeadDetail();
      toast({
        title: "Notes saved",
        description: "Notes have been saved successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save notes",
        variant: "destructive",
      });
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleAddNote = async () => {
    if (!activityNote.trim()) {
      toast({
        title: "Error",
        description: "Please enter a note",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsAddingNote(true);
      await addLeadNote(leadId, activityNote);
      setActivityNote("");
      await loadLeadDetail();
      await loadCommunicationTimeline();
      toast({
        title: "Note added",
        description: "Note has been added successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setIsAddingNote(false);
    }
  };

  const handleSaveContactDetails = async (contactDetails: LeadContactDetails) => {
    try {
      await updateLead(leadId, { contactDetails });
      await loadLeadDetail();
      toast({
        title: "Contact details updated",
        description: "Lead contact details have been updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update contact details",
        variant: "destructive",
      });
      throw err; // Re-throw to let dialog know it failed
    }
  };

  const handleSaveLeadDetails = async (details: LeadTripDetails) => {
    try {
      setIsSavingStatus(true);

      const payload: any = {
        checkInDate: details.checkInDate,
        checkOutDate: details.checkOutDate,
        roomsRequested: details.roomsRequested,
        guests: details.guests,
        occasion: details.occasion,
      };

      if (details.customData) {
        payload.customData = details.customData;
      }

      await updateLead(lead.id, payload);

      await loadLeadDetail();
      toast({
        title: "Trip details updated",
        description: "Lead trip details have been updated successfully",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update trip details",
        variant: "destructive",
      });
      throw err;
    }
  };

  // Get property name
  const propertyName = typeof lead.propertyId === "object" && lead.propertyId !== null
    ? (lead.propertyId as any).name
    : lead.propertyId || "Not specified";

  // Format travel dates
  const travelDates = lead.checkInDate && lead.checkOutDate
    ? `${format(new Date(lead.checkInDate), "MMM d, yyyy")} - ${format(new Date(lead.checkOutDate), "MMM d, yyyy")}`
    : "Not specified";

  // Format occupancy
  const occupancy = lead.guests
    ? `${lead.guests.adults || 0} Adults, ${lead.guests.children || 0} Children, ${lead.roomsRequested || 1} Rooms`
    : "Not specified";

  return (
    <div className="space-y-6">
      {/* Header with Back Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {guestName || "Lead"}
              </h1>
              <Badge className={getStatusBadgeColor(lead.status)}>
                {lead.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {lead.leadNumber ?? lead.id}
            </p>
            {lead.score !== undefined && (
              <Badge variant="outline" className={`ml-2 ${getScoreColor(lead.score)}`}>
                Score: {lead.score}/10
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsComposeEmailOpen(true)}
          >
            <Mail className="h-4 w-4 mr-2" />
            Send Email
          </Button>
          <Button
            size="sm"
            onClick={() => setIsQuotationDialogOpen(true)}
          >
            <FileText className="h-4 w-4 mr-2" />
            Create Quotation
          </Button>
          <Button
            size="sm"
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => setIsCreateBookingDialogOpen(true)}
          >
            <Hotel className="h-4 w-4 mr-2" />
            Create Booking
          </Button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative flex items-center justify-between w-full">
            <div className="absolute left-0 top-1/2 w-full h-1 bg-gray-200 -z-0"></div>
            {pipelineStages.filter((s) => !s.isTerminal || s.terminalType === "WON").map((stage, index) => {
              const currentStageIndex = pipelineStages.findIndex(s => s._id === lead.stageId);

              const isCompleted = index <= currentStageIndex;
              const isCurrent = index === currentStageIndex;

              return (
                <div key={stage._id} className="relative z-10 flex flex-col items-center bg-white px-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center border-2 
                      ${isCompleted ? "bg-primary border-primary text-primary-foreground" : "bg-white border-gray-300 text-gray-300"}
                      ${isCurrent ? "ring-4 ring-primary/20" : ""}
                    `}
                    style={{ backgroundColor: isCompleted ? stage.color || "currentColor" : "white" }}
                  >
                    {index + 1}
                  </div>
                  <span className={`text-xs mt-2 font-medium ${isCompleted ? "text-primary" : "text-gray-400"}`}>
                    {stage.name}
                  </span>
                </div>
              );
            })}
          </div>
          {pipelineStages.find(s => s._id === lead.stageId)?.terminalType === "LOST" && (
            <div className="flex justify-center mt-4">
              <Badge variant="destructive">LOST LEAD</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">

          {/* Guest Information */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Guest Information</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditContactDialogOpen(true)}
                disabled={!canUpdate}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {guestPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Phone</p>
                      <p className="font-medium">{guestPhone}</p>
                    </div>
                  </div>
                )}
                {guestEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Email</p>
                      <p className="font-medium">{guestEmail}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground uppercase">Hotel</p>
                      <p className="font-medium">{propertyName}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditLeadDetailsDialogOpen(true)}
                    disabled={!canUpdate}
                    className="-mr-2 h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Travel Dates</p>
                    <p className="font-medium">{travelDates}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Occupancy</p>
                    <p className="font-medium">{occupancy}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Occasion</p>
                    <p className="font-medium">{lead.occasion || "—"}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lead Status */}
          <Card>
            <CardHeader>
              <CardTitle>Lead Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-2 block">Stage</label>
                  <Select
                    value={localStage}
                    onValueChange={(value) => setLocalStage(value)}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelineStages.map((stage) => (
                        <SelectItem key={stage._id} value={stage._id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-2 block">Status (Legacy)</label>
                  <Select
                    value={localStatus}
                    onValueChange={(value) => setLocalStatus(value as LeadStatus)}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="CONTACTED">Contacted</SelectItem>
                      <SelectItem value="QUOTATION_SHARED">Quotation Shared</SelectItem>
                      <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
                      <SelectItem value="CLOSED_AUTO">Closed Auto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(localStatus === "LOST" || pipelineStages.find(s => s._id === localStage)?.terminalType === "LOST") && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase mb-2 block">Closed Reason</label>
                    <Select
                      value={localClosedReason}
                      onValueChange={setLocalClosedReason}
                      disabled={!canUpdate}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Reason" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SOLD_OUT">Sold Out</SelectItem>
                        <SelectItem value="BUDGET">Budget Issue</SelectItem>
                        <SelectItem value="BOOKED_OTA">Booked OTA</SelectItem>
                        <SelectItem value="BOOKED_WEBSITE">Booked Website</SelectItem>
                        <SelectItem value="BOOKED_OTHER_PROPERTY">Booked Other Property</SelectItem>
                        <SelectItem value="NO_RESPONSE">No Response</SelectItem>
                        <SelectItem value="PRICE">Price</SelectItem>
                        <SelectItem value="NO_AVAILABILITY">No Availability</SelectItem>
                        <SelectItem value="POLICY_UNDER_18">Policy: Under 18</SelectItem>
                        <SelectItem value="POLICY_LOCAL_ID">Policy: Local ID</SelectItem>
                        <SelectItem value="POLICY_PET">Policy: Pet</SelectItem>
                        <SelectItem value="POLICY_ALCOHOL">Policy: Alcohol</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-2 block">Heat Level</label>
                  <Select
                    value={localHeatLevel}
                    onValueChange={(value) => setLocalHeatLevel(value as HeatLevel)}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="HOT">Hot</SelectItem>
                      <SelectItem value="WARM">Warm</SelectItem>
                      <SelectItem value="COLD">Cold</SelectItem>
                      <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                    </SelectContent>
                  </Select>
                  {localHeatLevel && (
                    <div className="mt-2">
                      <Badge className={`${getHeatLevelBadge(localHeatLevel).color} flex items-center gap-1 w-fit`}>
                        {getHeatLevelBadge(localHeatLevel).icon}
                        {localHeatLevel}
                      </Badge>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase mb-2 block">Call Disposition</label>
                  <Select
                    value={localCallStatus}
                    onValueChange={(value) => setLocalCallStatus(value)}
                    disabled={!canUpdate}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="QUOTATION_SHARED">Quotation Shared</SelectItem>
                      <SelectItem value="PAYMENT_PENDING">Payment Pending</SelectItem>
                      <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {canUpdate && (
                  <Button
                    onClick={handleStatusChange}
                    disabled={isSavingStatus}
                    className="w-full"
                  >
                    {isSavingStatus ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="Add notes about this lead..."
                className="min-h-[100px]"
                disabled={!canUpdate}
              />
              {canUpdate && (
                <Button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="w-full"
                >
                  {isSavingNotes ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Notes
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          {/* Quick Info */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Source</p>
                <p className="font-medium">{lead.source}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Lead Type</p>
                <p className="font-medium">{lead.leadType}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Assigned To</p>
                <p className="font-medium">{assignedUser?.name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Repeat Guest</p>
                <p className="font-medium">{lead.isFirstTimeGuest ? "No" : "Yes"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Created</p>
                <p className="font-medium">
                  {lead.createdAt ? format(new Date(lead.createdAt), "MM/dd/yyyy") : "—"}
                </p>
              </div>
              {lead.tags && lead.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase mt-2 mb-1">Tags</p>
                  <div className="flex flex-wrap gap-1">
                    {lead.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] bg-slate-100 text-slate-600 border-slate-200">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Custom Fields Display */}
              {customFields.length > 0 && lead.customData && Object.keys(lead.customData).length > 0 && (
                <>
                  <div className="my-4 border-t border-slate-200" />
                  <div className="space-y-3">
                    {customFields.map(field => {
                      const val = lead.customData![field.fieldName];
                      if (val === undefined || val === null || val === "") return null;

                      let displayVal = String(val);
                      if (field.dataType === "BOOLEAN") {
                        displayVal = val ? "Yes" : "No";
                      } else if (field.dataType === "DATE") {
                        displayVal = format(new Date(val), "MM/dd/yyyy");
                      } else if (field.dataType === "DROPDOWN" && field.options) {
                        const opt = field.options.find(o => o.value === val);
                        displayVal = opt ? opt.label : val;
                      }

                      return (
                        <div key={field._id}>
                          <p className="text-xs text-muted-foreground uppercase">{field.label}</p>
                          <p className="font-medium whitespace-pre-wrap">{displayVal}</p>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quotations */}
          <Card>
            <CardHeader>
              <CardTitle>Quotations</CardTitle>
            </CardHeader>
            <CardContent>
              {leadDetail ? (
                <QuotationsTab
                  leadId={lead.id}
                  onSendNew={() => setIsQuotationDialogOpen(true)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">No quotations yet</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Add a note..."
                  value={activityNote}
                  onChange={(e) => setActivityNote(e.target.value)}
                  disabled={!canUpdate || isAddingNote}
                />
                <Button
                  onClick={handleAddNote}
                  disabled={!canUpdate || isAddingNote || !activityNote.trim()}
                  className="w-full"
                  size="sm"
                >
                  {isAddingNote ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      Add Note
                    </>
                  )}
                </Button>
              </div>
              <ScrollArea className="h-[300px]">
                {timelineItems.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <p className="text-sm">No activity yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {timelineItems
                      .filter((item) => {
                        // Filter out REMINDER_TRIGGERED, but keep other activities and communications
                        if (item.type === "activity") {
                          const activity = item.data as LeadActivity;
                          return activity.type !== "REMINDER_TRIGGERED";
                        }
                        return true;
                      })
                      .map((item, index) => {
                        const isActivity = item.type === "activity";
                        const isCommunication = item.type === "communication" || item.type === "email";

                        const activity = isActivity ? (item.data as LeadActivity) : null;
                        const comm = isCommunication ? (item.data as LeadCommunication) : null;

                        if (!activity && !comm) return null;

                        const performedByName = isActivity && activity
                          ? getUserName(activity.performedByUserId, users)
                          : isCommunication && comm
                            ? getUserName(comm.performedByUserId, users)
                            : "System";

                        return (
                          <div key={item.timestamp + index} className="flex items-start gap-3 text-sm">
                            <div className="mt-0.5 flex-shrink-0">
                              {isActivity && activity ? getActivityIcon(activity.type) : null}
                              {isCommunication && comm ? getCommunicationIcon(comm.channel) : null}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium">
                                {isActivity && activity ? formatTimelineMessage(activity, users) : ""}
                                {isCommunication && comm ? formatCommunicationMessage(comm, users) : ""}
                              </p>
                              {isActivity && activity && activity.note && activity.type !== "NOTE" && (
                                <p className="text-muted-foreground mt-1 text-sm">{activity.note}</p>
                              )}
                              {isCommunication && comm && comm.messageContent && (
                                <p className="text-muted-foreground mt-1 text-sm line-clamp-3 overflow-hidden text-ellipsis bg-muted/30 p-2 rounded border border-muted/50 mt-2">
                                  {comm.messageContent.replace(/<[^>]*>?/gm, ' ').substring(0, 150)}
                                  {comm.messageContent.length > 150 ? "..." : ""}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <p className="text-xs text-muted-foreground">
                                  {performedByName !== "System" && (
                                    <span className="font-medium text-slate-600">by {performedByName}</span>
                                  )}
                                  <span className={performedByName !== "System" ? "ml-2" : ""}>
                                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                                  </span>
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialogs */}

      {/* Compose Email Dialog */}
      <EmailComposer
        open={isComposeEmailOpen}
        onOpenChange={setIsComposeEmailOpen}
        initialTo={guestEmail ? [{ email: guestEmail, name: guestName || undefined }] : undefined}
        onSend={async (payload) => {
          try {
            await sendEmailFromLead(leadId, payload);
            toast({
              title: "Success",
              description: "Email sent successfully",
            });
            setIsComposeEmailOpen(false);
            // Reload both email list and communication timeline
            void loadLeadEmails(leadId);
            void loadCommunicationTimeline();
          } catch (err) {
            toast({
              title: "Error",
              description: err instanceof Error ? err.message : "Failed to send email",
              variant: "destructive",
            });
          }
        }}
      />

      {/* Schedule Follow-up Dialog */}
      <ScheduleFollowUpDialog
        open={isScheduleDialogOpen}
        onOpenChange={(open) => {
          setIsScheduleDialogOpen(open);
        }}
        leadId={lead.id}
        leadNumber={lead.leadNumber}
        defaultFollowUpType={scheduleType}
        pauseWorkflowOnSchedule={true}
        onSuccess={() => {
          toast({
            title: "Success",
            description: `${scheduleType === "meeting" ? "Meeting" : "Follow-up"} scheduled successfully`,
          });
          void loadLeadDetail();
        }}
      />

      {/* Send Quotation Dialog */}
      <SendQuotationDialog
        open={isQuotationDialogOpen}
        onOpenChange={(open) => {
          setIsQuotationDialogOpen(open);
        }}
        lead={lead}
        leadDetail={leadDetail}
        onQuotationSent={() => {
          toast({
            title: "Success",
            description: "Quotation sent successfully",
          });
          void loadLeadDetail();
        }}
      />

      {/* Edit Contact Details Dialog */}
      <EditContactDetailsDialog
        open={isEditContactDialogOpen}
        onOpenChange={setIsEditContactDialogOpen}
        currentContactDetails={{
          name: guestName,
          phone: guestPhone,
          email: guestEmail,
        }}
        onSave={handleSaveContactDetails}
      />

      {/* Edit Trip Details Dialog */}
      <EditLeadDetailsDialog
        open={isEditLeadDetailsDialogOpen}
        onOpenChange={setIsEditLeadDetailsDialogOpen}
        customFields={customFields}
        currentDetails={{
          checkInDate: lead.checkInDate,
          checkOutDate: lead.checkOutDate,
          roomsRequested: lead.roomsRequested,
          guests: lead.guests,
          occasion: lead.occasion,
          customData: lead.customData,
        }}
        onSave={handleSaveLeadDetails}
      />
      <CreateBookingDialog
        isOpen={isCreateBookingDialogOpen}
        onClose={() => setIsCreateBookingDialogOpen(false)}
        lead={lead}
        onSuccess={() => {
          void loadLeadDetail();
        }}
      />
    </div>
  );
};

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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
        <span className="text-sm text-muted-foreground">Loading quotation history...</span>
      </div>
    );
  }

  if (quotations.length === 0) {
    return <p className="text-sm text-muted-foreground">No quotations yet</p>;
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3">
        {quotations.map((quote) => (
          <div key={quote.id} className="p-3 border rounded-lg">
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
                    {format(new Date(quote.sentAt), "MMM d, yyyy 'at' h:mm a")}
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
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};

