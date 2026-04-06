import type {
  IFactSheetContent,
  IPropertyDirectoryContent,
  IPropertyContact,
  IRoomCategory,
  ICityInfoItem,
} from "../models/knowledgeBase";

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function formatCityEntry(e: { name?: string; distanceOrNotes?: string }): string | null {
  if (!isNonEmptyString(e?.name)) return null;
  const n = e.name.trim();
  const d = isNonEmptyString(e.distanceOrNotes) ? e.distanceOrNotes.trim() : "";
  return d ? `${n} — ${d}` : n;
}

/** Detects pre–v2 directory rows (seed / older UI). */
export function isLegacyPropertyDirectoryContent(raw: unknown): boolean {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return false;
  const d = raw as Record<string, unknown>;
  if (d.cityInfo != null) return false;
  if (d.cityGuide != null) return true;
  const rooms = d.rooms;
  if (Array.isArray(rooms) && rooms.length > 0) {
    const r0 = rooms[0] as Record<string, unknown>;
    if (r0 && typeof r0.name === "string" && r0.category == null) return true;
  }
  const c = d.contact as Record<string, unknown> | undefined;
  if (c && (c.frontDeskPhone != null || c.frontDeskEmail != null) && c.frontDesk == null) {
    return true;
  }
  const am = d.amenities as Record<string, unknown> | undefined;
  if (am?.safetySecurity != null && am.safety == null) return true;
  return false;
}

function legacyToFactSheet(raw: Record<string, unknown>): IFactSheetContent | null {
  const d = raw as {
    contact?: Record<string, string | undefined>;
    checkInTime?: string;
    checkOutTime?: string;
    buildingHighlights?: string[];
    rooms?: Array<{ name?: string; count?: number; ac?: boolean; ensuite?: boolean }>;
    amenities?: {
      room?: string[];
      hotel?: string[];
      safetySecurity?: string[];
      frontOffice?: string[];
    };
    cityGuide?: Record<string, Array<{ name?: string; distanceOrNotes?: string }>>;
  };

  const hasSignal =
    (d.contact && Object.keys(d.contact).length > 0) ||
    (d.rooms && d.rooms.length > 0) ||
    (d.amenities &&
      Object.values(d.amenities).some((a) => Array.isArray(a) && a.length > 0)) ||
    (d.cityGuide &&
      Object.values(d.cityGuide).some((a) => Array.isArray(a) && a.length > 0)) ||
    (d.buildingHighlights && d.buildingHighlights.length > 0) ||
    isNonEmptyString(d.checkInTime) ||
    isNonEmptyString(d.checkOutTime);

  if (!hasSignal) return null;

  const c = d.contact ?? {};
  const pocDetails =
    isNonEmptyString(c.frontDeskPhone) ||
    isNonEmptyString(c.frontDeskEmail) ||
    isNonEmptyString(c.gmName) ||
    isNonEmptyString(c.gmPhone)
      ? {
          frontDeskPhone: c.frontDeskPhone?.trim(),
          frontDeskEmail: c.frontDeskEmail?.trim(),
          gmName: c.gmName?.trim(),
          gmPhone: c.gmPhone?.trim(),
        }
      : undefined;

  const addressParts = [
    c.addressLine1,
    c.addressLine2,
    [c.city, c.state].filter(Boolean).join(", "),
    c.postalCode,
  ]
    .map((x) => (typeof x === "string" ? x.trim() : ""))
    .filter(Boolean);
  const propertyAddress =
    addressParts.length > 0 ? addressParts.join("\n") : undefined;

  const roomCategories =
    d.rooms?.map((r) => ({
      name: String(r.name ?? "").trim() || "Room",
      capacity: typeof r.count === "number" ? r.count : undefined,
      isAC: !!r.ac,
    })) ?? undefined;

  const cg = d.cityGuide ?? {};
  const nearbyAttractions: string[] = [];
  for (const e of cg.attractions ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(s);
  }
  for (const e of cg.importantPlaces ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(s);
  }
  for (const e of (cg.shopping ?? []).slice(0, 4)) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(`Shopping: ${s}`);
  }

  const nearbyRestaurants: string[] = [];
  for (const e of cg.restaurants ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyRestaurants.push(s);
  }
  for (const e of cg.streetFood ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyRestaurants.push(`Street food: ${s}`);
  }

  const inHouseRules =
    d.buildingHighlights?.filter(isNonEmptyString).map((s) => s.trim()) ?? [];

  const am = d.amenities ?? {};
  const generalInfo: string[] = [];
  const pushAm = (label: string, items: string[] | undefined) => {
    for (const x of items ?? []) {
      if (isNonEmptyString(x)) generalInfo.push(`${label}: ${x.trim()}`);
    }
  };
  pushAm("Room", am.room);
  pushAm("Hotel", am.hotel);
  pushAm("Safety", am.safetySecurity);
  pushAm("Front office", am.frontOffice);

  const out: IFactSheetContent = {
    propertyAddress,
    checkInTime: isNonEmptyString(d.checkInTime) ? d.checkInTime.trim() : undefined,
    checkOutTime: isNonEmptyString(d.checkOutTime) ? d.checkOutTime.trim() : undefined,
    pocDetails,
    roomCategories:
      roomCategories && roomCategories.length > 0 ? roomCategories : undefined,
    nearbyAttractions:
      nearbyAttractions.length > 0 ? nearbyAttractions : undefined,
    nearbyRestaurants:
      nearbyRestaurants.length > 0 ? nearbyRestaurants : undefined,
    inHouseRules: inHouseRules.length > 0 ? inHouseRules : undefined,
    generalInfo: generalInfo.length > 0 ? generalInfo.slice(0, 40) : undefined,
    roomAmenities: am.room?.filter(isNonEmptyString).map((s) => s.trim()),
    hotelAmenities: am.hotel?.filter(isNonEmptyString).map((s) => s.trim()),
  };

  const cleaned = Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined && v !== null)
  ) as IFactSheetContent;

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

