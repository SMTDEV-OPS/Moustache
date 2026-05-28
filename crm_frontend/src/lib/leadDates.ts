/** Start of local calendar day (midnight). */
export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Disable check-in dates before today. */
export function disableCheckInDate(date: Date): boolean {
  return startOfDay(date) < startOfDay(new Date());
}

/** Disable check-out dates before check-in (or before today if no check-in). */
export function disableCheckoutDate(date: Date, checkIn?: Date | null): boolean {
  const day = startOfDay(date);
  if (checkIn) {
    return day < startOfDay(checkIn);
  }
  return day < startOfDay(new Date());
}

/** Nights between check-in and check-out; 0 if invalid or missing. */
export function calculateStayNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn?.trim() || !checkOut?.trim()) return 0;
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return 0;
  }
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
}

/** Parse estimated value / budget to a non-negative number; default 0. */
export function parseDealAmount(estimatedValue?: string | number | null, budget?: number | null): number {
  if (budget != null && !Number.isNaN(budget)) return Math.max(0, budget);
  if (estimatedValue == null || estimatedValue === "") return 0;
  const n =
    typeof estimatedValue === "number"
      ? estimatedValue
      : parseFloat(String(estimatedValue).replace(/[^\d.-]/g, ""));
  return Number.isNaN(n) ? 0 : Math.max(0, n);
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
