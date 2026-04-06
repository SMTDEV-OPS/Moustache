import type { ILead } from "../models/lead";
import type { ILeadItinerary } from "../models/leadItinerary";
import type { QuotationTier } from "../constants/quotationVisualBranding";
import { coerceTier } from "../constants/quotationVisualBranding";

/** Lean itinerary shape (from .lean()) — avoids Document typing issues */
export type QuotationItineraryLean = Pick<
  ILeadItinerary,
  "checkInDate" | "checkOutDate" | "roomsRequested" | "numberOfGuests" | "hotelName" | "createdAt"
>;

export interface QuotationStayContext {
  tier: QuotationTier;
  propertyLabel: string;
  /** e.g. "HOSTEL · JAIPUR, RAJASTHAN" */
  locationSubtitle: string;
  checkInDisplay: string;
  checkOutDisplay: string;
  roomsLine: string;
  guestsLine: string;
}

function formatLongDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function firstItinerary(
  itineraries: QuotationItineraryLean[] | null | undefined
): QuotationItineraryLean | undefined {
  if (!itineraries?.length) return undefined;
  const sorted = [...itineraries].sort(
    (a, b) =>
      new Date(a.createdAt ?? 0).getTime() -
      new Date(b.createdAt ?? 0).getTime()
  );
  return sorted[0];
}

function resolveCheckInOut(
  lead: Pick<ILead, "checkIn" | "checkOut">,
  itinerary?: QuotationItineraryLean
): { in?: Date; out?: Date } {
  const cin =
    itinerary?.checkInDate ??
    (lead.checkIn ? new Date(lead.checkIn) : undefined);
  const cout =
    itinerary?.checkOutDate ??
    (lead.checkOut ? new Date(lead.checkOut) : undefined);
  return { in: cin, out: cout };
}

export function formatRoomsLine(
  itinerary: QuotationItineraryLean | undefined,
  quoteRooms: number
): string {
  const req = itinerary?.roomsRequested;
  if (!req?.length) {
    const n = quoteRooms > 0 ? quoteRooms : 1;
    return `${n} room${n === 1 ? "" : "s"}`;
  }

  const parts: string[] = [];
  for (const r of req) {
    const q = r.quantity ?? 1;
    const name = (r.roomTypeName ?? "Room").trim() || "Room";
    parts.push(`${q} × ${name}`);
  }
  if (parts.length > 10) {
    return `${parts.slice(0, 9).join(", ")} + ${parts.length - 9} more`;
  }
  return parts.join(", ");
}

export function formatGuestsLine(
  itinerary: QuotationItineraryLean | undefined,
  lead: Pick<ILead, "adults" | "children">
): string {
  const ng = itinerary?.numberOfGuests?.trim();
  if (ng) return ng;

  let adults = 0;
  let children = 0;
  if (itinerary?.roomsRequested?.length) {
    for (const r of itinerary.roomsRequested) {
      adults += r.adults ?? 0;
      children += r.children ?? 0;
    }
  }
  if (adults + children > 0) {
    const bits: string[] = [`${adults} adult${adults === 1 ? "" : "s"}`];
    if (children > 0) bits.push(`${children} child${children === 1 ? "" : "ren"}`);
    return bits.join(", ");
  }

  const la = lead.adults ?? 0;
  const lc = lead.children ?? 0;
  if (la + lc > 0) {
    const bits: string[] = [`${la} adult${la === 1 ? "" : "s"}`];
    if (lc > 0) bits.push(`${lc} child${lc === 1 ? "" : "ren"}`);
    return bits.join(", ");
  }
  return "—";
}

function buildLocationSubtitle(
  tier: QuotationTier,
  loc?: { city?: string; state?: string }
): string {
  const tierLabel =
    tier === "LUXURIA" ? "LUXURIA" : tier === "SELECT" ? "SELECT" : "HOSTEL";
  const city = (loc?.city ?? "").trim();
  const state = (loc?.state ?? "").trim();
  if (city && state) return `${tierLabel} · ${city.toUpperCase()}, ${state.toUpperCase()}`;
  if (city) return `${tierLabel} · ${city.toUpperCase()}`;
  if (state) return `${tierLabel} · ${state.toUpperCase()}`;
  return tierLabel;
}

/**
 * Build stay summary for quotation email from lead, optional property, and itineraries.
 */
export function buildQuotationStayContext(
  lead: ILead,
  itineraries: QuotationItineraryLean[] | null | undefined,
  property: {
    name?: string;
    tier?: string;
    location?: { city?: string; state?: string };
  } | null,
  quoteRooms: number
): QuotationStayContext {
  const tier = coerceTier(property?.tier);
  const it = firstItinerary(itineraries ?? []);
  const { in: dIn, out: dOut } = resolveCheckInOut(lead, it);

  const checkInDisplay = dIn ? formatLongDate(dIn) : "To be confirmed";
  const checkOutDisplay = dOut ? formatLongDate(dOut) : "To be confirmed";

  const propertyLabel =
    (property?.name?.trim() ||
      it?.hotelName?.trim() ||
      "Our Property") ?? "Our Property";

  return {
    tier,
    propertyLabel,
    locationSubtitle: buildLocationSubtitle(tier, property?.location),
    checkInDisplay,
    checkOutDisplay,
    roomsLine: formatRoomsLine(it, quoteRooms),
    guestsLine: formatGuestsLine(it, lead),
  };
}
