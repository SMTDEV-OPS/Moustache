import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Search, Filter, Plus, Phone, Mail, Calendar as CalendarIcon, Clock, User as UserIcon, TrendingUp, Eye, Users, MessageSquare, AlertTriangle, Trash2, Hotel } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { EmailDialog } from "@/components/communication/EmailDialog";
import { listLeads, Lead } from "@/services/leads";
import { listUsers, User } from "@/services/users";

interface ProfessionalLeadManagementProps {
  userRole: string;
  userName: string;
  backendUserId?: string;
  permissions?: string[];
}

const hotelEntrySchema = z.object({
  hotelName: z.string().min(1, "Hotel selection is required"),
  checkInDate: z.date({ required_error: "Check-in date is required" }),
  checkOutDate: z.date({ required_error: "Check-out date is required" }),
  roomCategory: z.string().min(1, "Room category is required"),
  roomPreference: z.string().optional(),
  numberOfGuests: z.string().min(1, "Guest count is required"),
});

const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  // Multiple hotels support
  hotels: z.array(hotelEntrySchema).min(1, "At least one hotel is required"),
  bookingSource: z.string().min(1, "Booking source is required"),
  guestContactNumber: z.string().min(10, "Valid contact number is required"),
  guestEmail: z.string().email("Valid email is required"),
  alternateContact: z.string().optional(),
  occupation: z.string().optional(),
  specialRequests: z.string().optional(),
  corporateBooking: z.string(),
  companyName: z.string().optional(),
  gstin: z.string().optional(),
  leadType: z.string().optional(),
  source: z.string().optional(),
  value: z.string().optional(),
  notes: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

