import { API_BASE_URL, withAuthHeaders } from "./api";

export type LocationType = "CBD" | "MICRO_MARKET" | "INDUSTRIAL_BELT" | "NORTH_GEO" | "SOUTH_GEO" | "CUSTOM";
export type SegmentType = "LUXURY" | "UPPER_UPSCALE" | "UPSCALE" | "MID_SEGMENT" | "BUDGET" | "GUEST_HOUSE";

export interface AccountPotential {
    id: string;
    accountId: string;
    city: string;
    location: LocationType;
    customLocation?: string;
    segment: SegmentType;
    fitPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };
    groupPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };
    longStayPotential: {
        roomNights: number;
        roomRevenue: number;
        actualRoomNights?: number;
        actualRoomRevenue?: number;
    };
    banquetPotential: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };
    fbPotential?: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };
    spaPotential?: {
        events: number;
        revenue: number;
        actualEvents?: number;
        actualRevenue?: number;
    };
    competitors: Array<{
        brandId?: string;
        brandName: string;
        rates?: string;
        marketShare?: number;
    }>;
    remarks?: string;
    year: number;
}

export const getAccountPotentials = async (accountId: string): Promise<AccountPotential[]> => {
    const response = await fetch(`${API_BASE_URL}/account-potentials/account/${accountId}`, {
        headers: withAuthHeaders(),
    });
    if (!response.ok) return [];
    const raw = await response.json() as Array<Partial<AccountPotential> & { _id?: string }>;
    return raw.map(p => ({ id: p._id || p.id, ...p })) as AccountPotential[];
};

export const saveAccountPotential = async (accountId: string, potential: Omit<AccountPotential, "id">): Promise<AccountPotential> => {
    const response = await fetch(`${API_BASE_URL}/account-potentials/account/${accountId}`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(potential),
    });
    if (!response.ok) throw new Error("Failed to save potential");
    const raw = await response.json();
    return { id: raw._id || raw.id, ...raw };
};

export interface MarketSearchResult {
    accountId: string;
    accountName: string;
    city?: string;
}

export const getMarketSearch = async (
    location: LocationType,
    segment: SegmentType,
    city?: string
): Promise<MarketSearchResult[]> => {
    const params = new URLSearchParams({ location, segment });
    if (city) params.set("city", city);
    const response = await fetch(
        `${API_BASE_URL}/account-potentials/market-search?${params}`,
        { headers: withAuthHeaders() }
    );
    if (!response.ok) throw new Error("Market search failed");
    return response.json();
};

export const getPotentialSummary = async (accountId: string, year?: number): Promise<unknown> => {
    const url = `${API_BASE_URL}/account-potentials/account/${accountId}/summary${year ? `?year=${year}` : ""}`;
    const response = await fetch(url, { headers: withAuthHeaders() });
    if (!response.ok) throw new Error("Failed to fetch summary");
    return response.json();
};
