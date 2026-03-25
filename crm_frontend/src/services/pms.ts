import { API_BASE_URL, withAuthHeaders } from "./api";

export interface RoomAvailability {
    roomTypeId: string;
    roomTypeName: string;
    date: string;
    availableCount: number;
}

export interface RoomRate {
    roomTypeId: string;
    ratePlanId: string;
    date: string;
    baseRate: number;
}

export interface BookingRequest {
    leadId: string;
    roomTypeId: string;
    ratePlanId: string;
    checkInDate: string;
    checkOutDate: string;
    price: number;
    occupancy: {
        adults: number;
        children: number;
    };
    guestDetails?: {
        firstName: string;
        lastName: string;
        email?: string;
        phone?: string;
        address?: string;
        city?: string;
        country?: string;
    };
    comments?: string;
}

export interface BookingResponse {
    reservation: any; // Using any for now, matches backend Reservation model
    pmsResponse?: {
        pmsBookingId: string;
        status: string;
        message: string;
    };
}

export const checkAvailability = async (
    propertyId: string,
    from: string,
    to: string
): Promise<RoomAvailability[]> => {
    const response = await fetch(
        `${API_BASE_URL}/pms/${propertyId}/inventory?from=${from}&to=${to}`,
        {
            headers: withAuthHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error("Failed to fetch inventory");
    }

    return response.json();
};

export const getRates = async (
    propertyId: string,
    from: string,
    to: string
): Promise<RoomRate[]> => {
    const response = await fetch(
        `${API_BASE_URL}/pms/${propertyId}/rates?from=${from}&to=${to}`,
        {
            headers: withAuthHeaders(),
        }
    );

    if (!response.ok) {
        throw new Error("Failed to fetch rates");
    }

    return response.json();
};

export const createBooking = async (
    propertyId: string,
    data: BookingRequest
): Promise<BookingResponse> => {
    const response = await fetch(`${API_BASE_URL}/pms/${propertyId}/bookings`, {
        method: "POST",
        headers: withAuthHeaders({
            "Content-Type": "application/json",
        }),
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to create booking");
    }

    return response.json();
};

export interface RoomCatalogue {
  roomTypes: {
    roomTypeId: string;
    roomTypeCode: string;
    roomTypeName: string;
    maxOccupancy?: number;
  }[];
  ratePlans: {
    ratePlanId: string;
    ratePlanCode: string;
    ratePlanName: string;
    inclusions?: string;
  }[];
  lastSyncedAt?: string;
  needsSync?: boolean;
}

/** Prefer catalogue name, then stored name from the lead — avoid showing raw PMS IDs in the UI. */
export function resolveRoomTypeDisplayName(
  roomTypeId: string | undefined | null,
  storedName: string | undefined | null,
  catalogue?: { roomTypeId: string; roomTypeName: string }[] | null
): string {
  const id = roomTypeId?.trim();
  const stored = storedName?.trim();
  if (id) {
    const fromCat = catalogue?.find((r) => r.roomTypeId === id)?.roomTypeName?.trim();
    if (fromCat) return fromCat;
  }
  if (stored && stored.toLowerCase() !== "unknown") return stored;
  if (id) return "Unknown room type";
  if (stored) return stored;
  return "—";
}

export const getRoomCatalogue = async (
  propertyId: string
): Promise<RoomCatalogue> => {
  const res = await fetch(
    `${API_BASE_URL}/pms/${propertyId}/catalogue`,
    { headers: withAuthHeaders() }
  );
  if (!res.ok) return { roomTypes: [], ratePlans: [] };
  return res.json();
};

export const syncRoomCatalogue = async (
  propertyId: string
): Promise<RoomCatalogue> => {
  const res = await fetch(
    `${API_BASE_URL}/pms/${propertyId}/catalogue/sync`,
    { method: "POST", headers: withAuthHeaders() }
  );
  if (!res.ok) throw new Error("Sync failed");
  return res.json();
};

export const getLiveAvailability = async (
  propertyId: string,
  from: string,
  to: string
): Promise<any> => {
  const res = await fetch(
    `${API_BASE_URL}/pms/${propertyId}/availability?from=${from}&to=${to}`,
    { headers: withAuthHeaders() }
  );
  if (!res.ok) return { available: false, error: "API Error" };
  return res.json();
};
