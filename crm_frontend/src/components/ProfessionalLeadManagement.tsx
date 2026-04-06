import { useCallback, useEffect, useState } from "react";
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
import { Search, Filter, Plus, Phone, Mail, Calendar as CalendarIcon, Clock, User as UserIcon, TrendingUp, Eye, Users, MessageSquare, AlertTriangle, Trash2, Hotel, FileText } from "lucide-react";
import { toast } from "sonner";
import { useForm, useFieldArray, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SharedEmailComposer } from "@/components/email/SharedEmailComposer";
import { listLeads, createLead, Lead, getLeadContactInfo } from "@/services/leads";
import { listUsers, User } from "@/services/users";
import { PERMISSIONS } from "@/constants/permissions";
import { listProperties, Property } from "@/services/properties";
import { PipelineService, PipelineStage } from "@/services/pipelines";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { SendQuotationDialog } from "@/components/SendQuotationDialog";
import { HotelBookingSection } from "./leads/HotelBookingSection";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { getRoomCatalogue, syncRoomCatalogue, RoomCatalogue, resolveRoomTypeDisplayName } from "@/services/pms";
import {
  COUNTRY_PHONE_OPTIONS,
  parsePhoneForForm,
  buildE164FromIso,
  isValidE164Phone,
} from "@/lib/phoneCountry";
import type { CountryCode } from "libphonenumber-js";

interface ProfessionalLeadManagementProps {
  userRole: string;
  userName: string;
  backendUserId?: string;
  permissions?: string[];
}

const hotelRoomRequestSchema = z.object({
  roomTypeId: z.string().min(1, "Room type is required"),
  roomTypeName: z.string().optional(),
  quantity: z.number().int().min(1).default(1),
  adults: z.number().int().min(1).default(1),
  children: z.number().int().min(0).default(0),
  notes: z.string().optional(),
});

const hotelEntrySchema = z.object({
  propertyId: z.string().min(1, "Hotel selection is required"),
  hotelName: z.string().optional(),
  checkInDate: z.date({ message: "Check-in date is required" }),
  checkOutDate: z.date({ message: "Check-out date is required" }),
  roomsRequested: z.array(hotelRoomRequestSchema).min(1, "Add at least one room type"),
});

const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  // Multiple hotels support
  hotels: z.array(hotelEntrySchema).min(1, "At least one hotel is required"),
  bookingSource: z.string().min(1, "Booking source is required"),
  guestContactNumber: z
    .string()
    .min(1, "Guest contact number is required")
    .refine(
      (v) => isValidE164Phone(v),
      "Enter a valid international phone number with country code (e.g. +919876543210)"
    ),
  guestEmail: z.string().email("Please enter a valid email address"),
  alternateContact: z
    .string()
    .optional()
    .refine((v) => {
      if (!v) return true;
      return isValidE164Phone(v);
    }, "Enter a valid alternate contact number with country code"),
  occupation: z.string().optional(),
  specialRequests: z.string().optional(),
  leadType: z.string().optional(),
  source: z.string().optional(),
  value: z.string().optional(),
  notes: z.string().optional(),
  // PMS Booking fields
  propertyId: z.string().optional(),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  roomTypeId: z.string().optional(),
  roomTypeName: z.string().optional(),
  ratePlanId: z.string().optional(),
  ratePlanName: z.string().optional(),
  adults: z.number().optional(),
  children: z.number().optional(),
  estimatedRate: z.number().optional(),
  estimatedRoomNights: z.number().optional(),
  estimatedRevenue: z.number().optional(),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

const defaultRoomRequest = () => ({
  roomTypeId: "",
  roomTypeName: "",
  quantity: 1,
  adults: 1,
  children: 0,
});

