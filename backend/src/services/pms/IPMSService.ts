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

/** Room / rate plan master data (e.g. eZee RoomInfo) — used to enrich catalogue with human-readable names. */
export interface RoomMasterRoomType {
    roomTypeId: string;
    roomTypeName: string;
}

export interface RoomMasterRatePlan {
    ratePlanId: string;
    ratePlanName: string;
    roomTypeId?: string;
}

export interface RoomMasterCatalog {
    roomTypes: RoomMasterRoomType[];
    ratePlans: RoomMasterRatePlan[];
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

    /**
     * Optional: room type names and rate plan names from PMS master data.
     * eZee Inventory/Rate XML often omits room names; RoomInfo JSON provides ID + Name.
     */
    getRoomMasterCatalog?(): Promise<RoomMasterCatalog | null>;

    createBooking(
        bookingDetails: BookingRequest
    ): Promise<BookingResponse>;

    cancelBooking(
        pmsBookingId: string,
        reason?: string
    ): Promise<boolean>;
}
