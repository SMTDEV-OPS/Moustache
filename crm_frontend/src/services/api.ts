export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);

// Log API URL in development or if not set (helps with debugging)
if (import.meta.env.DEV || !import.meta.env.VITE_API_BASE_URL) {
  if (!import.meta.env.VITE_API_BASE_URL) {
    console.warn("⚠️ VITE_API_BASE_URL not set! Using default:", API_BASE_URL);
  }
}

let authToken: string | null = null;

// Initialize from localStorage if available (browser only)
if (typeof window !== "undefined") {
  const storedToken = window.localStorage.getItem("authToken");
  if (storedToken) {
    authToken = storedToken;
  }
}

export const setAuthToken = (token: string | null) => {
  authToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      window.localStorage.setItem("authToken", token);
    } else {
      window.localStorage.removeItem("authToken");
    }
  }
};

export const getAuthToken = () => authToken;

export const withAuthHeaders = (headers: HeadersInit = {}): HeadersInit => {
  if (!authToken) return headers;
  return {
    ...headers,
    Authorization: `Bearer ${authToken}`,
  };
};

// Global Fetch Interceptor to handle 401 Token Expired globally
if (typeof window !== "undefined") {
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);

    if (response.status === 401) {
      try {
        const clone = response.clone();
        const data = await clone.json();

        // If backend explicitly says the token expired, force a logout
        const errorCode = data?.code || data?.error?.code;
        const errorMessage = data?.message || data?.error?.message;

        if (errorCode === "TOKEN_EXPIRED" || errorMessage === "Token expired" || errorCode === "INVALID_TOKEN") {
          console.warn("Auth token expired or invalid. Redirecting to login...");
          setAuthToken(null);
          // Optional: clear localStorage explicitly
          window.localStorage.removeItem("authToken");
          window.location.href = "/login?message=session_expired";
        } else if (response.status === 401) {
          // General 401 Unauthorized - also good practice to wipe token
          setAuthToken(null);
          window.localStorage.removeItem("authToken");
          window.location.href = "/login?message=unauthorized";
        }
      } catch (e) {
        // Response wasn't JSON, ignore
      }
    }

    return response;
  };
}

