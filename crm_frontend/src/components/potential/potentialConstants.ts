import type { LocationType, SegmentType } from "@/services/accountPotentials";

export const SEGMENT_FIELDS: Record<string, string[]> = {
  LUXURY: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential", "fbPotential", "spaPotential"],
  UPPER_UPSCALE: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential", "fbPotential", "spaPotential"],
  UPSCALE: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential"],
  MID_SEGMENT: ["fitPotential", "groupPotential", "longStayPotential", "banquetPotential"],
  BUDGET: ["fitPotential", "groupPotential", "banquetPotential"],
  GUEST_HOUSE: ["fitPotential", "groupPotential", "banquetPotential"],
};

export const FIELD_LABELS: Record<string, { label: string; color: string; type: "room" | "event" }> = {
  fitPotential: { label: "FIT Potential", color: "blue", type: "room" },
  groupPotential: { label: "Group Potential", color: "emerald", type: "room" },
  longStayPotential: { label: "Long Stay Potential", color: "amber", type: "room" },
  banquetPotential: { label: "Banquet Potential", color: "purple", type: "event" },
  fbPotential: { label: "F&B Potential", color: "rose", type: "event" },
  spaPotential: { label: "Spa & Wellness", color: "teal", type: "event" },
};

export const emptyRoomPotential = { roomNights: 0, roomRevenue: 0, actualRoomNights: 0, actualRoomRevenue: 0 };
export const emptyEventPotential = { events: 0, revenue: 0, actualEvents: 0, actualRevenue: 0 };

export const LOCATION_OPTIONS: { value: LocationType; label: string }[] = [
  { value: "CBD", label: "CBD" },
  { value: "MICRO_MARKET", label: "Micro Market" },
  { value: "INDUSTRIAL_BELT", label: "Industrial Belt" },
  { value: "NORTH_GEO", label: "North Geo" },
  { value: "SOUTH_GEO", label: "South Geo" },
  { value: "CUSTOM", label: "Custom" },
];

export const SEGMENT_OPTIONS: { value: SegmentType; label: string }[] = [
  { value: "LUXURY", label: "Luxury" },
  { value: "UPPER_UPSCALE", label: "Upper Upscale" },
  { value: "UPSCALE", label: "Upscale" },
  { value: "MID_SEGMENT", label: "Mid Segment" },
  { value: "BUDGET", label: "Budget" },
  { value: "GUEST_HOUSE", label: "Guest House" },
];

export const SEGMENT_COLORS: Record<string, { border: string; header: string }> = {
  LUXURY: { border: "border-l-amber-500", header: "bg-muted/40 border-border" },
  UPPER_UPSCALE: { border: "border-l-purple-500", header: "bg-muted/40 border-border" },
  UPSCALE: { border: "border-l-blue-500", header: "bg-muted/40 border-border" },
  MID_SEGMENT: { border: "border-l-emerald-500", header: "bg-muted/40 border-border" },
  BUDGET: { border: "border-l-slate-500", header: "bg-muted/40 border-border" },
  GUEST_HOUSE: { border: "border-l-teal-500", header: "bg-muted/40 border-border" },
};

export type ComboRow = { id: string; location: LocationType; segment: SegmentType };

export function getSegmentFields(segment: string): string[] {
  return SEGMENT_FIELDS[segment] || SEGMENT_FIELDS.LUXURY;
}

export function defaultComboData(): Record<string, object> {
  return {
    "1": {
      fitPotential: { ...emptyRoomPotential },
      groupPotential: { ...emptyRoomPotential },
      longStayPotential: { ...emptyRoomPotential },
      banquetPotential: { ...emptyEventPotential },
      fbPotential: { ...emptyEventPotential },
      spaPotential: { ...emptyEventPotential },
      competitors: [],
    },
  };
}
