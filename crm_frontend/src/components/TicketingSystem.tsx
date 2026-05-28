import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Filter, Clock, AlertTriangle, CheckCircle,
  MessageSquare, User, MapPin, Calendar, Phone
} from "lucide-react";
import { useForm } from "react-hook-form";

const TicketingSystem = () => {
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
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
      id: "T003",
      title: "Special Dietary Request",
      description: "Guest has severe nut allergy, needs special meal arrangements",
      guest: "Meera Gupta",
      guestPhone: "+91 76543 21098",
      priority: "High",
      status: "Resolved",
      category: "Service",
      property: "Postcard Kerala",
      assignedTo: "Property Manager - Kerala",
      createdBy: "Harleen Mehta - Call Center",
      created: "2024-12-13 11:45 AM",
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: "Guest has severe nut allergy (anaphylaxis risk). Check-in tomorrow. Need kitchen team to prepare nut-free meals and ensure no cross-contamination.",
          timestamp: "2024-12-13 11:45 AM",
          type: "create"
        },
        {
          id: 2,
          author: "Property Manager - Kerala",
          message: "Informed executive chef. Separate cooking area prepared for guest meals. All restaurant staff briefed on allergy severity. Room service menu customized.",
          timestamp: "2024-12-13 3:30 PM",
          type: "response"
        },
        {
          id: 3,
          author: "Property Manager - Kerala",
          message: "Guest checked out successfully. No allergy incidents. Guest was very satisfied with our special arrangements. Closing ticket.",
          timestamp: "2024-12-15 12:00 PM",
          type: "close"
        }
      ]
    }
  ]);

  const form = useForm({
    defaultValues: {
      title: "",
      description: "",
      guest: "",
      guestPhone: "",
      priority: "Medium",
      category: "",
      property: ""
    }
  });

  const properties = [
    "Postcard Goa",
    "Postcard Kerala",
    "Postcard Rajasthan",
    "Postcard Mumbai"
  ];

  const categories = [
    "Reservation",
    "Billing",
    "Service",
    "Maintenance",
    "Complaint",
    "Request",
    "Emergency"
  ];

  const onSubmit = (data: any) => {
    const newTicket = {
      id: `T${String(tickets.length + 1).padStart(3, '0')}`,
      title: data.title,
      description: data.description,
      guest: data.guest,
      guestPhone: data.guestPhone,
      priority: data.priority,
      status: "Open",
      category: data.category,
      property: data.property,
      assignedTo: `Property Manager - ${data.property.split(' ')[1]}`,
      createdBy: "Harleen Mehta - Call Center",
      created: new Date().toLocaleString(),
      responses: [
        {
          id: 1,
          author: "Harleen Mehta - Call Center",
          message: data.description,
          timestamp: new Date().toLocaleString(),
          type: "create"
        }
      ]
    };

    setTickets([newTicket, ...tickets]);
    setIsNewTicketOpen(false);
    form.reset();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'bg-blue-100 text-blue-800';
      case 'In Progress': return 'bg-yellow-100 text-yellow-800';
      case 'Resolved': return 'bg-green-100 text-green-800';
      case 'Closed': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-100 text-red-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tickets" className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-white shadow-sm">
          <TabsTrigger value="tickets">All Tickets</TabsTrigger>
          <TabsTrigger value="create">Create Ticket</TabsTrigger>
        </TabsList>

        <TabsContent value="tickets" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
              <p className="text-gray-600">Create and track support tickets for property managers</p>
            </div>
            <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  New Ticket
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Support Ticket</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="guest"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guest Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter guest name..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="guestPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Guest Phone</FormLabel>
                            <FormControl>
                              <Input placeholder="+91 XXXXX XXXXX" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ticket Title</FormLabel>
                          <FormControl>
                            <Input placeholder="Brief description of the issue..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="property"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Property</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select property" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {properties.map((property) => (
                                  <SelectItem key={property} value={property}>
                                    {property}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Category</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select category" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {categories.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {category}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Priority</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="High">High</SelectItem>
                                <SelectItem value="Medium">Medium</SelectItem>
                                <SelectItem value="Low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="Provide detailed information about the issue or request..."
                              className="min-h-[100px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end space-x-3">
                      <Button type="button" variant="outline" onClick={() => setIsNewTicketOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Create Ticket</Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {tickets.map((ticket) => (
              <Card key={ticket.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {ticket.id}
                        </Badge>
                        <Badge className={getStatusColor(ticket.status)}>
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1">{ticket.status}</span>
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority}
                        </Badge>
                        <Badge variant="outline">{ticket.category}</Badge>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{ticket.title}</h3>
                      <p className="text-gray-600 mb-3 line-clamp-2">{ticket.description}</p>

                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <div className="flex items-center space-x-1">
                          <User className="h-4 w-4" />
                          <span>{ticket.guest}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Phone className="h-4 w-4" />
                          <span>{ticket.guestPhone}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <MapPin className="h-4 w-4" />
                          <span>{ticket.property}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Calendar className="h-4 w-4" />
                          <span>{ticket.created}</span>
                        </div>
                      </div>

                      <div className="mt-3 text-sm">
                        <span className="text-gray-600">Assigned to:</span>
                        <span className="ml-1 font-medium text-blue-600">{ticket.assignedTo}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Badge variant="secondary" className="text-xs">
                        {ticket.responses.length} responses
                      </Badge>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <MessageSquare className="h-4 w-4 mr-2" />
                            View
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>
                              <div className="flex items-center space-x-3">
                                <span>Ticket {ticket.id}</span>
                                <Badge className={getStatusColor(ticket.status)}>
                                  {ticket.status}
                                </Badge>
                                <Badge className={getPriorityColor(ticket.priority)}>
                                  {ticket.priority}
                                </Badge>
                              </div>
                            </DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <h4 className="font-semibold text-gray-900 mb-2">{ticket.title}</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Guest:</span>
                                  <span className="ml-1 font-medium">{ticket.guest}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Phone:</span>
                                  <span className="ml-1 font-medium">{ticket.guestPhone}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Property:</span>
                                  <span className="ml-1 font-medium">{ticket.property}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Category:</span>
                                  <span className="ml-1 font-medium">{ticket.category}</span>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3">
                              <h5 className="font-medium text-gray-900">Conversation</h5>
                              {ticket.responses.map((response) => (
                                <div key={response.id} className={`p-4 rounded-lg ${response.type === 'response' ? 'bg-blue-50 border-l-4 border-blue-500' :
                                  response.type === 'close' ? 'bg-green-50 border-l-4 border-green-500' :
                                    'bg-gray-50 border-l-4 border-gray-500'
                                  }`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm text-gray-900">{response.author}</span>
                                    <span className="text-xs text-gray-500">{response.timestamp}</span>
                                  </div>
                                  <p className="text-gray-700">{response.message}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create New Support Ticket</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="guest"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guest Name *</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter guest name..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="guestPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guest Phone *</FormLabel>
                          <FormControl>
                            <Input placeholder="+91 XXXXX XXXXX" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ticket Title *</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief description of the issue..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="property"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select property" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {properties.map((property) => (
                                <SelectItem key={property} value={property}>
                                  {property}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {categories.map((category) => (
                                <SelectItem key={category} value={category}>
                                  {category}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select priority" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="High">High</SelectItem>
                              <SelectItem value="Medium">Medium</SelectItem>
                              <SelectItem value="Low">Low</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description *</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide detailed information about the issue or request..."
                            className="min-h-[120px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-3">
                    <Button type="button" variant="outline" onClick={() => form.reset()}>
                      Reset Form
                    </Button>
                    <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                      Create Ticket
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TicketingSystem;