export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:4000").replace(
  /\/$/,
  "",
);

// Log API URL in development or if not set (helps with debugging)
if (import.meta.env.DEV || !import.meta.env.VITE_API_BASE_URL) {
  console.log("API Base URL:", API_BASE_URL);
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

