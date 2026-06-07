import { LeadActivityModel, LeadActivityType } from "../models/leadActivity";
import { logger } from "../config/logger";

type RoomSnap = {
  propertyId?: string;
  hotelName?: string;
  roomTypeId?: string;
  roomTypeName?: string;
  mealPlanName?: string;
  ratePlanName?: string;
  estimatedRate?: number;
  rateSource?: string;
};

function flattenRoomsFromItineraries(itineraries: any[]): RoomSnap[] {
  const out: RoomSnap[] = [];
  for (const it of itineraries || []) {
    const propertyId = it?.propertyId?._id?.toString?.() || it?.propertyId?.toString?.() || undefined;
    const hotelName = it?.hotelName;
    const rooms = Array.isArray(it?.roomsRequested) ? it.roomsRequested : [];
    for (const r of rooms) {
      out.push({
        propertyId,
        hotelName,
        roomTypeId: r?.roomTypeId,
        roomTypeName: r?.roomTypeName,
        mealPlanName: r?.mealPlanName || r?.ratePlanName,
        ratePlanName: r?.ratePlanName,
        estimatedRate: r?.estimatedRate,
        rateSource: r?.rateSource,
      });
    }
  }
  return out;
}

function flattenRoomsFromHotels(hotels: any[]): RoomSnap[] {
  const out: RoomSnap[] = [];
  for (const h of hotels || []) {
    const propertyId = h?.propertyId?.toString?.() || h?.propertyId;
    const hotelName = h?.hotelName;
    const rooms = Array.isArray(h?.roomsRequested) ? h.roomsRequested : [];
    for (const r of rooms) {
      out.push({
        propertyId,
        hotelName,
        roomTypeId: r?.roomTypeId,
        roomTypeName: r?.roomTypeName,
        mealPlanName: r?.mealPlanName || r?.ratePlanName,
        ratePlanName: r?.ratePlanName,
        estimatedRate: r?.estimatedRate,
        rateSource: r?.rateSource,
      });
    }
  }
  return out;
}

function roomLabel(r: RoomSnap): string {
  return r.roomTypeName || r.roomTypeId || "Room";
}

