import { DEFAULT_RATE_SLABS } from "@/models/contract";
import type { RateGridRow } from "@/models/contract";

/** Ordered CAT slabs: always CAT A/B/C first, then any extras from data */
export function getOrderedSlabs(rows: RateGridRow[]): string[] {
  const fromData = [...new Set(rows.map((r) => r.rateSlab).filter(Boolean))];
  const ordered: string[] = [...DEFAULT_RATE_SLABS];
  for (const slab of fromData) {
    if (!ordered.includes(slab)) ordered.push(slab);
  }
  return ordered;
}

export function rowsForSlab(rows: RateGridRow[], slab: string): RateGridRow[] {
  return rows.filter((r) => r.rateSlab === slab);
}

export function uniqueRoomTypes(rows: RateGridRow[]): string[] {
  return [...new Set(rows.map((r) => r.roomType).filter(Boolean))];
}
