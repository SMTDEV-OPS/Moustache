import { API_BASE_URL, setAuthToken, withAuthHeaders, getAuthToken } from "./api";

interface BackendLoginUser {
  id: string;
  name: string;
  email: string;
    roleId?: string;
}

interface BackendMeUser {
  id: string;
  email: string;
  roleId?: string;
  isAdmin?: boolean;
  permissions?: string[];
}

export interface BackendLoginResult {
  token: string;
  user: BackendLoginUser & Partial<BackendMeUser>;
}

export const backendLogin = async (email: string, password: string): Promise<BackendLoginResult> => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    let message = "Unable to login";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      }
    } catch {
      // ignore JSON parse issues
    }
    throw new Error(message);
  }

  const loginData = (await response.json()) as {
    token: string;
    user: BackendLoginUser;
  };

  setAuthToken(loginData.token);

  const meResponse = await fetch(`${API_BASE_URL}/auth/me`, {
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
  });

  if (!meResponse.ok) {
    return {
      token: loginData.token,
      user: {
        ...loginData.user,
      },
    };
  }

  const meData = (await meResponse.json()) as { user: BackendMeUser };

  return {
    token: loginData.token,
    user: {
      ...loginData.user,
      ...meData.user,
    },
  };
};

/**
 * Send heartbeat to keep user online status updated
 */
export const sendHeartbeat = async (): Promise<void> => {
  try {
    await fetch(`${API_BASE_URL}/auth/heartbeat`, {
      method: "POST",
      headers: withAuthHeaders(),
    });
  } catch {
    // Silently fail - heartbeat is non-critical
  }
};

/**
 * Logout and set user offline
 * Clears auth token and notifies backend to set user offline
 * Also clears all session-related data from localStorage
 */
export const backendLogout = async (): Promise<void> => {
  try {
    // Try to notify backend first (if we have a token)
    const token = getAuthToken();
    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/logout`, {
          method: "POST",
          headers: withAuthHeaders(),
        });

        if (!response.ok) {
          console.warn("Backend logout returned non-OK status:", response.status);
        }
      } catch (err) {
        // Log error but don't throw - we still want to clear local state
        console.warn("Backend logout request failed:", err);
      }
    }
  } catch (err) {
    // Log error but don't throw - we still want to clear local state
    console.warn("Logout error:", err);
  } finally {
    // Always clear the auth token from memory and localStorage
    // This will cause WebSocket connections to disconnect (they check for token)
    setAuthToken(null);

    // Clear all session-related localStorage items
    if (typeof window !== "undefined") {
      // Clear known session keys
      window.localStorage.removeItem("authToken");
      window.localStorage.removeItem("gcSession");

      // Clear any other potential session-related items
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && (
          key.startsWith("auth") ||
          key.startsWith("session") ||
          key.startsWith("user") ||
          key.startsWith("token")
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => {
        try {
          window.localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove localStorage key ${key}:`, e);
        }
      });
    }
  }
};


