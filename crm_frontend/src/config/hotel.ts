/**
 * Hotel brand config - set VITE_HOTEL_BRAND in .env for your hotel.
 * Replaces Postcard-specific references throughout the app.
 */
export const HOTEL_BRAND =
  (import.meta.env.VITE_HOTEL_BRAND as string) || "Postcard Hotels and Resorts";

export const DEFAULT_ADMIN_PLACEHOLDER =
  import.meta.env.VITE_ADMIN_EMAIL_PLACEHOLDER || "admin@yourhotel.com";