const ProfessionalLeadManagement = ({
  userRole,
  userName,
  backendUserId,
  permissions,
}: ProfessionalLeadManagementProps) => {
  const [selectedLead, setSelectedLead] = useState<string | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilters, setSelectedFilters] = useState({
    status: "all",
    property: "all",
    temperature: "all", 
    bookingType: "all",
    assignedTo: userRole === 'callcenter' ? userName : "all"
  });

  const [scope, setScope] = useState<"own" | "team">("own");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const canViewTeamLeads =
    !!permissions?.includes("leads.view.team") ||
    !!permissions?.includes("leads.manage");

  const agentName = userRole === 'callcenter' ? userName : '';

  useEffect(() => {
    if (!backendUserId) {
      setLeads([]);
      return;
    }

    const fetchData = async () => {
      try {
        setIsLoadingLeads(true);
        setLoadError(null);
        const [leadData, usersData] = await Promise.all([
          listLeads({ scope }),
          listUsers(),
        ]);
        setLeads(leadData);
        setUserList(usersData);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Unable to load leads";
        setLoadError(message);
        const anyToast = toast as any;
        if (typeof anyToast.error === "function") {
          anyToast.error(message);
        } else {
          toast(message);
        }
      } finally {
        setIsLoadingLeads(false);
      }
    };

    void fetchData();
  }, [backendUserId, scope]);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailLead, setEmailLead] = useState<{ name: string; email: string } | null>(null);
  const [showCallbackDialog, setShowCallbackDialog] = useState(false);
  const [callbackLead, setCallbackLead] = useState<{ name: string } | null>(null);
  const [callbackDate, setCallbackDate] = useState<Date | undefined>(new Date());
  const [callbackTime, setCallbackTime] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      hotels: [
        {
          hotelName: "",
          checkInDate: undefined as unknown as Date,
          checkOutDate: undefined as unknown as Date,
          roomCategory: "",
          roomPreference: "",
          numberOfGuests: "",
        }
      ],
      bookingSource: "",
      guestContactNumber: "",
      guestEmail: "",
      alternateContact: "",
      occupation: "",
      specialRequests: "",
      corporateBooking: "no",
      companyName: "",
      gstin: "",
      leadType: "",
      source: "",
      value: "",
      notes: "",
    },
  });

  const { fields: hotelFields, append: appendHotel, remove: removeHotel } = useFieldArray({
    control: form.control,
    name: "hotels"
  });

  const addNewHotel = () => {
    appendHotel({
      hotelName: "",
      checkInDate: undefined as unknown as Date,
      checkOutDate: undefined as unknown as Date,
      roomCategory: "",
      roomPreference: "",
      numberOfGuests: ""
    });
  };

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

  // Leads mapped from backend for UI consumption
  const allLeads = leads.map((lead) => {
    const assignedUser = userList.find(
      (u) => u.id === lead.assignedToUserId
    );
    const assignedName =
      assignedUser?.name || assignedUser?.email || "Unassigned";

    const checkIn = lead.checkInDate
      ? lead.checkInDate.slice(0, 10)
      : "";
    const checkOut = lead.checkOutDate
      ? lead.checkOutDate.slice(0, 10)
      : "";

    const temperature =
      lead.heatLevel === "HOT"
        ? "Hot"
        : lead.heatLevel === "WARM"
        ? "Warm"
        : lead.heatLevel === "COLD"
        ? "Cold"
        : "Cold";

    return {
      id: lead.id,
      name: lead.leadNumber ?? lead.id,
      phone: "",
      email: "",
      property: lead.propertyId ?? "N/A",
      checkIn,
      checkOut,
      budget: "",
      pricePerNight: 0,
      status: lead.status,
      temperature,
      bookingType: "Direct Customer",
      assignedTo: assignedName,
      lastContact: "",
      nextFollowUp: undefined as string | undefined,
      workingDays: 0,
      workingHours: 0,
      score: 0,
      conversationHistory: [] as {
        date: string;
        time: string;
        type: string;
        agent: string;
        notes: string;
        disposition: string;
      }[],
    };
  });

  // Filter leads based on filters
  const filteredLeads = allLeads.filter(lead => {
    // Search query filter
    if (searchQuery && !lead.name.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !lead.phone.includes(searchQuery) && 
        !lead.email.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !lead.property.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    // Status filter
    if (selectedFilters.status !== "all" && lead.status !== selectedFilters.status) {
      return false;
    }

    // Property filter
    if (selectedFilters.property !== "all" && lead.property !== selectedFilters.property) {
      return false;
    }

    // Temperature filter
    if (selectedFilters.temperature !== "all" && lead.temperature !== selectedFilters.temperature) {
      return false;
    }
    
    // Booking type filter
    if (selectedFilters.bookingType !== "all" && lead.bookingType !== selectedFilters.bookingType) {
      return false;
    }

    // Assigned to filter (for managers)
    if (selectedFilters.assignedTo !== "all" && lead.assignedTo !== selectedFilters.assignedTo) {
      return false;
    }

    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "NEW":
        return "bg-blue-100 text-blue-800";
      case "IN_PROGRESS":
        return "bg-yellow-100 text-yellow-800";
      case "TENTATIVE":
        return "bg-orange-100 text-orange-800";
      case "CONFIRMED":
        return "bg-green-100 text-green-800";
      case "LOST":
      case "CLOSED_AUTO":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
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

  const getTemperatureColor = (temperature: string) => {
    switch (temperature) {
      case "Hot":
        return "bg-red-100 text-red-800 border-red-200";
      case "Warm":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "Cold":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getBookingTypeColor = (bookingType: string) => {
    switch (bookingType) {
      case "Confirmed Booking":
        return "bg-green-100 text-green-800 border-green-200";
      case "Tentative Booking":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "Corporate Booking":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Amendment":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Direct Customer":
        return "bg-teal-100 text-teal-800 border-teal-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-orange-600';
    return 'text-red-600';
  };

  const clearFilters = () => {
    setSelectedFilters({
      status: "all",
      property: "all", 
      temperature: "all",
      bookingType: "all",
      assignedTo: userRole === 'callcenter' ? agentName : "all"
    });
    setSearchQuery("");
  };

  const handleAssignLead = (leadId: string, assignTo: string) => {
    toast.success(`Lead assigned to ${assignTo}`);
    // In real implementation, this would update the lead assignment
  };

  const onSubmit = (data: LeadFormData) => {
    console.log("New lead data:", data);
    toast.success("Lead added successfully!");
    setIsAddLeadOpen(false);
    form.reset();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {userRole === 'callcenter' ? 'My Leads' : 'Lead Management'}
          </h1>
          <p className="text-muted-foreground">
            {userRole === 'callcenter' 
              ? 'Manage your assigned leads and track progress'
              : 'Comprehensive lead management and assignment'
            }
          </p>
        </div>
        
        <Dialog open={isAddLeadOpen} onOpenChange={setIsAddLeadOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Lead
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Lead</DialogTitle>
              <DialogDescription>
                Create a new lead with comprehensive details for better tracking and conversion.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest First Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Guest First Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="middleName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Middle Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Guest Middle Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Last Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Guest Last Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Multiple Hotels Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Hotel className="h-5 w-5" />
                      Hotel Bookings
                    </h3>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm"
                      onClick={addNewHotel}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Add Another Hotel
                    </Button>
                  </div>
                  
                  {hotelFields.map((hotel, index) => (
                    <div key={hotel.id} className="relative p-4 border rounded-lg bg-gray-50/50 space-y-4">
                      {hotelFields.length > 1 && (
                        <div className="absolute top-2 right-2 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">Hotel {index + 1}</Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeHotel(index)}
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      <FormField
                        control={form.control}
                        name={`hotels.${index}.hotelName`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Hotel Name *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Hotel" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                                <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                                <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                                <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`hotels.${index}.checkInDate`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Check In Date *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value || undefined}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`hotels.${index}.checkOutDate`}
                          render={({ field }) => (
                            <FormItem className="flex flex-col">
                              <FormLabel>Check Out Date *</FormLabel>
                              <Popover>
                                <PopoverTrigger asChild>
                                  <FormControl>
                                    <Button
                                      variant={"outline"}
                                      className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                      )}
                                    >
                                      {field.value ? (
                                        format(field.value, "PPP")
                                      ) : (
                                        <span>Pick a date</span>
                                      )}
                                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                  </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                  <Calendar
                                    mode="single"
                                    selected={field.value || undefined}
                                    onSelect={field.onChange}
                                    disabled={(date) => date < new Date()}
                                    initialFocus
                                  />
                                </PopoverContent>
                              </Popover>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`hotels.${index}.roomCategory`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Category *</FormLabel>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Room Category" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="standard">Standard Room</SelectItem>
                                  <SelectItem value="deluxe">Deluxe Room</SelectItem>
                                  <SelectItem value="suite">Suite</SelectItem>
                                  <SelectItem value="villa">Villa</SelectItem>
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`hotels.${index}.roomPreference`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Room Preference</FormLabel>
                              <FormControl>
                                <Input placeholder="e.g., Sea view, Garden view" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name={`hotels.${index}.numberOfGuests`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Number of Guests *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select Guest Count" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="1">1 Guest</SelectItem>
                                <SelectItem value="2">2 Guests</SelectItem>
                                <SelectItem value="3">3 Guests</SelectItem>
                                <SelectItem value="4">4 Guests</SelectItem>
                                <SelectItem value="5">5 Guests</SelectItem>
                                <SelectItem value="6">6 Guests</SelectItem>
                                <SelectItem value="7+">7+ Guests</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  ))}
                </div>

                {/* Booking Source */}
                <FormField
                  control={form.control}
                  name="bookingSource"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Booking Source *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Booking Source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Website">Website</SelectItem>
                          <SelectItem value="Email">Email</SelectItem>
                          <SelectItem value="Phone">Phone</SelectItem>
                          <SelectItem value="Walk-in">Walk-in</SelectItem>
                          <SelectItem value="Travel Agent">Travel Agent</SelectItem>
                          <SelectItem value="Corporate">Corporate</SelectItem>
                          <SelectItem value="OTA">OTA (Online Travel Agency)</SelectItem>
                          <SelectItem value="Social Media">Social Media</SelectItem>
                          <SelectItem value="Referral">Referral</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="guestContactNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Contact Number *</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 XXXXX XXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="alternateContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Alternate Contact</FormLabel>
                        <FormControl>
                          <Input placeholder="+91 XXXXX XXXXX" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="guestEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Guest Email *</FormLabel>
                        <FormControl>
                          <Input placeholder="guest@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="occupation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Occupation</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Business, Professional" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="specialRequests"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Special Requests</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Any special requirements, dietary restrictions, accessibility needs..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="corporateBooking"
                  render={({ field }) => (
                    <FormItem className="space-y-3">
                      <FormLabel>Is this a Corporate Booking?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex flex-row space-x-6"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="yes" />
                            <Label htmlFor="yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="no" />
                            <Label htmlFor="no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("corporateBooking") === "yes" && (
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="companyName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Company Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Company Name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gstin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>GSTIN</FormLabel>
                          <FormControl>
                            <Input placeholder="GSTIN Number" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                {/* Lead Type and Source */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="leadType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lead Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select Lead Type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FIT">FIT (Free Independent Traveler)</SelectItem>
                            <SelectItem value="Corporate">Corporate</SelectItem>
                            <SelectItem value="Group">Group</SelectItem>
                            <SelectItem value="Wedding">Wedding</SelectItem>
                            <SelectItem value="MICE">MICE</SelectItem>
                          </SelectContent>
                        </Select>
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
                          <Input placeholder="e.g., Website, Email, Phone" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="value"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estimated Value</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., ₹25,000" {...field} />
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
                  <Button type="button" variant="outline" onClick={() => setIsAddLeadOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Add Lead
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs for different views */}
      <Tabs defaultValue="leads" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="leads">My Leads</TabsTrigger>
          <TabsTrigger value="followups">Follow-ups</TabsTrigger>
        </TabsList>

        <TabsContent value="leads" className="space-y-6">
          {!backendUserId ? (
          <Card>
            <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  Backend user session not detected. Please login using backend
                  credentials to view your leads.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
          {/* Scope selector and Filters */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {scope === "own" ? "My Leads" : "My Team Leads"}
                </div>
                {canViewTeamLeads && (
                  <div className="inline-flex rounded-md border bg-muted p-0.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setScope("own")}
                      className={cn(
                        "px-2 py-1 rounded-sm",
                        scope === "own"
                          ? "bg-background font-semibold"
                          : "opacity-70"
                      )}
                    >
                      My Leads
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("team")}
                      className={cn(
                        "px-2 py-1 rounded-sm",
                        scope === "team"
                          ? "bg-background font-semibold"
                          : "opacity-70"
                      )}
                    >
                      My Team Leads
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads by name, phone, email, or property..."
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
                      <SelectItem value="NEW">New</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="TENTATIVE">Tentative</SelectItem>
                      <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                      <SelectItem value="LOST">Lost</SelectItem>
                      <SelectItem value="CLOSED_AUTO">Auto Closed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedFilters.property} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, property: value }))}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Property" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Properties</SelectItem>
                      <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                      <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                      <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                      <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                      <SelectItem value="Postcard Coonoor">Postcard Coonoor</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedFilters.temperature} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, temperature: value }))}>
                    <SelectTrigger className="w-32">
                      <SelectValue placeholder="Temperature" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Temperature</SelectItem>
                      <SelectItem value="Hot">Hot</SelectItem>
                      <SelectItem value="Warm">Warm</SelectItem>
                      <SelectItem value="Cold">Cold</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={selectedFilters.bookingType} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, bookingType: value }))}>
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Booking Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="Tentative Booking">Tentative Booking</SelectItem>
                      <SelectItem value="Amendment">Amendment</SelectItem>
                      <SelectItem value="Corporate Booking">Corporate Booking</SelectItem>
                      <SelectItem value="Direct Customer">Direct Customer</SelectItem>
                      <SelectItem value="Confirmed Booking">Confirmed Booking</SelectItem>
                    </SelectContent>
                  </Select>

                  {userRole !== 'callcenter' && (
                    <Select
                      value={selectedFilters.assignedTo}
                      onValueChange={(value) =>
                        setSelectedFilters((prev) => ({
                          ...prev,
                          assignedTo: value,
                        }))
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Assigned To" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Agents</SelectItem>
                        {userList.map((user) => (
                          <SelectItem
                            key={user.id}
                            value={user.name || user.email}
                          >
                            {user.name || user.email}
                          </SelectItem>
                        ))}
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
                {isLoadingLeads
                  ? "Loading leads..."
                  : `Showing ${filteredLeads.length} of ${allLeads.length} leads`}
                {loadError && (
                  <span className="ml-2 text-red-600">
                    ({loadError})
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Leads Grid */}
          <div className="space-y-4">
            {filteredLeads.map((lead) => (
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
                              setEmailLead({ name: lead.name, email: lead.email });
                              setShowEmailDialog(true);
                            }}
                          >
                            {lead.email}
                          </span>
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          <Badge className={getTemperatureColor(lead.temperature)}>
                            {lead.temperature}
                          </Badge>
                          <Badge className={getBookingTypeColor(lead.bookingType)}>
                            {lead.bookingType}
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
                        <p className="text-sm text-muted-foreground">Next: {lead.nextFollowUp}</p>
                      </div>

                      {/* Assignment & Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <UserIcon className="h-3 w-3" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="font-medium">{lead.assignedTo}</span>
                        </div>
                        
                        {userRole !== 'callcenter' && (
                          <Select onValueChange={(value) => handleAssignLead(lead.id, value)}>
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Reassign to..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Harleen Mehta">Harleen Mehta</SelectItem>
                              <SelectItem value="Rahul Singh">Rahul Singh</SelectItem>
                              <SelectItem value="Priya Kumar">Priya Kumar</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => {
                        setCallbackLead({ name: lead.name });
                        setShowCallbackDialog(true);
                      }}>
                        Schedule Call back
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEmailLead({ name: lead.name, email: lead.email });
                        setShowEmailDialog(true);
                      }}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email
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

                  {/* Conversation History */}
                  {selectedLead === lead.id && (
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

          {filteredLeads.length === 0 && !isLoadingLeads && (
            <Card>
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No leads found</h3>
                <p className="text-muted-foreground">Try adjusting your filters or search criteria</p>
                <Button variant="outline" className="mt-4" onClick={clearFilters}>
                  Clear all filters
                </Button>
              </CardContent>
            </Card>
          )}
        </>
          )}
        </TabsContent>

        <TabsContent value="followups" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Follow-ups Due</CardTitle>
              <CardDescription>Leads requiring immediate attention and follow-up</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-sm text-muted-foreground">
                Showing {allLeads.filter(lead => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length} follow-ups due
              </div>
            </CardContent>
          </Card>

          {/* Follow-ups Grid using same format as My Leads */}
          <div className="space-y-4">
            {allLeads.filter(lead => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).map((lead) => (
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
                              setEmailLead({ name: lead.name, email: lead.email });
                              setShowEmailDialog(true);
                            }}
                          >
                            {lead.email}
                          </span>
                        </p>
                        <div className="flex items-center space-x-2 mt-2">
                          <Badge className={getStatusColor(lead.status)}>
                            {lead.status}
                          </Badge>
                          <Badge className={getTemperatureColor(lead.temperature)}>
                            {lead.temperature}
                          </Badge>
                          <Badge className={getBookingTypeColor(lead.bookingType)}>
                            {lead.bookingType}
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
                        <p className="text-sm text-orange-600 font-medium">Due: {lead.nextFollowUp}</p>
                      </div>

                      {/* Assignment & Actions */}
                      <div className="space-y-2">
                        <div className="flex items-center space-x-1 text-sm">
                          <UserIcon className="h-3 w-3" />
                          <span className="text-muted-foreground">Assigned:</span>
                          <span className="font-medium">{lead.assignedTo}</span>
                        </div>
                        
                        {userRole !== 'callcenter' && (
                          <Select onValueChange={(value) => handleAssignLead(lead.id, value)}>
                            <SelectTrigger className="w-full text-xs">
                              <SelectValue placeholder="Reassign to..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Harleen Mehta">Harleen Mehta</SelectItem>
                              <SelectItem value="Rahul Singh">Rahul Singh</SelectItem>
                              <SelectItem value="Priya Kumar">Priya Kumar</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col space-y-2 ml-4">
                      <Button size="sm" variant="outline" onClick={() => {
                        setCallbackLead({ name: lead.name });
                        setShowCallbackDialog(true);
                      }}>
                        Schedule Call back
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEmailLead({ name: lead.name, email: lead.email });
                        setShowEmailDialog(true);
                      }}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email
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

                  {/* Conversation History */}
                  {selectedLead === lead.id && (
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

          {allLeads.filter(lead => lead.nextFollowUp && new Date(lead.nextFollowUp) <= new Date()).length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No follow-ups due</h3>
                <p className="text-muted-foreground">All caught up! Great work.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>

      {/* Schedule Callback Dialog */}
      <Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Call back for {callbackLead?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Callback Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {callbackDate ? format(callbackDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={callbackDate}
                    onSelect={setCallbackDate}
                    initialFocus
                    className="p-3 pointer-events-auto"
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
              <Button variant="outline" onClick={() => setShowCallbackDialog(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success("Callback scheduled");
                  setShowCallbackDialog(false);
                  setCallbackTime("");
                  setCallbackNotes("");
                }}
              >
                Schedule Callback
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <EmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        guestEmail={emailLead?.email}
        guestName={emailLead?.name}
      />
    </div>
  );
};

export default ProfessionalLeadManagement;