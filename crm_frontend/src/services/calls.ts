import { API_BASE_URL, withAuthHeaders } from "./api";

export interface GuestSearchResult {
  guest?: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    isSunshineMember: boolean;
    sunshineTier?: string;
    tags: string[];
    firstSeenAt: string;
    lastSeenAt: string;
    totalLeadsCount: number;
    totalReservationsCount: number;
  } | null;
  source: "local" | "external" | "both";
  externalData?: any;
  previousLeads?: any[];
  previousReservations?: any[];
  communicationHistory?: any[];
}

/**
 * Search guest by phone number
 */
export async function searchGuestByPhone(phone: string): Promise<GuestSearchResult> {
  const response = await fetch(
    `${API_BASE_URL}/guests/search-by-phone/${encodeURIComponent(phone)}`,
    {
      method: "GET",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search guest: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search guest by email
 */
export async function searchGuestByEmail(email: string): Promise<GuestSearchResult> {
  const response = await fetch(
    `${API_BASE_URL}/guests/search?email=${encodeURIComponent(email)}`,
    {
      method: "GET",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to search guest: ${response.statusText}`);
  }

  return response.json();
}

