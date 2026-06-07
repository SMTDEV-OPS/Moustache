import axios from "axios";
import { parseStringPromise, Builder } from "xml2js";
import { logger } from "../../../config/logger";
import {
    IPMSService,
    RoomAvailability,
    RoomRate,
    BookingRequest,
    BookingResponse,
    RoomMasterCatalog,
} from "../IPMSService";

/** xml2js often omits `[]` when a node appears once — normalize so we always iterate arrays. */
function ezeeXml2jsArray<T>(x: T | T[] | undefined | null): T[] {
    if (x == null) return [];
    return Array.isArray(x) ? x : [x];
}

/**
 * Rate XML (`getdataAPI.php`, Request_Type Rate): entries are under
 * `RES_Response.RoomInfo → Source[*] → RoomTypes → RateType[*]`.
 * Never use `RoomInfo.RoomTypes` without going through `Source` first when sources exist.
 */
function collectEzeeRateTypeXmlNodes(parsed: unknown): any[] {
    const r = parsed as Record<string, any> | null | undefined;
    if (!r || typeof r !== "object") return [];

    const resFirst = ezeeXml2jsArray(r.RES_Response ?? r.Res_Response ?? r.res_response)[0];
    if (!resFirst || typeof resFirst !== "object") return [];

    const roomInfoFirst = ezeeXml2jsArray(resFirst.RoomInfo)[0];
    if (!roomInfoFirst || typeof roomInfoFirst !== "object") return [];

    const out: any[] = [];
    const sources = ezeeXml2jsArray(roomInfoFirst.Source);
    if (sources.length > 0) {
        for (const source of sources) {
            if (!source || typeof source !== "object") continue;
            const roomTypesHead = ezeeXml2jsArray(source.RoomTypes)[0];
            if (!roomTypesHead) continue;
            out.push(...ezeeXml2jsArray(roomTypesHead.RateType));
        }
    }
    if (out.length === 0) {
        const roomTypesHead = ezeeXml2jsArray(roomInfoFirst.RoomTypes)[0];
        if (roomTypesHead) out.push(...ezeeXml2jsArray(roomTypesHead.RateType));
    }
    return out;
}

/**
 * Inventory XML (`getdataAPI.php`, Request_Type Inventory): entries are under
 * `RES_Response.RoomInfo → Source[*] → RoomTypes → RoomType[*]`.
 */
