import { API_BASE_URL, withAuthHeaders } from "./api";
import type { User } from "./users";
import type { Role } from "./roles";

export interface Group {
  id: string;
  name: string;
  description?: string;
    isActive: boolean;
  memberUserIds?: string[];
  roleIds?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface CreateGroupPayload {
  name: string;
  description?: string;
    isActive?: boolean;
}

interface UpdateGroupPayload {
  name?: string;
  description?: string;
    isActive?: boolean;
}

export const listGroups = async (): Promise<Group[]> => {
  const response = await fetch(`${API_BASE_URL}/groups`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch groups";
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
  return raw.map((g) => {
    const { _id, id, ...rest } = g;
    return { id: id ?? _id, ...rest } as Group;
  });
};

export const createGroup = async (payload: CreateGroupPayload): Promise<Group> => {
  const response = await fetch(`${API_BASE_URL}/groups`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create group";
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

  const g = (await response.json()) as any;
  const { _id, id, ...rest } = g;
  return { id: id ?? _id, ...rest } as Group;
};

export const updateGroup = async (groupId: string, payload: UpdateGroupPayload): Promise<Group> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
    method: "PUT",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update group";
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

  const g = (await response.json()) as any;
  const { _id, id, ...rest } = g;
  return { id: id ?? _id, ...rest } as Group;
};

export const deleteGroup = async (groupId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete group";
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

export const listUsersInGroup = async (groupId: string): Promise<User[]> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/users`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch group members";
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
    return { id: id ?? _id, ...rest } as User;
  });
};

export const addUsersToGroup = async (groupId: string, userIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/users`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ userIds }),
  });

  if (!response.ok) {
    let message = "Unable to add users to group";
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

export const removeUserFromGroup = async (groupId: string, userId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/users/${userId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to remove user from group";
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

export const listRolesForGroup = async (groupId: string): Promise<Role[]> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/roles`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch roles for group";
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
    return { id: id ?? _id, ...rest } as Role;
  });
};

export const addRolesToGroup = async (groupId: string, roleIds: string[]): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/roles`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ roleIds }),
  });

  if (!response.ok) {
    let message = "Unable to add roles to group";
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

export const removeRoleFromGroup = async (groupId: string, roleId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/groups/${groupId}/roles/${roleId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to remove role from group";
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


