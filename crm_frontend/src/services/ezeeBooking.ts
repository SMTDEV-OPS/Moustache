import { API_BASE_URL, withAuthHeaders } from "@/services/api";

export type AvailableRoomRowDiscount = {
  couponCode: string;
  discountPercentage: number;
  discountAmount: number;
  promotionName: string;
  promotionDescription: string;
};

export type AvailableRoomRow = {
  roomTypeId: string;
  rateTypeId: string;
  roomRateId: string;
  roomTypeName: string;
  planName: string;
  availableRooms: number;
  /** eZee `available_rooms` map: YYYY-MM-DD → rooms count */
  availableByDate?: Record<string, number | string>;
  baseAdultOccupancy: number;
  maxAdultOccupancy: number;
  maxChildOccupancy: number;
  nightlyRates: { date: string; rate: number; tax: number; total: number; extraAdult?: number; extraChild?: number }[];
  totalBeforeTax: number;
  totalTax: number;
  grandTotal: number;
  discount: AvailableRoomRowDiscount | null;
  isDiscounted: boolean;
};

export async function fetchAvailableRooms(input: {
  hotelId: string;
  fromDate: string;
  toDate: string;
  promotionCode?: string;
}): Promise<AvailableRoomRow[]> {
  const q = new URLSearchParams({
    hotelId: input.hotelId,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  const pc = String(input.promotionCode ?? "").trim();
  if (pc) q.set("promotionCode", pc);
  const res = await fetch(`${API_BASE_URL}/api/ezee/available-rooms?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || "Failed to fetch rooms");
  return data as AvailableRoomRow[];
}

export type EzeeChannelSource = { channelId: string; channelName: string };

export type EzeeRoomInfoResponse = {
  roomTypes: { id: string; name: string }[];
  rateTypes: { id: string; name: string }[];
  ratePlans: { id: string; roomTypeId?: string; rateTypeId?: string; name?: string }[];
  channelSources: EzeeChannelSource[];
};

export async function fetchEzeeRoomInfo(hotelId: string): Promise<EzeeRoomInfoResponse> {
  const q = new URLSearchParams({ hotelId });
  const res = await fetch(`${API_BASE_URL}/api/ezee/room-info?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || "room-info failed");
  return {
    roomTypes: Array.isArray((data as any)?.roomTypes) ? (data as any).roomTypes : [],
    rateTypes: Array.isArray((data as any)?.rateTypes) ? (data as any).rateTypes : [],
    ratePlans: Array.isArray((data as any)?.ratePlans) ? (data as any).ratePlans : [],
    channelSources: Array.isArray((data as any)?.channelSources) ? (data as any).channelSources : [],
  };
}

export type CreateEzeeBookingRoom = {
  roomTypeId: string;
  rateTypeId: string;
  roomRateId: string;
  roomTypeName: string;
  planName: string;
  adults: number;
  children: number;
  baseRate: number;
  extraAdultRate: number;
  extraChildRate: number;
  nightlyRates?: { date: string; rate: number; extraAdult?: number; extraChild?: number }[];
  physicalRoomId?: string;
  physicalRoomName?: string;
};

export async function fetchPhysicalRooms(input: {
  hotelId: string;
  roomTypeId: string;
  fromDate: string;
  toDate: string;
}): Promise<{ roomId: string; roomName: string }[]> {
  const q = new URLSearchParams({
    hotelId: input.hotelId,
    roomTypeId: input.roomTypeId,
    fromDate: input.fromDate,
    toDate: input.toDate,
  });
  const res = await fetch(`${API_BASE_URL}/api/ezee/physical-rooms?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || "Failed to load physical rooms");
  const list = (data as any)?.physicalRooms;
  return Array.isArray(list) ? list : [];
}

/**
 * Creates an eZee reservation via our backend. The JSON body uses **CRM names** (`checkIn`, `guestEmail`,
 * `rooms[].roomTypeId`, …). The server maps them to eZee `BookingData` with **exact** eZee keys (`check_in_date`,
 * `Email_Address`, `Roomtype_Id`, `Rateplan_Id`, `Source_Id`, …) per Postman “Create a Booking”.
 */
export async function createEzeeBooking(input: {
  hotelId: string;
  leadId: string;
  checkIn: string;
  checkOut: string;
  paymentMode?: "0" | "1" | "2";
  guestTitle: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  guestPhone: string;
  guestGender: "Male" | "Female";
  guestDateOfBirth: string;
  guestNationality: string;
  guestCity: string;
  guestCountry: string;
  guestAddress?: string;
  guestState?: string;
  guestZipcode?: string;
  specialRequest: string;
  sourceId?: string;
  /** Allowlisted; server maps to InsertBooking `Source_Id` (e.g. HOLIDAYS UNLIMITED). */
  businessSourceId?: string;
  promotionCode?: string;
  rooms: CreateEzeeBookingRoom[];
}): Promise<{ bookingRef: string; processedInPms?: boolean }> {
  const res = await fetch(`${API_BASE_URL}/api/ezee/create-booking`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || "Booking failed");
  return data as { bookingRef: string; processedInPms?: boolean };
}

export async function readEzeeBooking(input: { hotelId: string; bookingRef: string }): Promise<any> {
  const q = new URLSearchParams({ hotelId: input.hotelId });
  const res = await fetch(`${API_BASE_URL}/api/ezee/booking/${encodeURIComponent(input.bookingRef)}?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as any)?.message || (data as any)?.error || "Failed to read booking");
  return data;
}

