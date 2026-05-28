import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  MessageSquare, Clock, AlertTriangle, CheckCircle,
  Send, User, Phone, MapPin, Calendar, Tag
} from "lucide-react";

interface PropertyManagerDashboardProps {
  userRole: string;
  userName: string;
}

const PropertyManagerDashboard = ({ userRole, userName }: PropertyManagerDashboardProps) => {
  // Get property from user role
  const getPropertyFromRole = (role: string) => {
    switch (role) {
      case 'propertymanager1': return 'Postcard Goa';
      case 'propertymanager2': return 'Postcard Udaipur';
      case 'propertymanager3': return 'Postcard Munnar';
      default: return 'Postcard Goa';
    }
  };

  const currentProperty = getPropertyFromRole(userRole);

  const [tickets, setTickets] = useState([
    {
      id: "T001",
      title: "Reservation Change Request",
      description: "Guest wants to extend stay by 2 days and change room category",
      guest: "Priya Sharma",
      guestPhone: "+91 98765 43210",
      priority: "High",
      status: "Open",
      category: "Reservation",
      property: "Postcard Goa",
      assignedTo: "Property Manager - Goa",
      createdBy: "Harleen Mehta - Call Center",
      created: "2024-12-15 10:30 AM",
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: "Guest called to extend their stay from Jan 20-23 to Jan 20-25. They also want to upgrade to Ocean View suite. Please confirm availability and pricing.",
          timestamp: "2024-12-15 10:30 AM",
          type: "create"
        }
      ]
    },
    {
      id: "T002",
      title: "Billing Inquiry - Spa Charges",
      description: "Guest questions about spa charges on their bill",
      guest: "Rajesh Kumar",
      guestPhone: "+91 87654 32109",
      priority: "Medium",
      status: "In Progress",
      category: "Billing",
      property: "Postcard Rajasthan",
      assignedTo: "Property Manager - Rajasthan",
      createdBy: "Harleen Mehta - Call Center",
      created: "2024-12-14 2:15 PM",
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: "Guest called about unexpected spa charges of ₹5,500 on checkout bill. Guest claims they only had a 30-minute massage. Please verify with spa team.",
          timestamp: "2024-12-14 2:15 PM",
          type: "create"
        },
        {
          id: 2,
          author: "Property Manager - Rajasthan",
          message: "Checked with spa team. Guest had 30-min massage (₹2,500) + 60-min full body treatment (₹3,000). Both services were confirmed. Will call guest to explain.",
          timestamp: "2024-12-14 4:20 PM",
          type: "response"
        }
      ]
    },
    {
      id: "T004",
      title: "Room Maintenance Issue",
      description: "Air conditioning not working in room 205",
      guest: "Ankita Desai",
      guestPhone: "+91 98888 77777",
      priority: "High",
      status: "Open",
      category: "Maintenance",
      property: "Postcard Goa",
      assignedTo: "Property Manager - Goa",
      createdBy: "Harleen Mehta - Call Center",
      created: "2024-12-15 3:45 PM",
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: "Guest in room 205 called reporting AC not working. Temperature showing 28°C. Guest is checking out tomorrow morning. Need immediate attention.",
          timestamp: "2024-12-15 3:45 PM",
          type: "create"
        }
      ]
    },
    {
      id: "T005",
      title: "Special Anniversary Setup Request",
      description: "Guest wants room decoration for anniversary celebration",
      guest: "Vikram & Sneha Joshi",
      guestPhone: "+91 94567 12345",
      priority: "Medium",
      status: "Open",
      category: "Service",
      property: "Postcard Kerala",
      assignedTo: "Property Manager - Kerala",
      createdBy: "Harleen Mehta - Call Center",
      created: "2024-12-15 1:20 PM",
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: "Guest celebrating 5th wedding anniversary. Checking in Dec 18th. Would like room decorated with flowers, cake, and champagne setup. Guest willing to pay additional charges.",
          timestamp: "2024-12-15 1:20 PM",
          type: "create"
        }
      ]
    }
  ]);

  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const [replyText, setReplyText] = useState("");

  const handleReply = (ticketId: string) => {
    if (!replyText.trim()) return;

    setTickets(tickets.map(ticket => {
      if (ticket.id === ticketId) {
        return {
          ...ticket,
          responses: [...ticket.responses, {
            id: ticket.responses.length + 1,
            author: "Property Manager",
            message: replyText,
            timestamp: new Date().toLocaleString(),
            type: "response"
          }],
          status: "In Progress"
        };
      }
      return ticket;
    }));

    setReplyText("");

    // Update selected ticket if it's the one being replied to
    if (selectedTicket?.id === ticketId) {
      const updatedTicket = tickets.find(t => t.id === ticketId);
      if (updatedTicket) {
        setSelectedTicket({
          ...updatedTicket,
          responses: [...updatedTicket.responses, {
            id: updatedTicket.responses.length + 1,
            author: "Property Manager",
            message: replyText,
            timestamp: new Date().toLocaleString(),
            type: "response"
          }]
        });
      }
    }
  };

  const handleResolveTicket = (ticketId: string) => {
    setTickets(tickets.map(ticket => {
      if (ticket.id === ticketId) {
        return {
          ...ticket,
          status: "Resolved",
          responses: [...ticket.responses, {
            id: ticket.responses.length + 1,
            author: "Property Manager",
            message: "Issue has been resolved. Closing ticket.",
            timestamp: new Date().toLocaleString(),
            type: "close"
          }]
        };
      }
      return ticket;
    }));

    setSelectedTicket(null);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Resolved': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Closed': return 'bg-muted text-muted-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 animate-pulse';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return <Clock className="h-4 w-4" />;
      case 'In Progress': return <AlertTriangle className="h-4 w-4" />;
      case 'Resolved': return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const openTickets = tickets.filter(t => t.status === 'Open' && t.property === currentProperty);
  const inProgressTickets = tickets.filter(t => t.status === 'In Progress' && t.property === currentProperty);
  const resolvedTickets = tickets.filter(t => t.status === 'Resolved' && t.property === currentProperty);
  const myTickets = tickets.filter(t => t.property === currentProperty);

  return (
    <div className="space-y-6">
      {/* Property Header */}
      <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-6 rounded-lg">
        <h1 className="text-2xl font-bold">{currentProperty}</h1>
        <p className="text-primary-foreground/80 mt-1">Property Manager Dashboard - {userName}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Open Tickets</p>
                <p className="text-2xl font-bold text-blue-900">{openTickets.length}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">In Progress</p>
                <p className="text-2xl font-bold text-yellow-900">{inProgressTickets.length}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Resolved Today</p>
                <p className="text-2xl font-bold text-green-900">{resolvedTickets.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Response Time</p>
                <p className="text-2xl font-bold text-purple-900">1.2h</p>
              </div>
              <MessageSquare className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tickets Tabs */}
      <Tabs defaultValue="open" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="open">Open Tickets</TabsTrigger>
          <TabsTrigger value="all">All Tickets</TabsTrigger>
        </TabsList>

        {/* Open Tickets Tab */}
        <TabsContent value="open" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">Open Tickets - {currentProperty}</h2>
            <Badge variant="secondary" className="text-sm">
              {openTickets.length} open tickets
            </Badge>
          </div>

          {openTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {ticket.id}
                      </Badge>
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusIcon(ticket.status)}
                        <span className="ml-1">{ticket.status}</span>
                      </Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority} Priority
                      </Badge>
                      <Badge variant="outline" className="flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        {ticket.category}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{ticket.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{ticket.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span><strong>Guest:</strong> {ticket.guest}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>{ticket.guestPhone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span><strong>Property:</strong> {ticket.property}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span><strong>Created:</strong> {ticket.created}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      <span><strong>Created by:</strong> {ticket.createdBy}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-6">
                    <Badge variant="secondary" className="text-xs">
                      {ticket.responses.length} messages
                    </Badge>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>
                            <div className="flex items-center space-x-3">
                              <span>Ticket {ticket.id} - {ticket.title}</span>
                              <Badge className={getStatusColor(ticket.status)}>
                                {ticket.status}
                              </Badge>
                              <Badge className={getPriorityColor(ticket.priority)}>
                                {ticket.priority}
                              </Badge>
                            </div>
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                          {/* Ticket Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="font-medium">Guest:</span> {ticket.guest}</div>
                              <div><span className="font-medium">Phone:</span> {ticket.guestPhone}</div>
                              <div><span className="font-medium">Property:</span> {ticket.property}</div>
                              <div><span className="font-medium">Category:</span> {ticket.category}</div>
                            </div>
                          </div>

                          {/* Conversation */}
                          <div className="space-y-3">
                            {ticket.responses.map((response) => (
                              <div key={response.id} className={`p-4 rounded-lg ${response.author.includes('Property Manager') ? 'bg-blue-50 border-l-4 border-blue-500 ml-8' :
                                response.type === 'close' ? 'bg-green-50 border-l-4 border-green-500' :
                                  'bg-gray-50 border-l-4 border-gray-500'
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{response.author}</span>
                                  <span className="text-xs text-gray-500">{response.timestamp}</span>
                                </div>
                                <p className="text-gray-700">{response.message}</p>
                              </div>
                            ))}
                          </div>

                          {/* Reply Section */}
                          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                            <div className="border-t pt-4">
                              <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                  Reply to Call Center
                                </label>
                                <Textarea
                                  placeholder="Type your response here..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="min-h-[100px]"
                                />
                                <div className="flex justify-end space-x-3">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleResolveTicket(ticket.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Resolved
                                  </Button>
                                  <Button onClick={() => handleReply(ticket.id)}>
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Reply
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {openTickets.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Open Tickets</h3>
                <p className="text-gray-600">All tickets have been resolved. Great job!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* All Tickets Tab */}
        <TabsContent value="all" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-gray-900">All Tickets - {currentProperty}</h2>
            <Badge variant="secondary" className="text-sm">
              {myTickets.length} total tickets
            </Badge>
          </div>

          {myTickets.map((ticket) => (
            <Card key={ticket.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-3">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {ticket.id}
                      </Badge>
                      <Badge className={getStatusColor(ticket.status)}>
                        {getStatusIcon(ticket.status)}
                        <span className="ml-1">{ticket.status}</span>
                      </Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority} Priority
                      </Badge>
                      <Badge variant="outline" className="flex items-center">
                        <Tag className="h-3 w-3 mr-1" />
                        {ticket.category}
                      </Badge>
                    </div>

                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{ticket.title}</h3>
                    <p className="text-gray-600 mb-4 line-clamp-2">{ticket.description}</p>

                    <div className="grid grid-cols-2 gap-4 text-sm text-gray-500 mb-4">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span><strong>Guest:</strong> {ticket.guest}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4" />
                        <span>{ticket.guestPhone}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span><strong>Property:</strong> {ticket.property}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4" />
                        <span><strong>Created:</strong> {ticket.created}</span>
                      </div>
                    </div>

                    <div className="text-sm text-gray-600">
                      <span><strong>Created by:</strong> {ticket.createdBy}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-6">
                    <Badge variant="secondary" className="text-xs">
                      {ticket.responses.length} messages
                    </Badge>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedTicket(ticket)}
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Respond
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-4xl">
                        <DialogHeader>
                          <DialogTitle>
                            <div className="flex items-center space-x-3">
                              <span>Ticket {ticket.id} - {ticket.title}</span>
                              <Badge className={getStatusColor(ticket.status)}>
                                {ticket.status}
                              </Badge>
                              <Badge className={getPriorityColor(ticket.priority)}>
                                {ticket.priority}
                              </Badge>
                            </div>
                          </DialogTitle>
                        </DialogHeader>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                          {/* Ticket Details */}
                          <div className="bg-gray-50 p-4 rounded-lg">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div><span className="font-medium">Guest:</span> {ticket.guest}</div>
                              <div><span className="font-medium">Phone:</span> {ticket.guestPhone}</div>
                              <div><span className="font-medium">Property:</span> {ticket.property}</div>
                              <div><span className="font-medium">Category:</span> {ticket.category}</div>
                            </div>
                          </div>

                          {/* Conversation */}
                          <div className="space-y-3">
                            {ticket.responses.map((response) => (
                              <div key={response.id} className={`p-4 rounded-lg ${response.author.includes('Property Manager') ? 'bg-blue-50 border-l-4 border-blue-500 ml-8' :
                                response.type === 'close' ? 'bg-green-50 border-l-4 border-green-500' :
                                  'bg-gray-50 border-l-4 border-gray-500'
                                }`}>
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-sm">{response.author}</span>
                                  <span className="text-xs text-gray-500">{response.timestamp}</span>
                                </div>
                                <p className="text-gray-700">{response.message}</p>
                              </div>
                            ))}
                          </div>

                          {/* Reply Section */}
                          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                            <div className="border-t pt-4">
                              <div className="space-y-3">
                                <label className="block text-sm font-medium text-gray-700">
                                  Reply to Call Center
                                </label>
                                <Textarea
                                  placeholder="Type your response here..."
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  className="min-h-[100px]"
                                />
                                <div className="flex justify-end space-x-3">
                                  <Button
                                    variant="outline"
                                    onClick={() => handleResolveTicket(ticket.id)}
                                  >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Mark Resolved
                                  </Button>
                                  <Button
                                    onClick={() => handleReply(ticket.id)}
                                    disabled={!replyText.trim()}
                                  >
                                    <Send className="h-4 w-4 mr-2" />
                                    Send Reply
                                  </Button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PropertyManagerDashboard;