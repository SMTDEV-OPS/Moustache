import { API_BASE_URL, withAuthHeaders } from "./api";

export interface Property {
  _id: string;
  name: string;
  code: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  timeZone?: string;
  status: "ACTIVE" | "INACTIVE";
  pmsProvider?: "NONE" | "EZEE";
  pmsConfig?: {
    hotelCode?: string;
    authCode?: string;
  };
  lastSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreatePropertyInput {
  name: string;
  code: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  timeZone?: string;
  status?: "ACTIVE" | "INACTIVE";
  pmsProvider?: "NONE" | "EZEE";
  pmsConfig?: {
    hotelCode?: string;
    authCode?: string;
  };
}

export interface UpdatePropertyInput {
  name?: string;
  code?: string;
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  timeZone?: string;
  status?: "ACTIVE" | "INACTIVE";
  pmsProvider?: "NONE" | "EZEE";
  pmsConfig?: {
    hotelCode?: string;
    authCode?: string;
  };
}

export type ReservationStatus =
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "CANCELLED"
  | "AMENDED";

export interface Reservation {
  _id: string;
  leadId?: { _id: string } | string | null;
  guestId?: { _id: string; name?: string; phone?: string } | string | null;
  propertyId: string;
  pmsReservationId?: string;
  checkInDate: string;
  checkOutDate: string;
  roomsBooked?: number;
  ratePlan?: string;
  totalAmount?: number;
  status: ReservationStatus;
  cancellationReason?: string;
  amendmentHistory?: Array<{
    field: string;
    oldValue?: any;
    newValue?: any;
    changedAt: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Get list of all properties
 */
export const listProperties = async (): Promise<Property[]> => {
  const response = await fetch(`${API_BASE_URL}/properties`, {
    headers: withAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Unable to fetch properties";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json().catch(() => null);
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray((data as any).data)) return (data as any).data;
  return [];
};

/**
 * Get a single property by ID
 */
export const getProperty = async (id: string): Promise<Property> => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    headers: withAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Unable to fetch property";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Create a new property
 */
export const createProperty = async (
  input: CreatePropertyInput
): Promise<Property> => {
  const response = await fetch(`${API_BASE_URL}/properties`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Unable to create property";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Update a property
 */
export const updateProperty = async (
  id: string,
  input: UpdatePropertyInput
): Promise<Property> => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Unable to update property";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Delete a property
 */
export const deleteProperty = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete property";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

export const syncPropertyPms = async (
  id: string
): Promise<{ synced: number; created: number; updated: number }> => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}/sync-pms`, {
    method: "POST",
    headers: withAuthHeaders(),
    cache: "no-store",
  });

  if (!response.ok) {
    let message = "Unable to sync PMS";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

export const listPropertyReservations = async (
  propertyId: string,
  input: { from: string; to: string; status?: ReservationStatus }
): Promise<Reservation[]> => {
  const params = new URLSearchParams();
  params.set("from", input.from);
  params.set("to", input.to);
  if (input.status) params.set("status", input.status);

  const response = await fetch(
    `${API_BASE_URL}/properties/${propertyId}/reservations?${params.toString()}`,
    {
      headers: withAuthHeaders(),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    let message = "Unable to fetch reservations";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