function HotelItineraryCard({
  index,
  control,
  hotelOptions,
  setValue,
  getCatalogueForProperty,
  syncCatalogueForProperty,
}: {
  index: number;
  control: any;
  hotelOptions: Property[];
  setValue: (name: any, value: any) => void;
  getCatalogueForProperty: (propertyId: string) => RoomCatalogue | undefined;
  syncCatalogueForProperty: (propertyId: string) => Promise<void>;
}) {
  const propertyId: string = useWatch({ control, name: `hotels.${index}.propertyId` }) || "";
  const roomsRequested = useFieldArray({
    control,
    name: `hotels.${index}.roomsRequested`,
  });

  const catalogue = propertyId ? getCatalogueForProperty(propertyId) : undefined;
  const roomTypes = catalogue?.roomTypes || [];
  const [syncingCatalogue, setSyncingCatalogue] = useState(false);
  const roomsReqWatch = useWatch({
    control,
    name: `hotels.${index}.roomsRequested`,
  }) as { roomTypeId?: string; roomTypeName?: string }[] | undefined;

  return (
    <div className="relative p-4 border rounded-lg bg-gray-50/50 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <FormField
          control={control}
          name={`hotels.${index}.propertyId`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hotel Name *</FormLabel>
              <SearchableSelect
                options={
                  hotelOptions.length
                    ? hotelOptions.map((p) => ({
                        value: p._id,
                        label: p.name,
                      }))
                    : [
                        { value: "", label: "No PMS hotels available", disabled: true },
                      ]
                }
                value={field.value}
                disabled={!hotelOptions.length}
                placeholder="Select Hotel"
                onValueChange={(val) => {
                  field.onChange(val);
                  const selectedProperty = hotelOptions.find((p) => p._id === val);
                  setValue(`hotels.${index}.hotelName`, selectedProperty?.name || "");
                  // Reset rooms when hotel changes
                  setValue(`hotels.${index}.roomsRequested`, [defaultRoomRequest()]);
                }}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={control}
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
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
            control={control}
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
                        {field.value ? format(field.value, "PPP") : <span>Pick a date</span>}
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
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Room Types *</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => roomsRequested.append(defaultRoomRequest())}
            disabled={!propertyId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Room Type
          </Button>
        </div>

        {!propertyId ? (
          <div className="text-sm text-muted-foreground">Select a hotel to load room types.</div>
        ) : roomTypes.length === 0 ? (
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>No room types found for this hotel.</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={syncingCatalogue}
              onClick={async () => {
                setSyncingCatalogue(true);
                try {
                  await syncCatalogueForProperty(propertyId);
                } finally {
                  setSyncingCatalogue(false);
                }
              }}
            >
              Sync PMS catalogue
            </Button>
          </div>
        ) : null}

        <div className="space-y-3">
          {roomsRequested.fields.map((rf, roomIndex) => (
            <div key={rf.id} className="grid grid-cols-12 gap-3 items-end">
              <div className="col-span-12 md:col-span-5">
                <FormField
                  control={control}
                  name={`hotels.${index}.roomsRequested.${roomIndex}.roomTypeId`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Room Type</FormLabel>
                      <Select
                        onValueChange={(val) => {
                          field.onChange(val);
                          const rt = roomTypes.find((r) => r.roomTypeId === val);
                          setValue(
                            `hotels.${index}.roomsRequested.${roomIndex}.roomTypeName`,
                            rt?.roomTypeName || ""
                          );
                        }}
                        value={field.value}
                        disabled={!propertyId}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select room type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {field.value &&
                            !roomTypes.some((r) => r.roomTypeId === field.value) && (
                              <SelectItem value={field.value}>
                                {resolveRoomTypeDisplayName(
                                  field.value,
                                  roomsReqWatch?.[roomIndex]?.roomTypeName,
                                  roomTypes
                                )}
                              </SelectItem>
                            )}
                          {roomTypes.map((rt) => (
                            <SelectItem key={rt.roomTypeId} value={rt.roomTypeId}>
                              {resolveRoomTypeDisplayName(rt.roomTypeId, rt.roomTypeName, roomTypes)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <FormField
                  control={control}
                  name={`hotels.${index}.roomsRequested.${roomIndex}.quantity`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Qty</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value ?? 1}
                          onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <FormField
                  control={control}
                  name={`hotels.${index}.roomsRequested.${roomIndex}.adults`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Adults</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          value={field.value ?? 1}
                          onChange={(e) => field.onChange(Number(e.target.value) || 1)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-4 md:col-span-2">
                <FormField
                  control={control}
                  name={`hotels.${index}.roomsRequested.${roomIndex}.children`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Children</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          value={field.value ?? 0}
                          onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="col-span-12 md:col-span-1 flex md:justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => roomsRequested.remove(roomIndex)}
                  disabled={roomsRequested.fields.length <= 1}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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

    stage: "all",
    source: "all",
    property: "all",
    temperature: "all",
    bookingType: "all",
    assignedTo: userRole === 'callcenter' ? userName : "all"
  });

  const [scope, setScope] = useState<"own" | "team">("own");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [userList, setUserList] = useState<User[]>([]);
  const [isLoadingLeads, setIsLoadingLeads] = useState(false);
  const [pipelineStages, setPipelineStages] = useState<PipelineStage[]>([]);
  const [hotelOptions, setHotelOptions] = useState<Property[]>([]);
  const [isLoadingStages, setIsLoadingStages] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [customData, setCustomData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [catalogueByPropertyId, setCatalogueByPropertyId] = useState<Record<string, RoomCatalogue>>({});

  const canViewTeamLeads =
    !!permissions?.includes(PERMISSIONS.LEADS.READ) ||
    !!permissions?.includes(PERMISSIONS.LEADS.MANAGE);

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

    const fetchStages = async () => {
      try {
        setIsLoadingStages(true);
        const defaultPipeline = await PipelineService.getDefaultPipeline("leads");
        if (defaultPipeline) {
          setPipelineStages(defaultPipeline.stages);
        }
      } catch (err) {
        console.error("Failed to fetch pipeline stages", err);
      } finally {
        setIsLoadingStages(false);
      }
    };
    void fetchStages();

    const fetchCustomFields = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/fields?entity=lead`, {
          headers: withAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setCustomFields(
            data
              .filter((f: any) => f.is_active !== false && f.isActive !== false)
              .sort((a: any, b: any) => a.display_order - b.display_order)
          );
        }
      } catch (err) {
        console.error("Failed to fetch custom fields", err);
      }
    };
    void fetchCustomFields();
  }, [backendUserId, scope]);

  // Refresh custom fields when opening the Add Lead dialog so field-builder changes apply immediately.
  useEffect(() => {
    if (!isAddLeadOpen) return;
    const fetchCustomFields = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/admin/fields?entity=lead`, {
          headers: withAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setCustomFields(
            data
              .filter((f: any) => f.is_active !== false && f.isActive !== false)
              .sort((a: any, b: any) => a.display_order - b.display_order)
          );
        }
      } catch (err) {
        console.error("Failed to fetch custom fields", err);
      }
    };
    void fetchCustomFields();
  }, [isAddLeadOpen]);

  useEffect(() => {
    const fetchPmsHotels = async () => {
      try {
        const properties = await listProperties();
        const activeHotels = properties.filter(
          (property) => property.status === "ACTIVE"
        );
        setHotelOptions(activeHotels);
      } catch (err) {
        console.error("Failed to fetch PMS hotels", err);
        setHotelOptions([]);
      }
    };

    void fetchPmsHotels();
  }, []);

  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [emailLead, setEmailLead] = useState<{ name: string; email: string } | null>(null);
  const [showQuotationDialog, setShowQuotationDialog] = useState(false);
  const [quotationLead, setQuotationLead] = useState<Lead | null>(null);
  const [quotationContext, setQuotationContext] = useState<{
    guestName?: string;
    guestEmail?: string;
    guestPhone?: string;
    propertyName?: string;
  } | null>(null);
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
          propertyId: "",
          hotelName: "",
          checkInDate: undefined as unknown as Date,
          checkOutDate: undefined as unknown as Date,
          roomsRequested: [
            { roomTypeId: "", roomTypeName: "", quantity: 1, adults: 1, children: 0 }
          ],
        }
      ],
      bookingSource: "",
      guestContactNumber: "",
      guestEmail: "",
      alternateContact: "",
      occupation: "",
      specialRequests: "",
      leadType: "",
      source: "",
      value: "",
      notes: "",
      propertyId: "",
      checkIn: "",
      checkOut: "",
      roomTypeId: "",
      roomTypeName: "",
      ratePlanId: "",
      ratePlanName: "",
      adults: 1,
      children: 0,
      estimatedRate: 0,
      estimatedRoomNights: 0,
      estimatedRevenue: 0,
    },
  });

  const syncCatalogueForProperty = useCallback(async (propertyId: string) => {
    try {
      const cat = await syncRoomCatalogue(propertyId);
      setCatalogueByPropertyId((prev) => ({ ...prev, [propertyId]: cat }));
      toast.success("PMS room catalogue updated");
    } catch (e) {
      console.error(e);
      toast.error("Could not sync PMS catalogue");
    }
  }, []);

  // PMS room types per selected hotel + primary availability property (cached by propertyId)
  const watchedHotels = useWatch({ control: form.control, name: "hotels" }) as any[] | undefined;
  const watchedPrimaryPropertyId = useWatch({ control: form.control, name: "propertyId" }) as string | undefined;
  useEffect(() => {
    const fromHotels = (watchedHotels || [])
      .map((h) => h?.propertyId)
      .filter((v): v is string => typeof v === "string" && v.length > 0);
    const primary =
      typeof watchedPrimaryPropertyId === "string" && watchedPrimaryPropertyId.length > 0
        ? watchedPrimaryPropertyId
        : null;
    const ids = new Set<string>(fromHotels);
    if (primary) ids.add(primary);

    for (const propertyId of ids) {
      if (catalogueByPropertyId[propertyId]) continue;
      getRoomCatalogue(propertyId)
        .then((cat) => {
          setCatalogueByPropertyId((prev) => (prev[propertyId] ? prev : { ...prev, [propertyId]: cat }));
        })
        .catch(() => {
          setCatalogueByPropertyId((prev) =>
            prev[propertyId] ? prev : { ...prev, [propertyId]: { roomTypes: [], ratePlans: [] } }
          );
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedHotels, watchedPrimaryPropertyId]);

  const getCatalogueForProperty = (propertyId: string) => catalogueByPropertyId[propertyId];

  const { fields: hotelFields, append: appendHotel, remove: removeHotel } = useFieldArray({
    control: form.control,
    name: "hotels"
  });

  const addNewHotel = () => {
    appendHotel({
      propertyId: "",
      hotelName: "",
      checkInDate: undefined as unknown as Date,
      checkOutDate: undefined as unknown as Date,
      roomsRequested: [
        { roomTypeId: "", roomTypeName: "", quantity: 1, adults: 1, children: 0 }
      ],
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

    let primaryCheckIn = "";
    let primaryCheckOut = "";

    if (lead.itineraries && lead.itineraries.length > 0) {
      // Find earliest check-in
      const sortedItineraries = [...lead.itineraries].sort((a, b) => {
        if (!a.checkInDate) return 1;
        if (!b.checkInDate) return -1;
        return new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime();
      });
      const firstItinerary = sortedItineraries[0];
      if (firstItinerary.checkInDate) {
        primaryCheckIn = firstItinerary.checkInDate.slice(0, 10);
      }
      if (firstItinerary.checkOutDate) {
        primaryCheckOut = firstItinerary.checkOutDate.slice(0, 10);
      }
    }

    const checkIn = primaryCheckIn;
    const checkOut = primaryCheckOut;

    const temperature =
      lead.heatLevel === "HOT"
        ? "Hot"
        : lead.heatLevel === "WARM"
          ? "Warm"
          : lead.heatLevel === "COLD"
            ? "Cold"
            : "Cold";

    const stage = pipelineStages.find(s => s._id === lead.stageId);
    const stageName = stage ? stage.name : "N/A";

    return {
      id: lead.id,
      name: lead.leadNumber ?? lead.id,
      phone: "",
      email: "",
      property: lead.propertyId ?? "N/A",
      source: lead.source,
      checkIn,
      checkOut,
      budget: lead.budget ? formatCurrency(lead.budget) : "",
      pricePerNight: 0,
      status: lead.status,
      stage: stageName,
      stageId: lead.stageId,
      temperature,
      bookingType: "Direct Customer",
      assignedTo: assignedName,
      lastContact: "",
      nextFollowUp: undefined as string | undefined,
      workingDays: 0,
      workingHours: 0,
      score: lead.score || 0,
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

    // Stage filter
    if (selectedFilters.stage !== "all" && lead.stageId !== selectedFilters.stage) {
      return false;
    }

    // Source filter
    if (selectedFilters.source !== "all" && lead.source !== selectedFilters.source) {
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
    if (score >= 7) return 'text-green-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-red-600';
  };

  const clearFilters = () => {
    setSelectedFilters({
      status: "all",
      source: "all",
      stage: "all",
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

  const openQuotationForLead = (leadId: string, propertyName?: string) => {
    const targetLead = leads.find((item) => item.id === leadId);
    if (!targetLead) {
      toast.error("Lead details not found for quotation");
      return;
    }

    const contact = getLeadContactInfo(targetLead);
    setQuotationLead(targetLead);
    setQuotationContext({
      guestName: contact.name || targetLead.leadNumber,
      guestEmail: contact.email || undefined,
      guestPhone: contact.phone || undefined,
      propertyName,
    });
    setShowQuotationDialog(true);
  };

  const bookingSourceToLeadSource: Record<string, string> = {
    DIRECT_CALL: "DIRECT_CALL",
    WHATSAPP: "WHATSAPP",
    BRAND_WEBSITE: "BRAND_WEBSITE",
    EMAIL: "EMAIL",
    TRAVEL_AGENT: "TRAVEL_AGENT",
    // Backend doesn't have a separate OTA enum. We persist it as BRAND_WEBSITE.
    OTA: "BRAND_WEBSITE",
    REFERRAL: "REFERRAL",
    MANUAL: "MANUAL",
    IVR: "IVR",
  };

  const leadTypeToEnum: Record<string, string> = {
    FIT: "STAY",
    Corporate: "MICE",
    Group: "STAY",
    Wedding: "WEDDING",
    MICE: "MICE",
  };

  const onSubmit = async (data: LeadFormData) => {
    try {
      setIsSubmitting(true);

      const guestFullName = [data.firstName, data.middleName, data.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      const hotels = (data.hotels || []).map((hotel: any) => {
        const selectedProperty = hotelOptions.find((property) => property._id === hotel.propertyId);
        return {
          hotelName: selectedProperty?.name || hotel.hotelName || undefined,
          propertyId: hotel.propertyId || undefined,
          checkInDate: hotel.checkInDate ? new Date(hotel.checkInDate).toISOString() : undefined,
          checkOutDate: hotel.checkOutDate ? new Date(hotel.checkOutDate).toISOString() : undefined,
          roomsRequested: (hotel.roomsRequested || []).map((r: any) => ({
            roomTypeId: r.roomTypeId,
            roomTypeName: r.roomTypeName,
            quantity: Number(r.quantity) || 1,
            adults: Number(r.adults) || 1,
            children: Number(r.children) || 0,
            notes: r.notes || undefined,
          })),
        };
      });

      const mappedSource =
        bookingSourceToLeadSource[data.bookingSource] ||
        (data.source as string) ||
        "MANUAL";
      const mappedLeadType =
        leadTypeToEnum[data.leadType || ""] || (data.leadType as string) || "STAY";

      const payload = {
        guestContact: {
          name: guestFullName,
          phone: data.guestContactNumber,
          email: data.guestEmail || undefined,
        },
        source: mappedSource,
        leadType: mappedLeadType,
        estimatedValue: data.value || undefined,
        occasion: undefined,
        notes: data.notes || undefined,
        alternateContact: data.alternateContact || undefined,
        occupation: data.occupation || undefined,
        specialRequests: data.specialRequests || undefined,
        heatLevel: undefined,
        hotels: hotels.length > 0 ? hotels : undefined,
        customData,
        propertyId: data.propertyId || undefined,
        checkIn: data.checkIn ? new Date(data.checkIn).toISOString() : undefined,
        checkOut: data.checkOut ? new Date(data.checkOut).toISOString() : undefined,
        roomTypeId: data.roomTypeId || undefined,
        roomTypeName: data.roomTypeName || undefined,
        ratePlanId: data.ratePlanId || undefined,
        ratePlanName: data.ratePlanName || undefined,
        roomCategory: data.roomTypeName || undefined, // fallback
        adults: data.adults,
        children: data.children,
        estimatedRate: data.estimatedRate,
        estimatedRoomNights: data.estimatedRoomNights,
        estimatedRevenue: data.estimatedRevenue,
      };

      await createLead(payload);

      toast.success("Lead created successfully!");
      setIsAddLeadOpen(false);
      form.reset();
      setCustomData({});

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
          toast.error(message);
        } finally {
          setIsLoadingLeads(false);
        }
      };
      void fetchData();
    } catch (error: any) {
      toast.error(error?.message || "Failed to create lead");
    } finally {
      setIsSubmitting(false);
    }
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

                {/* Primary PMS: live availability check (separate from itinerary hotels below) */}
                <div className="space-y-4 pt-4 border-t border-gray-100 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                    <Hotel className="h-5 w-5" />
                    PMS availability check
                  </h3>
                  <div className="mb-4">
                    <Label>Property for availability check</Label>
                    <SearchableSelect
                      options={[
                        { value: "", label: "None", disabled: false },
                        ...hotelOptions.map((property) => ({
                          value: property._id,
                          label: property.name,
                        })),
                      ]}
                      value={form.watch("propertyId") || ""}
                      placeholder="Select a Property..."
                      onValueChange={(val) =>
                        form.setValue("propertyId", val ? val : "")
                      }
                    />
                  </div>

                  {form.watch("propertyId") && (
                    <HotelBookingSection
                      propertyId={form.watch("propertyId")!}
                      value={{
                        checkIn: form.watch("checkIn"),
                        checkOut: form.watch("checkOut"),
                        roomTypeId: form.watch("roomTypeId"),
                        roomTypeName: form.watch("roomTypeName"),
                        ratePlanId: form.watch("ratePlanId"),
                        ratePlanName: form.watch("ratePlanName"),
                        adults: form.watch("adults"),
                        children: form.watch("children"),
                        estimatedRate: form.watch("estimatedRate"),
                        estimatedRoomNights: form.watch("estimatedRoomNights"),
                        estimatedRevenue: form.watch("estimatedRevenue"),
                      }}
                      onChange={(patch) => {
                        Object.entries(patch).forEach(([key, value]) => {
                          form.setValue(key as any, value);
                        });
                      }}
                    />
                  )}
                </div>

                {/* Multiple Hotels Section */}
                <div className="space-y-4 pt-4 border-t border-gray-100">
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
                    <div key={hotel.id} className="relative space-y-4">
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
                      <HotelItineraryCard
                        index={index}
                        control={form.control}
                        hotelOptions={hotelOptions}
                        setValue={form.setValue}
                        getCatalogueForProperty={getCatalogueForProperty}
                        syncCatalogueForProperty={syncCatalogueForProperty}
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
                      <FormLabel>Lead Source *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select Booking Source" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DIRECT_CALL">Direct Call</SelectItem>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="BRAND_WEBSITE">Website</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="TRAVEL_AGENT">Travel Agent</SelectItem>
                          <SelectItem value="OTA">OTA</SelectItem>
                          <SelectItem value="REFERRAL">Referral</SelectItem>
                          <SelectItem value="MANUAL">Manual</SelectItem>
                          <SelectItem value="IVR">IVR</SelectItem>
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
                    render={({ field }) => {
                      const parsed = parsePhoneForForm(field.value);
                      return (
                        <FormItem>
                          <FormLabel>Guest Contact Number *</FormLabel>
                          <div className="flex gap-2">
                            <SearchableSelect
                              options={COUNTRY_PHONE_OPTIONS}
                              value={parsed.iso}
                              placeholder="Country / code"
                              triggerClassName="w-[min(260px,42vw)] shrink-0"
                              contentClassName="w-[min(360px,calc(100vw-2rem))]"
                              onValueChange={(iso) => {
                                field.onChange(
                                  buildE164FromIso(iso as CountryCode, parsed.nationalDigits)
                                );
                              }}
                            />
                            <Input
                              className="min-w-0 flex-1"
                              value={parsed.nationalDigits}
                              inputMode="tel"
                              autoComplete="tel-national"
                              placeholder="National number"
                              onChange={(e) => {
                                const local = e.target.value.replace(/\D/g, "").slice(0, 18);
                                field.onChange(buildE164FromIso(parsed.iso, local));
                              }}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
                  />
                  <FormField
                    control={form.control}
                    name="alternateContact"
                    render={({ field }) => {
                      const parsed = parsePhoneForForm(field.value);
                      return (
                        <FormItem>
                          <FormLabel>Alternate Contact</FormLabel>
                          <div className="flex gap-2">
                            <SearchableSelect
                              options={COUNTRY_PHONE_OPTIONS}
                              value={parsed.iso}
                              placeholder="Country / code"
                              triggerClassName="w-[min(260px,42vw)] shrink-0"
                              contentClassName="w-[min(360px,calc(100vw-2rem))]"
                              onValueChange={(iso) => {
                                const next = buildE164FromIso(iso as CountryCode, parsed.nationalDigits);
                                field.onChange(next || "");
                              }}
                            />
                            <Input
                              className="min-w-0 flex-1"
                              value={parsed.nationalDigits}
                              inputMode="tel"
                              autoComplete="tel-national"
                              placeholder="National number"
                              onChange={(e) => {
                                const local = e.target.value.replace(/\D/g, "").slice(0, 18);
                                field.onChange(buildE164FromIso(parsed.iso, local) || "");
                              }}
                            />
                          </div>
                          <FormMessage />
                        </FormItem>
                      );
                    }}
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

                <div className="grid grid-cols-1 gap-4">
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
                </div>

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

                {false && customFields.length > 0 && (
                  <div className="pt-4" />
                )}

                <div className="flex justify-end space-x-2">
                  <Button type="button" variant="outline" onClick={() => setIsAddLeadOpen(false)} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Adding..." : "Add Lead"}
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

                      <Select value={selectedFilters.stage} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, stage: value }))}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Stages</SelectItem>
                          {pipelineStages.map(stage => (
                            <SelectItem key={stage._id} value={stage._id}>
                              {stage.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Select value={selectedFilters.property} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, property: value }))}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Property" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Properties</SelectItem>
                          <SelectItem value="Moustache Goa">Moustache Goa</SelectItem>
                          <SelectItem value="Moustache Kerala">Moustache Kerala</SelectItem>
                          <SelectItem value="Moustache Rajasthan">Moustache Rajasthan</SelectItem>
                          <SelectItem value="Moustache Mumbai">Moustache Mumbai</SelectItem>
                          <SelectItem value="Moustache Coonoor">Moustache Coonoor</SelectItem>
                        </SelectContent>
                      </Select>



                      <Select value={selectedFilters.source} onValueChange={(value) => setSelectedFilters(prev => ({ ...prev, source: value }))}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Source" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Sources</SelectItem>
                          <SelectItem value="DIRECT_CALL">Direct Call</SelectItem>
                          <SelectItem value="WHATSAPP">WhatsApp</SelectItem>
                          <SelectItem value="BRAND_WEBSITE">Website</SelectItem>
                          <SelectItem value="EMAIL">Email</SelectItem>
                          <SelectItem value="TRAVEL_AGENT">Travel Agent</SelectItem>
                          <SelectItem value="OTA">OTA</SelectItem>
                          <SelectItem value="REFERRAL">Referral</SelectItem>
                          <SelectItem value="SOCIAL">Social Media</SelectItem>
                          <SelectItem value="WALK_IN">Walk In</SelectItem>
                          <SelectItem value="IVR">IVR</SelectItem>
                          <SelectItem value="MANUAL">Manual</SelectItem>
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
                              {lead.stage && (
                                <Badge variant="outline" className="border-blue-200 text-blue-800 bg-blue-50">
                                  {lead.stage.replace(/_/g, ' ')}
                                </Badge>
                              )}
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
                              <span className={`ml-1 font-bold ${getScoreColor(lead.score)}`}>{lead.score}/10</span>
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
                            onClick={() => openQuotationForLead(lead.id, lead.property)}
                          >
                            <FileText className="h-4 w-4 mr-2" />
                            Send Quotation
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
                        onClick={() => openQuotationForLead(lead.id, lead.property)}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Send Quotation
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

      </Tabs >

      {/* Schedule Callback Dialog */}
      < Dialog open={showCallbackDialog} onOpenChange={setShowCallbackDialog} >
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
      </Dialog >

      {/* Email Dialog */}
      <SharedEmailComposer
        isOpen={showEmailDialog}
        mode="compose"
        defaultTo={emailLead?.email || ""}
        onClose={() => setShowEmailDialog(false)}
        onSent={() => setShowEmailDialog(false)}
      />

      <SendQuotationDialog
        open={showQuotationDialog}
        onOpenChange={setShowQuotationDialog}
        lead={quotationLead}
        guestName={quotationContext?.guestName}
        guestEmail={quotationContext?.guestEmail}
        guestPhone={quotationContext?.guestPhone}
        propertyName={quotationContext?.propertyName}
      />
    </div >
  );
};

export default ProfessionalLeadManagement;