function formatRate(n?: number): string {
  if (n === undefined || n === null || Number.isNaN(Number(n))) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

/** Log PMS room/rate changes when lead itineraries are created or replaced. */
export async function logPmsItineraryChanges(
  leadId: unknown,
  prevItineraries: any[],
  nextHotels: any[],
  performedByUserId?: unknown
): Promise<void> {
  const prev = flattenRoomsFromItineraries(prevItineraries);
  const next = flattenRoomsFromHotels(nextHotels);
  const max = Math.max(prev.length, next.length);

  for (let i = 0; i < max; i++) {
    const p = prev[i];
    const n = next[i];
    if (!n) continue;

    const roomChanged =
      !p ||
      p.roomTypeId !== n.roomTypeId ||
      p.roomTypeName !== n.roomTypeName ||
      p.mealPlanName !== n.mealPlanName ||
      p.ratePlanName !== n.ratePlanName;

    const rateChanged =
      !p ||
      p.estimatedRate !== n.estimatedRate ||
      p.rateSource !== n.rateSource;

    if (roomChanged) {
      const fromLabel = p ? roomLabel(p) : "—";
      const toLabel = roomLabel(n);
      const plan = n.mealPlanName || n.ratePlanName;
      await LeadActivityModel.create({
        leadId,
        type: LeadActivityType.PMS_ROOM_UPDATED,
        note: plan
          ? `Room: ${fromLabel} → ${toLabel}, plan ${plan}`
          : `Room: ${fromLabel} → ${toLabel}`,
        performedByUserId,
        performedAt: new Date(),
        metadata: {
          propertyId: n.propertyId,
          roomTypeId: n.roomTypeId,
          oldRoomTypeId: p?.roomTypeId,
          newRoomTypeId: n.roomTypeId,
          ratePlanName: n.ratePlanName,
        },
      });
    }

    if (rateChanged && n.estimatedRate !== undefined) {
      await LeadActivityModel.create({
        leadId,
        type: LeadActivityType.PMS_RATE_UPDATED,
        note: `Rate ${formatRate(p?.estimatedRate)}/night → ${formatRate(n.estimatedRate)}/night (${n.rateSource || "pms"})`,
        performedByUserId,
        performedAt: new Date(),
        metadata: {
          propertyId: n.propertyId,
          roomTypeId: n.roomTypeId,
          oldRate: p?.estimatedRate,
          newRate: n.estimatedRate,
          rateSource: n.rateSource,
        },
      });
    }
  }
}

/** Log initial PMS room/rate data on lead create. */
export async function logPmsItineraryOnCreate(
  leadId: unknown,
  hotels: any[],
  performedByUserId?: unknown
): Promise<void> {
  const rooms = flattenRoomsFromHotels(hotels);
  for (const r of rooms) {
    if (!r.roomTypeId && !r.estimatedRate) continue;
    const label = roomLabel(r);
    const plan = r.mealPlanName || r.ratePlanName;
    if (r.roomTypeId) {
      await LeadActivityModel.create({
        leadId,
        type: LeadActivityType.PMS_ROOM_UPDATED,
        note: plan ? `Room: ${label}, plan ${plan}` : `Room: ${label}`,
        performedByUserId,
        performedAt: new Date(),
        metadata: { propertyId: r.propertyId, roomTypeId: r.roomTypeId, ratePlanName: r.ratePlanName },
      });
    }
    if (r.estimatedRate !== undefined) {
      await LeadActivityModel.create({
        leadId,
        type: LeadActivityType.PMS_RATE_UPDATED,
        note: `Rate ${formatRate(r.estimatedRate)}/night (${r.rateSource || "pms"})`,
        performedByUserId,
        performedAt: new Date(),
        metadata: {
          propertyId: r.propertyId,
          roomTypeId: r.roomTypeId,
          newRate: r.estimatedRate,
          rateSource: r.rateSource,
        },
      });
    }
  }
}

export async function logPmsBookingCancelled(
  leadId: unknown,
  opts: {
    bookingRef?: string;
    propertyId?: string;
    performedByUserId?: unknown;
  }
): Promise<void> {
  const { bookingRef, propertyId, performedByUserId } = opts;
  const note = bookingRef ? `Booking cancelled: ref ${bookingRef}` : "PMS booking cancelled";

  try {
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.PMS_BOOKING_CANCELLED,
      note,
      performedByUserId,
      performedAt: new Date(),
      metadata: { propertyId, bookingRef },
    });
  } catch (err) {
    logger.warn("Failed to log PMS_BOOKING_CANCELLED activity", {
      leadId: String(leadId),
      bookingRef,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function logPmsBookingCreated(
  leadId: unknown,
  opts: {
    bookingRef?: string;
    propertyId?: string;
    roomCount?: number;
    grandTotal?: number;
    performedByUserId?: unknown;
  }
): Promise<void> {
  const { bookingRef, propertyId, roomCount, grandTotal, performedByUserId } = opts;
  const totalStr = grandTotal !== undefined ? formatRate(grandTotal) : undefined;
  const note = bookingRef
    ? `Booked in PMS: ref ${bookingRef}${roomCount ? `, ${roomCount} room${roomCount === 1 ? "" : "s"}` : ""}${totalStr ? `, ${totalStr}` : ""}`
    : `PMS booking created${totalStr ? `: ${totalStr}` : ""}`;

  try {
    await LeadActivityModel.create({
      leadId,
      type: LeadActivityType.PMS_BOOKING_CREATED,
      note,
      performedByUserId,
      performedAt: new Date(),
      metadata: { propertyId, bookingRef, roomCount, grandTotal },
    });
  } catch (err) {
    logger.warn("Failed to log PMS_BOOKING_CREATED activity", {
      leadId: String(leadId),
      bookingRef,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
