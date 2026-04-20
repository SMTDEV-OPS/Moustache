/** Clean MetaSearch HotelList row for API responses (strip HTML, omit empties). */

import axios from "axios";
import { logger } from "../config/logger";

const EZEE_HOTEL_LIST_URL =
  "https://live.ipms247.com/booking/reservation_api/listing.php";

function htmlToText(html: unknown): string {
  if (html === null || html === undefined) return "";
  return String(html)
    .replace(/<[^>]*>/g, " ")
    .replace(/undefined/g, "")
    .replace(/\\"/g, '"')
    .replace(/\s{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const TEXT_FIELDS = [
  "Hotel_Name",
  "Hotel_Code",
  "City",
  "State",
  "Zipcode",
  "Country",
  "Address",
  "Phone",
  "Reservation_Phone",
  "Email",
  "Website",
  "CurrencyCode",
  "Property_Type",
  "grade",
  "Latitude",
  "Longitude",
  "BookingEngineURL",
] as const;

const HTML_FIELDS = [
  "Hotel_Description",
  /** Often contains inline HTML from PMS (e.g. span with font). */
  "CheckIn_Policy",
  "Facilities_Attractions",
  "Hotel_Policy",
  "Cancellation_Policy",
  "Parking_Policy",
  "ThingsToDo",
  "Children_ExtraGuest_Details",
  "Booking_Conditions",
  "Travel_Directions",
  "Landmarks_Nearby",
] as const;

export function cleanHotelDetails(raw: Record<string, unknown>): Record<string, unknown> {
  const built: Record<string, unknown> = {};
  for (const f of TEXT_FIELDS) {
    built[f] = (raw[f] ?? "").toString().trim();
  }
  for (const f of HTML_FIELDS) {
    built[f] = htmlToText(raw[f]);
  }
  const img = raw.HotelImages;
  built.HotelImages = Array.isArray(img) ? img : [];

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(built)) {
    if (k === "HotelImages") {
      if (Array.isArray(v) && v.length > 0) out[k] = v;
      continue;
    }
    if (typeof v === "string" && v !== "") out[k] = v;
  }
  return out;
}

/** Lean property shape — avoids circular imports with Property model. */
export type EzeeHotelListPropertyShape = {
  pmsProvider?: string;
  pmsConfig?: { hotelCode?: string; authCode?: string };
};

/**
 * Fetch MetaSearch HotelList for an EZEE property and return cleaned fields (same as /api/ezee/hotel-details).
 */
export async function fetchCleanEzeeHotelDetails(
  property: EzeeHotelListPropertyShape | null | undefined
): Promise<Record<string, unknown> | null> {
  if (!property || property.pmsProvider !== "EZEE") return null;
  const hotelCode = property.pmsConfig?.hotelCode?.trim();
  const apiKey = property.pmsConfig?.authCode?.trim();
  if (!hotelCode || !apiKey) return null;

  const url =
    `${EZEE_HOTEL_LIST_URL}?request_type=HotelList` +
    `&HotelCode=${encodeURIComponent(hotelCode)}` +
    `&APIKey=${encodeURIComponent(apiKey)}` +
    `&language=en`;

  try {
    const { data } = await axios.post(url, null, {
      timeout: 15000,
      headers: { Accept: "application/json, text/plain, */*" },
    });
    const rows = Array.isArray(data) ? data : [];
    const raw = rows[0];
    if (!raw || typeof raw !== "object") return null;
    return cleanHotelDetails(raw as Record<string, unknown>);
  } catch (e) {
    logger.warn("eZee HotelList fetch failed", {
      err: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}
