import { API_BASE_URL, withAuthHeaders } from "./api";

export interface Conglomerate {
    id: string;
    name: string;
    country: string;
    region: string;
    isActive: boolean;
    isGlobal: boolean;
}

export const listConglomerates = async (search?: string, country?: string): Promise<Conglomerate[]> => {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (country) params.append("country", country);

    const response = await fetch(`${API_BASE_URL}/conglomerates?${params.toString()}`, {
        headers: withAuthHeaders(),
    });

    if (!response.ok) return [];
    const raw = await response.json() as any[];
    return raw.map(c => ({ id: c._id || c.id, ...c }));
};

export const getConglomeratesByCountry = async (country: string): Promise<Conglomerate[]> => {
    const response = await fetch(`${API_BASE_URL}/conglomerates/by-country/${encodeURIComponent(country)}`, {
        headers: withAuthHeaders(),
    });

    if (!response.ok) return [];
    const raw = await response.json() as any[];
    return raw.map(c => ({ id: c._id || c.id, ...c }));
};
