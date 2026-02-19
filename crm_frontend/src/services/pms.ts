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
