
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Mail, TrendingUp, Clock, User, Plus, Filter, Star, Phone } from "lucide-react";
import { useForm } from "react-hook-form";
import { useToast } from "@/hooks/use-toast";

const EmailLeads = () => {
  const [isNewLeadDialogOpen, setIsNewLeadDialogOpen] = useState(false);
  const [emailLeads, setEmailLeads] = useState([
    {
      id: "EL001",
      name: "Jennifer Adams",
      email: "j.adams@company.com",
      phone: "+1 (555) 876-5432",
      source: "Newsletter Signup",
      campaign: "Summer Getaway 2025",
      status: "Proposal",
      value: "$1,800",
      assignedTo: "Mike Chen",
      created: "2025-06-09",
      lastContact: "2025-06-10",
      notes: "Corporate retreat planning for 20 people - responded to our summer package email",
      temperature: "Warm",
      bookingType: "Corporate Booking",
      score: 78,
      interactions: 3,
      emailActivity: [
        { date: "2025-06-10", action: "Opened", subject: "Follow-up: Summer Corporate Packages" },
        { date: "2025-06-09", action: "Clicked", subject: "Exclusive Summer Offers - 30% Off" },
        { date: "2025-06-08", action: "Opened", subject: "Exclusive Summer Offers - 30% Off" }
      ]
    },
    {
      id: "EL002",
      name: "Emma Rodriguez",
      email: "emma.rodriguez@techcorp.com",
      phone: "+1 (555) 654-3210",
      source: "Email Reply",
      campaign: "Luxury Weekend Package",
      status: "Query",
      value: "$2,400",
      assignedTo: "Lisa Park",
      created: "2025-06-11",
      lastContact: "2025-06-11",
      notes: "Replied to promotional email asking about luxury package availability for next month",
      temperature: "Hot",
      bookingType: "Direct Customer",
      score: 92,
      interactions: 2,
      emailActivity: [
        { date: "2025-06-11", action: "Replied", subject: "RE: Luxury Weekend Escape Packages" },
        { date: "2025-06-11", action: "Opened", subject: "Luxury Weekend Escape Packages" }
      ]
    },
    {
      id: "EL003",
      name: "Robert Kim",
      email: "r.kim@startup.io",
      phone: "+1 (555) 432-1098",
      source: "Email Campaign Click",
      campaign: "Wedding Packages 2024",
      status: "Query",
      value: "$4,500",
      assignedTo: "Mike Chen",
      created: "2024-06-09",
      lastContact: "2024-06-12",
      notes: "Clicked through wedding package email multiple times. Planning destination wedding for 50 guests",
      priority: "high",
      score: 95,
      interactions: 4,
      emailActivity: [
        { date: "2024-06-12", action: "Clicked", subject: "Wedding Package Inquiry Form" },
        { date: "2024-06-11", action: "Opened", subject: "Perfect Wedding Destination Packages" },
        { date: "2024-06-10", action: "Clicked", subject: "Perfect Wedding Destination Packages" },
        { date: "2024-06-09", action: "Opened", subject: "Perfect Wedding Destination Packages" }
      ]
    },
    {
      id: "EL004",
      name: "Lisa Wang",
      email: "lisa.wang@consulting.com",
      phone: "+1 (555) 321-0987",
      source: "Email Referral",
      campaign: "Referral Program",
      status: "Proposal",
      value: "$1,200",
      assignedTo: "John Smith",
      created: "2024-06-07",
      lastContact: "2024-06-08",
      notes: "Referred by existing customer via email. Showed interest in team building retreat packages",
      priority: "medium",
      score: 75,
      interactions: 2,
      emailActivity: [
        { date: "2024-06-08", action: "Opened", subject: "Team Building Retreat Packages" },
        { date: "2024-06-07", action: "Clicked", subject: "Welcome! Explore Our Exclusive Offers" }
      ]
    }
  ]);

  const { toast } = useToast();
  
  const form = useForm({
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      source: "",
      campaign: "",
      value: "",
      notes: "",
      temperature: "Hot",
      bookingType: "Corporate Booking",
      status: "Tentative"
    }
  });

  const calculateLeadScore = (data: any) => {
    let score = 30; // Base score
    
    // Email activity scoring
    if (data.source.toLowerCase().includes('reply')) score += 30;
    if (data.source.toLowerCase().includes('click')) score += 25;
    if (data.source.toLowerCase().includes('newsletter')) score += 20;
    if (data.source.toLowerCase().includes('referral')) score += 25;
    
    // Value scoring
    const value = parseInt(data.value.replace(/[$,]/g, '')) || 0;
    if (value > 3000) score += 25;
    else if (value > 1500) score += 15;
    else if (value > 500) score += 10;
    
    // Temperature scoring
    if (data.temperature === 'Hot') score += 15;
    else if (data.temperature === 'Warm') score += 8;
    
    // Booking type scoring
    if (data.bookingType === 'Confirmed Booking') score += 20;
    else if (data.bookingType === 'Corporate Booking') score += 15;
    else if (data.bookingType === 'Amendment') score += 10;
    else if (data.bookingType === 'Direct Customer') score += 12;
    
    return Math.min(score, 100);
  };

  const onSubmit = (data: any) => {
    const score = calculateLeadScore(data);
    const newLead = {
      id: `EL${String(emailLeads.length + 1).padStart(3, '0')}`,
      name: data.name,
      email: data.email,
      phone: data.phone,
      source: data.source,
      campaign: data.campaign,
      status: data.status,
      value: data.value,
      assignedTo: "Mike Chen",
      created: new Date().toISOString().split('T')[0],
      lastContact: new Date().toISOString().split('T')[0],
      notes: data.notes,
      temperature: data.temperature,
      bookingType: data.bookingType,
      score: score,
      interactions: 1,
      emailActivity: [
        { date: new Date().toISOString().split('T')[0], action: "Subscribed", subject: "Welcome Email" }
      ]
    };

    setEmailLeads([...emailLeads, newLead]);
    setIsNewLeadDialogOpen(false);
    form.reset();
    toast({
      title: "Email lead created",
      description: "New email lead has been added successfully."
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'query': return 'bg-blue-500';
      case 'proposal': return 'bg-yellow-500';
      case 'tentative': return 'bg-orange-500';
      case 'confirmed': return 'bg-green-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high': return 'text-red-600 bg-red-50';
      case 'medium': return 'text-yellow-600 bg-yellow-50';
      case 'low': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getTemperatureColor = (temperature: string) => {
    switch (temperature.toLowerCase()) {
      case 'hot':
        return 'text-red-800 bg-red-100';
      case 'warm':
        return 'text-yellow-800 bg-yellow-100';
      case 'cold':
        return 'text-blue-800 bg-blue-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const getBookingTypeColor = (bookingType: string) => {
    switch (bookingType) {
      case 'Confirmed Booking':
        return 'text-green-800 bg-green-100';
      case 'Tentative Booking':
        return 'text-orange-800 bg-orange-100';
      case 'Corporate Booking':
        return 'text-purple-800 bg-purple-100';
      case 'Amendment':
        return 'text-indigo-800 bg-indigo-100';
      case 'Direct Customer':
        return 'text-teal-800 bg-teal-100';
      default:
        return 'text-gray-800 bg-gray-100';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'replied': return 'bg-green-100 text-green-800';
      case 'clicked': return 'bg-blue-100 text-blue-800';
      case 'opened': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Email Leads Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Email Lead Tracking</h2>
          <p className="text-gray-600">Monitor email campaign performance and lead engagement</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Filter className="h-4 w-4 mr-2" />
            Filter
          </Button>
          <Dialog open={isNewLeadDialogOpen} onOpenChange={setIsNewLeadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="h-4 w-4 mr-2" />
                New Email Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Create Email Lead</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Enter lead name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Enter email address" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="campaign"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Campaign</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Summer Getaway 2025" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="source"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Source</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Email Campaign Click, Newsletter Signup" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimated Value</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., $2,500" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Enter any additional notes..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end space-x-2">
                    <Button type="button" variant="outline" onClick={() => setIsNewLeadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">Create Lead</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Email Lead Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Email Leads</p>
                <p className="text-2xl font-bold text-blue-700">{emailLeads.length}</p>
              </div>
              <Mail className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">Avg. Open Rate</p>
                <p className="text-2xl font-bold text-green-700">68%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-yellow-600">Click Rate</p>
                <p className="text-2xl font-bold text-yellow-700">24%</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Conversion Rate</p>
                <p className="text-2xl font-bold text-purple-700">12%</p>
              </div>
              <Star className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Leads List */}
      <Card className="bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Email Leads (Sorted by Score)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {emailLeads
              .sort((a, b) => b.score - a.score)
              .map((lead) => (
              <div key={lead.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className={`h-3 w-3 rounded-full ${getStatusColor(lead.status)}`} />
                    <h4 className="font-semibold text-gray-900">{lead.name}</h4>
                    <Badge variant="outline" className={getTemperatureColor(lead.temperature)}>
                      {lead.temperature}
                    </Badge>
                    <Badge variant="outline" className={getBookingTypeColor(lead.bookingType)}>
                      {lead.bookingType}
                    </Badge>
                    <Badge variant="outline" className={getScoreColor(lead.score)}>
                      <Star className="h-3 w-3 mr-1" />
                      Score: {lead.score}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">{lead.value}</p>
                    <p className="text-sm text-gray-500">{lead.status}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-sm text-gray-600 mb-4">
                  <div>
                    <p className="font-medium">Contact</p>
                    <p>{lead.email}</p>
                    <p>{lead.phone}</p>
                  </div>
                  <div>
                    <p className="font-medium">Campaign</p>
                    <p>{lead.campaign}</p>
                    <p className="text-xs">{lead.source}</p>
                  </div>
                  <div>
                    <p className="font-medium">Assigned To</p>
                    <p>{lead.assignedTo}</p>
                  </div>
                  <div>
                    <p className="font-medium">Last Contact</p>
                    <p>{lead.lastContact}</p>
                  </div>
                </div>

                <div className="mb-3">
                  <p className="text-sm text-gray-700">{lead.notes}</p>
                </div>

                {/* Email Activity Timeline */}
                <div>
                  <p className="font-medium text-sm mb-2">Email Activity</p>
                  <div className="flex flex-wrap gap-2">
                    {lead.emailActivity.map((activity, index) => (
                      <div key={index} className="flex items-center space-x-2 text-xs">
                        <Badge className={getActionColor(activity.action)}>
                          {activity.action}
                        </Badge>
                        <span className="text-gray-500">{activity.date}</span>
                        <span className="text-gray-600 truncate max-w-48">{activity.subject}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailLeads;
