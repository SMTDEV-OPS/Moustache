import { API_BASE_URL, withAuthHeaders } from "./api";

export interface HotelBrand {
    id: string;
    name: string;
    category: string;
}

export const listHotelBrands = async (): Promise<HotelBrand[]> => {
    const response = await fetch(`${API_BASE_URL}/hotel-brands`, {
        headers: withAuthHeaders(),
    });
    if (!response.ok) return [];
    const raw = await response.json() as any[];
    return raw.map(b => ({ id: b._id || b.id, ...b }));
};
