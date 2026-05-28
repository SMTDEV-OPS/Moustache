import { useEffect, useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  Calendar,
  User as UserIcon,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw,
  Loader2,
  Edit2,
  MessageCircle,
  GitBranch,
  Star,
  CheckSquare,
  ChevronRight,
  MoreVertical,
  Zap,
  Plus,
  IndianRupee,
} from "lucide-react";
import { Button, Badge, PageHeader } from "@/components/shared";
import { PageSkeleton } from "@/components/patterns";
import { getLeadDetail, LeadDetail, LeadActivity, LeadCommunication, updateLead, addLeadNote, LeadStatus, HeatLevel, getLeadContactInfo, LeadContactDetails } from "@/services/leads";
import { PipelineService, PipelineStage } from "@/services/pipelines";
import { listEmails, EmailMessage } from "@/services/email";
import { ScheduleFollowUpDialog } from "@/components/ScheduleFollowUpDialog";
import { SendQuotationDialog } from "@/components/SendQuotationDialog";
import { listQuotations, Quotation } from "@/services/quotations";
import { listUsers, User } from "@/services/users";
import { formatDistanceToNow, format } from "date-fns";
import { getPaymentLinksForLead, createPaymentLink, type PaymentLink } from "@/services/paymentLinks";
import { getCommunicationTimeline, updateCallStatus, type CommunicationTimelineItem } from "@/services/communications";
import { Textarea } from "@/components/ui/textarea";
import { API_BASE_URL, withAuthHeaders, getAuthToken } from "@/services/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EditContactDetailsDialog } from "@/components/EditContactDetailsDialog";
import { EditLeadDetailsDialog, LeadTripDetails } from "@/components/EditLeadDetailsDialog";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { listAdminFields, AdminField } from "@/services/adminFields";
import { listTasksForLead, Task, updateTask } from "@/services/tasks";
import { getCallQuality, submitCallQuality, getCallQualityDimensions, type CallQualityScore, type CallQualityDimension } from "@/services/callQuality";
import { getWorkflowLogsForLead, type WorkflowExecutionLog } from "@/services/workflowLogs";
import LeadEmailComposer from "@/components/email/EmailComposer";
import { EmailThreadView } from "@/components/email/EmailThreadView";

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
  permissions?: string[];
  isAdmin?: boolean;
  /** When true, renders inside a modal (no standalone back navigation). */
  embedded?: boolean;
}

