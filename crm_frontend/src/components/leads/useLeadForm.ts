import { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { listProperties, type Property } from "@/services/properties";
import { createLead, type CreateLeadPayload } from "@/services/leads";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";

export interface LeadFormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  hotels: {
    hotelName: string;
    checkInDate: Date;
    checkOutDate: Date;
    rooms: {
      roomCategory: string;
      roomPreference?: string;
      numberOfGuests: string;
    }[];
  }[];
  bookingSource: string;
  guestContactNumber: string;
  guestEmail: string;
  alternateContact?: string;
  occupation?: string;
  specialRequests?: string;
  corporateBooking: string;
  companyName?: string;
  gstin?: string;
  leadType?: string;
  source?: string;
  value?: string;
  heatLevel: "HOT" | "WARM" | "COLD";
  notes?: string;
}

const roomEntrySchema = z.object({
  roomCategory: z.string().optional(),
  roomPreference: z.string().optional(),
  numberOfGuests: z.string().optional(),
});

const hotelEntrySchema = z.object({
  hotelName: z.string().optional(),
  checkInDate: z.date().optional(),
  checkOutDate: z.date().optional(),
  rooms: z.array(roomEntrySchema).optional(),
});

export const leadFormSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  middleName: z.string().optional(),
  lastName: z.string().min(1, "Last name is required"),
  hotels: z.array(hotelEntrySchema).min(1),
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
  heatLevel: z.enum(["HOT", "WARM", "COLD"]),
  notes: z.string().optional(),
});

