import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  getTicketDetail,
  updateTicket,
  addTicketNote,
  resolveTicket,
  reopenTicket,
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketActivity,
  TicketDetail,
} from "@/services/tickets";
import { listUsers, User } from "@/services/users";
import { formatDistanceToNow, format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle, XCircle, Clock, AlertCircle, MessageSquare, User as UserIcon, RefreshCw } from "lucide-react";

interface TicketDetailPageProps {
  ticketId: string;
  onUpdate?: () => void;
}

const statusColors: Record<TicketStatus, string> = {
  NEW: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-yellow-100 text-yellow-800",
  RESOLVED: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const priorityColors: Record<TicketPriority, string> = {
  LOW: "bg-gray-100 text-gray-800",
  MEDIUM: "bg-blue-100 text-blue-800",
  HIGH: "bg-orange-100 text-orange-800",
  URGENT: "bg-red-100 text-red-800",
};

// Helper function to get user name from activity
const getUserName = (
  userId: string | { _id?: string; id?: string; name?: string; email?: string } | undefined,
  users: User[]
): string => {
  if (!userId) return "System";
  if (typeof userId === "object" && userId !== null) {
    return userId.name || "Unknown User";
  }
  const user = users.find((u) => u.id === userId);
  return user?.name || "Unknown User";
};

// Helper function to format timeline messages
const formatTimelineMessage = (activity: TicketActivity, users: User[]): string => {
  const performedByName = getUserName(activity.performedByUserId, users);

  switch (activity.type) {
    case "TICKET_CREATED":
      return `Ticket was created`;
    case "STATUS_CHANGE":
      if (activity.fromStatus && activity.toStatus) {
        return `Status changed from ${activity.fromStatus} to ${activity.toStatus}`;
      }
      return `Status changed to ${activity.toStatus || "unknown"}`;
    case "PRIORITY_CHANGE":
      if (activity.fromPriority && activity.toPriority) {
        return `Priority changed from ${activity.fromPriority} to ${activity.toPriority}`;
      }
      return `Priority changed to ${activity.toPriority || "unknown"}`;
    case "AUTO_ASSIGNED":
      const autoAssignedToName = getUserName(activity.toUserId, users);
      return `Ticket automatically assigned to ${autoAssignedToName}`;
    case "MANUAL_ASSIGNED":
      const manualAssignedToName = getUserName(activity.toUserId, users);
      const assignedByName = getUserName(activity.assignedByUserId, users);
      return `Ticket assigned to ${manualAssignedToName}${activity.assignedByUserId ? ` by ${assignedByName}` : ""}`;
    case "REASSIGNED":
      const reassignedFromName = getUserName(activity.fromUserId, users);
      const reassignedToName = getUserName(activity.toUserId, users);
      const reassignedByName = getUserName(activity.assignedByUserId, users);
      return `Ticket reassigned from ${reassignedFromName} to ${reassignedToName}${activity.assignedByUserId ? ` by ${reassignedByName}` : ""}`;
    case "RESOLVED":
      return `Ticket resolved${activity.note ? `: ${activity.note}` : ""}`;
    case "REOPENED":
      return `Ticket reopened${activity.note ? `: ${activity.note}` : ""}`;
    case "NOTE":
      return activity.note || "Note added";
    default:
      return activity.note || activity.type;
  }
};

export const TicketDetailPage = ({ ticketId, onUpdate }: TicketDetailPageProps) => {
  const { toast } = useToast();
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");

  useEffect(() => {
    loadData();
  }, [ticketId]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [detail, usersData] = await Promise.all([
        getTicketDetail(ticketId),
        listUsers(),
      ]);
      setTicketDetail(detail);
      setUsers(usersData);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to load ticket details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (!ticketDetail) return;
    try {
      setIsUpdating(true);
      await updateTicket(ticketId, { status: newStatus });
      toast({
        title: "Success",
        description: "Ticket status updated",
      });
      await loadData();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to update status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (!ticketDetail) return;
    try {
      setIsUpdating(true);
      await updateTicket(ticketId, { priority: newPriority });
      toast({
        title: "Success",
        description: "Ticket priority updated",
      });
      await loadData();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to update priority",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) {
      toast({
        title: "Error",
        description: "Note cannot be empty",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsUpdating(true);
      await addTicketNote(ticketId, newNote);
      toast({
        title: "Success",
        description: "Note added",
      });
      setNewNote("");
      await loadData();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to add note",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResolve = async () => {
    try {
      setIsUpdating(true);
      await resolveTicket(ticketId, resolutionNotes || undefined);
      toast({
        title: "Success",
        description: "Ticket resolved",
      });
      setResolutionNotes("");
      await loadData();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to resolve ticket",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReopen = async () => {
    try {
      setIsUpdating(true);
      await reopenTicket(ticketId);
      toast({
        title: "Success",
        description: "Ticket reopened",
      });
      await loadData();
      onUpdate?.();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to reopen ticket",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticketDetail) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Ticket not found</p>
      </div>
    );
  }

  const { ticket, activities } = ticketDetail;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold">{ticket.title}</h2>
          <div className="flex items-center gap-2 mt-2">
            <Badge className={statusColors[ticket.status]}>
              {ticket.status.replace("_", " ")}
            </Badge>
            <Badge className={priorityColors[ticket.priority]}>
              {ticket.priority}
            </Badge>
            <Badge variant="outline">{ticket.category}</Badge>
            <span className="text-sm text-muted-foreground">#{ticket.ticketNumber}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Status</Label>
              <Select
                value={ticket.status}
                onValueChange={(value) => handleStatusChange(value as TicketStatus)}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NEW">New</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                  <SelectItem value="CANCELLED">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Priority</Label>
              <Select
                value={ticket.priority}
                onValueChange={(value) => handlePriorityChange(value as TicketPriority)}
                disabled={isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Assigned To</Label>
              <p className="text-sm">
                {ticket.assignedToUserId
                  ? typeof ticket.assignedToUserId === "object"
                    ? ticket.assignedToUserId.name
                    : "Loading..."
                  : "Unassigned"}
              </p>
            </div>
            <div>
              <Label>Created By</Label>
              <p className="text-sm">
                {ticket.createdByUserId
                  ? typeof ticket.createdByUserId === "object"
                    ? ticket.createdByUserId.name
                    : "Loading..."
                  : "System"}
              </p>
            </div>
            {ticket.createdAt && (
              <div>
                <Label>Created At</Label>
                <p className="text-sm">{format(new Date(ticket.createdAt), "PPp")}</p>
              </div>
            )}
            {ticket.resolvedAt && (
              <div>
                <Label>Resolved At</Label>
                <p className="text-sm">{format(new Date(ticket.resolvedAt), "PPp")}</p>
              </div>
            )}
            {ticket.resolutionNotes && (
              <div>
                <Label>Resolution Notes</Label>
                <p className="text-sm">{ticket.resolutionNotes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            {ticket.tags && ticket.tags.length > 0 && (
              <div className="mt-4">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ticket.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticket.status === "RESOLVED" ? (
            <Button onClick={handleReopen} disabled={isUpdating}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Reopen Ticket
            </Button>
          ) : (
            <div className="space-y-2">
              <Label>Resolution Notes</Label>
              <Textarea
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                placeholder="Enter resolution notes (optional)"
                rows={3}
              />
              <Button onClick={handleResolve} disabled={isUpdating}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Resolve Ticket
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add Note</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Enter a note..."
            rows={3}
          />
          <Button onClick={handleAddNote} disabled={isUpdating || !newNote.trim()}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Add Note
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activities yet</p>
              ) : (
                activities.map((activity) => (
                  <div key={activity._id || activity.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                        <UserIcon className="h-4 w-4" />
                      </div>
                      <div className="w-px h-full bg-border mt-2" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {getUserName(activity.performedByUserId, users)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {activity.performedAt
                            ? formatDistanceToNow(new Date(activity.performedAt), {
                                addSuffix: true,
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm">{formatTimelineMessage(activity, users)}</p>
                      {activity.performedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(activity.performedAt), "PPp")}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

