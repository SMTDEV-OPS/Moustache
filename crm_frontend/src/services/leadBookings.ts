import { API_BASE_URL, withAuthHeaders } from "@/services/api";

export type LeadBookingStatus = "confirmed" | "cancelled";

export type LeadBookingRoom = {
  roomTypeId: string;
  roomTypeName: string;
  rateTypeId: string;
  planName: string;
  adults: number;
  children: number;
  baseRate: number;
  totalAmount: number;
};

export type LeadBooking = {
  _id: string;
  leadId: string;
  propertyId: { _id: string; name?: string } | string;
  ezeeBookingRef: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestName: string;
  guestEmail?: string;
  guestPhone?: string;
  rooms: LeadBookingRoom[];
  grandTotal: number;
  status: LeadBookingStatus;
  bookedAt: string;
  specialRequest?: string;
  /** False when eZee ProcessBooking did not confirm (reservation may still be pending in PMS). */
  processedInPms?: boolean;
};

export async function listLeadBookings(leadId: string): Promise<LeadBooking[]> {
  const res = await fetch(`${API_BASE_URL}/leads/${leadId}/bookings`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load bookings");
  return res.json();
}

export async function getLeadBooking(leadId: string, bookingId: string): Promise<LeadBooking> {
  const res = await fetch(`${API_BASE_URL}/leads/${leadId}/bookings/${bookingId}`, {
    headers: withAuthHeaders(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Failed to load booking");
  return data as LeadBooking;
}

export async function cancelEzeeBooking(input: {
  leadId: string;
  hotelId: string;
  bookingRef: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/ezee/cancel-booking`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || data.error || "Cancel failed");
}

