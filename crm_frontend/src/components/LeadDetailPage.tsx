import { useEffect, useMemo, useState, useRef } from "react";
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
  Building2,
  BedDouble,
} from "lucide-react";
import { Button, Badge, PageHeader } from "@/components/shared";
import { getLeadDetail, LeadDetail, LeadActivity, LeadCommunication, updateLead, addLeadNote, LeadStatus, HeatLevel, getLeadContactInfo, LeadContactDetails } from "@/services/leads";
import { canEditLeadField, canReassignLeadByProfile } from "@/lib/leadFieldEdit";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { EditContactDetailsDialog } from "@/components/EditContactDetailsDialog";
import { EditLeadDialog } from "@/components/EditLeadDialog";
import { CreateBookingDialog } from "@/components/CreateBookingDialog";
import { listAdminFields, AdminField } from "@/services/adminFields";
import { listTasksForLead, Task, updateTask } from "@/services/tasks";
import { getCallQuality, submitCallQuality, getCallQualityDimensions, type CallQualityScore, type CallQualityDimension } from "@/services/callQuality";
import { getWorkflowLogsForLead, type WorkflowExecutionLog } from "@/services/workflowLogs";
import { EmailThreadView } from "@/components/email/EmailThreadView";
import { SharedEmailComposer } from "@/components/email/SharedEmailComposer";
import { KBQuickDrawer } from "@/components/knowledge/directory/KBQuickDrawer";
import { extractLeadPropertyId } from "@/lib/leadPropertyId";
import { getProperty } from "@/services/properties";
import { BookRoomDialog } from "@/components/BookRoomDialog";
import { BookingDetailDialog } from "@/components/booking/BookingDetailDialog";
import { listLeadBookings, type LeadBooking, cancelEzeeBooking } from "@/services/leadBookings";
import {
  bookingPropertyId,
  isItineraryPendingForBookings,
} from "@/lib/pendingTravel";

interface LeadDetailPageProps {
  leadId: string;
  onBack: () => void;
  permissions?: string[];
  isAdmin?: boolean;
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
      if (activity.note?.trim()) {
        return activity.note.trim();
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

    case "PMS_ROOM_UPDATED":
      return activity.note || "Room details updated from PMS";

    case "PMS_RATE_UPDATED":
      return activity.note || "Rate updated";

    case "PMS_BOOKING_CREATED":
      return activity.note || "Booking created in PMS";

    case "PMS_BOOKING_CANCELLED":
      return activity.note || "Booking cancelled in PMS";

    default:
      return activity.note || activity.type;
  }
};