function v2ToFactSheet(dir: IPropertyDirectoryContent): IFactSheetContent | null {
  const c: IPropertyContact = dir.contact ?? {};
  const hasSignal =
    Object.keys(c).length > 0 ||
    (dir.buildingHighlights?.length ?? 0) > 0 ||
    (dir.rooms?.length ?? 0) > 0 ||
    Object.values(dir.amenities ?? {}).some((a) => Array.isArray(a) && a.length > 0) ||
    Object.values(dir.cityInfo ?? {}).some((a) => Array.isArray(a) && a.length > 0) ||
    isNonEmptyString(dir.address) ||
    isNonEmptyString(dir.city) ||
    isNonEmptyString(dir.region);

  if (!hasSignal) return null;

  const addressParts = [dir.address, dir.landmark, dir.city, dir.region]
    .filter((x) => isNonEmptyString(x))
    .map((x) => String(x).trim());
  const propertyAddress =
    addressParts.length > 0 ? addressParts.join("\n") : undefined;

  const pocDetails =
    isNonEmptyString(c.frontDesk) ||
    isNonEmptyString(c.email) ||
    isNonEmptyString(c.managerName) ||
    isNonEmptyString(c.managerPhone) ||
    isNonEmptyString(c.ownerName) ||
    isNonEmptyString(c.ownerPhone)
      ? {
          frontDeskPhone: c.frontDesk?.trim(),
          frontDeskEmail: c.email?.trim(),
          gmName: c.managerName?.trim(),
          gmPhone: c.managerPhone?.trim(),
        }
      : undefined;

  const roomCategories =
    dir.rooms?.map((r: IRoomCategory) => ({
      name: String(r.category ?? "").trim() || "Room",
      capacity: typeof r.count === "number" ? r.count : undefined,
      isAC: !!r.isAC,
      isDorm: false,
    })) ?? undefined;

  const ci = dir.cityInfo ?? {};
  const nearbyAttractions: string[] = [];
  for (const e of ci.attractions ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(s);
  }
  for (const e of ci.importantPlaces ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(s);
  }
  for (const e of (ci.shopping ?? []).slice(0, 4)) {
    const s = formatCityEntry(e);
    if (s) nearbyAttractions.push(`Shopping: ${s}`);
  }

  const nearbyRestaurants: string[] = [];
  for (const e of ci.restaurants ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyRestaurants.push(s);
  }
  for (const e of ci.streetFood ?? []) {
    const s = formatCityEntry(e);
    if (s) nearbyRestaurants.push(`Street food: ${s}`);
  }

  const inHouseRules =
    dir.buildingHighlights?.filter(isNonEmptyString).map((s) => s.trim()) ?? [];

  const am = dir.amenities ?? { room: [], hotel: [], safety: [], frontOffice: [] };
  const generalInfo: string[] = [];
  const pushAm = (label: string, items: string[] | undefined) => {
    for (const x of items ?? []) {
      if (isNonEmptyString(x)) generalInfo.push(`${label}: ${x.trim()}`);
    }
  };
  pushAm("Room", am.room);
  pushAm("Hotel", am.hotel);
  pushAm("Safety", am.safety);
  pushAm("Front office", am.frontOffice);

  const out: IFactSheetContent = {
    propertyAddress,
    mapLocation: c.mapLink?.trim(),
    checkInTime: dir.checkInTime?.trim(),
    checkOutTime: dir.checkOutTime?.trim(),
    pocDetails,
    roomCategories:
      roomCategories && roomCategories.length > 0 ? roomCategories : undefined,
    nearbyAttractions:
      nearbyAttractions.length > 0 ? nearbyAttractions : undefined,
    nearbyRestaurants:
      nearbyRestaurants.length > 0 ? nearbyRestaurants : undefined,
    inHouseRules: inHouseRules.length > 0 ? inHouseRules : undefined,
    generalInfo: generalInfo.length > 0 ? generalInfo.slice(0, 40) : undefined,
    roomAmenities: am.room?.filter(isNonEmptyString).map((s) => s.trim()),
    hotelAmenities: am.hotel?.filter(isNonEmptyString).map((s) => s.trim()),
  };

  if (isNonEmptyString(c.ownerName) || isNonEmptyString(c.ownerPhone)) {
    const bits = [c.ownerName, c.ownerPhone].filter(isNonEmptyString);
    if (bits.length) {
      out.generalInfo = [...(out.generalInfo ?? []), `Owner: ${bits.join(" · ")}`];
    }
  }

  const cleaned = Object.fromEntries(
    Object.entries(out).filter(([, v]) => v !== undefined && v !== null)
  ) as IFactSheetContent;

  return Object.keys(cleaned).length > 0 ? cleaned : null;
}

/**
 * Maps PROPERTY_DIRECTORY `content` (v2 or legacy) → IFactSheetContent for quotations.
 */
export function toFactSheetContent(raw: unknown): IFactSheetContent | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  if (isLegacyPropertyDirectoryContent(raw)) {
    return legacyToFactSheet(raw as Record<string, unknown>);
  }
  return v2ToFactSheet(raw as IPropertyDirectoryContent);
}

/** @deprecated use toFactSheetContent */
export const toFactSheetContentFromDirectory = toFactSheetContent;
