import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Calendar as CalendarIcon, Phone, Mail, MapPin, Clock, User, Eye, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { EmailDialog } from "@/components/communication/EmailDialog";

interface SalesExecutiveDashboardProps {
  userName: string;
  defaultTab?: 'leads' | 'follow-ups' | 'tickets';
}

const SalesExecutiveDashboard = ({ userName, defaultTab = 'leads' }: SalesExecutiveDashboardProps) => {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedCallbackDate, setSelectedCallbackDate] = useState<Date | undefined>(new Date());
  const [callbackTime, setCallbackTime] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");
  const [isCallbackDialogOpen, setIsCallbackDialogOpen] = useState(false);
  const [isEmailDialogOpen, setIsEmailDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [leadDetailView, setLeadDetailView] = useState<string | null>(null);

  // Mock data for sales executive's leads
  const myLeads = [
    {
      id: "L001",
      name: "Ankit Sharma",
      email: "ankit.sharma@email.com",
      phone: "+91 98765 43210",
      source: "Website",
      property: "Postcard Goa",
      status: "New",
      priority: "High",
      checkIn: "2024-07-15",
      checkOut: "2024-07-18",
      guests: 2,
      budget: "₹25,000",
      pricePerNight: 8500,
      assignedDate: "2024-06-15",
      followUpDate: "2024-06-18",
      lastContact: "2024-06-15",
      workingDays: 3,
      workingHours: 8,
      score: 85,
      assignedTo: userName,
      notes: "Interested in beachfront room with sea view",
      conversationHistory: [
        { date: "2024-06-15", time: "2:00 PM", type: "Email", agent: userName, notes: "Initial inquiry received", disposition: "New Query" },
        { date: "2024-06-16", time: "11:30 AM", type: "Call", agent: userName, notes: "Discussed room preferences", disposition: "Follow up" }
      ]
    },
    {
      id: "L002",
      name: "Priya Gupta",
      email: "priya.gupta@email.com",
      phone: "+91 87654 32109",
      source: "Phone",
      property: "Postcard Udaipur",
      status: "Follow Up",
      priority: "Medium",
      checkIn: "2024-08-10",
      checkOut: "2024-08-14",
      guests: 4,
      budget: "₹45,000",
      pricePerNight: 11500,
      assignedDate: "2024-06-12",
      followUpDate: "2024-06-20",
      lastContact: "2024-06-18",
      workingDays: 6,
      workingHours: 12,
      score: 65,
      assignedTo: userName,
      notes: "Family vacation, needs connecting rooms",
      conversationHistory: [
        { date: "2024-06-18", time: "3:30 PM", type: "Call", agent: userName, notes: "Family vacation planning", disposition: "Follow up" },
        { date: "2024-06-12", time: "10:00 AM", type: "Call", agent: userName, notes: "Initial contact", disposition: "New Query" }
      ]
    },
    {
      id: "L003",
      name: "Rajesh Kumar",
      email: "rajesh.kumar@email.com",
      phone: "+91 76543 21098",
      source: "Referral",
      property: "Postcard Munnar",
      status: "Quoted",
      priority: "High",
      checkIn: "2024-07-25",
      checkOut: "2024-07-28",
      guests: 2,
      budget: "₹30,000",
      pricePerNight: 10000,
      assignedDate: "2024-06-10",
      followUpDate: "2024-06-22",
      lastContact: "2024-06-20",
      workingDays: 10,
      workingHours: 15,
      score: 75,
      assignedTo: userName,
      notes: "Honeymoon package inquiry",
      conversationHistory: [
        { date: "2024-06-20", time: "4:00 PM", type: "Email", agent: userName, notes: "Sent honeymoon package details", disposition: "Quoted" },
        { date: "2024-06-15", time: "11:00 AM", type: "Call", agent: userName, notes: "Honeymoon package discussion", disposition: "Follow up" },
        { date: "2024-06-10", time: "9:00 AM", type: "Call", agent: userName, notes: "Initial referral contact", disposition: "New Query" }
      ]
    },
    {
      id: "L004",
      name: "Meera Singh",
      email: "meera.singh@email.com",
      phone: "+91 65432 10987",
      source: "Social Media",
      property: "Postcard Goa",
      status: "Converted",
      priority: "Medium",
      checkIn: "2024-06-25",
      checkOut: "2024-06-28",
      guests: 3,
      budget: "₹35,000",
      pricePerNight: 12000,
      assignedDate: "2024-06-05",
      followUpDate: "Completed",
      lastContact: "2024-06-24",
      workingDays: 19,
      workingHours: 25,
      score: 100,
      assignedTo: userName,
      notes: "Booked deluxe room with breakfast",
      conversationHistory: [
        { date: "2024-06-24", time: "5:00 PM", type: "Email", agent: userName, notes: "Booking confirmation sent", disposition: "Converted" },
        { date: "2024-06-22", time: "2:30 PM", type: "Call", agent: userName, notes: "Final booking discussion", disposition: "Closing" },
        { date: "2024-06-15", time: "1:00 PM", type: "Call", agent: userName, notes: "Social media inquiry follow-up", disposition: "Follow up" },
        { date: "2024-06-05", time: "10:30 AM", type: "Email", agent: userName, notes: "Initial social media inquiry", disposition: "New Query" }
      ]
    }
  ];

  // Mock data for open tickets
  const openTickets = [
    {
      id: "T001",
      guestName: "Ankit Sharma",
      guestEmail: "ankit.sharma@email.com",
      guestPhone: "+91 98765 43210",
      property: "Postcard Goa",
      roomNumber: "201",
      issueType: "Room Service",
      priority: "High",
      description: "AC not working properly in the room",
      status: "Open",
      assignedTo: userName,
      createdDate: "2025-01-15",
      lastUpdated: "2025-01-16",
      checkIn: "2025-01-14",
      checkOut: "2025-01-18"
    },
    {
      id: "T002",
      guestName: "Priya Gupta",
      guestEmail: "priya.gupta@email.com",
      guestPhone: "+91 87654 32109",
      property: "Postcard Udaipur",
      roomNumber: "305",
      issueType: "Maintenance",
      priority: "Medium",
      description: "Bathroom faucet is leaking",
      status: "In Progress",
      assignedTo: userName,
      createdDate: "2025-01-14",
      lastUpdated: "2025-01-15",
      checkIn: "2025-01-13",
      checkOut: "2025-01-17"
    },
    {
      id: "T003",
      guestName: "Rajesh Kumar",
      guestEmail: "rajesh.kumar@email.com",
      guestPhone: "+91 76543 21098",
      property: "Postcard Munnar",
      roomNumber: "102",
      issueType: "Billing",
      priority: "Low",
      description: "Question about extra charges on bill",
      status: "Open",
      assignedTo: userName,
      createdDate: "2025-01-16",
      lastUpdated: "2025-01-16",
      checkIn: "2025-01-15",
      checkOut: "2025-01-19"
    }
  ];

  // Upcoming follow-ups
  const upcomingFollowUps = myLeads
    .filter(lead => lead.followUpDate !== "Completed" && lead.status !== "Converted")
    .sort((a, b) => new Date(a.followUpDate).getTime() - new Date(b.followUpDate).getTime());

  // Helper functions
  const calculateNights = (checkIn: string, checkOut: string) => {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'New': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'Follow Up': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Quoted': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'Converted': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'Lost': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Sales Executive Dashboard</h1>
          <p className="text-muted-foreground">Welcome back, {userName}</p>
        </div>
      </div>

      {/* Year to Date Stats */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Year to Date Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Leads YTD</p>
                  <p className="text-2xl font-bold text-foreground">147</p>
                  <p className="text-sm text-green-600">+23% vs last year</p>
                </div>
                <User className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversions YTD</p>
                  <p className="text-2xl font-bold text-green-600">42</p>
                  <p className="text-sm text-green-600">28.6% conversion rate</p>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  28.6%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Revenue YTD</p>
                  <p className="text-2xl font-bold text-purple-600">₹18.5L</p>
                  <p className="text-sm text-green-600">+31% vs last year</p>
                </div>
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avg Deal Size YTD</p>
                  <p className="text-2xl font-bold text-indigo-600">₹44,048</p>
                  <p className="text-sm text-green-600">+12% vs last year</p>
                </div>
                <User className="h-8 w-8 text-indigo-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Current Month Stats */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Current Month Performance</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">My Total Leads</p>
                  <p className="text-2xl font-bold text-foreground">{myLeads.length}</p>
                </div>
                <User className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Conversions</p>
                  <p className="text-2xl font-bold text-green-600">
                    {myLeads.filter(lead => lead.status === 'Converted').length}
                  </p>
                </div>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                  {((myLeads.filter(lead => lead.status === 'Converted').length / myLeads.length) * 100).toFixed(1)}%
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Follow-ups Due</p>
                  <p className="text-2xl font-bold text-orange-600">{upcomingFollowUps.length}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Leads</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {myLeads.filter(lead => !['Converted', 'Lost'].includes(lead.status)).length}
                  </p>
                </div>
                <User className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="follow-ups">My Today's Follow Ups</TabsTrigger>
          <TabsTrigger value="leads">My Leads</TabsTrigger>
          <TabsTrigger value="tickets">Open Tickets</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>My Leads</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {myLeads.length} leads
              </div>
            </CardContent>
          </Card>

          {/* Leads Grid using detailed format */}
          <div className="space-y-4">
            {myLeads.map((lead) => (
              <Card key={lead.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                      {/* Lead Info */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{lead.name}</h3>
                        <p className="text-sm text-muted-foreground">{lead.phone}</p>
                        <p className="text-sm text-muted-foreground">
                          <span
                            className="underline cursor-pointer hover:text-blue-600"
                            onClick={() => {
                              setSelectedLead(lead);
                              setIsEmailDialogOpen(true);
                            }}
                          >
                            {lead.email}
                          </span>
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          <Badge className={getPriorityColor(lead.priority)}>
                            {lead.priority}
                          </Badge>
                        </div>
                      </div>

                      {/* Property & Dates */}
                      <div className="space-y-1">
                        <p className="font-medium">{lead.property}</p>
                        <p className="text-sm text-muted-foreground">Check-in: {lead.checkIn}</p>
                        <p className="text-sm text-muted-foreground">Check-out: {lead.checkOut}</p>
                        <p className="text-sm text-muted-foreground">Guest Budget: {lead.budget}</p>
                        <p className="text-sm text-muted-foreground">Total nights: {calculateNights(lead.checkIn, lead.checkOut)}</p>
                        <p className="text-sm font-medium text-green-600">
                          Total Deal Value: {formatCurrency(calculateNights(lead.checkIn, lead.checkOut) * lead.pricePerNight)}
                        </p>
                      </div>

                      {/* Progress & Timing */}
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Score:</span>
                          <span className={`ml-1 font-bold ${getScoreColor(lead.score)}`}>{lead.score}%</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-1" />
                          Working: {lead.workingDays}d {lead.workingHours}h
                        </p>
                        <p className="text-sm text-muted-foreground">Last: {lead.lastContact}</p>
                        <p className="text-sm text-muted-foreground">Next: {lead.followUpDate}</p>
                      </div>

                      {/* Assignment & Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <User className="h-3 w-3" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="font-medium">{lead.assignedTo}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">Source: {lead.source}</p>
                        {lead.notes && <p className="text-sm text-muted-foreground">Notes: {lead.notes}</p>}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsEmailDialogOpen(true);
                        }}
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLead(lead);
                          setIsCallbackDialogOpen(true);
                        }}
                      >
                        Schedule Call back
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLeadDetailView(leadDetailView === lead.id ? null : lead.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {leadDetailView === lead.id ? 'Hide' : 'View'}
                      </Button>
                    </div>
                  </div>

                  {/* Conversation History */}
                  {leadDetailView === lead.id && (
                    <div className="mt-6 pt-6 border-t">
                      <h4 className="font-semibold mb-4">Conversation History</h4>
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
                                <p className="text-sm font-medium">{conversation.type} by {conversation.agent}</p>
                                <div className="text-xs text-muted-foreground">
                                  {conversation.date} - {conversation.time}
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">{conversation.notes}</p>
                              <Badge variant="outline" className="text-xs">
                                {conversation.disposition}
                              </Badge>
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

        <TabsContent value="follow-ups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scheduled Follow-ups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {upcomingFollowUps.length} follow-ups due
              </div>
            </CardContent>
          </Card>

          {/* Follow-ups using detailed format */}
          <div className="space-y-4">
            {upcomingFollowUps.length > 0 ? (
              upcomingFollowUps.map((lead) => (
                <Card key={lead.id} className="hover:shadow-md transition-shadow border-l-4 border-l-orange-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                        {/* Lead Info */}
                        <div className="space-y-1">
                          <h3 className="font-semibold text-lg">{lead.name}</h3>
                          <p className="text-sm text-muted-foreground">{lead.phone}</p>
                          <p className="text-sm text-muted-foreground">
                            <span
                              className="underline cursor-pointer hover:text-blue-600"
                              onClick={() => {
                                setSelectedLead(lead);
                                setIsEmailDialogOpen(true);
                              }}
                            >
                              {lead.email}
                            </span>
                          </p>
                          <div className="flex items-center space-x-2 mt-2">
                            <Badge className={getStatusColor(lead.status)}>
                              {lead.status}
                            </Badge>
                            <Badge className={getPriorityColor(lead.priority)}>
                              {lead.priority}
                            </Badge>
                          </div>
                        </div>

                        {/* Property & Dates */}
                        <div className="space-y-1">
                          <p className="font-medium">{lead.property}</p>
                          <p className="text-sm text-muted-foreground">Check-in: {lead.checkIn}</p>
                          <p className="text-sm text-muted-foreground">Check-out: {lead.checkOut}</p>
                          <p className="text-sm text-muted-foreground">Guest Budget: {lead.budget}</p>
                          <p className="text-sm text-muted-foreground">Total nights: {calculateNights(lead.checkIn, lead.checkOut)}</p>
                          <p className="text-sm font-medium text-green-600">
                            Total Deal Value: {formatCurrency(calculateNights(lead.checkIn, lead.checkOut) * lead.pricePerNight)}
                          </p>
                        </div>

                        {/* Progress & Timing */}
                        <div className="space-y-1">
                          <p className="text-sm">
                            <span className="font-medium">Score:</span>
                            <span className={`ml-1 font-bold ${getScoreColor(lead.score)}`}>{lead.score}%</span>
                          </p>
                          <p className="text-sm text-muted-foreground">
                            <Clock className="h-3 w-3 inline mr-1" />
                            Working: {lead.workingDays}d {lead.workingHours}h
                          </p>
                          <p className="text-sm text-muted-foreground">Last: {lead.lastContact}</p>
                          <p className="text-sm text-orange-600 font-medium">Due: {lead.followUpDate}</p>
                        </div>

                        {/* Assignment & Actions */}
                        <div className="space-y-2">
                          <div className="flex items-center space-x-1 text-sm">
                            <User className="h-3 w-3" />
                            <span className="text-muted-foreground">Assigned:</span>
                            <span className="font-medium">{lead.assignedTo}</span>
                          </div>
                          <p className="text-sm text-muted-foreground">Source: {lead.source}</p>
                          {lead.notes && <p className="text-sm text-muted-foreground">Notes: {lead.notes}</p>}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col space-y-2 ml-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsEmailDialogOpen(true);
                          }}
                        >
                          <Mail className="h-4 w-4 mr-2" />
                          Email
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsCallbackDialogOpen(true);
                          }}
                        >
                          Schedule Call back
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setLeadDetailView(leadDetailView === lead.id ? null : lead.id)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          {leadDetailView === lead.id ? 'Hide' : 'View'}
                        </Button>
                      </div>
                    </div>

                    {/* Conversation History */}
                    {leadDetailView === lead.id && (
                      <div className="mt-6 pt-6 border-t">
                        <h4 className="font-semibold mb-4">Conversation History</h4>
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
                                  <p className="text-sm font-medium">{conversation.type} by {conversation.agent}</p>
                                  <div className="text-xs text-muted-foreground">
                                    {conversation.date} - {conversation.time}
                                  </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-2">{conversation.notes}</p>
                                <Badge variant="outline" className="text-xs">
                                  {conversation.disposition}
                                </Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="p-12 text-center">
                  <CalendarIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600">No Follow-ups Scheduled</h3>
                  <p className="text-gray-500">All your leads are up to date!</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="tickets" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Open Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {openTickets.length} open tickets
              </div>
            </CardContent>
          </Card>

          {/* Tickets Grid */}
          <div className="space-y-4">
            {openTickets.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
                      {/* Guest Info */}
                      <div className="space-y-1">
                        <h3 className="font-semibold text-lg">{ticket.guestName}</h3>
                        <p className="text-sm text-muted-foreground">{ticket.guestPhone}</p>
                        <p className="text-sm text-muted-foreground">{ticket.guestEmail}</p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={`${ticket.status === 'Open'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : ticket.status === 'In Progress'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                            {ticket.status}
                          </Badge>
                          <Badge className={`${ticket.priority === 'High'
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                            : ticket.priority === 'Medium'
                              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                              : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                            }`}>
                            {ticket.priority}
                          </Badge>
                        </div>
                      </div>

                      {/* Property & Room Info */}
                      <div className="space-y-1">
                        <p className="font-medium">{ticket.property}</p>
                        <p className="text-sm text-muted-foreground">Room: {ticket.roomNumber}</p>
                        <p className="text-sm text-muted-foreground">Check-in: {ticket.checkIn}</p>
                        <p className="text-sm text-muted-foreground">Check-out: {ticket.checkOut}</p>
                        <p className="text-sm font-medium text-blue-600">Issue: {ticket.issueType}</p>
                      </div>

                      {/* Issue Details */}
                      <div className="space-y-1">
                        <p className="text-sm">
                          <span className="font-medium">Description:</span>
                        </p>
                        <p className="text-sm text-muted-foreground">{ticket.description}</p>
                        <p className="text-sm text-muted-foreground">Created: {ticket.createdDate}</p>
                        <p className="text-sm text-muted-foreground">Updated: {ticket.lastUpdated}</p>
                      </div>

                      {/* Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <User className="h-3 w-3" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="font-medium">{ticket.assignedTo}</span>
                        </div>
                        <div className="flex flex-col gap-2 mt-4">
                          <Button size="sm" variant="default">
                            Update Status
                          </Button>
                          <Button size="sm" variant="outline">
                            <Phone className="h-3 w-3 mr-1" />
                            Call Guest
                          </Button>
                          <Button size="sm" variant="outline">
                            <Mail className="h-3 w-3 mr-1" />
                            Email Guest
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Schedule Callback Dialog */}
      <Dialog open={isCallbackDialogOpen} onOpenChange={setIsCallbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Call back for {selectedLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Callback Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {selectedCallbackDate ? format(selectedCallbackDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedCallbackDate}
                    onSelect={setSelectedCallbackDate}
                    initialFocus
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
              <Button variant="outline" onClick={() => setIsCallbackDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => {
                // Handle callback scheduling logic here
                setIsCallbackDialogOpen(false);
                setCallbackTime("");
                setCallbackNotes("");
              }}>
                Schedule Callback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <EmailDialog
        open={isEmailDialogOpen}
        onOpenChange={setIsEmailDialogOpen}
        guestEmail={selectedLead?.email}
        guestName={selectedLead?.name}
      />
    </div>
  );
};

export default SalesExecutiveDashboard;