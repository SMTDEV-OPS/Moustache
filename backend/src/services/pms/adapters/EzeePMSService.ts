import axios from "axios";
import { parseStringPromise, Builder } from "xml2js";
import {
    IPMSService,
    RoomAvailability,
    RoomRate,
    BookingRequest,
    BookingResponse,
} from "../IPMSService";

export interface EzeeReservationRoom {
    roomTypeCode?: string;
    roomTypeName?: string;
    roomName?: string;
    ratePlanCode?: string;
    ratePlanName?: string;
}

export interface EzeeReservation {
    reservationId: string;
    guestName?: string;
    guestPhone?: string;
    checkIn: string; // YYYY-MM-DD
    checkOut: string; // YYYY-MM-DD
    status: string;
    totalAmount?: number;
    rooms: EzeeReservationRoom[];
}

export class EzeePMSService implements IPMSService {
    private hotelCode: string;
    private authCode: string;
    private baseUrl = "https://live.ipms247.com/pmsinterface";

    constructor(config: { hotelCode: string; authCode: string }) {
        this.hotelCode = config.hotelCode;
        this.authCode = config.authCode;
    }

    async getInventory(
        startDate: string,
        endDate: string
    ): Promise<RoomAvailability[]> {
        const xmlBuilder = new Builder();
        const requestBody = xmlBuilder.buildObject({
            RES_Request: {
                Request_Type: "Inventory",
                Authentication: {
                    HotelCode: this.hotelCode,
                    AuthCode: this.authCode,
                },
                FromDate: startDate,
                ToDate: endDate,
            },
        });

        try {
            const response = await axios.post(
                `${this.baseUrl}/getdataAPI.php`,
                requestBody,
                {
                    headers: { "Content-Type": "text/xml" },
                }
            );

            const result = await parseStringPromise(response.data);
            const inventoryList: RoomAvailability[] = [];

            if (
                result.RES_Response &&
                result.RES_Response.RoomInfo &&
                result.RES_Response.RoomInfo[0].Source
            ) {
                const sources = result.RES_Response.RoomInfo[0].Source;
                for (const source of sources) {
                    if (source.RoomTypes && source.RoomTypes[0].RoomType) {
                        for (const rt of source.RoomTypes[0].RoomType) {
                            inventoryList.push({
                                roomTypeId: rt.RoomTypeID[0],
                                roomTypeName: "Unknown", // API doesn't return name here, might need separate lookup
                                date: rt.FromDate[0], // Assuming 1 day range per entry if simplified, or handling range
                                availableCount: parseInt(rt.Availability[0], 10),
                            });
                        }
                    }
                }
            }

            return inventoryList;
        } catch (error) {
            console.error("Error fetching inventory from eZee:", error);
            throw new Error("Failed to fetch inventory");
        }
    }

    async getRates(startDate: string, endDate: string): Promise<RoomRate[]> {
        const xmlBuilder = new Builder();
        const requestBody = xmlBuilder.buildObject({
            RES_Request: {
                Request_Type: "Rate",
                Authentication: {
                    HotelCode: this.hotelCode,
                    AuthCode: this.authCode,
                },
                FromDate: startDate,
                ToDate: endDate,
            },
        });

        try {
            const response = await axios.post(
                `${this.baseUrl}/getdataAPI.php`,
                requestBody,
                {
                    headers: { "Content-Type": "text/xml" },
                }
            );

            const result = await parseStringPromise(response.data);
            const rateList: RoomRate[] = [];

            if (
                result.RES_Response &&
                result.RES_Response.RoomInfo &&
                result.RES_Response.RoomInfo[0].Source
            ) {
                const sources = result.RES_Response.RoomInfo[0].Source;
                for (const source of sources) {
                    if (source.RoomTypes && source.RoomTypes[0].RateType) {
                        for (const rt of source.RoomTypes[0].RateType) {
                            rateList.push({
                                roomTypeId: rt.RoomTypeID[0],
                                ratePlanId: rt.RateTypeID[0],
                                date: rt.FromDate[0],
                                baseRate: parseFloat(rt.RoomRate[0].Base[0]),
                            });
                        }
                    }
                }
            }

            return rateList;
        } catch (error) {
            console.error("Error fetching rates from eZee:", error);
            throw new Error("Failed to fetch rates");
        }
    }

