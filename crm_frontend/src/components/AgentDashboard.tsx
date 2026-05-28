import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Clock, Phone, Mail, User, Eye, TrendingUp, Target, CheckCircle, Users, MessageSquare, AlertTriangle } from "lucide-react";
import { EmailDialog } from "@/components/communication/EmailDialog";

interface AgentDashboardProps {
  userName: string;
  userRole: string;
}

export const AgentDashboard = ({ userName, userRole }: AgentDashboardProps) => {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [selectedLeadForDialog, setSelectedLeadForDialog] = useState<any>(null);

  // Mock data for today's follow-ups
  const todayFollowUps = [
    {
      id: "FU001",
      leadName: "Rajesh Kumar",
      phone: "+91 98765 43210",
      property: "Postcard Goa",
      scheduledTime: "10:00 AM",
      status: "pending",
      temperature: "Hot",
      bookingType: "Direct Customer",
      notes: "Interested in premium suite for anniversary"
    },
    {
      id: "FU002",
      leadName: "Priya Sharma",
      phone: "+91 87654 32109",
      property: "Postcard Udaipur",
      scheduledTime: "2:00 PM",
      status: "completed",
      temperature: "Warm",
      bookingType: "Corporate Booking",
      notes: "Follow up on spa package inquiry"
    },
    {
      id: "FU003",
      leadName: "Amit Patel",
      phone: "+91 76543 21098",
      property: "Postcard Munnar",
      scheduledTime: "4:30 PM",
      status: "pending",
      priority: "low",
      notes: "Corporate booking for team outing"
    }
  ];

  // Mock data for agent's leads conversation history
  const agentLeads = [
    {
      id: "L001",
      name: "Sunita Reddy",
      phone: "+91 98765 43211",
      email: "sunita.reddy@email.com",
      property: "Postcard Goa",
      status: "hot",
      lastInteraction: "2025-01-15",
      workingDays: 5,
      workingHours: 12,
      conversationHistory: [
        { date: "2025-01-15", time: "3:30 PM", type: "Call", notes: "Interested in beach view room for Feb", disposition: "Property Request" },
        { date: "2025-01-12", time: "11:00 AM", type: "Email", notes: "Sent brochure and pricing", disposition: "New Query" },
        { date: "2025-01-10", time: "2:15 PM", type: "Call", notes: "Initial inquiry about rates", disposition: "New Query" }
      ]
    },
    {
      id: "L002",
      name: "Vikram Singh",
      phone: "+91 87654 32110",
      email: "vikram.singh@email.com",
      property: "Postcard Udaipur",
      status: "warm",
      lastInteraction: "2024-01-14",
      workingDays: 8,
      workingHours: 20,
      conversationHistory: [
        { date: "2024-01-14", time: "4:00 PM", type: "WhatsApp", notes: "Confirmed dates, waiting for approval", disposition: "Call back" },
        { date: "2024-01-10", time: "1:30 PM", type: "Call", notes: "Discussed corporate rates", disposition: "Property Request" },
        { date: "2024-01-08", time: "10:00 AM", type: "Email", notes: "Initial corporate inquiry", disposition: "New Query" }
      ]
    }
  ];

  // Mock open tickets created by the current user
  const myOpenTickets = [
    {
      id: "T001",
      title: "Guest Room Service Issue",
      status: "open",
      priority: "high",
      property: "Postcard Goa",
      guestName: "Priya Sharma",
      createdDate: "2025-01-14",
      createdBy: userName,
      assignedTo: "Housekeeping Team",
      description: "Guest reporting AC not working in room 205"
    },
    {
      id: "T003",
      title: "Special Dietary Request",
      status: "open",
      priority: "low",
      property: "Postcard Rajasthan",
      guestName: "Meera Gupta",
      createdDate: "2025-01-15",
      createdBy: userName,
      assignedTo: "F&B Team",
      description: "Guest has gluten allergy, needs special meal arrangements"
    },
    {
      id: "T004",
      title: "Billing Discrepancy",
      status: "in-progress",
      priority: "medium",
      property: "Postcard Kerala",
      guestName: "Arjun Patel",
      createdDate: "2025-01-13",
      createdBy: "Another Agent",
      assignedTo: "Finance Team",
      description: "Extra charges appearing on guest bill"
    }
  ].filter((t) => t.status === 'open' && t.createdBy === userName);


  const getStatusColor = (status: string) => {
    switch (status) {
      case 'hot': return 'bg-red-100 text-red-800';
      case 'warm': return 'bg-orange-100 text-orange-800';
      case 'cold': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Welcome back, {userName}!</h1>
          <p className="text-muted-foreground">Here's your activity overview for today</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Today</p>
          <p className="text-lg font-semibold">{new Date().toLocaleDateString('en-IN')}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="text-sm text-muted-foreground">Follow-ups Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{agentLeads.length}</p>
                <p className="text-sm text-muted-foreground">Active Leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Phone className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">12</p>
                <p className="text-sm text-muted-foreground">Calls Today</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-sm text-muted-foreground">Conversions</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="followups" className="space-y-4">
        <TabsList>
          <TabsTrigger value="followups">Today's Follow-ups</TabsTrigger>
          <TabsTrigger value="leads">My Leads</TabsTrigger>
          <TabsTrigger value="tickets">Open Tickets</TabsTrigger>
        </TabsList>

        {/* Today's Follow-ups */}
        <TabsContent value="followups" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="h-5 w-5" />
                <span>Today's Follow-ups ({todayFollowUps.length})</span>
              </CardTitle>
              <CardDescription>
                Scheduled follow-up calls and meetings for today
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {todayFollowUps.map((followup) => (
                  <Card key={followup.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                          {/* Lead Info */}
                          <div className="space-y-1">
                            <h3 className="font-semibold text-lg">{followup.leadName}</h3>
                            <p className="text-sm text-muted-foreground">{followup.phone}</p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant={followup.status === 'completed' ? 'default' : 'secondary'}>
                                {followup.status}
                              </Badge>
                              {followup.priority && (
                                <Badge className={getPriorityColor(followup.priority)}>
                                  {followup.priority}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Property & Time */}
                          <div className="space-y-1">
                            <p className="font-medium">{followup.property}</p>
                            <p className="text-sm text-muted-foreground">Scheduled: {followup.scheduledTime}</p>
                            {followup.temperature && (
                              <p className="text-sm text-muted-foreground">Temperature: {followup.temperature}</p>
                            )}
                            {followup.bookingType && (
                              <p className="text-sm text-muted-foreground">Type: {followup.bookingType}</p>
                            )}
                          </div>

                          {/* Notes */}
                          <div className="space-y-1">
                            <p className="font-medium text-sm">Notes</p>
                            <p className="text-sm text-muted-foreground">{followup.notes}</p>
                          </div>

                          {/* Assignment */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-1 text-sm">
                              <User className="h-3 w-3" />
                              <span className="text-muted-foreground">Assigned:</span>
                              <span className="font-medium">{userName}</span>
                            </div>
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedLeadForDialog({ name: followup.leadName, phone: followup.phone, email: '' });
                              setIsCallDialogOpen(true);
                            }}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedLeadForDialog({ name: followup.leadName, phone: followup.phone, email: '' });
                              setIsEmailDialogOpen(true);
                            }}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLead(selectedLead === followup.id ? null : followup.id)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            {selectedLead === followup.id ? 'Hide' : 'View'}
                          </Button>
                        </div>
                      </div>

                      {/* Expanded Follow-up Details */}
                      {selectedLead === followup.id && (
                        <div className="mt-6 pt-6 border-t">
                          <h5 className="font-semibold mb-3">Follow-up Details</h5>
                          <div className="space-y-3">
                            <div className="p-3 bg-muted/50 rounded-lg">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="font-medium">Follow-up ID:</span>
                                  <p className="text-muted-foreground">{followup.id}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Scheduled Time:</span>
                                  <p className="text-muted-foreground">{followup.scheduledTime}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Status:</span>
                                  <p className="text-muted-foreground">{followup.status}</p>
                                </div>
                                <div>
                                  <span className="font-medium">Temperature:</span>
                                  <p className="text-muted-foreground">{followup.temperature || 'N/A'}</p>
                                </div>
                                <div className="col-span-2">
                                  <span className="font-medium">Notes:</span>
                                  <p className="text-muted-foreground">{followup.notes}</p>
                                </div>
                                <div className="col-span-2">
                                  <span className="font-medium">Booking Type:</span>
                                  <p className="text-muted-foreground">{followup.bookingType || 'N/A'}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Leads with Conversation History */}
        <TabsContent value="leads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>My Leads ({agentLeads.length})</span>
              </CardTitle>
              <CardDescription>
                All leads assigned to you with conversation history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {agentLeads.length} leads
              </div>
            </CardContent>
          </Card>

          {/* Leads Grid using detailed format */}
          <div className="space-y-4">
            {agentLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                      {/* Lead Info */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{lead.name}</h3>
                        <p className="text-sm text-muted-foreground">{lead.phone}</p>
                        <p className="text-sm text-muted-foreground">
                          <span className="underline cursor-pointer hover:text-blue-600">{lead.email}</span>
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Property & Dates */}
                      <div className="space-y-1">
                        <p className="font-medium">{lead.property}</p>
                        <p className="text-sm text-muted-foreground">Last Contact: {lead.lastInteraction}</p>
                        <p className="text-sm text-muted-foreground">Working Days: {lead.workingDays}</p>
                        <p className="text-sm text-muted-foreground">Working Hours: {lead.workingHours}h</p>
                      </div>

                      {/* Progress & Timing */}
                      <div className="space-y-1">
                        <p className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Working: {lead.workingDays}d {lead.workingHours}h
                        </p>
                        <p className="text-sm text-muted-foreground">Last: {lead.lastInteraction}</p>
                      </div>

                      {/* Assignment */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <User className="h-3 w-3" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="font-medium">{userName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedLeadForDialog(lead);
                          setIsEmailDialogOpen(true);
                        }}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLeadForDialog(lead);
                          setIsCallDialogOpen(true);
                        }}
                      >
                        <Phone className="h-4 w-4 mr-2" />
                        Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedLead(selectedLead === lead.id ? null : lead.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {selectedLead === lead.id ? 'Hide' : 'View'}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Conversation History */}
                  {selectedLead === lead.id && (
                    <div className="mt-6 pt-6 border-t">
                      <h5 className="font-semibold mb-3">Conversation History</h5>
                      <div className="space-y-3">
                        {lead.conversationHistory.map((conversation, index) => (
                          <div key={index} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                            <div className="flex-shrink-0">
                              {conversation.type === 'Call' && <Phone className="h-4 w-4 text-blue-600 mt-1" />}
                              {conversation.type === 'Email' && <Mail className="h-4 w-4 text-green-600 mt-1" />}
                              {conversation.type === 'WhatsApp' && <MessageSquare className="h-4 w-4 text-green-600 mt-1" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium">{conversation.type}</p>
                                <div className="text-xs text-muted-foreground">
                                  {conversation.date} - {conversation.time}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{conversation.notes}</p>
                              {conversation.disposition && (
                                <Badge variant="outline" className="text-xs">
                                  {conversation.disposition}
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Open Tickets - created by me and still open */}
        <TabsContent value="tickets" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Open Tickets Created by Me ({myOpenTickets.length})</span>
              </CardTitle>
              <CardDescription>
                Tickets you've created that are currently open
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myOpenTickets.map((ticket) => (
                  <div key={ticket.id} className="flex items-start justify-between p-4 border-l-4 bg-red-50 border-l-red-500 rounded-r">
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-semibold">{ticket.title}</h4>
                        <Badge variant="outline">#{ticket.id}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{ticket.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                        <span><strong>Guest:</strong> {ticket.guestName}</span>
                        <span><strong>Property:</strong> {ticket.property}</span>
                        <span><strong>Created:</strong> {ticket.createdDate}</span>
                        <span><strong>Assigned to:</strong> {ticket.assignedTo}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className="bg-red-100 text-red-800">Open</Badge>
                      <Badge className={getPriorityColor(ticket.priority)}>
                        {ticket.priority}
                      </Badge>
                      <Button size="sm" variant="outline">View</Button>
                    </div>
                  </div>
                ))}
                {myOpenTickets.length === 0 && (
                  <div className="text-center py-10">
                    <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                    <h4 className="font-semibold mb-1">No open tickets</h4>
                    <p className="text-sm text-muted-foreground">All tickets created by you are resolved. Great job!</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Email Dialog */}
      <EmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        guestEmail={selectedLeadForDialog?.email || ''}
        guestName={selectedLeadForDialog?.name || ''}
      />

      {/* Call Dialog */}
      <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Make a Call</DialogTitle>
            <DialogDescription>
              Call the lead and record notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="lead-name">Lead Name</Label>
              <Input
                id="lead-name"
                value={selectedLeadForDialog?.name || ''}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone-number">Phone Number</Label>
              <Input
                id="phone-number"
                value={selectedLeadForDialog?.phone || ''}
                readOnly
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="call-notes">Call Notes</Label>
              <Textarea
                id="call-notes"
                placeholder="Enter call notes..."
                rows={4}
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsCallDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => setIsCallDialogOpen(false)}>
                Save Call Notes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};