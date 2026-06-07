import type { LeadBooking } from "@/services/leadBookings";

export function bookingPropertyId(booking: LeadBooking): string | undefined {
  return typeof booking.propertyId === "string"
    ? booking.propertyId
    : (booking.propertyId as { _id?: string })?._id;
}

/** True when this hotel has no booking history (confirmed or cancelled) on the lead. */
export function isItineraryPendingForBookings(
  propertyId: string | undefined,
  bookings: LeadBooking[]
): boolean {
  if (!propertyId) return true;
  return !bookings.some((b) => bookingPropertyId(b) === String(propertyId));
}

export function itineraryPropertyIdFromRaw(it: { propertyId?: unknown }): string | undefined {
  if (!it?.propertyId) return undefined;
  if (typeof it.propertyId === "object" && it.propertyId !== null && "_id" in (it.propertyId as object)) {
    return String((it.propertyId as { _id: string })._id);
  }
  return String(it.propertyId);
}
