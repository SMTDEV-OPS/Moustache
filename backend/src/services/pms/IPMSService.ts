export interface RoomAvailability {
    roomTypeId: string;
    roomTypeName: string;
    date: string; // YYYY-MM-DD
    availableCount: number;
}

export interface RoomRate {
    roomTypeId: string;
    ratePlanId: string;
    date: string; // YYYY-MM-DD
    baseRate: number;
    promoCode?: string;
}

export interface BookingGuest {
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
}

export interface BookingRoom {
    roomTypeId: string;
    ratePlanId: string;
    occupancy: {
        adults: number;
        children: number;
    };
    price: number;
}

export interface BookingRequest {
    checkInDate: string; // YYYY-MM-DD
    checkOutDate: string; // YYYY-MM-DD
    guest: BookingGuest;
    rooms: BookingRoom[];
    totalAmount: number;
    comments?: string;
    leadId?: string; // For reference
}

export interface BookingResponse {
    pmsBookingId: string;
    status: "CONFIRMED" | "PENDING" | "FAILED";
    message?: string;
}

export interface IPMSService {
    getInventory(
        startDate: string,
        endDate: string
    ): Promise<RoomAvailability[]>;

    getRates(
        startDate: string,
        endDate: string
    ): Promise<RoomRate[]>;

    createBooking(
        bookingDetails: BookingRequest
    ): Promise<BookingResponse>;

    cancelBooking(
        pmsBookingId: string,
        reason?: string
    ): Promise<boolean>;
}
