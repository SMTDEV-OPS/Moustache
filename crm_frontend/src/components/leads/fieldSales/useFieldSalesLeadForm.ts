import { useState } from "react";
import { calculateStayNights } from "@/lib/leadDates";
import {
  createLead,
  updateLead,
  type CreateLeadPayload,
  type HeatLevel,
  type LeadDetail,
} from "@/services/leads";
import type { ItineraryPricingLine } from "@/constants/fieldSalesLeadOptions";
import { SOURCES_REQUIRING_ACCOUNT } from "@/constants/fieldSalesLeadOptions";

export interface FieldSalesLeadFormState {
  pocName: string;
  phone: string;
  email: string;
  alternateContact: string;
  source: string;
  accountId: string;
  companyName: string;
  heatLevel: HeatLevel;
  hotelName: string;
  propertyId: string;
  checkInDate: string;
  checkOutDate: string;
  roomsRequested: string;
  pricingLines: ItineraryPricingLine[];
  occasion: string;
  specialRequests: string;
  notes: string;
  followUpDate: string;
  followUpTime: string;
  followUpNotes: string;
}

export const emptyFieldSalesForm = (accountId = ""): FieldSalesLeadFormState => ({
  pocName: "",
  phone: "",
  email: "",
  alternateContact: "",
  source: "DIRECT_GUEST",
  accountId,
  companyName: "",
  heatLevel: "WARM",
  hotelName: "",
  propertyId: "",
  checkInDate: "",
  checkOutDate: "",
  roomsRequested: "1",
  pricingLines: [{ roomCategory: "", mealPlan: "CP", ratePerNight: "", inclusions: "" }],
  occasion: "",
  specialRequests: "",
  notes: "",
  followUpDate: "",
  followUpTime: "",
  followUpNotes: "",
});

export function computeEstimatedValue(
  roomsRequested: string,
  checkIn: string,
  checkOut: string,
  pricingLines: ItineraryPricingLine[]
): number {
  const rooms = Math.max(0, parseInt(roomsRequested, 10) || 0);
  const nights = calculateStayNights(checkIn, checkOut);
  if (rooms === 0 || nights === 0) return 0;
  let total = 0;
  for (const line of pricingLines) {
    const rate = parseFloat(line.ratePerNight.replace(/[^\d.-]/g, "")) || 0;
    if (rate > 0) total += rooms * nights * rate;
  }
  return Math.round(total);
}

function mapLeadType(source: string): string {
  if (source === "WEDDING_PLANNER" || source === "EVENT_MGMT") return "WEDDING";
  if (source === "CORPORATE_COMPANY") return "MICE";
  return "STAY";
}

export function buildFieldSalesPayload(
  data: FieldSalesLeadFormState,
  options?: { defaultAccountId?: string }
): CreateLeadPayload {
  const accountId = data.accountId || options?.defaultAccountId;
  const estimated = computeEstimatedValue(
    data.roomsRequested,
    data.checkInDate,
    data.checkOutDate,
    data.pricingLines
  );
  const primaryLine = data.pricingLines[0];
  const hotels =
    data.checkInDate || data.checkOutDate || data.hotelName
      ? [
          {
            hotelName: data.hotelName || undefined,
            propertyId: data.propertyId || undefined,
            checkInDate: data.checkInDate ? new Date(data.checkInDate) : undefined,
            checkOutDate: data.checkOutDate ? new Date(data.checkOutDate) : undefined,
            roomCategory: primaryLine?.roomCategory || undefined,
            rooms: primaryLine?.roomCategory
              ? [{ roomCategory: primaryLine.roomCategory, numberOfGuests: data.roomsRequested }]
              : undefined,
          },
        ]
      : undefined;

  const followUp =
    data.followUpDate && data.followUpTime
      ? {
          dueAt: new Date(`${data.followUpDate}T${data.followUpTime}`).toISOString(),
          notes: data.followUpNotes || undefined,
        }
      : undefined;

  return {
    accountId: accountId || undefined,
    guestContact: {
      name: data.pocName.trim(),
      phone: data.phone.trim() || undefined,
      email: data.email.trim() || undefined,
    },
    source: data.source,
    leadType: mapLeadType(data.source),
    heatLevel: data.heatLevel,
    preserveManualHeatLevel: true,
    estimatedValue: estimated > 0 ? String(estimated) : undefined,
    alternateContact: data.alternateContact || undefined,
    specialRequests: data.specialRequests || undefined,
    notes: data.notes || undefined,
    occasion: data.occasion || undefined,
    roomsRequested: parseInt(data.roomsRequested, 10) || undefined,
    companyName: data.companyName || undefined,
    isCorporateBooking: SOURCES_REQUIRING_ACCOUNT.has(data.source),
    hotels,
    assignmentMode: "auto",
    customData: {
      field_sales_form: true,
      itinerary_pricing: data.pricingLines,
      rooms_requested: data.roomsRequested,
    },
    followUp,
  } as CreateLeadPayload & {
    preserveManualHeatLevel?: boolean;
    followUp?: { dueAt: string; notes?: string };
    roomsRequested?: number;
  };
}

