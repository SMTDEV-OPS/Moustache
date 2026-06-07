import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import type { IPropertyDirectoryContent } from "@/services/knowledgeBase";

/** Title + MetaSearch field key (matches backend quotationEmailTemplate). */
export const PMS_DETAIL_SECTIONS: [string, string][] = [
  ["About the property", "Hotel_Description"],
  ["Facilities", "Facilities_Attractions"],
  ["Check-in & check-out", "CheckIn_Policy"],
  ["House rules", "Hotel_Policy"],
  ["Cancellation", "Cancellation_Policy"],
  ["Parking", "Parking_Policy"],
  ["Children & extra guests", "Children_ExtraGuest_Details"],
  ["Dining & activities", "ThingsToDo"],
  ["Directions", "Travel_Directions"],
  ["Nearby", "Landmarks_Nearby"],
  ["Booking conditions", "Booking_Conditions"],
];

export type PmsHotelDetailsResponse = {
  tier?: string;
  details?: Record<string, unknown>;
  error?: string;
};

export function pmsField(
  details: Record<string, unknown> | null | undefined,
  key: string
): string {
  if (!details) return "";
  const v = details[key];
  return typeof v === "string" ? v.trim() : "";
}

export async function fetchPmsHotelDetails(
  propertyId: string
): Promise<PmsHotelDetailsResponse> {
  const res = await fetch(`${API_BASE_URL}/api/ezee/hotel-details`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ hotelId: propertyId }),
  });
  if (!res.ok) throw new Error("hotel-details failed");
  return (await res.json()) as PmsHotelDetailsResponse;
}

export function hasKbOverviewContent(
  content: IPropertyDirectoryContent | null | undefined
): boolean {
  if (!content) return false;
  const contact = content.contact;
  const phone =
    contact?.frontDesk ||
    contact?.frontDeskPhone ||
    contact?.managerPhone ||
    "";
  const email = contact?.email || contact?.frontDeskEmail || "";
  const highlights = (content.buildingHighlights ?? []).filter(Boolean);
  return Boolean(
    phone.trim() ||
      email.trim() ||
      content.address?.trim() ||
      highlights.length > 0
  );
}

export function pmsOverviewSections(
  details: Record<string, unknown>
): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const about = pmsField(details, "Hotel_Description");
  if (about) out.push({ title: "About the property", body: about });
  const type = pmsField(details, "Property_Type");
  if (type) out.push({ title: "Property type", body: type });
  for (const [title, key] of PMS_DETAIL_SECTIONS) {
    if (key === "Hotel_Description") continue;
    if (["Facilities_Attractions", "ThingsToDo", "Landmarks_Nearby", "Travel_Directions"].includes(key)) {
      continue;
    }
    const body = pmsField(details, key);
    if (body) out.push({ title, body });
  }
  return out;
}

export function pmsAmenitiesSections(
  details: Record<string, unknown>
): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  for (const key of ["Facilities_Attractions", "ThingsToDo"] as const) {
    const body = pmsField(details, key);
    if (body) {
      out.push({
        title: key === "Facilities_Attractions" ? "Facilities" : "Dining & activities",
        body,
      });
    }
  }
  return out;
}

export function pmsCitySections(
  details: Record<string, unknown>
): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  const cityLine = [pmsField(details, "City"), pmsField(details, "State"), pmsField(details, "Country")]
    .filter(Boolean)
    .join(", ");
  if (cityLine) out.push({ title: "Location", body: cityLine });
  for (const [title, key] of [
    ["Nearby", "Landmarks_Nearby"],
    ["Directions", "Travel_Directions"],
  ] as const) {
    const body = pmsField(details, key);
    if (body) out.push({ title, body });
  }
  return out;
}

export function pmsHasAnyDetails(details: Record<string, unknown> | null | undefined): boolean {
  if (!details) return false;
  return Object.values(details).some((v) => typeof v === "string" && v.trim().length > 0);
}
