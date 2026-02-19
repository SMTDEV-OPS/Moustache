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

/**
 * Get list of all properties
 */
export const listProperties = async (): Promise<Property[]> => {
  const response = await fetch(`${API_BASE_URL}/properties`, {
    headers: withAuthHeaders(),
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

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Get a single property by ID
 */
export const getProperty = async (id: string): Promise<Property> => {
  const response = await fetch(`${API_BASE_URL}/properties/${id}`, {
    headers: withAuthHeaders(),
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

