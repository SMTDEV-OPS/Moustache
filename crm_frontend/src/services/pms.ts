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

/** Normalized row from GET /pms/:propertyId/rates (eZee Rate API; rate type = meal plan). */
export interface FetchedRoomRateRow {
    roomTypeId: string;
    /** eZee XML `RateTypeID` actually maps to RatePlanID (see Postman Rate response). */
    ratePlanId: string;
    fromDate: string;
    toDate: string;
    baseRate: number;
    extraAdult?: number;
    extraChild?: number;
}

function parseRatesPayload(data: unknown): FetchedRoomRateRow[] {
    if (!Array.isArray(data)) {
        return [];
    }
    const arr = data;
    return arr.map((raw: any) => {
        const date = String(raw.date ?? raw.fromDate ?? "").trim();
        const toDate = String(raw.toDate ?? raw.date ?? raw.fromDate ?? "").trim();
        const ratePlanId = String(raw.ratePlanId ?? raw.rateTypeId ?? "").trim();
        const roomTypeId = String(raw.roomTypeId ?? "").trim();
        const baseRate = Number(raw.baseRate);
        const extraAdult = raw.extraAdult != null && raw.extraAdult !== "" ? Number(raw.extraAdult) : undefined;
        const extraChild = raw.extraChild != null && raw.extraChild !== "" ? Number(raw.extraChild) : undefined;
        return {
            roomTypeId,
            ratePlanId,
            fromDate: date,
            toDate: toDate || date,
            baseRate: Number.isFinite(baseRate) ? baseRate : 0,
            ...(extraAdult !== undefined && Number.isFinite(extraAdult) ? { extraAdult } : {}),
            ...(extraChild !== undefined && Number.isFinite(extraChild) ? { extraChild } : {}),
        };
    });
}

/**
 * Room-type–scoped rates for the date range (backend filters by roomTypeId).
 * Throws on HTTP errors or PMS error payloads (`{ available: false }`).
 */
export async function fetchRoomRates(
    propertyId: string,
    from: string,
    to: string,
    roomTypeId: string
): Promise<FetchedRoomRateRow[]> {
    const q = new URLSearchParams({ from, to, roomTypeId });
    const response = await fetch(`${API_BASE_URL}/pms/${propertyId}/rates?${q.toString()}`, {
        headers: withAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error("Failed to fetch rates");
    }

    const data = await response.json();
    if (data && typeof data === "object" && !Array.isArray(data) && (data as any).available === false) {
        throw new Error((data as any).error || "PMS unavailable");
    }

    return parseRatesPayload(data);
}

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

export type EzeeSeparateSourceMapping = {
  roomTypes: { id: string; name: string }[];
  rateTypes: { id: string; name: string }[];
  /** RatePlanID + RoomTypeID + RateTypeID + display Name (eZee Separatesourcemapping). */
  ratePlans: { id: string; roomTypeId?: string; rateTypeId?: string; name?: string }[];
  /** Present on `GET /api/ezee/room-info` when eZee returns `Saparatechannelsources`. */
  channelSources?: { channelId: string; channelName: string }[];
};

const ezeeMappingCache = new Map<string, { expiresAt: number; value?: EzeeSeparateSourceMapping; promise?: Promise<EzeeSeparateSourceMapping> }>();

export async function getEzeeSeparateSourceMappingCached(
  propertyId: string,
  opts?: { ttlMs?: number; signal?: AbortSignal }
): Promise<EzeeSeparateSourceMapping> {
  const ttlMs = opts?.ttlMs ?? 5 * 60_000;
  const key = `ezee-mapping::${propertyId}`;
  const now = Date.now();
  const cached = ezeeMappingCache.get(key);
  if (cached?.value && cached.expiresAt > now) return cached.value;
  if (cached?.promise) return cached.promise;

  const promise = (async () => {
    const res = await fetch(`${API_BASE_URL}/pms/${propertyId}/ezee/mapping`, {
      headers: withAuthHeaders(),
      signal: opts?.signal,
    });
    if (!res.ok) return { roomTypes: [], rateTypes: [], ratePlans: [] };
    return (await res.json()) as EzeeSeparateSourceMapping;
  })()
    .then((value) => {
      ezeeMappingCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      ezeeMappingCache.delete(key);
      throw err;
    });

  ezeeMappingCache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}

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

type AvailabilityInventoryRow = {
  roomTypeId: string;
  availableCount?: number;
  roomTypeName?: string;
};

type LiveAvailabilityResponse =
  | { available: false; error?: string }
  | AvailabilityInventoryRow[];

const liveAvailabilityCache = new Map<
  string,
  { expiresAt: number; promise?: Promise<LiveAvailabilityResponse>; value?: LiveAvailabilityResponse }
>();

function liveAvailabilityKey(propertyId: string, from: string, to: string) {
  return `${propertyId}::${from}::${to}`;
}

/**
 * Cached wrapper around GET /pms/:propertyId/availability.
 * - TTL cache (default 30s) to keep room dropdown snappy while editing.
 * - De-dupes in-flight requests for same (propertyId, from, to).
 * - Supports aborting on fast user edits (signal only cancels the caller fetch).
 */
export async function getLiveAvailabilityCached(
  propertyId: string,
  from: string,
  to: string,
  opts?: { signal?: AbortSignal; ttlMs?: number }
): Promise<LiveAvailabilityResponse> {
  const ttlMs = opts?.ttlMs ?? 30_000;
  const key = liveAvailabilityKey(propertyId, from, to);
  const now = Date.now();

  const cached = liveAvailabilityCache.get(key);
  if (cached && cached.value && cached.expiresAt > now) return cached.value;
  if (cached && cached.promise) return cached.promise;

  const promise = (async () => {
    const res = await fetch(
      `${API_BASE_URL}/pms/${propertyId}/availability?from=${from}&to=${to}`,
      { headers: withAuthHeaders(), signal: opts?.signal }
    );
    if (!res.ok) return { available: false, error: "API Error" } as const;
    return (await res.json()) as LiveAvailabilityResponse;
  })()
    .then((value) => {
      liveAvailabilityCache.set(key, { value, expiresAt: Date.now() + ttlMs });
      return value;
    })
    .catch((err) => {
      liveAvailabilityCache.delete(key);
      throw err;
    });

  liveAvailabilityCache.set(key, { promise, expiresAt: now + ttlMs });
  return promise;
}
