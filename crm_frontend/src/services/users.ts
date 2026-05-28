import { API_BASE_URL, withAuthHeaders } from "./api";

export interface User {
  id: string;
  name: string;
  email: string;
    status: string;
  createdAt?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  password: string;
    phone?: string;
  regions?: string[];
}

export const createUser = async (payload: CreateUserPayload): Promise<User> => {
  const response = await fetch(`${API_BASE_URL}/users`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create user";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const data = (await response.json()) as User;
  return data;
};

export const listUsers = async (): Promise<User[]> => {
  const response = await fetch(`${API_BASE_URL}/users`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch users";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((u) => {
    const { _id, id, ...rest } = u;
    return {
      id: id ?? _id,
      ...rest,
    } as User;
  });
};


