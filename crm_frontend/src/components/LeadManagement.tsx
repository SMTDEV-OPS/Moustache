import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarIcon, User, MapPin, Clock, Plus, Filter, Mail, Trash2, Hotel } from "lucide-react";
import { useForm, useFieldArray } from "react-hook-form";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { disableCheckInDate, disableCheckoutDate, startOfDay } from "@/lib/leadDates";
import type { UseFormReturn } from "react-hook-form";

function LeadMgmtHotelDates({
  index,
  form,
}: {
  index: number;
  form: UseFormReturn<any>;
}) {
  const checkIn = form.watch(`hotels.${index}.checkInDate`);

  return (
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
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value || undefined}
                  onSelect={(date) => {
                    field.onChange(date);
                    const checkOut = form.getValues(`hotels.${index}.checkOutDate`);
                    if (date && checkOut && startOfDay(checkOut) < startOfDay(date)) {
                      form.setValue(`hotels.${index}.checkOutDate`, null);
                    }
                  }}
                  disabled={disableCheckInDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
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
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value ? format(field.value, "dd-MM-yyyy") : <span>Pick a date</span>}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value || undefined}
                  onSelect={field.onChange}
                  disabled={(date) => disableCheckoutDate(date, checkIn || null)}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

const LeadManagement = () => {
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [isNewLeadDialogOpen, setIsNewLeadDialogOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterForm, setFilterForm] = useState({
    guestName: "",
    bookerName: "",
    hotel: "all",
    status: "all",
    assignedTeam: "all",
    checkInFrom: "",
    checkInTo: "",
    leadCreationFrom: "",
    leadCreationTo: "",
    source: "",
    priority: "all"
  });

  const teams = [
    { name: "Harleen Mehta", department: "Sales Team" },
    { name: "Priya Sharma", department: "Sales Team" },
    { name: "Rajesh Kumar", department: "Sales Team" },
    { name: "Anjali Patel", department: "Sales Team" },
    { name: "Vikram Singh", department: "Sales Team" },
    { name: "Meera Gupta", department: "Sales Team" },
    { name: "Kavita Reddy", department: "Sales Team" },
    { name: "Arjun Malhotra", department: "Sales Team" }
  ];

  const propertyRoomCategories = {
    "Postcard Goa": ["Deluxe Ocean View", "Premium Sea Facing", "Luxury Villa", "Standard Room"],
    "Postcard Kerala": ["Backwater Suite", "Garden View", "Pool Villa", "Heritage Room"],
    "Postcard Rajasthan": ["Royal Suite", "Palace View", "Courtyard Room", "Desert Villa"],
    "Postcard Mumbai": ["City View", "Executive Suite", "Business Room", "Premium Floor"]
  };

  const [leads, setLeads] = useState<any[]>([
    {
      id: "L001",
      firstName: "Arjun",
      middleName: "",
      lastName: "Kumar",
      bookerName: "Arjun Kumar",
      bookerPhone: "+91 98765 43210",
      email: "arjun.kumar@email.com",
      phone: "+91 98765 43210",
      source: "Website",
      status: "Query",
      value: "$3,200",
      hotelName: "Postcard Goa",
      checkInDate: "2025-01-20",
      checkOutDate: "2025-01-23",
      roomCategory: "Deluxe Ocean View",
      numberOfRooms: 1,
      paxPerRoom: "2",
      extraBed: false,
      companyName: "",
      rateQuoted: "$1600",
      mealPlan: "CP",
      clientName: "Self",
      contactNumber: "+91 98765 43210",
      specialRequest: "Anniversary celebration",
      otherRequirements: "Airport transfer needed",
      destinationConfirmed: true,
      datesFinal: false,
      confirmationBy: "2025-01-15",
      salesColleague: "Priya Sharma - Sales Team",
      assignedTo: "Priya Sharma - Sales Team",
      created: "2025-12-10",
      lastContact: "2025-12-11",
      notes: "Interested in luxury suite for anniversary trip",
      temperature: "Hot",
      bookingType: "Direct Customer",
      score: 95,
      interactions: 5,
      captureDate: "2025-12-10",
      hotels: []
    },
    {
      id: "L002",
      firstName: "Kavya",
      middleName: "",
      lastName: "Patel",
      bookerName: "HR Department - Tech Solutions",
      bookerPhone: "+91 87654 32109",
      email: "kavya.patel@company.com",
      phone: "+91 87654 32109",
      source: "Email Campaign",
      status: "Proposal",
      value: "$1,800",
      hotelName: "Postcard Kerala",
      checkInDate: "2025-01-18",
      checkOutDate: "2025-01-21",
      roomCategory: "Backwater Suite",
      numberOfRooms: 2,
      paxPerRoom: "4,4",
      extraBed: false,
      companyName: "Tech Solutions Ltd",
      rateQuoted: "$900",
      mealPlan: "MAP",
      clientName: "HR Department",
      contactNumber: "+91 87654 32109",
      specialRequest: "Team building activities",
      otherRequirements: "Conference room booking",
      destinationConfirmed: true,
      datesFinal: true,
      confirmationBy: "2025-01-16",
      salesColleague: "Rajesh Kumar - Sales Team",
      assignedTo: "Anjali Patel - Sales Team",
      created: "2024-12-09",
      lastContact: "2024-12-10",
      notes: "Corporate retreat planning for 20 people",
      priority: "medium",
      score: 78,
      interactions: 3,
      captureDate: "2024-12-09"
    },
    {
      id: "L003",
      firstName: "Rajesh",
      middleName: "",
      lastName: "Singh",
      bookerName: "Rajesh Singh",
      bookerPhone: "+91 76543 21098",
      email: "rajesh.singh@email.com",
      phone: "+91 76543 21098",
      source: "Event",
      status: "Tentative",
      value: "$950",
      hotelName: "Postcard Rajasthan",
      checkInDate: "2025-01-16",
      checkOutDate: "2025-01-18",
      roomCategory: "Palace View",
      numberOfRooms: 1,
      paxPerRoom: "2",
      extraBed: true,
      companyName: "",
      rateQuoted: "$475",
      mealPlan: "EP",
      clientName: "Self",
      contactNumber: "+91 76543 21098",
      specialRequest: "Birthday celebration",
      otherRequirements: "Car rental",
      destinationConfirmed: false,
      datesFinal: false,
      confirmationBy: "2025-01-14",
      salesColleague: "",
      assignedTo: "Vikram Singh - Sales Team",
      created: "2024-12-08",
      lastContact: "2024-12-08",
      notes: "Inquired about weekend getaway packages",
      priority: "low",
      score: 45,
      interactions: 1,
      captureDate: "2024-12-08"
    },
    // Additional leads from other sales reps across India
    {
      id: "L004",
      firstName: "Sneha",
      middleName: "",
      lastName: "Reddy",
      bookerName: "Sneha Reddy",
      bookerPhone: "+91 95412 78653",
      email: "sneha.reddy@email.com",
      phone: "+91 95412 78653",
      source: "Social Media",
      status: "Query",
      value: "$2,400",
      hotelName: "Postcard Kerala",
      checkInDate: "2025-01-25",
      checkOutDate: "2025-01-28",
      roomCategory: "Pool Villa",
      numberOfRooms: 2,
      paxPerRoom: "3,2",
      extraBed: true,
      companyName: "",
      rateQuoted: "$1200",
      mealPlan: "AP",
      clientName: "Self",
      contactNumber: "+91 95412 78653",
      specialRequest: "Family vacation with kids",
      otherRequirements: "Kids activities",
      destinationConfirmed: true,
      datesFinal: true,
      confirmationBy: "2025-01-18",
      salesColleague: "Meera Gupta - Sales Team",
      assignedTo: "Meera Gupta - Sales Team",
      created: "2024-12-11",
      lastContact: "2024-12-12",
      notes: "Family of 5, interested in Kerala backwaters experience",
      priority: "high",
      score: 88,
      interactions: 4,
      captureDate: "2024-12-11"
    },
    {
      id: "L005",
      firstName: "Amit",
      middleName: "",
      lastName: "Sharma",
      bookerName: "Amit Sharma",
      bookerPhone: "+91 94321 65487",
      email: "amit.sharma@corporate.com",
      phone: "+91 94321 65487",
      source: "Corporate Referral",
      status: "Proposal",
      value: "$5,200",
      hotelName: "Postcard Rajasthan",
      checkInDate: "2025-02-15",
      checkOutDate: "2025-02-18",
      roomCategory: "Royal Suite",
      numberOfRooms: 3,
      paxPerRoom: "2,2,2",
      extraBed: false,
      companyName: "Global Solutions Inc",
      rateQuoted: "$2600",
      mealPlan: "MAP",
      clientName: "Global Solutions Inc",
      contactNumber: "+91 94321 65487",
      specialRequest: "Executive retreat",
      otherRequirements: "Conference facilities, wifi",
      destinationConfirmed: true,
      datesFinal: false,
      confirmationBy: "2025-01-20",
      salesColleague: "Kavita Reddy - Sales Team",
      assignedTo: "Kavita Reddy - Sales Team",
      created: "2024-12-05",
      lastContact: "2024-12-09",
      notes: "Corporate group booking for senior executives",
      priority: "high",
      score: 82,
      interactions: 6,
      captureDate: "2024-12-05"
    },
    {
      id: "L006",
      firstName: "Ravi",
      middleName: "",
      lastName: "Patel",
      bookerName: "Ravi Patel Family",
      bookerPhone: "+91 98712 34567",
      email: "ravi.patel@email.com",
      phone: "+91 98712 34567",
      source: "Website Chat",
      status: "Tentative",
      value: "$1,200",
      hotelName: "Postcard Mumbai",
      checkInDate: "2025-03-10",
      checkOutDate: "2025-03-12",
      roomCategory: "City View",
      numberOfRooms: 1,
      paxPerRoom: "4",
      extraBed: true,
      companyName: "",
      rateQuoted: "$600",
      mealPlan: "CP",
      clientName: "Self",
      contactNumber: "+91 98712 34567",
      specialRequest: "Budget-friendly stay",
      otherRequirements: "Local transport guidance",
      destinationConfirmed: false,
      datesFinal: false,
      confirmationBy: "2025-02-01",
      salesColleague: "Arjun Malhotra - Sales Team",
      assignedTo: "Arjun Malhotra - Sales Team",
      created: "2024-12-07",
      lastContact: "2024-12-08",
      notes: "Price-sensitive customer, looking for deals",
      priority: "low",
      score: 35,
      interactions: 2,
      captureDate: "2024-12-07"
    }
  ]);

  const form = useForm({
    defaultValues: {
      firstName: "",
      middleName: "",
      lastName: "",
      // Multiple hotels array
      hotels: [
        {
          hotelName: "",
          checkInDate: null as Date | null,
          checkOutDate: null as Date | null,
          roomCategory: "",
          roomPreference: "",
          numberOfGuests: ""
        }
      ],
      bookingSource: "",
      contactNumber: "",
      alternateContact: "",
      email: "",
      occupation: "",
      specialRequest: "",
      isCorporateBooking: "No",
      companyName: "",
      gstin: "",
      source: "",
      leadType: "",
      value: "",
      notes: "",
      priority: "medium",
      status: "Tentative"
    }
  });

  const { fields: hotelFields, append: appendHotel, remove: removeHotel } = useFieldArray({
    control: form.control,
    name: "hotels"
  });

  const getUrgencyStatus = (checkInDate: string, status: string) => {
    const today = new Date();
    const checkIn = new Date(checkInDate);
    const diffDays = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (status === "Open" || status === "Query" || status === "Proposal") {
      if (diffDays <= 1) return "critical";
      if (diffDays <= 5) return "urgent";
    }
    return "normal";
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical': return 'bg-red-600 animate-pulse';
      case 'urgent': return 'bg-red-500';
      default: return 'bg-blue-500';
    }
  };

  const filteredLeads = leads.filter(lead => {
    // Guest Name filter
    if (filterForm.guestName && !`${lead.firstName} ${lead.lastName}`.toLowerCase().includes(filterForm.guestName.toLowerCase())) {
      return false;
    }

    // Booker Name filter
    if (filterForm.bookerName && !lead.bookerName.toLowerCase().includes(filterForm.bookerName.toLowerCase())) {
      return false;
    }

    // Hotel filter
    if (filterForm.hotel && filterForm.hotel !== "all" && lead.hotelName !== filterForm.hotel) {
      return false;
    }

    // Status filter
    if (filterForm.status && filterForm.status !== "all" && lead.status !== filterForm.status) {
      return false;
    }

    // Team filter - check if assigned team member belongs to the selected department
    if (filterForm.assignedTeam && filterForm.assignedTeam !== "all" && !lead.assignedTo.toLowerCase().includes(filterForm.assignedTeam.toLowerCase())) {
      return false;
    }

    // Source filter
    if (filterForm.source && !lead.source.toLowerCase().includes(filterForm.source.toLowerCase())) {
      return false;
    }

    // Priority filter
    if (filterForm.priority && filterForm.priority !== "all" && lead.priority !== filterForm.priority) {
      return false;
    }

    // Date filters
    if (filterForm.checkInFrom && lead.checkInDate < filterForm.checkInFrom) {
      return false;
    }

    if (filterForm.checkInTo && lead.checkInDate > filterForm.checkInTo) {
      return false;
    }

    // Lead Creation Date filters
    if (filterForm.leadCreationFrom && lead.created < filterForm.leadCreationFrom) {
      return false;
    }

    if (filterForm.leadCreationTo && lead.created > filterForm.leadCreationTo) {
      return false;
    }

    return true;
  });

  const clearFilters = () => {
    setFilterForm({
      guestName: "",
      bookerName: "",
      hotel: "all",
      status: "all",
      assignedTeam: "all",
      checkInFrom: "",
      checkInTo: "",
      leadCreationFrom: "",
      leadCreationTo: "",
      source: "",
      priority: "all"
    });
  };

  const addNewHotel = () => {
    appendHotel({
      hotelName: "",
      checkInDate: null,
      checkOutDate: null,
      roomCategory: "",
      roomPreference: "",
      numberOfGuests: ""
    });
  };

  const onSubmit = (data: any) => {
    // Get the first hotel for backward compatibility with lead list display
    const primaryHotel = data.hotels[0] || {};

    const newLead = {
      id: `L${String(leads.length + 1).padStart(3, '0')}`,
      firstName: data.firstName,
      middleName: data.middleName,
      lastName: data.lastName,
      bookerName: `${data.firstName} ${data.lastName}`,
      bookerPhone: data.contactNumber,
      email: data.email,
      phone: data.contactNumber,
      alternateContact: data.alternateContact,
      occupation: data.occupation,
      source: data.source,
      leadType: data.leadType,
      bookingSource: data.bookingSource,
      status: data.status,
      value: data.value,
      // Primary hotel info for display
      hotelName: primaryHotel.hotelName || '',
      checkInDate: primaryHotel.checkInDate ? format(primaryHotel.checkInDate, 'yyyy-MM-dd') : '',
      checkOutDate: primaryHotel.checkOutDate ? format(primaryHotel.checkOutDate, 'yyyy-MM-dd') : '',
      roomCategory: primaryHotel.roomCategory || '',
      roomPreference: primaryHotel.roomPreference || '',
      numberOfGuests: primaryHotel.numberOfGuests || '',
      // All hotels array for multi-hotel leads
      hotels: data.hotels.map((hotel: any) => ({
        hotelName: hotel.hotelName,
        checkInDate: hotel.checkInDate ? format(hotel.checkInDate, 'yyyy-MM-dd') : '',
        checkOutDate: hotel.checkOutDate ? format(hotel.checkOutDate, 'yyyy-MM-dd') : '',
        roomCategory: hotel.roomCategory,
        roomPreference: hotel.roomPreference,
        numberOfGuests: hotel.numberOfGuests
      })),
      numberOfRooms: data.hotels.length,
      paxPerRoom: data.hotels.map((h: any) => h.numberOfGuests).join(','),
      extraBed: false,
      isCorporateBooking: data.isCorporateBooking === "Yes",
      companyName: data.isCorporateBooking === "Yes" ? data.companyName : '',
      gstin: data.isCorporateBooking === "Yes" ? data.gstin : '',
      rateQuoted: data.value,
      mealPlan: "",
      clientName: "Self",
      contactNumber: data.contactNumber,
      specialRequest: data.specialRequest,
      otherRequirements: "",
      destinationConfirmed: true,
      datesFinal: false,
      confirmationBy: "",
      salesColleague: "",
      assignedTo: "Harleen Mehta - Sales Team",
      created: new Date().toISOString().split('T')[0],
      lastContact: new Date().toISOString().split('T')[0],
      notes: data.notes,
      priority: data.priority,
      score: Math.floor(Math.random() * 40) + 60,
      interactions: 1,
      captureDate: new Date().toISOString().split('T')[0]
    };

    setLeads([...leads, newLead]);
    setIsNewLeadDialogOpen(false);
    form.reset();
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

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-50';
    if (score >= 60) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getSourceIcon = (source: string) => {
    if (source.toLowerCase().includes('email') || source.toLowerCase().includes('newsletter')) {
      return <Mail className="h-4 w-4" />;
    }
    return <User className="h-4 w-4" />;
  };

  const getFilterCount = () => {
    let count = 0;
    if (filterForm.guestName) count++;
    if (filterForm.bookerName) count++;
    if (filterForm.hotel !== "all") count++;
    if (filterForm.status !== "all") count++;
    if (filterForm.assignedTeam !== "all") count++;
    if (filterForm.source) count++;
    if (filterForm.priority !== "all") count++;
    if (filterForm.checkInFrom) count++;
    if (filterForm.checkInTo) count++;
    if (filterForm.leadCreationFrom) count++;
    if (filterForm.leadCreationTo) count++;
    return count;
  };

  return (
    <div className="space-y-6">
      {/* Lead Management Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sales Leads from All Reps</h2>
          <p className="text-gray-600">Manage and track leads from all sales representatives across India</p>
        </div>

        <div className="flex space-x-3">
          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline">
                <Filter className="h-4 w-4 mr-2" />
                Filter ({getFilterCount()})
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="end">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filter Leads</h4>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear All
                  </Button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Guest Name</label>
                    <Input
                      placeholder="Search by guest name..."
                      value={filterForm.guestName}
                      onChange={(e) => setFilterForm({ ...filterForm, guestName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Booker Name</label>
                    <Input
                      placeholder="Search by booker name..."
                      value={filterForm.bookerName}
                      onChange={(e) => setFilterForm({ ...filterForm, bookerName: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Hotel</label>
                    <Select value={filterForm.hotel} onValueChange={(value) => setFilterForm({ ...filterForm, hotel: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Hotel" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Hotels</SelectItem>
                        <SelectItem value="Postcard Goa">Postcard Goa</SelectItem>
                        <SelectItem value="Postcard Kerala">Postcard Kerala</SelectItem>
                        <SelectItem value="Postcard Rajasthan">Postcard Rajasthan</SelectItem>
                        <SelectItem value="Postcard Mumbai">Postcard Mumbai</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Status</label>
                    <Select value={filterForm.status} onValueChange={(value) => setFilterForm({ ...filterForm, status: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="Query">Query</SelectItem>
                        <SelectItem value="Proposal">Proposal</SelectItem>
                        <SelectItem value="Tentative">Tentative</SelectItem>
                        <SelectItem value="Confirmed">Confirmed</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Assigned Team</label>
                    <Select value={filterForm.assignedTeam} onValueChange={(value) => setFilterForm({ ...filterForm, assignedTeam: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        <SelectItem value="sales">Sales Team</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Source</label>
                    <Input
                      placeholder="Website, Email, etc..."
                      value={filterForm.source}
                      onChange={(e) => setFilterForm({ ...filterForm, source: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-1 block">Priority</label>
                    <Select value={filterForm.priority} onValueChange={(value) => setFilterForm({ ...filterForm, priority: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Priorities</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="low">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Check-in From</label>
                      <Input
                        type="date"
                        value={filterForm.checkInFrom}
                        onChange={(e) => setFilterForm({ ...filterForm, checkInFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Check-in To</label>
                      <Input
                        type="date"
                        value={filterForm.checkInTo}
                        onChange={(e) => setFilterForm({ ...filterForm, checkInTo: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Lead Creation From</label>
                      <Input
                        type="date"
                        value={filterForm.leadCreationFrom}
                        onChange={(e) => setFilterForm({ ...filterForm, leadCreationFrom: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Lead Creation To</label>
                      <Input
                        type="date"
                        value={filterForm.leadCreationTo}
                        onChange={(e) => setFilterForm({ ...filterForm, leadCreationTo: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Dialog open={isNewLeadDialogOpen} onOpenChange={setIsNewLeadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
                <p className="text-sm text-gray-500">Create a new lead with comprehensive details for better tracking and conversion.</p>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Guest Name Section */}
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

                        <LeadMgmtHotelDates index={index} form={form} />

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
                                    {form.watch(`hotels.${index}.hotelName`) &&
                                      propertyRoomCategories[form.watch(`hotels.${index}.hotelName`) as keyof typeof propertyRoomCategories]?.map((category) => (
                                        <SelectItem key={category} value={category}>{category}</SelectItem>
                                      ))
                                    }
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

                  {/* Contact Details */}
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contactNumber"
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
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Guest Email *</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="guest@example.com" {...field} />
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

                  {/* Special Requests */}
                  <FormField
                    control={form.control}
                    name="specialRequest"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Special Requests</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Any special requirements, dietary restrictions, accessibility needs..."
                            className="min-h-[80px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Corporate Booking Section */}
                  <div className="space-y-4 p-4 border rounded-lg">
                    <FormField
                      control={form.control}
                      name="isCorporateBooking"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Is this a Corporate Booking?</FormLabel>
                          <FormControl>
                            <RadioGroup
                              onValueChange={field.onChange}
                              value={field.value}
                              className="flex flex-row space-x-6"
                            >
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="Yes" id="corporate-yes" />
                                <Label htmlFor="corporate-yes">Yes</Label>
                              </div>
                              <div className="flex items-center space-x-2">
                                <RadioGroupItem value="No" id="corporate-no" />
                                <Label htmlFor="corporate-no">No</Label>
                              </div>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch("isCorporateBooking") === "Yes" && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
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
                  </div>

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

                  {/* Value */}
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

                  {/* Notes */}
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Enter any additional notes..."
                            className="min-h-[100px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end space-x-3 pt-4 border-t">
                    <Button type="button" variant="outline" onClick={() => setIsNewLeadDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="bg-violet-500 hover:bg-violet-600">
                      Add Lead
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Enhanced Lead Cards with History */}
        <div className="grid gap-6">
          {filteredLeads.map((lead) => {
            const urgency = getUrgencyStatus(lead.checkInDate, lead.status);
            return (
              <Card key={lead.id} className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => setSelectedLead(selectedLead?.id === lead.id ? null : lead)}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-4">
                      <div className={`h-4 w-4 rounded-full ${getUrgencyColor(urgency)}`} />
                      <div>
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">
                            {lead.firstName} {lead.lastName}
                          </h3>
                          <Badge variant="outline" className="font-mono text-xs">{lead.id}</Badge>
                          <Badge className={`${getStatusColor(lead.status)}`}>
                            {lead.status}
                          </Badge>
                          <Badge variant="outline" className={getPriorityColor(lead.priority)}>
                            {lead.priority} priority
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                          <span className="flex items-center space-x-1">
                            {getSourceIcon(lead.source)}
                            <span>{lead.source}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <User className="h-4 w-4" />
                            <span>{lead.assignedTo}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <MapPin className="h-4 w-4" />
                            <span>{lead.hotelName}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">{lead.value}</div>
                      <div className="flex items-center space-x-2 text-sm text-gray-500">
                        <Badge className={getScoreColor(lead.score)} variant="outline">
                          Score: {lead.score}
                        </Badge>
                        <span>{lead.interactions} interactions</span>
                      </div>
                    </div>
                  </div>

                  {/* Lead Details Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4 text-sm">
                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium">Guest Details</p>
                      <p className="font-medium">{lead.firstName} {lead.lastName}</p>
                      <p className="text-gray-600">{lead.phone}</p>
                      <p className="text-gray-600">{lead.email}</p>
                      {lead.companyName && <p className="text-gray-600">{lead.companyName}</p>}
                    </div>

                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium">Booking Details</p>
                      <p className="font-medium">{lead.hotelName}</p>
                      <p className="text-gray-600">{lead.roomCategory}</p>
                      <div className="flex flex-wrap gap-1 text-xs">
                        <Badge variant="outline">{lead.numberOfRooms} room(s)</Badge>
                        <Badge variant="outline">{lead.paxPerRoom} pax</Badge>
                        {lead.hotels && lead.hotels.length > 1 && (
                          <Badge variant="secondary" className="bg-violet-100 text-violet-700">
                            +{lead.hotels.length - 1} more hotel(s)
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium">Stay Period</p>
                      <p className="font-medium">{lead.checkInDate}</p>
                      <p className="text-gray-600">to {lead.checkOutDate}</p>
                      {urgency !== 'normal' && (
                        <Badge className={`text-xs ${urgency === 'critical' ? 'bg-red-600' : 'bg-orange-500'}`}>
                          {urgency === 'critical' ? '⚠️ Critical' : '🔥 Urgent'}
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-1">
                      <p className="text-gray-500 font-medium">Lead Info</p>
                      <p className="font-medium">₹{lead.rateQuoted} quoted</p>
                      <p className="text-gray-600">Created: {lead.created}</p>
                      <p className="text-gray-600">Last Contact: {lead.lastContact}</p>
                    </div>
                  </div>

                  {/* Lead History (shown when clicked) */}
                  {selectedLead?.id === lead.id && (
                    <div className="mt-6 pt-6 border-t">
                      {/* Multiple Hotels Display */}
                      {lead.hotels && lead.hotels.length > 0 && (
                        <div className="mb-6">
                          <h4 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                            <Hotel className="h-4 w-4" />
                            <span>Hotel Bookings ({lead.hotels.length})</span>
                          </h4>
                          <div className="grid gap-3">
                            {lead.hotels.map((hotel: any, idx: number) => (
                              <div key={idx} className="p-3 bg-violet-50 rounded-lg border border-violet-100">
                                <div className="flex items-center justify-between mb-2">
                                  <span className="font-medium text-violet-900">{hotel.hotelName}</span>
                                  <Badge variant="outline" className="text-xs">Hotel {idx + 1}</Badge>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                  <div>
                                    <span className="text-gray-500">Check-in:</span>{" "}
                                    <span className="font-medium">{hotel.checkInDate}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Check-out:</span>{" "}
                                    <span className="font-medium">{hotel.checkOutDate}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Room:</span>{" "}
                                    <span className="font-medium">{hotel.roomCategory}</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">Guests:</span>{" "}
                                    <span className="font-medium">{hotel.numberOfGuests}</span>
                                  </div>
                                  {hotel.roomPreference && (
                                    <div className="col-span-2">
                                      <span className="text-gray-500">Preference:</span>{" "}
                                      <span className="font-medium">{hotel.roomPreference}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <h4 className="font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                        <Clock className="h-4 w-4" />
                        <span>Lead Conversation History</span>
                      </h4>
                      <div className="space-y-3">
                        {[
                          {
                            date: "2024-12-12 14:30",
                            agent: lead.assignedTo.split(' - ')[0],
                            type: "Call",
                            summary: "Follow-up call regarding room preferences. Guest interested in ocean view room.",
                            notes: "Guest mentioned they are celebrating their anniversary. Recommended our honeymoon package."
                          },
                          {
                            date: "2024-12-11 16:45",
                            agent: lead.assignedTo.split(' - ')[0],
                            type: "Email",
                            summary: "Sent detailed brochure and pricing for room categories",
                            notes: "Guest responded positively to the amenities offered. Asked about spa services and local attractions."
                          },
                          {
                            date: "2024-12-10 10:15",
                            agent: "System",
                            type: "Web Form",
                            summary: "Initial lead captured from website contact form",
                            notes: `Guest filled out inquiry form for ${lead.hotelName}. Source: ${lead.source}.`
                          }
                        ].map((interaction, index) => (
                          <div key={index} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center space-x-3">
                                <Badge variant="outline" className="text-xs">
                                  {interaction.type}
                                </Badge>
                                <span className="text-sm font-medium text-gray-900">
                                  {interaction.agent}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">{interaction.date}</span>
                            </div>
                            <p className="text-sm text-gray-700 mb-2">{interaction.summary}</p>
                            <p className="text-xs text-gray-600 bg-white p-2 rounded">
                              <strong>Notes:</strong> {interaction.notes}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {lead.notes && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <span className="font-medium">Notes:</span> {lead.notes}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeadManagement;