    async createBooking(
        bookingDetails: BookingRequest
    ): Promise<BookingResponse> {
        // Constructing JSON payload for BookingRecdNotification
        // Based on limited Postman example, but expanding with standard fields
        // attempting to match typical PMS connectivity structures.
        const bookingId = bookingDetails.leadId || `CRM-${Date.now()}`;

        const payload = {
            RES_Request: {
                Request_Type: "BookingRecdNotification",
                Authentication: {
                    HotelCode: this.hotelCode,
                    AuthCode: this.authCode,
                },
                Bookings: {
                    Booking: [
                        {
                            BookingId: bookingId,
                            Status: "New",
                            // Mapping Guest Details
                            GuestInfo: {
                                GuestName: `${bookingDetails.guest.firstName} ${bookingDetails.guest.lastName}`,
                                Email: bookingDetails.guest.email,
                                Phone: bookingDetails.guest.phone,
                                Address: bookingDetails.guest.address,
                                City: bookingDetails.guest.city,
                                Country: bookingDetails.guest.country,
                            },
                            // Mapping Room Details
                            RoomTypes: bookingDetails.rooms.map((room) => ({
                                RoomTypeID: room.roomTypeId,
                                RateTypeID: room.ratePlanId,
                                FromDate: bookingDetails.checkInDate,
                                ToDate: bookingDetails.checkOutDate,
                                Adult: room.occupancy.adults,
                                Child: room.occupancy.children,
                                RoomRate: room.price,
                            })),
                            TotalAmount: bookingDetails.totalAmount,
                            Comments: bookingDetails.comments,
                        },
                    ],
                },
            },
        };

        try {
            const response = await axios.post(
                `${this.baseUrl}/pms_connectivity.php`,
                payload,
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            console.log("eZee Create Booking Response:", response.data);

            if (response.data?.Errors || response.data?.RES_Response?.Errors) {
                throw new Error(
                    JSON.stringify(response.data.Errors || response.data.RES_Response.Errors)
                );
            }

            return {
                pmsBookingId: bookingId, // eZee might not return its own ID immediately in this sync call, or we use ours
                status: "CONFIRMED",
                message: "Booking sent to PMS",
            };
        } catch (error) {
            console.error("Error creating booking in eZee:", error);
            return {
                pmsBookingId: "",
                status: "FAILED",
                message: error instanceof Error ? error.message : "Unknown error",
            };
        }
    }

    async cancelBooking(
        pmsBookingId: string,
        reason?: string
    ): Promise<boolean> {
        const payload = {
            RES_Request: {
                Request_Type: "BookingRecdNotification",
                Authentication: {
                    HotelCode: this.hotelCode,
                    AuthCode: this.authCode,
                },
                Bookings: {
                    Booking: [
                        {
                            BookingId: pmsBookingId,
                            Status: "Cancel",
                            Reason: reason
                        },
                    ],
                },
            },
        };

        try {
            await axios.post(
                `${this.baseUrl}/pms_connectivity.php`,
                payload,
                {
                    headers: { "Content-Type": "application/json" },
                }
            );
            return true;
        } catch (error) {
            console.error("Error cancelling booking in eZee:", error);
            return false;
        }
    }

    async getReservations(
        hotelCode: string,
        authCode: string,
        fromDate: string,
        toDate: string
    ): Promise<EzeeReservation[]> {
        // Postman collection for eZee PMS Connectivity uses Request_Type = "Bookings"
        // (not "FetchBooking"). The API does not appear to support date filters for this
        // request type, so we fetch and filter client-side by check-in.
        const payload = {
            RES_Request: {
                Request_Type: "Bookings",
                Authentication: {
                    HotelCode: hotelCode,
                    AuthCode: authCode,
                },
            },
        };

        try {
            const response = await axios.post(
                `${this.baseUrl}/pms_connectivity.php`,
                payload,
                {
                    headers: { "Content-Type": "application/json" },
                }
            );

            const data = response.data;
            if (data?.Errors || data?.RES_Response?.Errors) {
                // eslint-disable-next-line no-console
                console.error(
                    "eZee getReservations error:",
                    data?.Errors || data?.RES_Response?.Errors
                );
                return [];
            }

            const reservationsNode =
                data?.Reservations ||
                data?.RES_Response?.Reservations ||
                data?.Bookings ||
                data?.RES_Response?.Bookings;
            const reservations =
                reservationsNode?.Reservation ??
                reservationsNode?.Booking ??
                reservationsNode ??
                [];

            const out: EzeeReservation[] = [];

            const fromTs = new Date(fromDate).getTime();
            const toTs = new Date(toDate).getTime();

            for (const r of Array.isArray(reservations) ? reservations : []) {
                const bookingTran = Array.isArray(r?.BookingTran) ? r.BookingTran[0] : r?.BookingTran;
                const reservationId = String(r?.UniqueID || bookingTran?.TransactionId || bookingTran?.SubBookingId || "").trim();
                if (!reservationId) continue;

                const firstName = bookingTran?.FirstName ? String(bookingTran.FirstName).trim() : "";
                const lastName = bookingTran?.LastName ? String(bookingTran.LastName).trim() : "";
                const guestName =
                    (firstName || lastName) ? `${firstName} ${lastName}`.trim() : (bookingTran?.GuestName ? String(bookingTran.GuestName).trim() : undefined);
                const guestPhone = bookingTran?.Mobile
                    ? String(bookingTran.Mobile).trim()
                    : bookingTran?.Phone
                        ? String(bookingTran.Phone).trim()
                        : undefined;

                const checkIn = String(bookingTran?.Start || "").trim();
                const checkOut = String(bookingTran?.End || "").trim();
                if (!checkIn || !checkOut) continue;

                const checkInTs = new Date(checkIn).getTime();
                if (Number.isFinite(fromTs) && Number.isFinite(toTs) && Number.isFinite(checkInTs)) {
                    if (checkInTs < fromTs || checkInTs > toTs) continue;
                }

                const totalAmountRaw =
                    bookingTran?.TotalAmountAfterTax ??
                    bookingTran?.TotalRate ??
                    bookingTran?.TotalAmount ??
                    undefined;
                const totalAmount =
                    totalAmountRaw !== undefined && totalAmountRaw !== null && totalAmountRaw !== ""
                        ? Number(totalAmountRaw)
                        : undefined;

                const status = String(
                    bookingTran?.CurrentStatus || bookingTran?.Status || r?.Status || "CONFIRMED"
                ).trim();

                const rooms: EzeeReservationRoom[] = [];
                if (bookingTran?.RoomTypeCode || bookingTran?.RoomTypeName || bookingTran?.RoomName) {
                    rooms.push({
                        roomTypeCode: bookingTran?.RoomTypeCode ? String(bookingTran.RoomTypeCode) : undefined,
                        roomTypeName: bookingTran?.RoomTypeName ? String(bookingTran.RoomTypeName) : undefined,
                        roomName: bookingTran?.RoomName ? String(bookingTran.RoomName) : undefined,
                        ratePlanCode: bookingTran?.RateplanCode ? String(bookingTran.RateplanCode) : undefined,
                        ratePlanName: bookingTran?.RateplanName ? String(bookingTran.RateplanName) : undefined,
                    });
                }

                out.push({
                    reservationId,
                    guestName,
                    guestPhone,
                    checkIn,
                    checkOut,
                    status,
                    totalAmount: Number.isFinite(totalAmount as number) ? (totalAmount as number) : undefined,
                    rooms,
                });
            }

            return out;
        } catch (error) {
            // eslint-disable-next-line no-console
            console.error("Error fetching reservations from eZee:", error);
            return [];
        }
    }
}
