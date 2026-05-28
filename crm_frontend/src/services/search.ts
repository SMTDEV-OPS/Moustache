import { API_BASE_URL, withAuthHeaders } from "./api";

export interface GlobalSearchLeadResult {
  id: string;
  leadNumber: string;
  guestName: string;
  phone?: string;
  hotelNames: string[];
  bookingSource?: string;
  pmsReservationId?: string;
  accountName?: string;
}

export interface GlobalSearchAccountResult {
  id: string;
  name: string;
  city?: string;
  type?: string;
  isChild?: boolean;
  parentName?: string;
}

export interface GlobalSearchGuestResult {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

export interface GlobalSearchResults {
  leads: GlobalSearchLeadResult[];
  accounts: GlobalSearchAccountResult[];
  guests: GlobalSearchGuestResult[];
}

export async function globalSearch(
  q: string,
  scope: "own" | "team" | "all" = "own",
  limit = 8
): Promise<GlobalSearchResults> {
  const params = new URLSearchParams({ q, scope, limit: String(limit) });
  const res = await fetch(`${API_BASE_URL}/api/search?${params}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message || "Search failed");
  }
  return res.json();
}