function collectEzeeInventoryRoomTypeXmlNodes(parsed: unknown): any[] {
    const r = parsed as Record<string, any> | null | undefined;
    if (!r || typeof r !== "object") return [];

    const resFirst = ezeeXml2jsArray(r.RES_Response ?? r.Res_Response ?? r.res_response)[0];
    if (!resFirst || typeof resFirst !== "object") return [];

    const roomInfoFirst = ezeeXml2jsArray(resFirst.RoomInfo)[0];
    if (!roomInfoFirst || typeof roomInfoFirst !== "object") return [];

    const out: any[] = [];
    const sources = ezeeXml2jsArray(roomInfoFirst.Source);
    if (sources.length > 0) {
        for (const source of sources) {
            if (!source || typeof source !== "object") continue;
            const roomTypesHead = ezeeXml2jsArray(source.RoomTypes)[0];
            if (!roomTypesHead) continue;
            out.push(...ezeeXml2jsArray(roomTypesHead.RoomType));
        }
    }
    if (out.length === 0) {
        const roomTypesHead = ezeeXml2jsArray(roomInfoFirst.RoomTypes)[0];
        if (roomTypesHead) out.push(...ezeeXml2jsArray(roomTypesHead.RoomType));
    }
    return out;
}

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
            const roomTypeNodes = collectEzeeInventoryRoomTypeXmlNodes(result);

            for (const rt of roomTypeNodes) {
                const roomTypeId = String(rt?.RoomTypeID?.[0] ?? rt?.RoomTypeId?.[0] ?? "").trim();
                if (!roomTypeId) continue;
                const availabilityRaw = rt?.Availability?.[0] ?? rt?.Available?.[0];
                inventoryList.push({
                    roomTypeId,
                    roomTypeName: "Unknown",
                    date: String(rt?.FromDate?.[0] ?? rt?.Date?.[0] ?? ""),
                    availableCount: parseInt(String(availabilityRaw ?? "0"), 10) || 0,
                });
            }

            if (inventoryList.length === 0) {
                logger.warn("eZee getInventory returned no room types", {
                    hotelCode: this.hotelCode,
                    startDate,
                    endDate,
                    responseSnippet: String(response.data).slice(0, 500),
                });
            }

            return inventoryList;
        } catch (error) {
            logger.error("Error fetching inventory from eZee", { hotelCode: this.hotelCode }, error instanceof Error ? error : new Error(String(error)));
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

            const rateNodes = collectEzeeRateTypeXmlNodes(result);
            for (const rt of rateNodes) {
                const roomTypeId = rt?.RoomTypeID?.[0];
                const ratePlanId = rt?.RateTypeID?.[0];
                if (!roomTypeId || !ratePlanId) continue;
                const baseRaw = rt?.RoomRate?.[0]?.Base?.[0];
                rateList.push({
                    roomTypeId,
                    ratePlanId,
                    date: rt?.FromDate?.[0] ?? "",
                    baseRate: parseFloat(String(baseRaw ?? "0")),
                });
            }

            return rateList;
        } catch (error) {
            console.error("Error fetching rates from eZee:", error);
            throw new Error("Failed to fetch rates");
        }
    }

    /**
     * Date-based rates lookup (Rate XML API).
     * Returns a flat map: `${roomTypeId}_${ratePlanId}` -> { base, extraAdult, extraChild }.
     *
     * Notes:
     * - API returns one RateType row per date segment; we aggregate by averaging across returned rows.
     * - This is safe for quotation "suggested base rate" (field remains editable).
     *
     * IMPORTANT:
     * - In eZee Rate XML (getdataAPI.php), the element name is `<RateTypeID>`, but in practice it maps to
     *   the PMS "RatePlanID" space (as used in Separatesourcemapping RatePlans). Treat it as ratePlanId.
     */
    async getRatesLookup(
        startDate: string,
        endDate: string
    ): Promise<Record<string, { base: number; extraAdult?: number; extraChild?: number }>> {
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

        const response = await axios.post(`${this.baseUrl}/getdataAPI.php`, requestBody, {
            headers: { "Content-Type": "text/xml" },
            timeout: 15000,
        });

        const result = await parseStringPromise(response.data);
        const out: Record<string, { base: number; extraAdult?: number; extraChild?: number }> = {};

        const rateNodes = collectEzeeRateTypeXmlNodes(result);

        const buckets = new Map<
            string,
            { baseSum: number; baseN: number; eaSum: number; eaN: number; ecSum: number; ecN: number }
        >();

        const toNum = (v: any): number | undefined => {
            if (v === null || v === undefined) return undefined;
            const s = Array.isArray(v) ? v[0] : v;
            const n = Number(s);
            return Number.isFinite(n) ? n : undefined;
        };

        // Include every XML row in the lookup map — do not filter by ID suffix (real RatePlanIDs can end in ...0000001).
        for (const rt of rateNodes) {
            const roomTypeId = String(rt?.RoomTypeID?.[0] ?? "").trim();
            const ratePlanId = String(rt?.RateTypeID?.[0] ?? "").trim();
            if (!roomTypeId || !ratePlanId) continue;

            const base = toNum(rt?.RoomRate?.[0]?.Base);
            const extraAdult = toNum(rt?.RoomRate?.[0]?.ExtraAdult);
            const extraChild = toNum(rt?.RoomRate?.[0]?.ExtraChild);

            const key = `${roomTypeId}_${ratePlanId}`;
            const b = buckets.get(key) ?? { baseSum: 0, baseN: 0, eaSum: 0, eaN: 0, ecSum: 0, ecN: 0 };
            if (base !== undefined) {
                b.baseSum += base;
                b.baseN += 1;
            }
            if (extraAdult !== undefined) {
                b.eaSum += extraAdult;
                b.eaN += 1;
            }
            if (extraChild !== undefined) {
                b.ecSum += extraChild;
                b.ecN += 1;
            }
            buckets.set(key, b);
        }

        for (const [key, b] of buckets.entries()) {
            if (b.baseN <= 0) continue;
            const base = b.baseSum / b.baseN;
            const row: { base: number; extraAdult?: number; extraChild?: number } = {
                base: Math.round(base * 100) / 100,
            };
            if (b.eaN > 0) row.extraAdult = Math.round((b.eaSum / b.eaN) * 100) / 100;
            if (b.ecN > 0) row.extraChild = Math.round((b.ecSum / b.ecN) * 100) / 100;
            out[key] = row;
        }

        logger.debug("eZee rate map built", {
            hotelCode: this.hotelCode,
            rawXmlRateRows: rateNodes.length,
            entryCount: Object.keys(out).length,
            sampleKeys: Object.keys(out).slice(0, 3),
        });

        return out;
    }

    /**
     * eZee PMS Connectivity JSON:
     * - Request_Type = "Separatesourcemapping" returns RoomTypes, RateTypes (meal plan names), and RatePlans mapping.
     * This is the authoritative mapping for RateTypeID -> meal plan label.
     *
     * Safe to cache at the caller layer (rarely changes).
     */
    async getSeparateSourceMapping(): Promise<{
        roomTypes: { id: string; name: string }[];
        rateTypes: { id: string; name: string }[];
        ratePlans: { id: string; roomTypeId?: string; rateTypeId?: string; name?: string }[];
        channelSources: { channelId: string; channelName: string }[];
    }> {
        const payload = {
            RES_Request: {
                Request_Type: "Separatesourcemapping",
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

        const getId = (o: any, ...keys: string[]) => {
            for (const k of keys) {
                const v = o?.[k];
                if (v == null) continue;
                const s = String(v).trim();
                if (s) return s;
            }
            return "";
        };

        const getName = (o: any, ...keys: string[]) => {
            for (const k of keys) {
                const v = o?.[k];
                if (v == null) continue;
                const s = String(v).trim();
                if (s) return s;
            }
            return "";
        };

        /** eZee JSON often includes HTML entities in names (e.g. &amp;). */
        const decodeEzeeText = (s: string) =>
            s
                .replace(/&amp;/gi, "&")
                .replace(/&quot;/gi, '"')
                .replace(/&#39;/g, "'")
                .replace(/&lt;/gi, "<")
                .replace(/&gt;/gi, ">");

        /** Postman + live API: success still includes Errors: { ErrorCode: "0", ErrorMessage: "Success" }. */
        const isFatalEzeeEnvelope = (d: any): boolean => {
            const errBag = d?.Errors ?? d?.RES_Response?.Errors;
            if (errBag && typeof errBag === "object" && !Array.isArray(errBag)) {
                const code = String(errBag.ErrorCode ?? errBag.errorcode ?? "").trim();
                const bagMsg = String(errBag.ErrorMessage ?? errBag.errormessage ?? "").trim();
                if (code !== "" && code !== "0") return true;
                if (bagMsg !== "" && !/^success$/i.test(bagMsg)) return true;
            }
            const msg = typeof d?.ErrorMessage === "string" ? d.ErrorMessage.trim() : "";
            if (msg && !/^success$/i.test(msg)) return true;
            return typeof d?.Error === "string" && d.Error.trim() !== "";
        };

        try {
            const res = await axios.post(`${this.baseUrl}/pms_connectivity.php`, payload, {
                headers: { "Content-Type": "application/json" },
                timeout: 15000,
            });

            let data: any = res.data;
            if (typeof data === "string") {
                try {
                    data = JSON.parse(data);
                } catch {
                    return { roomTypes: [], rateTypes: [], ratePlans: [], channelSources: [] };
                }
            }

            if (isFatalEzeeEnvelope(data)) {
                return { roomTypes: [], rateTypes: [], ratePlans: [], channelSources: [] };
            }

            const top = data?.RES_Response ?? data;
            /** Separatesourcemapping returns RoomTypes / RateTypes / RatePlans under RoomInfo (see Postman "Retrieve Room Rates with Source details"). */
            const block = top?.RoomInfo ?? top;

            const rtNodes = normalizeArray(block?.RoomTypes?.RoomType ?? block?.RoomTypes ?? block?.RoomType);
            const rateTypeNodes = normalizeArray(block?.RateTypes?.RateType ?? block?.RateTypes ?? block?.RateType);
            const planNodes = normalizeArray(block?.RatePlans?.RatePlan ?? block?.RatePlans ?? block?.RatePlan);

            const roomTypes = rtNodes
                .map((x: any) => ({
                    id: getId(x, "RoomTypeID", "RoomTypeId", "ID", "Id"),
                    name: decodeEzeeText(getName(x, "RoomTypeName", "Name", "RoomType", "roomtype")),
                }))
                .filter((x: any) => x.id);

            const rateTypes = rateTypeNodes
                .map((x: any) => ({
                    id: getId(x, "RateTypeID", "RateTypeId", "ID", "Id"),
                    name: decodeEzeeText(getName(x, "RateTypeName", "Name", "RateType")),
                }))
                .filter((x: any) => x.id);

            const ratePlans = planNodes
                .map((x: any) => ({
                    id: getId(x, "RatePlanID", "RatePlanId", "ID", "Id"),
                    roomTypeId: getId(x, "RoomTypeID", "RoomTypeId"),
                    rateTypeId: getId(x, "RateTypeID", "RateTypeId"),
                    name: decodeEzeeText(getName(x, "Name", "RatePlanName", "RatePlan")),
                }))
                .filter((x: any) => x.id);

            /** eZee typo: `Saparatechannelsources` under RoomInfo (Postman "Retrieve Room Rates with Source details"). */
            const chRoot =
                (block as any)?.Saparatechannelsources ??
                (block as any)?.Separatechannelsources ??
                (block as any)?.saparatechannelsources;
            const rawChannelSources = normalizeArray(
                chRoot?.Saparatechannelsource ??
                    chRoot?.SaparatechannelSource ??
                    chRoot?.Separatechannelsource ??
                    chRoot
            );
            const channelSources = rawChannelSources
                .filter((s: any) => s && typeof s === "object")
                .map((s: any) => ({
                    channelId: String(s.ChannelID ?? s.channelID ?? s.Id ?? s.ID ?? "").trim(),
                    channelName: String(s.Channel_name ?? s.ChannelName ?? s.channel_name ?? s.Name ?? "").trim(),
                }))
                .filter((s: { channelId: string; channelName: string }) => s.channelId && s.channelName);

            return { roomTypes, rateTypes, ratePlans, channelSources };
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("eZee getSeparateSourceMapping error:", e);
            return { roomTypes: [], rateTypes: [], ratePlans: [], channelSources: [] };
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

                const roomNodes = normalizeArray((rt as any).Rooms?.Room ?? (rt as any).Rooms);
                const physicalRooms: { roomId: string; roomName: string }[] = [];
                for (const room of roomNodes) {
                    if (!room || typeof room !== "object") continue;
                    const rid = String((room as any).RoomID ?? (room as any).ID ?? "").trim();
                    if (!rid) continue;
                    const rname = String((room as any).RoomName ?? (room as any).Name ?? "").trim();
                    physicalRooms.push({ roomId: rid, roomName: rname || rid });
                }

                if (id) {
                    roomTypes.push({
                        roomTypeId: id,
                        roomTypeName: name || `Room ${id}`,
                        ...(physicalRooms.length ? { physicalRooms } : {}),
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

    /**
     * Physical rooms for one room type — derived from the same RoomInfo (NeedPhysicalRooms: 1) data
     * parsed in {@link getRoomMasterCatalog} (`RoomTypes.RoomType[].Rooms.Room[]`, RoomID/RoomName).
     */
    async getPhysicalRoomsForRoomType(roomTypeId: string): Promise<{ roomId: string; roomName: string }[]> {
        const targetId = String(roomTypeId || "").trim();
        if (!targetId) return [];
        try {
            const catalog = await this.getRoomMasterCatalog();
            if (!catalog) return [];
            const hit = catalog.roomTypes.find((rt) => String(rt.roomTypeId) === targetId);
            return Array.isArray(hit?.physicalRooms) ? hit.physicalRooms : [];
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error("eZee getPhysicalRoomsForRoomType error:", e);
            return [];
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

    /**
     * MetaSearch `listing.php` — `request_type=ProcessBooking`: confirms a reservation after InsertBooking.
     * `Process_Data` JSON keys follow eZee connectivity (Action, ReservationNo, Inventory_Mode, Booking_Payment_Mode).
     */
    async processBooking(reservationNo: string, bookingPaymentMode: string = "3"): Promise<void> {
        const resNo = String(reservationNo ?? "").trim();
        if (!resNo) {
            throw new Error("ProcessBooking: reservation number is required");
        }

        const processData = {
            Action: "ConfirmBooking",
            ReservationNo: resNo,
            Inventory_Mode: "REGULAR",
            Booking_Payment_Mode: String(bookingPaymentMode ?? "3").trim() || "3",
        };

        const processDataJson = JSON.stringify(processData);
        const processDataEncoded = encodeURIComponent(processDataJson);
        const processUrl =
            `${this.metaSearchBaseUrl}/listing.php` +
            `?request_type=ProcessBooking` +
            `&HotelCode=${encodeURIComponent(this.hotelCode)}` +
            `&APIKey=${encodeURIComponent(this.authCode)}` +
            `&Process_Data=${processDataEncoded}` +
            `&LANGUAGE=${encodeURIComponent("en")}`;

        const resp = await axios.post(processUrl, null, { timeout: 20000 });

        let result: any = resp.data;
        if (typeof result === "string") {
            try {
                result = JSON.parse(result);
            } catch {
                /* keep string */
            }
        }

        const errBag = result?.Errors ?? result?.RES_Response?.Errors;
        const errCode = String(errBag?.ErrorCode ?? errBag?.errorcode ?? "").trim();
        if (errCode && errCode !== "0") {
            const em = String(errBag?.ErrorMessage ?? errBag?.errormessage ?? "").trim();
            throw new Error(`ProcessBooking failed (${errCode}): ${em || JSON.stringify(result)}`);
        }

        const resLower = String(result?.result ?? result?.Result ?? "").toLowerCase().trim();
        const msg = typeof result?.message === "string" ? result.message : String(result?.Message ?? "");
        if (resLower === "success" || /booking processed successfully/i.test(msg)) {
            return;
        }

        throw new Error(`ProcessBooking failed: ${msg || (() => { try { return JSON.stringify(result); } catch { return String(result); } })()}`);
    }
}
