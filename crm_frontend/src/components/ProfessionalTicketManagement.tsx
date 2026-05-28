import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Filter, Plus, Clock, AlertCircle, CheckCircle, User, Calendar } from "lucide-react";
import { toast } from "sonner";

interface ProfessionalTicketManagementProps {
  userRole: string;
  agentName: string;
}

export const ProfessionalTicketManagement = ({ userRole, agentName }: ProfessionalTicketManagementProps) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({
    status: "all",
    priority: "all",
    category: "all",
    assignedTo: userRole === 'callcenter' ? agentName : "all"
  });
  const [isCreateTicketOpen, setIsCreateTicketOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState("");

  // Mock ticket data
  const allTickets = [
    {
      id: "TKT-001",
      title: "AC not working in Room 204",
      description: "Guest complained that air conditioning unit is not cooling properly",
      status: "open",
      priority: "high",
      category: "maintenance",
      assignedTo: "Harleen Mehta",
      createdBy: "Front Desk",
      guestName: "Rajesh Kumar",
      roomNumber: "204",
      property: "Postcard Goa",
      createdDate: "2024-01-18",
      updatedDate: "2024-01-18",
      dueDate: "2024-01-19",
      estimatedHours: 4,
      actualHours: 0,
      comments: [
        { date: "2024-01-18", time: "2:30 PM", user: "Front Desk", message: "Guest reported AC issue during check-in" },
        { date: "2024-01-18", time: "3:00 PM", user: "Harleen Mehta", message: "Maintenance team has been notified" }
      ]
    },
    {
      id: "TKT-002",
      title: "Billing discrepancy for reservation",
      description: "Guest disputes charges for spa services not availed",
      status: "in-progress",
      priority: "medium",
      category: "billing",
      assignedTo: "Rahul Singh",
      createdBy: "Guest Services",
      guestName: "Priya Sharma",
      roomNumber: "315",
      property: "Postcard Udaipur",
      createdDate: "2024-01-17",
      updatedDate: "2024-01-18",
      dueDate: "2024-01-20",
      estimatedHours: 2,
      actualHours: 1.5,
      comments: [
        { date: "2024-01-17", time: "11:00 AM", user: "Guest Services", message: "Guest called to dispute spa charges" },
        { date: "2024-01-17", time: "2:15 PM", user: "Rahul Singh", message: "Reviewing billing records and spa logs" },
        { date: "2024-01-18", time: "10:30 AM", user: "Rahul Singh", message: "Confirmed error in billing, processing refund" }
      ]
    },
    {
      id: "TKT-003",
      title: "Special dietary request",
      description: "Guest has severe nut allergy, needs special menu arrangements",
      status: "resolved",
      priority: "high",
      category: "dining",
      assignedTo: "Priya Kumar",
      createdBy: "Concierge",
      guestName: "Amit Patel",
      roomNumber: "128",
      property: "Postcard Munnar",
      createdDate: "2024-01-15",
      updatedDate: "2024-01-16",
      dueDate: "2024-01-16",
      estimatedHours: 1,
      actualHours: 0.5,
      comments: [
        { date: "2024-01-15", time: "4:00 PM", user: "Concierge", message: "Guest mentioned severe nut allergy" },
        { date: "2024-01-15", time: "4:15 PM", user: "Priya Kumar", message: "Coordinated with kitchen staff for special menu" },
        { date: "2024-01-16", time: "9:00 AM", user: "Priya Kumar", message: "Special arrangements confirmed, guest satisfied" }
      ]
    },
    {
      id: "TKT-004",
      title: "Noise complaint from neighboring room",
      description: "Guest in 302 complaining about loud music from 301",
      status: "open",
      priority: "medium",
      category: "guest-relations",
      assignedTo: "Harleen Mehta",
      createdBy: "Night Manager",
      guestName: "Sunita Reddy",
      roomNumber: "302",
      property: "Postcard Goa",
      createdDate: "2024-01-18",
      updatedDate: "2024-01-18",
      dueDate: "2024-01-18",
      estimatedHours: 0.5,
      actualHours: 0,
      comments: [
        { date: "2024-01-18", time: "11:45 PM", user: "Night Manager", message: "Guest called front desk about noise" },
        { date: "2024-01-18", time: "11:50 PM", user: "Harleen Mehta", message: "Will speak with guests in room 301" }
      ]
    }
  ];

  // Filter tickets based on role and filters  
  const filteredTickets = allTickets.filter(ticket => {
    // Role-based filtering
    if (userRole === 'callcenter' && ticket.assignedTo !== agentName) {
      return false;
    }

    // Search query filter
    if (searchQuery && !ticket.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ticket.id.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ticket.guestName.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !ticket.description.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    if (selectedFilters.status !== "all" && ticket.status !== selectedFilters.status) {
      return false;
    }

    // Priority filter
    if (selectedFilters.priority !== "all" && ticket.priority !== selectedFilters.priority) {
      return false;
    }

    // Category filter
    if (selectedFilters.category !== "all" && ticket.category !== selectedFilters.category) {
      return false;
    }

    // Assigned to filter (for managers)
    if (selectedFilters.assignedTo !== "all" && ticket.assignedTo !== selectedFilters.assignedTo) {
      return false;
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500 text-white';
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open': return <AlertCircle className="h-4 w-4" />;
      case 'in-progress': return <Clock className="h-4 w-4" />;
      case 'resolved': return <CheckCircle className="h-4 w-4" />;
      case 'closed': return <CheckCircle className="h-4 w-4" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'maintenance': return '🔧';
      case 'billing': return '💰';
      case 'dining': return '🍽️';
      case 'guest-relations': return '👥';
      case 'housekeeping': return '🧹';
      case 'concierge': return '🛎️';
      default: return '📋';
    }
  };

  const clearFilters = () => {
    setSelectedFilters({
      status: "all",
      priority: "all",
      category: "all",
      assignedTo: userRole === 'callcenter' ? agentName : "all"
    });
    setSearchQuery("");
  };

  const handleStatusChange = (ticketId: string, newStatus: string) => {
    toast.success(`Ticket ${ticketId} status updated to ${newStatus}`);
    // In real implementation, this would update the ticket status
  };

  // Property agents mapping
  const propertyAgents = {
    "Postcard Goa": ["Harleen Mehta", "Rahul Singh", "Priya Kumar"],
    "Postcard Kerala": ["Amit Sharma", "Neha Patel", "Ravi Kumar"],
    "Postcard Rajasthan": ["Sanju Verma", "Meera Singh", "Vikram Rao"],
    "Postcard Mumbai": ["Anjali Shah", "Karan Malhotra", "Deepa Joshi"],
  };

  const getTicketStats = () => {
    const open = filteredTickets.filter(t => t.status === 'open').length;
    const inProgress = filteredTickets.filter(t => t.status === 'in-progress').length;
    const resolved = filteredTickets.filter(t => t.status === 'resolved').length;
    const total = filteredTickets.length;

    return { open, inProgress, resolved, total };
  };

  const stats = getTicketStats();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {userRole === 'callcenter' ? 'My Tickets' : 'Ticket Management'}
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'callcenter'
              ? 'Manage your assigned support tickets'
              : 'Comprehensive ticket management and assignment'
            }
          </p>
        </div>

        <Dialog open={isCreateTicketOpen} onOpenChange={setIsCreateTicketOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Ticket</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="ticket-title">Title</Label>
                <Input id="ticket-title" placeholder="Ticket title" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-category">Category</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="booking">Booking Issue</SelectItem>
                    <SelectItem value="payment">Payment</SelectItem>
                    <SelectItem value="amenities">Amenities</SelectItem>
                    <SelectItem value="housekeeping">Housekeeping</SelectItem>
                    <SelectItem value="technical">Technical Support</SelectItem>
                    <SelectItem value="complaint">General Complaint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ticket-priority">Priority</Label>
                <Select>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="property">Property</Label>
                <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select property" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                    <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                    <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                    <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="assigned-agent">Assign to Agent</Label>
                <Select disabled={!selectedProperty}>
                  <SelectTrigger>
                    <SelectValue placeholder={selectedProperty ? "Select agent" : "Select property first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProperty && propertyAgents[selectedProperty as keyof typeof propertyAgents]?.map((agent) => (
                      <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-name">Guest Name</Label>
                <Input id="guest-name" placeholder="Guest name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-phone">Guest Phone</Label>
                <Input id="guest-phone" placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Guest Email</Label>
                <Input id="guest-email" type="email" placeholder="guest@email.com" />
              </div>
              <div className="col-span-2 space-y-2">
                <Label htmlFor="ticket-description">Description</Label>
                <Textarea id="ticket-description" placeholder="Detailed description of the issue..." rows={4} />
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCreateTicketOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                toast.success("Ticket created successfully!");
                setIsCreateTicketOpen(false);
                setSelectedProperty("");
              }}>
                Create Ticket
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{stats.open}</p>
                <p className="text-sm text-muted-foreground">Open</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="h-8 w-8 text-yellow-600" />
              <div>
                <p className="text-2xl font-bold">{stats.inProgress}</p>
                <p className="text-sm text-muted-foreground">In Progress</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{stats.resolved}</p>
                <p className="text-sm text-muted-foreground">Resolved</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <User className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Tickets</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets by ID, title, guest name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in-progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedFilters.priority} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, priority: value }))}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priority</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedFilters.category} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, category: value }))}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="billing">Billing</SelectItem>
                  <SelectItem value="dining">Dining</SelectItem>
                  <SelectItem value="guest-relations">Guest Relations</SelectItem>
                  <SelectItem value="housekeeping">Housekeeping</SelectItem>
                  <SelectItem value="concierge">Concierge</SelectItem>
                </SelectContent>
              </Select>

              {userRole !== 'callcenter' && (
                <Select value={selectedFilters.assignedTo} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, assignedTo: value }))}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Assigned To" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agents</SelectItem>
                    <SelectItem value="Harleen Mehta">Harleen Mehta</SelectItem>
                    <SelectItem value="Rahul Singh">Rahul Singh</SelectItem>
                    <SelectItem value="Priya Kumar">Priya Kumar</SelectItem>
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
            Showing {filteredTickets.length} of {allTickets.length} tickets
          </div>
        </CardContent>
      </Card>

      {/* Tickets List */}
      <div className="space-y-4">
        {filteredTickets.map((ticket) => (
          <Card key={ticket.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="space-y-4">
                {/* Ticket Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-lg">{getCategoryIcon(ticket.category)}</span>
                      <h3 className="font-semibold text-lg">{ticket.title}</h3>
                      <Badge variant="outline" className="text-xs">
                        {ticket.id}
                      </Badge>
                    </div>

                    <p className="text-muted-foreground text-sm mb-3">{ticket.description}</p>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Guest:</span>
                        <p className="text-muted-foreground">{ticket.guestName}</p>
                        <p className="text-muted-foreground">Room {ticket.roomNumber}</p>
                      </div>

                      <div>
                        <span className="font-medium">Property:</span>
                        <p className="text-muted-foreground">{ticket.property}</p>
                      </div>

                      <div>
                        <span className="font-medium">Assigned to:</span>
                        <p className="text-muted-foreground">{ticket.assignedTo}</p>
                      </div>

                      <div>
                        <span className="font-medium">Time:</span>
                        <p className="text-muted-foreground">Est: {ticket.estimatedHours}h</p>
                        <p className="text-muted-foreground">Actual: {ticket.actualHours}h</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end space-y-2">
                    <div className="flex items-center space-x-2">
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusIcon(ticket.status)}
                        <span className="ml-1">{ticket.status}</span>
                      </Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                    </div>

                    <div className="text-right text-xs text-muted-foreground">
                      <p>Due: {ticket.dueDate}</p>
                      <p>Created: {ticket.createdDate}</p>
                    </div>

                    {/* Status Change */}
                    <Select onValueChange={(value) => handleStatusChange(ticket.id, value)}>
                      <SelectTrigger className="w-32 text-xs">
                        <SelectValue placeholder="Change status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="in-progress">In Progress</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                        <SelectItem value="closed">Closed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Comments Section */}
                <div className="border-t pt-4">
                  <h4 className="font-semibold mb-3 text-sm">Recent Updates</h4>
                  <div className="space-y-2">
                    {ticket.comments.slice(0, 2).map((comment, index) => (
                      <div key={index} className="flex items-start space-x-3 p-2 bg-muted/50 rounded text-sm">
                        <Calendar className="h-3 w-3 text-muted-foreground mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-medium text-xs">{comment.user}</span>
                            <span className="text-xs text-muted-foreground">{comment.date} {comment.time}</span>
                          </div>
                          <p className="text-muted-foreground text-xs">{comment.message}</p>
                        </div>
                      </div>
                    ))}
                    {ticket.comments.length > 2 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{ticket.comments.length - 2} more updates...
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredTickets.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tickets found</h3>
            <p className="text-muted-foreground">Try adjusting your filters or search criteria</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear all filters
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};