export const defaultLeadFormValues: LeadFormData = {
  firstName: "",
  middleName: "",
  lastName: "",
  hotels: [
    {
      hotelName: "",
      checkInDate: undefined as unknown as Date,
      checkOutDate: undefined as unknown as Date,
      rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
    },
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
  heatLevel: "WARM",
  notes: "",
};

const bookingSourceToLeadSource: Record<string, string> = {
  Website: "BRAND_WEBSITE",
  Email: "EMAIL",
  Phone: "DIRECT_CALL",
  "Walk-in": "WALK_IN",
  "Walk-In": "WALK_IN",
  "Travel Agent": "TRAVEL_AGENT",
  Corporate: "CORPORATE_OFFICE",
  "OTA (Online Travel Agency)": "OTA",
  OTA: "OTA",
  "Social Media": "SOCIAL",
  Referral: "REFERRAL",
  Other: "MANUAL",
  "Direct offline": "DIRECT_CALL",
  Media: "SOCIAL",
  "House Use": "MANUAL",
  "Owners Quota": "MANUAL",
  "Bank alliance": "MANUAL",
  "Airline Alliance": "MANUAL",
  "CEO Office": "CORPORATE_OFFICE",
  "Crop Office": "CORPORATE_OFFICE",
  "Eazy Dinner": "MANUAL",
  "Inbound DMC": "TRAVEL_AGENT",
  "Unit Hotel": "UNIT",
};

const leadTypeToEnum: Record<string, string> = {
  FIT: "STAY",
  Corporate: "MICE",
  Group: "STAY",
  Wedding: "WEDDING",
  MICE: "MICE",
};

export function buildLeadPayload(
  data: LeadFormData,
  hotelOptions: Property[],
  customData: Record<string, unknown>,
  options?: { accountId?: string }
): CreateLeadPayload {
  const guestFullName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(" ").trim();

  const hotels = (data.hotels || [])
    .filter((hotel) => hotel.hotelName?.trim())
    .map((hotel) => {
      const selectedProperty = hotelOptions.find((property) => property.name === hotel.hotelName);
      const rooms = (hotel.rooms || []).map((r) => ({
        roomCategory: r.roomCategory || undefined,
        roomPreference: r.roomPreference || undefined,
        numberOfGuests: r.numberOfGuests ? String(r.numberOfGuests) : undefined,
      }));
      return {
        hotelName: hotel.hotelName,
        propertyId: selectedProperty?._id || undefined,
        checkInDate: hotel.checkInDate ? new Date(hotel.checkInDate) : undefined,
        checkOutDate: hotel.checkOutDate ? new Date(hotel.checkOutDate) : undefined,
        rooms:
          rooms.length > 0
            ? rooms
            : [{ roomCategory: undefined, roomPreference: undefined, numberOfGuests: undefined }],
      };
    });

  const mappedSource =
    bookingSourceToLeadSource[data.bookingSource] || (data.source as string) || "MANUAL";
  const mappedLeadType = leadTypeToEnum[data.leadType || ""] || (data.leadType as string) || "STAY";

  return {
    accountId: options?.accountId,
    guestContact: {
      name: guestFullName,
      phone: data.guestContactNumber,
      email: data.guestEmail || undefined,
    },
    source: mappedSource,
    leadType: mappedLeadType,
    estimatedValue: data.value || undefined,
    heatLevel: data.heatLevel,
    notes: data.notes || undefined,
    alternateContact: data.alternateContact || undefined,
    occupation: data.occupation || undefined,
    specialRequests: data.specialRequests || undefined,
    isCorporateBooking: data.corporateBooking === "yes",
    companyName: data.companyName || undefined,
    gstin: data.gstin || undefined,
    hotels: hotels.length > 0 ? hotels : undefined,
    bookingSource: data.bookingSource || undefined,
    customData: Object.keys(customData).length > 0 ? customData : undefined,
  };
}

export interface UseLeadFormOptions {
  defaultAccountId?: string;
  prefill?: Partial<LeadFormData>;
  onCreated?: (lead: Awaited<ReturnType<typeof createLead>>) => void;
}

export function useLeadForm(options: UseLeadFormOptions = {}) {
  const [hotelOptions, setHotelOptions] = useState<Property[]>([]);
  const [customFields, setCustomFields] = useState<unknown[]>([]);
  const [customData, setCustomData] = useState<Record<string, unknown>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: { ...defaultLeadFormValues, ...options.prefill },
  });

  const { fields: hotelFields, append: appendHotel, remove: removeHotel } = useFieldArray({
    control: form.control,
    name: "hotels",
  });

  useEffect(() => {
    const fetchPmsHotels = async () => {
      try {
        const properties = await listProperties();
        setHotelOptions(
          properties.filter(
            (property) => property.status === "ACTIVE" && property.pmsProvider && property.pmsProvider !== "NONE"
          )
        );
      } catch {
        setHotelOptions([]);
      }
    };
    void fetchPmsHotels();
  }, []);

  const refreshCustomFields = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/fields?entity=lead`, {
        headers: withAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setCustomFields(
          data
            .filter((f: { is_active?: boolean; isActive?: boolean }) => f.is_active !== false && f.isActive !== false)
            .sort((a: { display_order: number }, b: { display_order: number }) => a.display_order - b.display_order)
        );
      }
    } catch (err) {
      console.error("Failed to fetch custom fields", err);
    }
  };

  const addNewHotel = () => {
    appendHotel({
      hotelName: "",
      checkInDate: undefined as unknown as Date,
      checkOutDate: undefined as unknown as Date,
      rooms: [{ roomCategory: "", roomPreference: "", numberOfGuests: "" }],
    });
  };

  const addRoom = (hotelIndex: number) => {
    const rooms = form.getValues(`hotels.${hotelIndex}.rooms`) || [];
    form.setValue(`hotels.${hotelIndex}.rooms`, [
      ...rooms,
      { roomCategory: "", roomPreference: "", numberOfGuests: "" },
    ]);
  };

  const removeRoom = (hotelIndex: number, roomIndex: number) => {
    const rooms = form.getValues(`hotels.${hotelIndex}.rooms`) || [];
    if (rooms.length <= 1) return;
    form.setValue(
      `hotels.${hotelIndex}.rooms`,
      rooms.filter((_, i) => i !== roomIndex)
    );
  };

  const resetForm = () => {
    form.reset({ ...defaultLeadFormValues, ...options.prefill });
    setCustomData({});
  };

  const submitLead = async (data: LeadFormData) => {
    setIsSubmitting(true);
    try {
      const payload = buildLeadPayload(data, hotelOptions, customData, {
        accountId: options.defaultAccountId,
      });
      const created = await createLead(payload);
      options.onCreated?.(created);
      return created;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    hotelFields,
    hotelOptions,
    customFields,
    customData,
    setCustomData,
    isSubmitting,
    addNewHotel,
    removeHotel,
    addRoom,
    removeRoom,
    refreshCustomFields,
    resetForm,
    submitLead,
  };
}