function activityTimelineBody(activity: LeadActivity, title: string): string {
  const note = activity.note?.trim();
  if (!note || activity.type === "NOTE") return "";
  if (note === title.trim()) return "";
  return note;
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
    case "PMS_ROOM_UPDATED":
      return <BedDouble className="h-4 w-4 text-indigo-500" />;
    case "PMS_RATE_UPDATED":
      return <IndianRupee className="h-4 w-4 text-amber-600" />;
    case "PMS_BOOKING_CREATED":
      return <CheckCircle className="h-4 w-4 text-emerald-600" />;
    case "PMS_BOOKING_CANCELLED":
      return <XCircle className="h-4 w-4 text-red-500" />;
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

type NormalizedRoomReq = {
  roomTypeId?: string;
  roomTypeName?: string;
  quantity?: number;
  adults?: number;
  children?: number;
  notes?: string;
};

type NormalizedItinerary = {
  propertyId?: string;
  propertyName?: string;
  hotelName?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomsRequested: NormalizedRoomReq[];
};

function toYmd(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value.split("T")[0];
  try {
    if (value instanceof Date) return value.toISOString().split("T")[0];
  } catch {
    // ignore
  }
  return undefined;
}

function formatYmdForDisplay(ymd?: string): string {
  if (!ymd) return "—";
  try {
    return new Date(ymd).toLocaleDateString("en-IN");
  } catch {
    return ymd;
  }
}

function normalizeItineraries(lead: any, bookings: LeadBooking[] = []): NormalizedItinerary[] {
  const raw = Array.isArray(lead?.itineraries) ? lead.itineraries : [];
  const fromItins: NormalizedItinerary[] = raw
    .map((it: any) => {
      const propertyId =
        (it?.propertyId && typeof it.propertyId === "object" ? it.propertyId?._id : it?.propertyId) || undefined;
      const propertyName =
        (it?.propertyId && typeof it.propertyId === "object" ? it.propertyId?.name : undefined) || undefined;
      const rooms: any[] = Array.isArray(it?.roomsRequested) ? it.roomsRequested : [];
      const roomsRequested: NormalizedRoomReq[] = rooms.map((r) => ({
        roomTypeId: r?.roomTypeId ? String(r.roomTypeId) : undefined,
        roomTypeName: r?.roomTypeName ? String(r.roomTypeName) : undefined,
        quantity: r?.quantity != null ? Number(r.quantity) : undefined,
        adults: r?.adults != null ? Number(r.adults) : undefined,
        children: r?.children != null ? Number(r.children) : undefined,
        notes: r?.notes ? String(r.notes) : undefined,
      }));

      return {
        propertyId,
        propertyName,
        hotelName: it?.hotelName ? String(it.hotelName) : propertyName,
        checkInDate: toYmd(it?.checkInDate),
        checkOutDate: toYmd(it?.checkOutDate),
        roomsRequested,
      };
    })
    .filter((x) => x.propertyId || x.hotelName || x.checkInDate || x.checkOutDate || x.roomsRequested.length);

  if (fromItins.length) return fromItins;

  // Fallback for older leads: single "primary" booking fields
  const fallbackHotel =
    (lead?.propertyId && typeof lead.propertyId === "object" ? lead.propertyId?.name : undefined) ||
    lead?.hotelName ||
    lead?.propertyName;

  const fallbackRooms: NormalizedRoomReq[] =
    lead?.roomTypeId || lead?.roomTypeName
      ? [
          {
            roomTypeId: lead?.roomTypeId ? String(lead.roomTypeId) : undefined,
            roomTypeName: lead?.roomTypeName ? String(lead.roomTypeName) : undefined,
            quantity: lead?.roomsRequested != null ? Number(lead.roomsRequested) : undefined,
            adults: lead?.adults != null ? Number(lead.adults) : undefined,
            children: lead?.children != null ? Number(lead.children) : undefined,
          },
        ]
      : [];

  const fallback: NormalizedItinerary = {
    propertyId:
      (lead?.propertyId && typeof lead.propertyId === "object" ? lead.propertyId?._id : lead?.propertyId) || undefined,
    propertyName:
      (lead?.propertyId && typeof lead.propertyId === "object" ? lead.propertyId?.name : undefined) || undefined,
    hotelName: fallbackHotel ? String(fallbackHotel) : undefined,
    checkInDate: toYmd(lead?.checkIn),
    checkOutDate: toYmd(lead?.checkOut),
    roomsRequested: fallbackRooms,
  };

  if (bookings.length > 0) {
    const fid = fallback.propertyId ? String(fallback.propertyId) : undefined;
    if (!fid || bookings.some((b) => bookingPropertyId(b) === fid)) {
      return [];
    }
  }

  if (fallback.propertyId || fallback.hotelName || fallback.checkInDate || fallback.checkOutDate || fallback.roomsRequested.length) {
    return [fallback];
  }
  return [];
}

export const LeadDetailPage = ({ leadId, onBack, permissions, isAdmin }: LeadDetailPageProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [leadDetail, setLeadDetail] = useState<LeadDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [leadEmails, setLeadEmails] = useState<EmailMessage[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = useState(false);
  const [emailComposerOpen, setEmailComposerOpen] = useState(false);
  const [replyComposerOpen, setReplyComposerOpen] = useState(false);
  const [replyToEmailItem, setReplyToEmailItem] = useState<CommunicationTimelineItem | null>(null);

  // Custom fields state
  const [customFields, setCustomFields] = useState<AdminField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);

  const [isQuotationDialogOpen, setIsQuotationDialogOpen] = useState(false);
  const [kbDrawerOpen, setKbDrawerOpen] = useState(false);
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
  const [activityFilter, setActivityFilter] = useState<"all" | "emails">("all");
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [isEditContactDialogOpen, setIsEditContactDialogOpen] = useState(false);
  const [isEditLeadDialogOpen, setIsEditLeadDialogOpen] = useState(false);
  const [isCreateBookingDialogOpen, setIsCreateBookingDialogOpen] = useState(false);
  const [isReassignDialogOpen, setIsReassignDialogOpen] = useState(false);
  const [reassignUserId, setReassignUserId] = useState("");
  const [isSavingReassign, setIsSavingReassign] = useState(false);

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

  const [leadBookings, setLeadBookings] = useState<LeadBooking[]>([]);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [hotelPickOpen, setHotelPickOpen] = useState(false);
  const [bookRoomOpen, setBookRoomOpen] = useState(false);
  const [bookableHotels, setBookableHotels] = useState<
    { hotelId: string; hotelName: string; checkIn: string; checkOut: string }[]
  >([]);
  const [selectedHotelForBooking, setSelectedHotelForBooking] = useState<
    { hotelId: string; hotelName: string; checkIn: string; checkOut: string } | null
  >(null);
  const [bookingDetailOpen, setBookingDetailOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [cancelBookingTarget, setCancelBookingTarget] = useState<LeadBooking | null>(null);
  const [isCancellingBooking, setIsCancellingBooking] = useState(false);

  const formatBookingMoney = (n: number | undefined | null) => {
    if (n === undefined || n === null || !Number.isFinite(n)) return "—";
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
  };

  const canScoreCall = !!isAdmin || permissions?.includes("leads.manage") || permissions?.includes("settings.manage");

  // Permission checks (legacy) + per-field keys from GET /leads/:id (`editableLeadFields`)
  const legacyLeadUpdate =
    !!isAdmin || permissions?.includes("leads.update") || permissions?.includes("leads.manage");
  const canEditField = (key: string) =>
    canEditLeadField(leadDetail?.editableLeadFields, key, legacyLeadUpdate);
  const canAssign = !!isAdmin || permissions?.includes("leads.assign") || permissions?.includes("leads.manage");
  const canReassign = canEditLeadField(
    leadDetail?.editableLeadFields,
    "assignedToUserId",
    canReassignLeadByProfile(permissions, isAdmin)
  );

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
      void loadLeadBookings(leadId);
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

  const loadLeadBookings = async (leadId: string) => {
    try {
      setIsLoadingBookings(true);
      const rows = await listLeadBookings(leadId);
      setLeadBookings(rows);
    } catch {
      setLeadBookings([]);
    } finally {
      setIsLoadingBookings(false);
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
      const activeOnly = fields.filter((f) => f.is_active);
      setCustomFields(activeOnly.sort((a, b) => a.display_order - b.display_order));
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
  const timelineItems = useMemo(() => {
    if (!leadDetail) return [];
    const activities = leadDetail.activities
      .filter((a) => a.type !== "REMINDER_TRIGGERED")
      .map((activity) => ({
        type: "activity" as const,
        data: activity,
        timestamp: activity.performedAt ? new Date(activity.performedAt).getTime() : 0,
      }));
    const comms =
      communicationTimeline.length > 0
        ? communicationTimeline.map((item) => ({
            type: item.type as "communication" | "email",
            data: item,
            timestamp:
              item.createdAt || item.receivedAt || item.sentAt
                ? new Date(item.createdAt || item.receivedAt || item.sentAt || "").getTime()
                : 0,
          }))
        : leadDetail.communications.map((comm) => ({
            type: "communication" as const,
            data: comm,
            timestamp: comm.createdAt ? new Date(comm.createdAt).getTime() : 0,
          }));
    return [...activities, ...comms].sort((a, b) => b.timestamp - a.timestamp);
  }, [leadDetail, communicationTimeline]);

  const emailTimelineItems = useMemo(() => {
    return (communicationTimeline.length > 0 ? communicationTimeline : []).filter(
      (item) => (item.channel || "").toUpperCase() === "EMAIL"
    );
  }, [communicationTimeline]);

  // Must be defined before any early returns to preserve Hook order.
  const leadForMemos = (leadDetail?.lead ?? null) as any;
  const itineraries = useMemo(
    () => normalizeItineraries(leadForMemos, leadBookings),
    [leadForMemos, leadBookings]
  );

  const pendingItineraries = useMemo(() => {
    return itineraries.filter((it) => isItineraryPendingForBookings(it.propertyId, leadBookings));
  }, [itineraries, leadBookings]);

  const hasBookableTravel = useMemo(
    () => pendingItineraries.some((it) => it.propertyId && it.checkInDate && it.checkOutDate),
    [pendingItineraries]
  );

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
  const leadPropertyId = extractLeadPropertyId(lead, undefined, leadBookings);
  const assignedUser = users.find((u) => u.id === lead.assignedToUserId);

  // Prefer contactDetails (inquiry snapshot), fall back to guest
  const { name: guestName, email: guestEmail, phone: guestPhone } = getLeadContactInfo(lead);

  const getStageLabel = (stageId: string) => {
    const stage = pipelineStages.find(s => s._id === stageId);
    return stage?.name || "Unknown Stage";
  };

  const canOpenEditLead =
    canEditField("contactDetails") ||
    canEditField("hotels") ||
    canEditField("checkIn") ||
    canEditField("notes") ||
    canEditField("source") ||
    canEditField("heatLevel") ||
    canEditField("customData") ||
    canEditField("budget") ||
    canEditField("bookingWindow") ||
    canEditField("customerType") ||
    canEditField("estimatedRate");

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
      const patch: {
        status?: LeadStatus;
        stageId?: string;
        heatLevel?: HeatLevel;
        callStatus?: string;
      } = {};
      if (canEditField("status")) patch.status = localStatus;
      if (canEditField("stageId")) patch.stageId = localStage;
      if (canEditField("heatLevel")) patch.heatLevel = localHeatLevel;
      if (canEditField("callStatus")) patch.callStatus = localCallStatus || undefined;

      if (Object.keys(patch).length === 0) {
        toast({
          title: "Permission denied",
          description: "You don't have permission to update status, stage, heat, or call disposition.",
          variant: "destructive",
        });
        return;
      }

      await updateLead(leadId, patch);

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
    if (!canEditField("notes")) {
      toast({
        title: "Permission denied",
        description: "You can't edit lead notes.",
        variant: "destructive",
      });
      return;
    }
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

    if (!canEditField("notes")) {
      toast({
        title: "Permission denied",
        description: "You can't add notes on this lead.",
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
    if (!canEditField("contactDetails")) {
      toast({
        title: "Permission denied",
        description: "You can't edit contact details for this lead.",
        variant: "destructive",
      });
      return;
    }
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

  const propertyName =
    (lead?.propertyId as any)?.name ?? lead?.itineraries?.[0]?.hotelName ?? itineraries?.[0]?.hotelName ?? "—";

  const checkIn = lead?.itineraries?.[0]?.checkInDate ?? getField(lead, "checkInDate", "travelDate", "travel_date");
  const travelDates = checkIn ? new Date(checkIn).toLocaleDateString("en-IN") : "Not specified";

  const primaryCheckIn = checkIn;
  const primaryCheckOut = lead?.itineraries?.[0]?.checkOutDate ?? getField(lead, "checkOutDate", "check_out_date");

  const budget = getField(lead, "budget", "estimatedValue");
  const budgetValue = budget ? `₹${Number(budget).toLocaleString("en-IN")}` : "—";

  const customerType = getField(lead, "customerType", "customer_type", "leadType");
  const customerTypeValue = customerType || "—";

  const bookingWindow = getField(lead, "bookingWindow", "booking_window");
  const bookingWindowValue = bookingWindow || "—";

  const primaryGuests = lead?.itineraries?.[0]?.numberOfGuests;
  const occupancy = primaryGuests
    ? primaryGuests
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
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>
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
                setEmailComposerOpen(true);
              }}
            >
              New Email
            </Button>
            <Button
              variant="secondary"
              icon={FileText}
              size="sm"
              disabled={!hasBookableTravel}
              title={!hasBookableTravel ? "Add a travel plan (hotel, check-in, check-out) to send a quotation" : undefined}
              onClick={() => setIsQuotationDialogOpen(true)}
            >
              Send Quotation
            </Button>
            <Button
              variant="secondary"
              icon={Calendar}
              size="sm"
              disabled={!hasBookableTravel}
              title={!hasBookableTravel ? "Add a travel plan (hotel, check-in, check-out) to book a room" : undefined}
              onClick={async () => {
                if (!hasBookableTravel) return;
                try {
                  const candidates = pendingItineraries
                    .filter((it) => it.propertyId && it.checkInDate && it.checkOutDate)
                    .map((it) => ({
                      hotelId: String(it.propertyId),
                      hotelName: String(it.hotelName || it.propertyName || "Hotel"),
                      checkIn: String(it.checkInDate),
                      checkOut: String(it.checkOutDate),
                    }));

                  const uniqueByHotel = Array.from(
                    new Map(candidates.map((c) => [`${c.hotelId}::${c.checkIn}::${c.checkOut}`, c])).values()
                  );

                  if (uniqueByHotel.length === 0) {
                    toast({
                      title: "Missing itinerary",
                      description: "Add a hotel with check-in and check-out dates to book via PMS.",
                      variant: "destructive",
                    });
                    return;
                  }

                  const props = await Promise.all(
                    uniqueByHotel.map(async (c) => {
                      try {
                        const p: any = await getProperty(c.hotelId);
                        const ok =
                          String(p?.pmsProvider || "").toUpperCase() === "EZEE" &&
                          String(p?.pmsConfig?.hotelCode || "").trim() &&
                          String(p?.pmsConfig?.authCode || "").trim();
                        return ok ? c : null;
                      } catch {
                        return null;
                      }
                    })
                  );

                  const eligible = props.filter(Boolean) as typeof uniqueByHotel;
                  if (eligible.length === 0) {
                    toast({
                      title: "Not bookable",
                      description: "No eZee PMS hotel with valid credentials found on this lead.",
                      variant: "destructive",
                    });
                    return;
                  }

                  setBookableHotels(eligible);
                  if (eligible.length === 1) {
                    setSelectedHotelForBooking(eligible[0]);
                    setBookRoomOpen(true);
                    return;
                  }
                  setHotelPickOpen(true);
                } catch (e) {
                  toast({
                    title: "Could not start booking",
                    description: e instanceof Error ? e.message : "Try again.",
                    variant: "destructive",
                  });
                }
              }}
            >
              Book Room
            </Button>
            {leadPropertyId ? (
              <Button
                variant="secondary"
                icon={Building2}
                size="sm"
                onClick={() => setKbDrawerOpen(true)}
              >
                Property info
              </Button>
            ) : null}
            {canOpenEditLead && (
              <Button
                variant="primary"
                icon={Edit2}
                size="sm"
                onClick={() => setIsEditLeadDialogOpen(true)}
              >
                Edit Lead
              </Button>
            )}
          </>
        }
      />

      {/* 2-column layout: 65% left, 35% right */}
      <div className="grid grid-cols-1 lg:grid-cols-[65%_35%] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-4">
          {/* Lead Info Card */}
          <div
            ref={leadInfoRef}
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              {[
                { label: "Guest Name", value: guestName || "—" },
                { label: "Phone", value: guestPhone || "—" },
                { label: "Email", value: guestEmail || "—" },
                { label: "Source", value: lead.source || "—" },
                {
                  label: "Property/Hotel",
                  value:
                    leadPropertyId ? (
                      <span className="inline-flex items-center gap-2 flex-wrap">
                        <span>{propertyName}</span>
                        <button
                          type="button"
                          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
                          onClick={() => setKbDrawerOpen(true)}
                        >
                          Property info
                        </button>
                      </span>
                    ) : (
                      propertyName
                    ),
                },
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

          {/* Travel / Hotel bookings */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>Travel</div>
            {pendingItineraries.length === 0 ? (
              <div className="space-y-3">
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {leadBookings.length > 0
                    ? "No pending travel. To send a quotation or book again, add a new travel plan."
                    : "No hotel bookings added yet."}
                </div>
                {canOpenEditLead ? (
                  <Button variant="secondary" size="sm" icon={Plus} onClick={() => setIsEditLeadDialogOpen(true)}>
                    Add travel plan
                  </Button>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                {pendingItineraries.map((it, idx) => {
                  const title = it.hotelName || it.propertyName || "Hotel";
                  const dateLine = `${formatYmdForDisplay(it.checkInDate)} → ${formatYmdForDisplay(it.checkOutDate)}`;
                  const rooms = it.roomsRequested || [];
                  const showRooms = rooms.length > 0;
                  return (
                    <div
                      key={`${it.propertyId || it.hotelName || "it"}-${idx}`}
                      style={{
                        border: "1px solid var(--border-light)",
                        borderRadius: "var(--radius-md)",
                        padding: 12,
                        background: "transparent",
                      }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }} className="truncate">
                            {title}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{dateLine}</div>
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-faint)" }}>
                          {showRooms ? `${rooms.length} room type${rooms.length === 1 ? "" : "s"}` : "No rooms"}
                        </div>
                      </div>

                      {showRooms && (
                        <div
                          className="mt-3 overflow-hidden rounded-md"
                          style={{ border: "1px solid var(--border-light)" }}
                        >
                          <div
                            className="grid grid-cols-12 gap-2 px-3 py-2"
                            style={{ background: "var(--surface-2)", fontSize: 11, color: "var(--text-faint)" }}
                          >
                            <div className="col-span-6">Room type</div>
                            <div className="col-span-2 text-right">Qty</div>
                            <div className="col-span-2 text-right">Adults</div>
                            <div className="col-span-2 text-right">Children</div>
                          </div>
                          {rooms.map((r, rIdx) => (
                            <div
                              key={`${r.roomTypeId || r.roomTypeName || "room"}-${rIdx}`}
                              className="px-3 py-2 border-t"
                              style={{ borderColor: "var(--border-light)" }}
                            >
                              <div className="grid grid-cols-12 gap-2 items-start">
                                <div className="col-span-6 min-w-0">
                                  <div style={{ fontSize: 13, color: "var(--text)" }} className="truncate">
                                    {r.roomTypeName || r.roomTypeId || "—"}
                                  </div>
                                  {r.notes ? (
                                    <div
                                      style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}
                                      className="break-words"
                                    >
                                      {r.notes}
                                    </div>
                                  ) : null}
                                </div>
                                <div className="col-span-2 text-right" style={{ fontSize: 13, color: "var(--text)" }}>
                                  {r.quantity ?? "—"}
                                </div>
                                <div className="col-span-2 text-right" style={{ fontSize: 13, color: "var(--text)" }}>
                                  {r.adults ?? "—"}
                                </div>
                                <div className="col-span-2 text-right" style={{ fontSize: 13, color: "var(--text)" }}>
                                  {r.children ?? "—"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Bookings */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
              marginBottom: 16,
            }}
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Bookings</div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void loadLeadBookings(leadId)}
                disabled={isLoadingBookings}
              >
                Refresh
              </Button>
            </div>
            {isLoadingBookings ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Loading bookings…</div>
            ) : leadBookings.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--text-muted)" }}>No bookings yet.</div>
            ) : (
              <div className="-mx-1 px-1 overflow-x-auto rounded-md" style={{ border: "1px solid var(--border-light)" }}>
                <table className="w-full table-fixed text-sm min-w-[680px]">
                  <colgroup>
                    <col className="w-[10%]" />
                    <col className="w-[18%]" />
                    <col className="w-[12%]" />
                    <col className="w-[12%]" />
                    <col className="w-[6%]" />
                    <col className="w-[10%]" />
                    <col className="w-[10%]" />
                    <col className="w-[22%]" />
                  </colgroup>
                  <thead>
                    <tr className="text-left text-xs" style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}>
                      <th className="px-2 py-2 font-medium">Booking Ref</th>
                      <th className="px-2 py-2 font-medium">Hotel</th>
                      <th className="px-2 py-2 font-medium">Check-in</th>
                      <th className="px-2 py-2 font-medium">Check-out</th>
                      <th className="px-2 py-2 font-medium text-right">Rooms</th>
                      <th className="px-2 py-2 font-medium text-right">Total</th>
                      <th className="px-2 py-2 font-medium">Status</th>
                      <th className="px-2 py-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leadBookings.map((b) => {
                      const propName =
                        typeof b.propertyId === "string" ? b.propertyId : (b.propertyId as { name?: string })?.name;
                      const roomsCount = b.rooms?.length ?? 0;
                      const isCancelled = (b.status ?? "confirmed") === "cancelled";
                      return (
                        <tr key={b._id} className="border-t" style={{ borderColor: "var(--border-light)" }}>
                          <td className="px-2 py-2 align-middle" style={{ color: "var(--text)" }}>
                            <div className="truncate">{b.ezeeBookingRef}</div>
                            {b.processedInPms === false ? (
                              <div className="text-[11px] text-amber-600 font-medium mt-0.5">Pending PMS</div>
                            ) : null}
                          </td>
                          <td className="px-2 py-2 align-middle" style={{ color: "var(--text)" }}>
                            <span className="line-clamp-2 break-words">{propName || "—"}</span>
                          </td>
                          <td className="px-2 py-2 align-middle whitespace-nowrap text-xs" style={{ color: "var(--text)" }}>
                            {new Date(b.checkIn).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-2 py-2 align-middle whitespace-nowrap text-xs" style={{ color: "var(--text)" }}>
                            {new Date(b.checkOut).toLocaleDateString("en-IN")}
                          </td>
                          <td className="px-2 py-2 align-middle text-right" style={{ color: "var(--text)" }}>
                            {roomsCount}
                          </td>
                          <td className="px-2 py-2 align-middle text-right whitespace-nowrap text-xs" style={{ color: "var(--text)" }}>
                            {formatBookingMoney(b.grandTotal)}
                          </td>
                          <td className="px-2 py-2 align-middle">
                            <Badge
                              label={isCancelled ? "Cancelled" : "Confirmed"}
                              variant={isCancelled ? "default" : "stage_active"}
                            />
                          </td>
                          <td className="px-2 py-2 align-middle min-w-[148px]">
                            <div className="flex justify-end gap-1 whitespace-nowrap">
                              <Button
                                variant="secondary"
                                size="sm"
                                className="px-2 h-8"
                                onClick={() => {
                                  setSelectedBookingId(b._id);
                                  setBookingDetailOpen(true);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                className="px-2 h-8"
                                disabled={isCancelled}
                                onClick={() => setCancelBookingTarget(b)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
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
                      onClick={() => isFuture && canEditField("stageId") && handleStageMoveClick(stage._id)}
                      disabled={!isFuture || !canEditField("stageId")}
                      style={{
                        fontSize: 13,
                        padding: "6px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: isCurrent ? "var(--primary-light)" : "transparent",
                        color: isCurrent ? "var(--primary)" : "var(--text-faint)",
                        fontWeight: isCurrent ? 500 : 400,
                        border: isCurrent ? "1px solid #c7d2fe" : "none",
                        cursor: isFuture && canEditField("stageId") ? "pointer" : "default",
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

          {/* Activity Timeline */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              padding: 20,
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>Activity</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={activityFilter === "all" ? "primary" : "secondary"}
                  onClick={() => setActivityFilter("all")}
                >
                  All
                </Button>
                <Button
                  size="sm"
                  variant={activityFilter === "emails" ? "primary" : "secondary"}
                  onClick={() => setActivityFilter("emails")}
                >
                  Emails
                </Button>
              </div>
            </div>

            {activityFilter === "emails" ? (
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setReplyToEmailItem(null);
                      setEmailComposerOpen(true);
                    }}
                  >
                    New Email
                  </Button>
                </div>
                <EmailThreadView
                  items={emailTimelineItems}
                  onReply={(message) => {
                    setReplyToEmailItem(message);
                    setReplyComposerOpen(true);
                  }}
                />
              </div>
            ) : (
              <div style={{ borderLeft: "2px solid var(--border-light)", paddingLeft: 16 }}>
                {timelineItems.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--text-muted)", paddingBottom: 16 }}>No activity yet</p>
                ) : (
                  timelineItems.map((item, index) => {
                    const isActivity = item.type === "activity";
                    const activity = isActivity ? (item.data as LeadActivity) : null;
                    const comm = !isActivity ? (item.data as LeadCommunication & { channel?: string; summary?: string }) : null;
                    const isEmailComm = comm && (comm.channel || "").toUpperCase() === "EMAIL";

                    let iconBg = "#f3f4f6";
                    let iconEl = <FileText className="w-4 h-4 text-gray-500" />;

                    if (isActivity && activity) {
                      iconEl = getActivityIcon(activity.type);
                      if (activity.type === "STATUS_CHANGE") {
                        iconBg = "var(--primary-light)";
                      } else if (activity.type === "FOLLOW_UP") {
                        iconBg = "#f0fdf4";
                      } else if (
                        [
                          "LEAD_CREATED",
                          "QUOTE_SENT",
                          "PAYMENT_LINK_SENT",
                          "PAYMENT_RECEIVED",
                          "CLIENT_RESPONSE",
                          "PMS_ROOM_UPDATED",
                          "PMS_RATE_UPDATED",
                          "PMS_BOOKING_CREATED",
                          "PMS_BOOKING_CANCELLED",
                        ].includes(activity.type)
                      ) {
                        iconBg = "#fffbeb";
                      }
                    } else if (comm) {
                      if (comm.channel === "CALL") {
                        iconBg = "#dbeafe";
                        iconEl = <Phone className="h-4 w-4 text-blue-700" />;
                      } else if (comm.channel === "WHATSAPP") {
                        iconBg = "#d1fae5";
                        iconEl = <MessageSquare className="h-4 w-4 text-green-700" />;
                      } else if (isEmailComm) {
                        iconBg = "#fce7f3";
                        iconEl = <Mail className="h-4 w-4 text-pink-800" />;
                      } else {
                        iconEl = getCommunicationIcon(comm.channel || "");
                      }
                    }

                    const title =
                      isActivity && activity
                        ? formatTimelineMessage(activity, users)
                        : comm
                          ? formatCommunicationMessage(comm, users)
                          : "";
                    const body =
                      comm?.summary ||
                      (isActivity && activity ? activityTimelineBody(activity, title) : "");

                    return (
                      <div key={`${item.type}-${index}`} className="flex gap-3 pb-4" style={{ position: "relative" }}>
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background: iconBg,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          {iconEl}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>{title}</div>
                          {body ? (
                            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }} className="line-clamp-2">
                              {body}
                            </div>
                          ) : null}
                          <div style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 4 }}>
                            {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            <div className="mt-4">
              <Textarea
                value={activityNote}
                onChange={(e) => setActivityNote(e.target.value)}
                placeholder="Add a note..."
                style={{ minHeight: 72, width: "100%", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "10px 12px", fontSize: 14, resize: "vertical" }}
                disabled={!canEditField("notes") || isAddingNote}
              />
              <div className="flex justify-end mt-2">
                <Button variant="primary" size="sm" onClick={handleAddNote} loading={isAddingNote} disabled={!activityNote.trim() || !canEditField("notes")}>
                  Add Note
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-4">
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
                            variant="secondary"
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
                            variant="secondary"
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
                {canReassign && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setReassignUserId(lead.assignedToUserId ?? "");
                      setIsReassignDialogOpen(true);
                    }}
                  >
                    Reassign
                  </Button>
                )}
              </div>
            ) : (
              <div>
                <div style={{ fontStyle: "italic", color: "var(--text-faint)", marginBottom: 8 }}>Unassigned</div>
                {canReassign && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setReassignUserId("");
                      setIsReassignDialogOpen(true);
                    }}
                  >
                    Assign
                  </Button>
                )}
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
      <Dialog open={hotelPickOpen} onOpenChange={setHotelPickOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Select hotel to book</DialogTitle>
            <DialogDescription>Each hotel is booked as a separate flow.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {bookableHotels.map((h) => (
              <button
                key={`${h.hotelId}::${h.checkIn}::${h.checkOut}`}
                type="button"
                className="w-full text-left rounded-md border px-3 py-3 hover:bg-muted transition-colors"
                onClick={() => {
                  setSelectedHotelForBooking(h);
                  setHotelPickOpen(false);
                  setBookRoomOpen(true);
                }}
              >
                <div className="text-sm font-medium">{h.hotelName}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {h.checkIn} → {h.checkOut}
                </div>
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setHotelPickOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {selectedHotelForBooking ? (
        <BookRoomDialog
          open={bookRoomOpen}
          onOpenChange={setBookRoomOpen}
          lead={lead}
          hotel={selectedHotelForBooking}
          onSuccess={() => {
            void loadLeadDetail();
            void loadLeadBookings(leadId);
          }}
        />
      ) : null}

      <BookingDetailDialog
        open={bookingDetailOpen}
        onOpenChange={setBookingDetailOpen}
        leadId={leadId}
        bookingId={selectedBookingId}
      />

      <AlertDialog open={!!cancelBookingTarget} onOpenChange={(open) => !open && setCancelBookingTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel booking</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel booking #{cancelBookingTarget?.ezeeBookingRef}? This will cancel the reservation in eZee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancellingBooking} onClick={() => setCancelBookingTarget(null)}>
              No
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isCancellingBooking}
              onClick={async (e) => {
                e.preventDefault();
                if (!cancelBookingTarget) return;
                setIsCancellingBooking(true);
                try {
                  const hotelId =
                    typeof cancelBookingTarget.propertyId === "string"
                      ? cancelBookingTarget.propertyId
                      : (cancelBookingTarget.propertyId as { _id?: string })?._id;
                  if (!hotelId) throw new Error("Hotel not found for this booking");
                  await cancelEzeeBooking({
                    leadId,
                    hotelId,
                    bookingRef: cancelBookingTarget.ezeeBookingRef,
                  });
                  toast({ title: "Cancelled", description: "Booking cancelled successfully." });
                  setCancelBookingTarget(null);
                  void loadLeadBookings(leadId);
                  void loadLeadDetail();
                } catch (err) {
                  toast({
                    title: "Cancel failed",
                    description: err instanceof Error ? err.message : "Try again.",
                    variant: "destructive",
                  });
                } finally {
                  setIsCancellingBooking(false);
                }
              }}
            >
              {isCancellingBooking ? "Cancelling…" : "Yes, cancel"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <SharedEmailComposer
        isOpen={emailComposerOpen}
        mode="compose"
        leadId={(lead as any)._id || lead.id}
        defaultTo={guestEmail}
        onSent={() => {
          setEmailComposerOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["communication-timeline", leadId] });
          void loadCommunicationTimeline();
        }}
        onClose={() => setEmailComposerOpen(false)}
      />

      <SharedEmailComposer
        isOpen={replyComposerOpen}
        mode="reply"
        leadId={(lead as any)._id || lead.id}
        defaultTo={
          (replyToEmailItem?.from?.email ||
            (typeof replyToEmailItem?.metadata?.from === "string"
              ? replyToEmailItem?.metadata?.from
              : replyToEmailItem?.metadata?.from?.email)) || guestEmail
        }
        defaultSubject={`Re: ${replyToEmailItem?.summary || ""}`}
        defaultThreadId={replyToEmailItem?.metadata?.threadId || replyToEmailItem?.threadId || ""}
        defaultInReplyTo={replyToEmailItem?.metadata?.messageId || ""}
        onSent={() => {
          setReplyComposerOpen(false);
          void queryClient.invalidateQueries({ queryKey: ["communication-timeline", leadId] });
          void loadCommunicationTimeline();
        }}
        onClose={() => setReplyComposerOpen(false)}
      />

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
        leadBookings={leadBookings}
        onQuotationSent={() => {
          toast({
            title: "Success",
            description: "Quotation sent successfully",
          });
          void loadLeadDetail();
        }}
      />

      {leadPropertyId ? (
        <KBQuickDrawer
          key={leadPropertyId}
          propertyId={leadPropertyId}
          isOpen={kbDrawerOpen}
          onClose={() => setKbDrawerOpen(false)}
          defaultTab="overview"
        />
      ) : null}

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

      {/* Single Edit Lead Dialog (all sections) */}
      <EditLeadDialog
        open={isEditLeadDialogOpen}
        onOpenChange={setIsEditLeadDialogOpen}
        lead={lead}
        customFields={customFields}
        editableFieldKeys={leadDetail.editableLeadFields}
        onSave={async (patch) => {
          await updateLead(lead.id, patch as any);
          await loadLeadDetail();
          toast({
            title: "Lead updated",
            description: "Changes saved successfully",
          });
        }}
      />
      <CreateBookingDialog
        isOpen={isCreateBookingDialogOpen}
        onClose={() => setIsCreateBookingDialogOpen(false)}
        lead={lead}
        onSuccess={() => {
          void loadLeadDetail();
        }}
      />

      <Dialog open={isReassignDialogOpen} onOpenChange={setIsReassignDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{lead.assignedToUserId ? "Reassign lead" : "Assign lead"}</DialogTitle>
            <DialogDescription>
              Choose an active user. Admins grant this in Setup → Profiles: open the user&apos;s profile, enable &quot;Leads Reassign&quot; under Setup Permissions, and ensure Leads has View + Edit under Module Permissions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="reassign-user">Assignee</Label>
            <Select value={reassignUserId || undefined} onValueChange={setReassignUserId}>
              <SelectTrigger id="reassign-user">
                <SelectValue placeholder="Select user" />
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
            <Button type="button" variant="secondary" onClick={() => setIsReassignDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!reassignUserId || isSavingReassign}
              onClick={async () => {
                if (!reassignUserId) return;
                try {
                  setIsSavingReassign(true);
                  await updateLead(lead.id, { assignedToUserId: reassignUserId });
                  toast({ title: lead.assignedToUserId ? "Lead reassigned" : "Lead assigned", description: "Assignee updated." });
                  setIsReassignDialogOpen(false);
                  await loadLeadDetail();
                } catch (err) {
                  toast({
                    variant: "destructive",
                    title: "Could not update assignee",
                    description: err instanceof Error ? err.message : "Try again or check your role permissions.",
                  });
                } finally {
                  setIsSavingReassign(false);
                }
              }}
            >
              {isSavingReassign ? "Saving…" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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

