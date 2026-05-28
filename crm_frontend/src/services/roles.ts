import { API_BASE_URL, withAuthHeaders } from "./api";

export interface Role {
  id: string;
  name: string;
  description?: string;
  parentRoleId?: string | null;
  isSystemRole?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface RoleUser {
  id: string;
  name: string;
  email: string;
}

export interface CreateRolePayload {
  name: string;
  description?: string;
  parentRoleId?: string | null;
}

export interface UpdateRolePayload {
  name?: string;
  description?: string;
  parentRoleId?: string | null;
}

export const listRoles = async (): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/roles`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch roles";
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
  return raw.map((r) => {
    const { _id, id, ...rest } = r;
    return {
      id: id ?? _id,
      ...rest,
    } as Role;
  });
};

export const createRole = async (payload: CreateRolePayload): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create role";
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

  const data = (await response.json()) as Role;
  return data;
};

export const updateRole = async (roleId: string, payload: UpdateRolePayload): Promise<Role> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update role";
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

  const data = (await response.json()) as Role;
  return data;
};

export const deleteRole = async (roleId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete role";
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
};

export const listUsersForRole = async (roleId: string): Promise<RoleUser[]> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/users`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch users for role";
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
    } as RoleUser;
  });
};

export const addUsersToRole = async (roleId: string, userIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/users`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    let message = "Unable to add users to role";
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
};

export const removeUserFromRole = async (roleId: string, userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/users/${userId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to remove user from role";
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
};

// Role owner (SPOC) management
export const listRoleOwners = async (roleId: string): Promise<RoleUser[]> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/owners`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch role owners";
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
    } as RoleUser;
  });
};

export const addRoleOwners = async (roleId: string, userIds: string[]): Promise<RoleUser[]> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/owners`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    let message = "Unable to add role owners";
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
    } as RoleUser;
  });
};

export const removeRoleOwner = async (roleId: string, userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/roles/${roleId}/owners/${userId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to remove role owner";
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
};


