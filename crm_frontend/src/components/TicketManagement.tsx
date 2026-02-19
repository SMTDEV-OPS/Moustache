import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Filter, Eye, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";
import {
  listTickets,
  createTicket,
  updateTicket,
  getTicketDetail,
  Ticket,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  TicketListQuery,
  CreateTicketPayload,
  getEligibleAssignees,
  EligibleAssignee,
} from "@/services/tickets";
import { TicketDetailPage } from "./TicketDetailPage";

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

interface TicketManagementProps {
  permissions?: string[];
  isAdmin?: boolean;
}

export const TicketManagement = ({ permissions = [], isAdmin = false }: TicketManagementProps) => {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isNewTicketDialogOpen, setIsNewTicketDialogOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [eligibleAssignees, setEligibleAssignees] = useState<EligibleAssignee[]>([]);
  
  // Determine available scopes based on permissions
  const canViewOwn = isAdmin || permissions.includes("tickets.view.own") || permissions.includes("tickets.manage");
  const canViewTeam = isAdmin || permissions.includes("tickets.view.team") || permissions.includes("tickets.manage");
  const canViewAll = isAdmin || permissions.includes("tickets.view.all") || permissions.includes("tickets.manage");
  
  // Set default scope to the highest permission level available
  const getDefaultScope = (): TicketScope => {
    if (canViewAll) return "all";
    if (canViewTeam) return "team";
    return "own";
  };
  
  const [filters, setFilters] = useState<TicketListQuery>({
    scope: getDefaultScope(),
  });

  const [newTicket, setNewTicket] = useState<CreateTicketPayload>({
    title: "",
    description: "",
    category: "GENERAL",
    priority: "MEDIUM",
    assignmentMode: "auto",
  });

  useEffect(() => {
    loadTickets();
    loadEligibleAssignees();
  }, [filters]);

  const loadTickets = async () => {
    try {
      setIsLoading(true);
      const data = await listTickets(filters);
      setTickets(data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unable to load tickets";
      
      // If permission error, fall back to "own" scope
      if (errorMessage.includes("403") || errorMessage.includes("Forbidden") || errorMessage.includes("permission")) {
        if (filters.scope !== "own") {
          toast({
            title: "Permission Denied",
            description: `You don't have permission to view ${filters.scope} tickets. Showing your own tickets instead.`,
            variant: "destructive",
          });
          setFilters({ ...filters, scope: "own" });
          return;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadEligibleAssignees = async () => {
    try {
      const data = await getEligibleAssignees();
      setEligibleAssignees(data);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  const handleCreateTicket = async () => {
    if (!newTicket.title || !newTicket.description) {
      toast({
        title: "Error",
        description: "Title and description are required",
        variant: "destructive",
      });
      return;
    }

    try {
      const created = await createTicket(newTicket);
      toast({
        title: "Success",
        description: "Ticket created successfully",
      });
      setIsNewTicketDialogOpen(false);
      setNewTicket({
        title: "",
        description: "",
        category: "GENERAL",
        priority: "MEDIUM",
        assignmentMode: "auto",
      });
      await loadTickets();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to create ticket",
        variant: "destructive",
      });
    }
  };

  const handleViewTicket = async (ticket: Ticket) => {
    try {
      const detail = await getTicketDetail(ticket.id);
      setSelectedTicket(detail.ticket);
      setIsDetailDialogOpen(true);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to load ticket details",
        variant: "destructive",
      });
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: TicketStatus) => {
    try {
      await updateTicket(ticketId, { status: newStatus });
      toast({
        title: "Success",
        description: "Ticket status updated",
      });
      await loadTickets();
      if (selectedTicket?.id === ticketId) {
        const detail = await getTicketDetail(ticketId);
        setSelectedTicket(detail.ticket);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Unable to update ticket",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: TicketStatus) => {
    switch (status) {
      case "NEW":
        return <AlertCircle className="h-4 w-4" />;
      case "IN_PROGRESS":
        return <Clock className="h-4 w-4" />;
      case "RESOLVED":
        return <CheckCircle className="h-4 w-4" />;
      case "CLOSED":
        return <XCircle className="h-4 w-4" />;
      case "CANCELLED":
        return <XCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Ticket Management</h2>
          <p className="text-sm text-muted-foreground">
            Manage and track support tickets
          </p>
        </div>
        <div className="flex gap-2">
          <Select
            value={filters.scope || "own"}
            onValueChange={(value) => setFilters({ ...filters, scope: value as "own" | "team" | "all" })}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canViewOwn && <SelectItem value="own">My Tickets</SelectItem>}
              {canViewTeam && <SelectItem value="team">Team Tickets</SelectItem>}
              {canViewAll && <SelectItem value="all">All Tickets</SelectItem>}
            </SelectContent>
          </Select>
          <Dialog open={isNewTicketDialogOpen} onOpenChange={setIsNewTicketDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New Ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Ticket</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={newTicket.title}
                    onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                    placeholder="Enter ticket title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description *</Label>
                  <Textarea
                    id="description"
                    value={newTicket.description}
                    onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                    placeholder="Enter ticket description"
                    rows={5}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <Select
                      value={newTicket.category}
                      onValueChange={(value) => setNewTicket({ ...newTicket, category: value as TicketCategory })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="TECHNICAL">Technical</SelectItem>
                        <SelectItem value="BILLING">Billing</SelectItem>
                        <SelectItem value="GENERAL">General</SelectItem>
                        <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                        <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority</Label>
                    <Select
                      value={newTicket.priority}
                      onValueChange={(value) => setNewTicket({ ...newTicket, priority: value as TicketPriority })}
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignment">Assignment</Label>
                  <Select
                    value={newTicket.assignmentMode}
                    onValueChange={(value) => setNewTicket({ ...newTicket, assignmentMode: value as "auto" | "manual" })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto Assign</SelectItem>
                      <SelectItem value="manual">Manual Assign</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newTicket.assignmentMode === "manual" && (
                  <div className="space-y-2">
                    <Label htmlFor="assignee">Assign To</Label>
                    <Select
                      value={newTicket.assignedToUserId || ""}
                      onValueChange={(value) => setNewTicket({ ...newTicket, assignedToUserId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select assignee" />
                      </SelectTrigger>
                      <SelectContent>
                        {eligibleAssignees.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name} ({user.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsNewTicketDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTicket}>Create Ticket</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Loading tickets...</p>
          </CardContent>
        </Card>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No tickets found</p>
            <Button onClick={() => setIsNewTicketDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create First Ticket
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold">{ticket.title}</h3>
                      <Badge className={statusColors[ticket.status]}>
                        <span className="flex items-center gap-1">
                          {getStatusIcon(ticket.status)}
                          {ticket.status.replace("_", " ")}
                        </span>
                      </Badge>
                      <Badge className={priorityColors[ticket.priority]}>
                        {ticket.priority}
                      </Badge>
                      <Badge variant="outline">{ticket.category}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                      {ticket.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>#{ticket.ticketNumber}</span>
                      {ticket.assignedToUserId && (
                        <span>
                          Assigned to:{" "}
                          {typeof ticket.assignedToUserId === "object"
                            ? ticket.assignedToUserId.name
                            : "Loading..."}
                        </span>
                      )}
                      {ticket.createdAt && (
                        <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedTicket && (
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ticket Details</DialogTitle>
            </DialogHeader>
            <TicketDetailPage
              ticketId={selectedTicket.id}
              onUpdate={() => {
                loadTickets();
                if (selectedTicket) {
                  getTicketDetail(selectedTicket.id).then((detail) => {
                    setSelectedTicket(detail.ticket);
                  });
                }
              }}
            />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