export function fieldSalesFormFromLeadDetail(
  detail: LeadDetail,
  defaultAccountId?: string
): FieldSalesLeadFormState {
  const lead = detail.lead;
  const contact = lead.contactDetails || { name: "", phone: "", email: "" };
  const it = lead.itineraries?.[0];
  const custom = lead.customData || {};
  const pricing =
    (custom.itinerary_pricing as ItineraryPricingLine[]) ||
    [{ roomCategory: it?.rooms?.[0]?.roomCategory || "", mealPlan: "CP", ratePerNight: "", inclusions: "" }];

  const accountId =
    typeof lead.accountId === "string"
      ? lead.accountId
      : (lead.accountId as { id?: string })?.id || defaultAccountId || "";

  return {
    pocName: contact.name || "",
    phone: contact.phone || "",
    email: contact.email || "",
    alternateContact: lead.alternateContact || "",
    source: lead.source || "DIRECT_GUEST",
    accountId,
    companyName: lead.companyName || "",
    heatLevel: (lead.heatLevel as HeatLevel) || "WARM",
    hotelName: it?.hotelName || "",
    propertyId: typeof lead.propertyId === "string" ? lead.propertyId : "",
    checkInDate: it?.checkInDate ? String(it.checkInDate).slice(0, 10) : "",
    checkOutDate: it?.checkOutDate ? String(it.checkOutDate).slice(0, 10) : "",
    roomsRequested: String(lead.roomsRequested || custom.rooms_requested || 1),
    pricingLines: pricing.length ? pricing : emptyFieldSalesForm().pricingLines,
    occasion: lead.occasion || "",
    specialRequests: lead.specialRequests || "",
    notes: lead.notes || "",
    followUpDate: "",
    followUpTime: "",
    followUpNotes: "",
  };
}

export function useFieldSalesLeadForm(options: { defaultAccountId?: string } = {}) {
  const [form, setForm] = useState<FieldSalesLeadFormState>(() =>
    emptyFieldSalesForm(options.defaultAccountId || "")
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editLeadId, setEditLeadId] = useState<string | null>(null);

  const resetForm = () => {
    setForm(emptyFieldSalesForm(options.defaultAccountId || ""));
    setEditLeadId(null);
  };

  const loadForEdit = (detail: LeadDetail) => {
    setEditLeadId(detail.lead.id);
    setForm(fieldSalesFormFromLeadDetail(detail, options.defaultAccountId));
  };

  const estimatedValue = computeEstimatedValue(
    form.roomsRequested,
    form.checkInDate,
    form.checkOutDate,
    form.pricingLines
  );

  const submit = async (overrideConfirmDuplicate?: boolean) => {
    if (!form.pocName.trim()) throw new Error("Lead POC name is required");
    if (!form.phone.trim() && !form.email.trim()) {
      throw new Error("Phone or email is required");
    }
    if (SOURCES_REQUIRING_ACCOUNT.has(form.source) && !form.accountId && !options.defaultAccountId) {
      throw new Error("Account is required for this lead source");
    }

    setIsSubmitting(true);
    try {
      const payload = buildFieldSalesPayload(form, options);
      if (editLeadId) {
        await updateLead(editLeadId, {
          accountId: payload.accountId,
          contactDetails: payload.guestContact,
          source: payload.source,
          leadType: payload.leadType,
          heatLevel: payload.heatLevel,
          estimatedValue: payload.estimatedValue,
          notes: payload.notes,
          occasion: payload.occasion,
          alternateContact: payload.alternateContact,
          specialRequests: payload.specialRequests,
          companyName: payload.companyName,
          roomsRequested: payload.roomsRequested,
          hotels: payload.hotels,
          customData: payload.customData,
        });
        return { id: editLeadId };
      }
      const lead = await createLead(payload as CreateLeadPayload);
      return lead;
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    setForm,
    isSubmitting,
    editLeadId,
    estimatedValue,
    resetForm,
    loadForEdit,
    submit,
  };
}
