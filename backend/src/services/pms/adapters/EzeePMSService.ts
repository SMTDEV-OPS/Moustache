import axios from "axios";
import { parseStringPromise, Builder } from "xml2js";
import {
    IPMSService,
    RoomAvailability,
    RoomRate,
    BookingRequest,
    BookingResponse,
    RoomMasterCatalog,
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

/** Hotel-level policy text from eZee reservation `HotelList` (MetaSearch listing API). */
export interface EzeeQuotationPolicySection {
    title: string;
    /** May contain HTML from PMS — sanitize before putting in email */
    body: string;
}

export class EzeePMSService implements IPMSService {
    private hotelCode: string;
    private authCode: string;
    private baseUrl = "https://live.ipms247.com/pmsinterface";
    private metaSearchBaseUrl = "https://live.ipms247.com/booking/reservation_api";

    constructor(config: { hotelCode: string; authCode: string }) {
        this.hotelCode = config.hotelCode;
        this.authCode = config.authCode;
    }

    private humanizePolicyFieldKey(key: string): string {
        return key
            .replace(/_/g, " ")
            .replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/^./, (c) => c.toUpperCase());
    }

    /** Keys on HotelList rows that look like policies / terms (not marketing address fields). */
    private isPolicyLikeFieldKey(key: string): boolean {
        if (
            /^(hotel_name|hotel_description|hotel_code|hotelunkid|bookingengineurl|city|state|zipcode|country|country_isocode|countryalias|grade|property_type|latitude|longitude|email|phone|fax|website)$/i.test(
                key
            )
        ) {
            return false;
        }
        const k = key.toLowerCase();
        return /policy|terms|cancel|child|pet|deposit|payment|rule|disclaimer|remark|instruction|check.?in|check.?out|early|late|smoking|restrict|occupancy|extra|damage|liability|guideline|fine|penalty|important|general.?condition/i.test(
            k
        );
    }

    private sectionSortKey(title: string): number {
        const t = title.toLowerCase();
        if (t.includes("cancel")) return 0;
        if (t.includes("term") || t.includes("condition")) return 1;
        if (t.includes("payment") || t.includes("deposit")) return 2;
        if (t.includes("check")) return 3;
        return 10;
    }

    /**
     * Fetches `request_type=HotelList` and extracts policy-like string fields for the configured hotel.
     * Shape varies by property; unknown keys are skipped unless they match policy heuristics.
     */
    async getQuotationPolicySections(): Promise<EzeeQuotationPolicySection[]> {
        const url =
            `${this.metaSearchBaseUrl}/listing.php` +
            `?request_type=HotelList` +
            `&HotelCode=${encodeURIComponent(this.hotelCode)}` +
            `&APIKey=${encodeURIComponent(this.authCode)}` +
            `&language=en`;

        try {
            const res = await axios.post(url, null, { timeout: 15000 });
            const raw = res.data;
            if (raw?.Errors?.ErrorMessage) {
                return [];
            }

            let rows: unknown[] = [];
            if (Array.isArray(raw)) {
                rows = raw;
            } else if (raw && typeof raw === "object" && Array.isArray((raw as any).Hotels)) {
                rows = (raw as any).Hotels;
            } else if (raw && typeof raw === "object" && (raw as any).Hotel) {
                const h = (raw as any).Hotel;
                rows = Array.isArray(h) ? h : [h];
            }

            const codeNorm = String(this.hotelCode).trim();
            const codeLo = codeNorm.toLowerCase();
            let hotel = rows.find((r) => {
                if (!r || typeof r !== "object") return false;
                const o = r as Record<string, unknown>;
                const c = String(o.Hotel_Code ?? o.hotelcode ?? o.HotelCode ?? "").trim();
                return c === codeNorm || c.toLowerCase() === codeLo;
            }) as Record<string, unknown> | undefined;

            if (!hotel && rows.length === 1 && rows[0] && typeof rows[0] === "object") {
                hotel = rows[0] as Record<string, unknown>;
            }

            if (!hotel) {
                return [];
            }

            const seen = new Set<string>();
            const out: EzeeQuotationPolicySection[] = [];
            const maxLen = 4500;

            for (const [key, val] of Object.entries(hotel)) {
                if (!this.isPolicyLikeFieldKey(key)) continue;
                const body =
                    typeof val === "string"
                        ? val.trim()
                        : val != null
                          ? String(val).trim()
                          : "";
                if (body.length < 12) continue;

                const title = this.humanizePolicyFieldKey(key);
                const dedupe = `${title.toLowerCase()}:${body.slice(0, 120)}`;
                if (seen.has(dedupe)) continue;
                seen.add(dedupe);

                out.push({
                    title,
                    body: body.length > maxLen ? `${body.slice(0, maxLen)}…` : body,
                });
            }

            out.sort(
                (a, b) =>
                    this.sectionSortKey(a.title) - this.sectionSortKey(b.title) ||
                    a.title.localeCompare(b.title)
            );

            return out.slice(0, 12);
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("eZee getQuotationPolicySections error:", e);
            return [];
        }
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

    /**
     * eZee PMS Connectivity JSON — Request_Type "RoomInfo" returns room type names and rate plan names.
     * Inventory XML does not include room names; we merge this into the cached catalogue on sync.
     */
    async getRoomMasterCatalog(): Promise<RoomMasterCatalog | null> {
        const fetchRoomTypesFromMetaSearch = async (): Promise<Map<string, string>> => {
            try {
                const url =
                    `${this.metaSearchBaseUrl}/listing.php` +
                    `?request_type=RoomTypeList` +
                    `&HotelCode=${encodeURIComponent(this.hotelCode)}` +
                    `&APIKey=${encodeURIComponent(this.authCode)}` +
                    `&language=en&publishtoweb=1`;

                const res = await axios.get(url, { timeout: 10000 });
                const data: any = res.data;

                // Error shape: { Errors: { ErrorCode, ErrorMessage } }
                if (data?.Errors?.ErrorMessage) {
                    return new Map();
                }

                const rows: any[] = Array.isArray(data) ? data : [];
                const map = new Map<string, string>();
                for (const r of rows) {
                    if (!r || typeof r !== "object") continue;
                    const id = String((r as any).roomtypeunkid ?? (r as any).roomTypeUnkId ?? "").trim();
                    const name = String((r as any).roomtype ?? (r as any).roomType ?? "").trim();
                    if (id && name) map.set(id, name);
                }
                return map;
            } catch (e) {
                // MetaSearch is optional fallback. Never fail the master catalog because of it.
                return new Map();
            }
        };

        const shouldPreferMetaSearchName = (candidate: string | undefined, id: string): boolean => {
            const name = String(candidate ?? "").trim();
            if (!name) return true;
            const lower = name.toLowerCase();
            if (lower === "unknown") return true;
            if (lower === `room ${id}`.toLowerCase()) return true;
            if (lower === `room type ${id}`.toLowerCase()) return true;
            return false;
        };

        const payload = {
            RES_Request: {
                Request_Type: "RoomInfo",
                NeedPhysicalRooms: 1,
                Authentication: {
                    HotelCode: this.hotelCode,
                    AuthCode: this.authCode,
                },
            },
        };

        const normalizeArray = <T,>(x: T | T[] | undefined | null): T[] => {
            if (x == null) return [];
            return Array.isArray(x) ? x : [x];
        };

        try {
            const [roomInfoResp, metaRoomTypeMap] = await Promise.all([
                axios.post(
                    `${this.baseUrl}/pms_connectivity.php`,
                    payload,
                    { headers: { "Content-Type": "application/json" } }
                ),
                fetchRoomTypesFromMetaSearch(),
            ]);

            let data: any = roomInfoResp.data;
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                } catch {
                    return null;
                }
            }

            let roomInfo: any =
                data?.RoomInfo ??
                data?.RES_Response?.RoomInfo;
            if (Array.isArray(roomInfo) && roomInfo.length) {
                roomInfo = roomInfo[0];
            }
            if (!roomInfo || typeof roomInfo !== "object") {
                return null;
            }

            const roomTypeNodes = normalizeArray(
                roomInfo.RoomTypes?.RoomType ?? roomInfo.RoomTypes
            );

            const roomTypes: RoomMasterCatalog["roomTypes"] = [];
            for (const rt of roomTypeNodes) {
                if (!rt || typeof rt !== "object") continue;
                const id = String((rt as any).ID ?? (rt as any).RoomTypeID ?? "").trim();
                const rawName = String((rt as any).Name ?? (rt as any).RoomTypeName ?? "").trim();
                const metaName = id ? metaRoomTypeMap.get(id) : undefined;
                const name =
                    id && metaName && shouldPreferMetaSearchName(rawName, id)
                        ? metaName
                        : rawName;
                if (id) {
                    roomTypes.push({
                        roomTypeId: id,
                        roomTypeName: name || `Room ${id}`,
                    });
                }
            }

            // If RoomInfo didn't return room types at all, fall back completely to MetaSearch list.
            if (roomTypes.length === 0 && metaRoomTypeMap.size > 0) {
                for (const [id, name] of metaRoomTypeMap.entries()) {
                    roomTypes.push({ roomTypeId: id, roomTypeName: name || `Room ${id}` });
                }
            }

            const ratePlanNodes = normalizeArray(
                roomInfo.RatePlans?.RatePlan ?? roomInfo.RatePlans
            );

            const ratePlans: RoomMasterCatalog["ratePlans"] = [];
            for (const rp of ratePlanNodes) {
                if (!rp || typeof rp !== "object") continue;
                const id = String((rp as any).RatePlanID ?? (rp as any).RatePlanId ?? (rp as any).ID ?? "").trim();
                const name = String((rp as any).Name ?? (rp as any).RatePlanName ?? "").trim();
                const roomTypeId = (rp as any).RoomTypeID
                    ? String((rp as any).RoomTypeID).trim()
                    : undefined;
                if (id) {
                    ratePlans.push({
                        ratePlanId: id,
                        ratePlanName: name || `Plan ${id}`,
                        roomTypeId,
                    });
                }
            }

            return { roomTypes, ratePlans };
        } catch (error) {
            console.error("eZee getRoomMasterCatalog error:", error);
            return null;
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