function getField(lead: any, ...keys: string[]): any {
  for (const key of keys) {
    // Check top-level
    const direct = lead?.[key]
    if (direct !== undefined && direct !== null && direct !== '') 
      return direct
    // Check customData
    const fromCustom = lead?.customData?.[key] 
      ?? lead?.customData?.get?.(key)
    if (fromCustom !== undefined && fromCustom !== null && fromCustom !== '') 
      return fromCustom
  }
  return null
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

const getSourceBadgeVariant = (source: string): "src_ivr" | "src_whatsapp" | "src_website" | "src_call" | "src_email" | "default" => {
  if (source === "IVR" || source === "IVR_LIVE") return "src_ivr";
  if (source === "WHATSAPP") return "src_whatsapp";
  if (source === "BRAND_WEBSITE") return "src_website";
  if (source === "DIRECT_CALL") return "src_call";
  if (source === "EMAIL") return "src_email";
  return "default";
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

export const LeadDetailPage = ({ leadId, onBack, permissions, isAdmin, embedded }: LeadDetailPageProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [leadEmails, setLeadEmails] = useState<EmailMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [isComposeEmailOpen, setIsComposeEmailOpen] = useState(false);
  const [replyToEmailItem, setReplyToEmailItem] = useState<CommunicationTimelineItem | null>(null);

  // Custom fields state
  const [customFields, setCustomFields] = useState<AdminField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

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

  const [stageMoveError, setStageMoveError] = useState<{ stageName: string; missingFields: { id: string; name: string; slug: string }[] } | null>(null);
  const [followUps, setFollowUps] = useState<Task[]>([]);
  const [workflowLogs, setWorkflowLogs] = useState<WorkflowExecutionLog[]>([]);
  const [callQualityScores, setCallQualityScores] = useState<CallQualityScore[]>([]);
  const [isScheduleFollowUpOpen, setIsScheduleFollowUpOpen] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const [completionOutcome, setCompletionOutcome] = useState("");
  const [isCallQualityModalOpen, setIsCallQualityModalOpen] = useState(false);
  const [callQualityDimensions, setCallQualityDimensions] = useState<CallQualityDimension[]>([]);
  const [isLeadSocketConnected, setIsLeadSocketConnected] = useState(false);
  const leadInfoRef = useRef<HTMLDivElement>(null);
  const leadSocketRef = useRef<Socket | null>(null);

  const canScoreCall = !!isAdmin || permissions?.includes("leads.manage") || permissions?.includes("settings.manage");

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

  useEffect(() => {
    if (!leadId) return;
    void listTasksForLead(leadId).then(setFollowUps).catch(() => setFollowUps([]));
    void getWorkflowLogsForLead(leadId).then(setWorkflowLogs).catch(() => setWorkflowLogs([]));
    void getCallQuality(leadId).then(setCallQualityScores).catch(() => setCallQualityScores([]));
  }, [leadId]);

  useEffect(() => {
    void getCallQualityDimensions().then(setCallQualityDimensions).catch(() => setCallQualityDimensions([]));
  }, []);

  useEffect(() => {
    const token = getAuthToken();
    if (!token || !leadId) return;

    const wsUrl = API_BASE_URL.replace(/^http/, "ws").replace(/\/api$/, "");
    const socket = io(wsUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    leadSocketRef.current = socket;

    socket.on("connect", () => {
      setIsLeadSocketConnected(true);
      socket.emit("lead:join", leadId);
    });
    socket.on("disconnect", () => {
      setIsLeadSocketConnected(false);
    });

    const refreshTimeline = () => {
      void queryClient.invalidateQueries({ queryKey: ["communication-timeline", leadId] });
      void loadCommunicationTimeline();
    };

    socket.on("lead:email_received", refreshTimeline);
    socket.on("lead:email_sent", refreshTimeline);

    return () => {
      socket.off("lead:email_received", refreshTimeline);
      socket.off("lead:email_sent", refreshTimeline);
      socket.disconnect();
      leadSocketRef.current = null;
      setIsLeadSocketConnected(false);
    };
  }, [leadId, queryClient]);

  useEffect(() => {
    if (isLeadSocketConnected) return;
    const timer = window.setInterval(() => {
      void loadCommunicationTimeline();
    }, 30000);
    return () => {
      window.clearInterval(timer);
    };
  }, [isLeadSocketConnected, leadId]);

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

  const handleCompleteTask = async (task: Task) => {
    if (task.type === "followup") {
      setCompletingTaskId(task.id);
      setCompletionOutcome("");
      return;
    }

    try {
      await updateTask(task.id, { status: "COMPLETED" });
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      setFollowUps((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: "COMPLETED" } : t)));
      toast({ title: "Success", description: "Task marked as completed" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to complete task",
        variant: "destructive",
      });
    }
  };

  const handleConfirmFollowupComplete = async (taskId: string) => {
    if (!completionOutcome.trim()) {
      toast({
        title: "Error",
        description: "Please enter outcome before completing follow-up",
        variant: "destructive",
      });
      return;
    }

    try {
      await updateTask(taskId, { status: "COMPLETED", outcome: completionOutcome.trim() });
      await queryClient.invalidateQueries({ queryKey: ["tasks-today"] });
      await queryClient.invalidateQueries({ queryKey: ["task-summary"] });
      setFollowUps((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "COMPLETED", outcome: completionOutcome.trim() } : t
        )
      );
      setCompletingTaskId(null);
      setCompletionOutcome("");
      toast({ title: "Success", description: "Follow-up marked as completed" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to complete follow-up",
        variant: "destructive",
      });
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
      const fields = await listAdminFields("lead");
      setCustomFields(fields.sort((a, b) => a.display_order - b.display_order));
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
  const emailTimelineItems = (communicationTimeline.length > 0 ? communicationTimeline : [])
    .filter((item) => (item.channel || "").toUpperCase() === "EMAIL");
  const nonEmailTimelineItems = timelineItems.filter((item) => {
    if (item.type === "activity") return true;
    const comm = item.data as LeadCommunication & { channel?: string };
    return (comm.channel || "").toUpperCase() !== "EMAIL";
  });

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
    return <PageSkeleton variant="detail" />;
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

  const getStageLabel = (stageId: string) => {
    const stage = pipelineStages.find(s => s._id === stageId);
    return stage?.name || "Unknown Stage";
  };

  const handleStatusChange = async () => {
    // MANDATORY DATA VALIDATION (SOP 1.9)
    if (["PAYMENT_REQUEST", "BOOKED"].includes(localStage)) {
      const missingFields: string[] = [];
      const lead = leadDetail?.lead;
      const hasItinerary = lead?.itineraries && lead.itineraries.length > 0;
      if (!hasItinerary || !lead?.itineraries?.[0]?.checkInDate) missingFields.push("Check-in Date");
      if (!hasItinerary || !lead?.itineraries?.[0]?.checkOutDate) missingFields.push("Check-out Date");
      if (!hasItinerary || !lead?.itineraries?.[0]?.numberOfGuests) missingFields.push("Guest Count");

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
        hotels: [{
          checkInDate: details.checkInDate,
          checkOutDate: details.checkOutDate,
          numberOfGuests: details.guests
            ? `${details.guests.adults || 0} Adults, ${details.guests.children || 0} Children`
            : `${details.roomsRequested || 1} Rooms`,
        }],
        occasion: details.occasion,
        budget: details.budget ? Number(details.budget) : undefined,
        customerType: details.customerType || undefined,
        bookingWindow: details.bookingWindow || undefined,
        notes: details.notes || undefined,
        source: details.source || undefined,
        heatLevel: details.heatLevel || undefined,
        customData: {
          ...(details.customData || {}),
          ...(details.budget != null && details.budget !== "" && { budget: String(details.budget) }),
          ...(details.customerType && { customer_type: details.customerType }),
          ...(details.bookingWindow && { booking_window: details.bookingWindow }),
        },
      };

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

  const handleStageMoveClick = async (targetStageId: string) => {
    setStageMoveError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
        method: "PATCH",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ stageId: targetStageId }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 422 && data.missingFields?.length) {
        const stage = pipelineStages.find((s) => s._id === targetStageId);
        setStageMoveError({
          stageName: stage?.name ?? "that stage",
          missingFields: data.missingFields,
        });
        return;
      }
      if (!res.ok) throw new Error(data.message || data.error || "Failed to move stage");
      await loadLeadDetail();
      toast({ title: "Stage updated", description: "Lead moved successfully" });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to move stage",
        variant: "destructive",
      });
    }
  };

  const scrollToField = (slug: string) => {
    const el = document.getElementById(`field-${slug}`);
    el?.scrollIntoView({ behavior: "smooth" });
  };

  const propertyName = (lead?.propertyId as any)?.name ?? lead?.itineraries?.[0]?.hotelName ?? '—';

  const checkIn = lead?.itineraries?.[0]?.checkInDate ?? getField(lead, 'checkInDate', 'travelDate', 'travel_date');
  const travelDates = checkIn ? new Date(checkIn).toLocaleDateString('en-IN') : 'Not specified';

  const primaryCheckIn = checkIn;
  const primaryCheckOut = lead?.itineraries?.[0]?.checkOutDate ?? getField(lead, 'checkOutDate', 'check_out_date');

  const budget = getField(lead, 'budget', 'estimatedValue');
  const budgetValue = budget ? `₹${Number(budget).toLocaleString('en-IN')}` : '—';

  const customerType = getField(lead, 'customerType', 'customer_type', 'leadType');
  const customerTypeValue = customerType || '—';

  const bookingWindow = getField(lead, 'bookingWindow', 'booking_window');
  const bookingWindowValue = bookingWindow || '—';

  const firstItinerary = lead?.itineraries?.[0];
  const primaryGuests = firstItinerary?.numberOfGuests;
  const roomLines = (firstItinerary as { rooms?: { roomCategory?: string; numberOfGuests?: string }[] })?.rooms;
  const roomCount = roomLines?.length ?? 0;
  const occupancy = primaryGuests
    ? primaryGuests + (roomCount > 1 ? ` (${roomCount} rooms)` : "")
    : lead.guests
      ? `${lead.guests.adults || 0} Adults, ${lead.guests.children || 0} Children`
      : "Not specified";

  const subtitleEl = (
    <span className="flex items-center gap-2 flex-wrap">
      {guestPhone && <span>{guestPhone}</span>}
      {lead.source && <Badge label={lead.source} variant={getSourceBadgeVariant(lead.source)} />}
    </span>
  );

  return (
    <div className={embedded ? "space-y-4 p-4" : "space-y-6"}>
      {!embedded && (
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
      )}
      <PageHeader
        title={guestName || "Lead"}
        subtitle={guestPhone || lead.source ? subtitleEl : undefined}
        actions={
          <>
            <Button variant="secondary" icon={Phone} size="sm">
              Call
            </Button>
            <Button variant="secondary" icon={MessageSquare} size="sm">
              WhatsApp
            </Button>
            <Button
              variant="secondary"
              icon={Mail}
              size="sm"
              onClick={() => {
                setReplyToEmailItem(null);
                setIsComposeEmailOpen(true);
              }}
            >
              New Email
            </Button>
            <Button
              variant="secondary"
              icon={FileText}
              size="sm"
              onClick={() => setIsQuotationDialogOpen(true)}
            >
              Send Quotation
            </Button>
            <Button variant="primary" icon={Edit2} size="sm" onClick={() => setIsEditLeadDetailsDialogOpen(true)}>
              Edit Lead
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(260px,280px)_1fr_minmax(280px,300px)]">
        {/* LEFT — identity & stage */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          <div
            ref={leadInfoRef}
            className="rounded-md border border-border bg-surface p-5 shadow-sm"
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: "Guest Name", value: guestName || "—" },
                { label: "Phone", value: guestPhone || "—" },
                { label: "Email", value: guestEmail || "—" },
                { label: "Source", value: lead.source || "—" },
                { label: "Property/Hotel", value: propertyName },
                { label: "Budget", value: budgetValue },
                { label: "Travel Date", value: travelDates },
                { label: "Booking Window", value: bookingWindowValue },
                { label: "Customer Type", value: customerTypeValue },
                { label: "Lead Score", value: lead.score != null ? `${lead.score}/10` : "—" },
                { label: "Stage", value: getStageLabel(lead.stageId || "") },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: 3 }}>
                    {label}
                  </div>
                  <div style={{ fontSize: 14, color: "var(--text)" }}>{value}</div>
                </div>
              ))}
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                paddingTop: 16,
                borderTop: "1px solid var(--border-light)",
                marginTop: 16,
              }}
            >
              <span
                style={{
                  fontSize: 14,
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  background: lead.heatLevel === "HOT" ? "var(--hot-bg)" : lead.heatLevel === "WARM" ? "var(--warm-bg)" : lead.heatLevel === "COLD" ? "var(--cold-bg)" : "var(--border-light)",
                  color: lead.heatLevel === "HOT" ? "var(--hot-text)" : lead.heatLevel === "WARM" ? "var(--warm-text)" : lead.heatLevel === "COLD" ? "var(--cold-text)" : "var(--text-muted)",
                }}
              >
                {lead.heatLevel}
              </span>
              {lead.score != null && (
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: lead.heatLevel === "HOT" ? "var(--hot-text)" : lead.heatLevel === "WARM" ? "var(--warm-text)" : lead.heatLevel === "COLD" ? "var(--cold-text)" : "var(--text)",
                  }}
                >
                  {lead.score}/10
                </span>
              )}
              {(() => {
                const activityTimes = leadDetail.activities.map((a) => (a.performedAt ? new Date(a.performedAt).getTime() : 0));
                const commTimes = communicationTimeline.map((c) => (c.createdAt || c.receivedAt || c.sentAt ? new Date(c.createdAt || c.receivedAt || c.sentAt || "").getTime() : 0));
                const allTimes = [...activityTimes, ...commTimes].filter((t) => t > 0);
                const lastActivity = allTimes.length > 0 ? Math.max(...allTimes) : lead.createdAt ? new Date(lead.createdAt).getTime() : 0;
                const hours = lastActivity ? (Date.now() - lastActivity) / (1000 * 60 * 60) : 0;
                if (hours >= 72) return <span style={{ fontSize: 12, color: "#ef4444" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#ef4444", marginRight: 4, verticalAlign: "middle" }} />Inactive 72h</span>;
                if (hours >= 48) return <span style={{ fontSize: 12, color: "#f59e0b" }}><span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#f59e0b", marginRight: 4, verticalAlign: "middle" }} />Inactive 48h</span>;
                return null;
              })()}
            </div>
          </div>

          {/* Pipeline Stage Bar */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <div className="flex flex-wrap items-center gap-1">
              {pipelineStages.map((stage, idx) => {
                const currentStageIdx = pipelineStages.findIndex((s) => s._id === lead.stageId);
                const isCurrent = idx === currentStageIdx;
                const isPast = idx < currentStageIdx;
                const isFuture = idx > currentStageIdx;
                const isTerminal = stage.terminalType === "WON" || stage.terminalType === "LOST";
                return (
                  <span key={stage._id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => isFuture && canUpdate && handleStageMoveClick(stage._id)}
                      disabled={!isFuture || !canUpdate}
                      style={{
                        fontSize: 13,
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: isCurrent ? "var(--primary-light)" : "transparent",
                        color: isCurrent ? "var(--primary)" : "var(--text-faint)",
                        fontWeight: isCurrent ? 500 : 400,
                        border: isCurrent ? "1px solid #c7d2fe" : "none",
                        cursor: isFuture && canUpdate ? "pointer" : "default",
                      }}
                    >
                      {isTerminal && stage.terminalType === "WON" && <CheckCircle className="w-3 h-3 inline mr-1" />}
                      {isTerminal && stage.terminalType === "LOST" && <XCircle className="w-3 h-3 inline mr-1" />}
                      {stage.name}
                    </button>
                    {idx < pipelineStages.length - 1 && <ChevronRight className="w-4 h-4 text-[var(--text-faint)]" />}
                  </span>
                );
              })}
            </div>
            {stageMoveError && (
              <div
                style={{
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "var(--radius)",
                  padding: "12px 16px",
                  marginTop: 8,
                }}
              >
                Cannot move to {stageMoveError.stageName}. Please fill:{" "}
                {stageMoveError.missingFields.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => scrollToField(f.slug)}
                    className="underline text-[#b91c1c] hover:no-underline ml-1"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* CENTER — timeline & communications */}
        <div className="min-w-0 space-y-4">
          <div className="rounded-md border border-border bg-surface p-5 shadow-sm">
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 16 }}>Activity</div>
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between">
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>Email Threads</span>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setReplyToEmailItem(null);
                    setIsComposeEmailOpen(true);
                  }}
                >
                  New Email
                </Button>
              </div>
              <EmailThreadView
                items={emailTimelineItems}
                onReply={(message) => {
                  setReplyToEmailItem(message);
                  setIsComposeEmailOpen(true);
                }}
              />
            </div>
            <div style={{ borderLeft: "2px solid var(--border-light)", paddingLeft: 16 }}>
              {nonEmailTimelineItems.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)", paddingBottom: 16 }}>No activity yet</p>
              ) : (
                nonEmailTimelineItems.map((item, index) => {
                  const isActivity = item.type === "activity";
                  const activity = isActivity ? (item.data as LeadActivity) : null;
                  const comm = !isActivity ? (item.data as LeadCommunication & { channel?: string }) : null;
                  let iconBg = "#f3f4f6";
                  let iconColor = "#374151";
                  let IconComponent = FileText;
                  if (isActivity && activity) {
                    if (activity.type === "NOTE") {
                      iconBg = "#f3f4f6";
                      iconColor = "#374151";
                      IconComponent = FileText;
                    } else if (activity.type === "STATUS_CHANGE") {
                      iconBg = "var(--primary-light)";
                      iconColor = "var(--primary)";
                      IconComponent = GitBranch;
                    } else if (["LEAD_CREATED", "QUOTE_SENT", "PAYMENT_LINK_SENT", "PAYMENT_RECEIVED", "CLIENT_RESPONSE"].includes(activity.type)) {
                      iconBg = "#fffbeb";
                      iconColor = "#f59e0b";
                      IconComponent = Star;
                    } else if (activity.type === "FOLLOW_UP") {
                      iconBg = "#f0fdf4";
                      iconColor = "#166534";
                      IconComponent = CheckSquare;
                    } else {
                      IconComponent = FileText;
                    }
                  } else if (comm) {
                    if (comm.channel === "CALL") {
                      iconBg = "#dbeafe";
                      iconColor = "#1e40af";
                      IconComponent = Phone;
                    } else if (comm.channel === "WHATSAPP") {
                      iconBg = "#d1fae5";
                      iconColor = "#065f46";
                      IconComponent = MessageSquare;
                    } else if (comm.channel === "EMAIL") {
                      iconBg = "#fce7f3";
                      iconColor = "#9d174d";
                      IconComponent = Mail;
                    }
                  }
                  const title = isActivity && activity ? formatTimelineMessage(activity, users) : comm ? formatCommunicationMessage(comm, users) : "";
                  const body = isActivity && activity?.note && activity.type !== "NOTE" ? activity.note : comm?.summary || "";
                  return (
                    <div key={index} className="flex gap-3 pb-4" style={{ position: "relative" }}>
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: "50%",
                          background: iconBg,
                          color: iconColor,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <IconComponent className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{title}</div>
                        {body && <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{body}</div>}
                        <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>{formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-4">
              <Textarea
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="Add a note..."
                style={{ minHeight: 72, width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 14, resize: "vertical" }}
                disabled={!canUpdate || isAddingNote}
              />
              <div className="flex justify-end mt-2">
                <Button variant="primary" size="sm" onClick={handleAddNote} loading={isAddingNote} disabled={!activityNote.trim() || !canUpdate}>
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT — actions & tasks */}
        <div className="space-y-4 xl:sticky xl:top-4 xl:self-start">
          {/* Follow-ups Card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontSize: 14, fontWeight: 600 }}>Follow-ups</span>
              <Button variant="ghost" size="sm" icon={Plus} onClick={() => setIsScheduleFollowUpOpen(true)}>Add</Button>
            </div>
            <div>
              {followUps.length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No follow-ups</p>
              ) : (
                followUps.slice(0, 10).map((task) => {
                  const isOverdue = task.status === "OPEN" && task.dueAt && new Date(task.dueAt) < new Date();
                  return (
                    <div key={task.id}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid #f3f4f6",
                        borderLeft: isOverdue ? "2px solid #f87171" : undefined,
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--text)" }}>
                          <Clock className="w-4 h-4" style={{ color: "var(--text-faint)" }} />
                          {task.dueAt && format(new Date(task.dueAt), "MMM d, h:mm a")}
                        </div>
                        {task.title && (
                          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                            {task.title}
                            <span className="ml-2 text-xs text-gray-400">{task.type}</span>
                            {task.isAutoGenerated && (
                              <span className="text-xs text-gray-400 ml-2">auto</span>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            borderRadius: "var(--radius-sm)",
                            background: task.status === "COMPLETED" ? "#d1fae5" : isOverdue ? "#fef2f2" : "#f3f4f6",
                            color: task.status === "COMPLETED" ? "#065f46" : isOverdue ? "#ef4444" : "var(--text-muted)",
                          }}
                        >
                          {task.status === "COMPLETED" ? "Done" : isOverdue ? "Overdue" : "Pending"}
                        </span>
                        {task.status === "OPEN" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCompleteTask(task)}
                            className="rounded-md border-gray-200"
                          >
                            Complete
                          </Button>
                        )}
                        <button type="button" className="opacity-0 hover:opacity-100 transition-opacity" aria-label="More">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    {completingTaskId === task.id && (
                      <div className="py-2 border-b border-gray-100">
                        <Textarea
                          placeholder="What happened?"
                          rows={2}
                          value={completionOutcome}
                          onChange={(e) => setCompletionOutcome(e.target.value)}
                          className="text-sm border-gray-200"
                        />
                        <div className="flex items-center gap-2 mt-2">
                          <Button
                            size="sm"
                            onClick={() => handleConfirmFollowupComplete(task.id)}
                            className="rounded-md"
                          >
                            Confirm Complete
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCompletingTaskId(null);
                              setCompletionOutcome("");
                            }}
                            className="rounded-md border-gray-200"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Assignment Card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 11, textTransform: "uppercase" as const, letterSpacing: "0.05em", color: "var(--text-faint)", marginBottom: 8 }}>Assigned To</div>
            {assignedUser ? (
              <div>
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      background: "var(--primary-light)",
                      color: "var(--primary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 600,
                    }}
                  >
                    {assignedUser.name?.slice(0, 2).toUpperCase() || "?"}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{assignedUser.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{(assignedUser as any).roleId || "Agent"}</div>
                  </div>
                </div>
                {canAssign && <Button variant="ghost" size="sm" className="mt-2">Reassign</Button>}
              </div>
            ) : (
              <div>
                <div style={{ fontStyle: "italic", color: "var(--text-faint)", marginBottom: 8 }}>Unassigned</div>
                {canAssign && <Button variant="secondary" size="sm">Assign</Button>}
              </div>
            )}
          </div>

          {/* Workflow Execution Log Card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Automations</div>
            {workflowLogs.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No automations run yet</p>
            ) : (
              <>
                {workflowLogs.slice(0, 5).map((log) => {
                  const wf = typeof log.workflowId === "object" ? log.workflowId : null;
                  const statusColor = log.status === "completed" ? "#22c55e" : log.status === "failed" ? "#f97316" : "#9ca3af";
                  return (
                    <div key={log.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" style={{ color: statusColor }} />
                        <span style={{ fontSize: 13 }}>{wf?.name ?? "Workflow"}</span>
                      </div>
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{formatDistanceToNow(new Date(log.executed_at), { addSuffix: true })}</span>
                    </div>
                  );
                })}
                {workflowLogs.length > 5 && <a href="#" className="text-sm text-[var(--primary)] mt-2 block">View all</a>}
              </>
            )}
          </div>

          {/* Call Quality Card */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Call Quality</div>
            {callQualityScores.length === 0 ? (
              <div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>No scores yet</p>
                {canScoreCall && (
                  <Button variant="secondary" size="sm" icon={Star} className="mt-2" onClick={() => setIsCallQualityModalOpen(true)}>Score This Call</Button>
                )}
              </div>
            ) : (
              <div>
                {(() => {
                  const latest = callQualityScores[0];
                  const scoredBy = typeof latest.scored_by === "object" ? latest.scored_by?.name : "Unknown";
                  return (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 700, color: "var(--primary)" }}>{latest.weighted_total}/100</div>
                      {latest.scores_json && Object.entries(latest.scores_json).map(([dimId, score]) => {
                        const dim = callQualityDimensions.find((d) => d.id === dimId || String(d.id) === dimId);
                        return (
                          <div key={dimId} className="flex items-center gap-2 mt-2">
                            <span style={{ fontSize: 12 }}>{dim?.name ?? dimId}</span>
                            <div style={{ flex: 1, height: 4, background: "var(--border-light)", borderRadius: 2 }}>
                              <div style={{ width: `${score * 10}%`, height: "100%", background: "var(--primary)", borderRadius: 2 }} />
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 500 }}>{score}</span>
                          </div>
                        );
                      })}
                      <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 8 }}>Scored by {scoredBy} · {format(new Date(latest.createdAt), "MMM d, yyyy")}</div>
                      {canScoreCall && (
                        <Button variant="secondary" size="sm" icon={Star} className="mt-3" onClick={() => setIsCallQualityModalOpen(true)}>Score This Call</Button>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <Dialog open={isComposeEmailOpen} onOpenChange={setIsComposeEmailOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{replyToEmailItem ? "Reply by Email" : "New Email"}</DialogTitle>
          </DialogHeader>
          <LeadEmailComposer
            leadId={leadId}
            guestEmail={guestEmail}
            replyTo={replyToEmailItem ? {
              messageId: replyToEmailItem.metadata?.messageId || "",
              threadId: replyToEmailItem.metadata?.threadId || replyToEmailItem.threadId || "",
              from:
                (typeof replyToEmailItem.metadata?.from === "string"
                  ? replyToEmailItem.metadata?.from
                  : replyToEmailItem.metadata?.from?.email) ||
                replyToEmailItem.from?.email ||
                guestEmail,
              subject: replyToEmailItem.summary || "",
              bodyHtml: replyToEmailItem.messageContent,
              sentAt: replyToEmailItem.createdAt || replyToEmailItem.receivedAt || replyToEmailItem.sentAt,
            } : undefined}
            onSent={() => {
              toast({ title: "Success", description: "Email sent successfully" });
              setIsComposeEmailOpen(false);
              void queryClient.invalidateQueries({ queryKey: ["communication-timeline", leadId] });
              void loadCommunicationTimeline();
            }}
            onClose={() => setIsComposeEmailOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Schedule Follow-up Dialog */}
      <ScheduleFollowUpDialog
        open={isScheduleFollowUpOpen}
        onOpenChange={setIsScheduleFollowUpOpen}
        leadId={lead.id}
        leadNumber={lead.leadNumber}
        defaultFollowUpType="call"
        pauseWorkflowOnSchedule={true}
        onSuccess={() => {
          toast({ title: "Success", description: "Follow-up scheduled successfully" });
          void loadLeadDetail();
          void listTasksForLead(leadId).then(setFollowUps).catch(() => setFollowUps([]));
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
          checkInDate: primaryCheckIn,
          checkOutDate: primaryCheckOut,
          roomsRequested: (lead as any).roomsRequested,
          guests: lead.guests,
          occasion: (lead as any).occasion,
          customData: lead.customData,
          budget: lead.budget ?? getField(lead, "budget"),
          customerType: lead.customerType ?? getField(lead, "customerType", "customer_type"),
          bookingWindow: lead.bookingWindow ?? getField(lead, "bookingWindow", "booking_window"),
          notes: lead.notes,
          source: lead.source,
          heatLevel: lead.heatLevel,
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

      {/* Call Quality Score Modal (TL only) */}
      {isCallQualityModalOpen && (
        <CallQualityScoreModal
          dimensions={callQualityDimensions}
          onClose={() => setIsCallQualityModalOpen(false)}
          onSubmit={async (scoresJson, notes) => {
            await submitCallQuality(leadId, { scoresJson, notes });
            setIsCallQualityModalOpen(false);
            void getCallQuality(leadId).then(setCallQualityScores).catch(() => setCallQualityScores([]));
            toast({ title: "Success", description: "Call quality scored" });
          }}
        />
      )}
    </div>
  );
};

function CallQualityScoreModal({
  dimensions,
  onClose,
  onSubmit,
}: {
  dimensions: CallQualityDimension[];
  onClose: () => void;
  onSubmit: (scoresJson: Record<string, number>, notes: string) => Promise<void>;
}) {
  const [scores, setScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const scoresJson: Record<string, number> = {};
    dimensions.forEach((d) => {
      const v = scores[d.id];
      scoresJson[d.id] = typeof v === "number" && v >= 0 && v <= 10 ? v : 0;
    });
    setLoading(true);
    try {
      await onSubmit(scoresJson, notes);
    } catch {
      // Toast handled by parent
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: "var(--radius-md)",
          padding: 24,
          maxWidth: 480,
          width: "90%",
          boxShadow: "var(--shadow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Score Call Quality</div>
        <div className="space-y-4">
          {dimensions.map((d) => (
            <div key={d.id} className="flex justify-between items-center gap-4">
              <label className="flex-1" style={{ fontSize: 14 }}>{d.name}</label>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{d.weight_percent}%</span>
              <input
                type="number"
                min={0}
                max={10}
                value={scores[d.id] ?? ""}
                onChange={(e) => setScores((prev) => ({ ...prev, [d.id]: parseFloat(e.target.value) || 0 }))}
                style={{ width: 64, textAlign: "center", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "6px 8px" }}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 14, display: "block", marginBottom: 4 }}>Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              style={{ width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "8px 12px" }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={loading}>Submit</Button>
        </div>
      </div>
    </div>
  );
}

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
                <Badge label={quote.status} className={getStatusColor(quote.status)} />
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

