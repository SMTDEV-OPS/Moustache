import type { IPropertyDirectoryContent } from "../models/knowledgeBase";

/** Collapse whitespace and fix common misspellings used in QA searches. */
export function normalizeSearchQuery(q: string): string {
  let s = q.toLowerCase().trim().replace(/\s+/g, " ");
  s = s.replace(/jaccuzi/g, "jacuzzi");
  s = s.replace(/swimming\s*pool/g, "swimming pool");
  return s;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function includesNeedle(haystack: string, needle: string): boolean {
  return norm(haystack).includes(needle);
}

function titleCasePhrase(needle: string): string {
  return needle
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/**
 * Human-readable match lines for directory deep search (legacy + v2 shapes).
 */
export function collectDirectoryMatchReasons(
  raw: unknown,
  needleNorm: string
): string[] {
  if (!needleNorm || raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return [];
  }
  const d = raw as Record<string, unknown>;
  const reasons: string[] = [];

  const checkList = (items: string[] | undefined, label: string) => {
    for (const item of items ?? []) {
      if (typeof item !== "string") continue;
      if (includesNeedle(item, needleNorm)) {
        reasons.push(`${item.trim()} in ${label}`);
      }
    }
  };

  if (typeof d.address === "string" && includesNeedle(d.address, needleNorm)) {
    reasons.push(`Address matches "${titleCasePhrase(needleNorm)}"`);
  }
  if (typeof d.landmark === "string" && includesNeedle(d.landmark, needleNorm)) {
    reasons.push(`Landmark matches "${titleCasePhrase(needleNorm)}"`);
  }

  checkList(d.buildingHighlights as string[] | undefined, "building highlights");

  const rooms = d.rooms as unknown[] | undefined;
  if (Array.isArray(rooms)) {
    for (const r of rooms) {
      if (!r || typeof r !== "object") continue;
      const row = r as Record<string, unknown>;
      const cat =
        typeof row.category === "string"
          ? row.category
          : typeof row.name === "string"
            ? row.name
            : "";
      if (cat && includesNeedle(cat, needleNorm)) {
        reasons.push(`${titleCasePhrase(needleNorm)} in ${cat.trim()}`);
      }
      if (typeof row.notes === "string" && includesNeedle(row.notes, needleNorm)) {
        reasons.push(`Room notes match in ${cat || "room"}`);
      }
    }
  }

  const am = (d.amenities ?? {}) as Record<string, unknown>;
  checkList(am.room as string[] | undefined, "room amenities");
  checkList(am.hotel as string[] | undefined, "hotel amenities");
  checkList(am.safety as string[] | undefined, "safety and security");
  checkList(am.safetySecurity as string[] | undefined, "safety and security");
  checkList(am.frontOffice as string[] | undefined, "front office");

  const cityInfo = (d.cityInfo ?? {}) as IPropertyDirectoryContent["cityInfo"];
  const cityGuide = (d.cityGuide ?? {}) as Record<
    string,
    Array<{ name?: string; distanceOrNotes?: string }>
  >;

  const scanCitySection = (
    arr: Array<{ name?: string; distanceOrNotes?: string }> | undefined,
    label: string
  ) => {
    for (const e of arr ?? []) {
      const n = typeof e?.name === "string" ? e.name : "";
      const note = typeof e?.distanceOrNotes === "string" ? e.distanceOrNotes : "";
      const blob = `${n} ${note}`;
      if (includesNeedle(blob, needleNorm)) {
        reasons.push(`"${n.trim()}" in ${label}`);
      }
    }
  };

  if (cityInfo) {
    scanCitySection(cityInfo.restaurants, "restaurants and cafes");
    scanCitySection(cityInfo.shopping, "shopping");
    scanCitySection(cityInfo.nightlife, "nightlife");
    scanCitySection(cityInfo.attractions, "attractions");
    scanCitySection(cityInfo.importantPlaces, "important places");
    scanCitySection(cityInfo.streetFood, "street food");
  }

  const cgLabels: Record<string, string> = {
    restaurants: "restaurants and cafes",
    shopping: "shopping",
    nightlife: "nightlife",
    attractions: "attractions",
    importantPlaces: "important places",
    streetFood: "street food",
  };
  for (const [key, label] of Object.entries(cgLabels)) {
    scanCitySection(cityGuide[key], label);
  }

  const c = (d.contact ?? {}) as Record<string, unknown>;
  const contactBlob = [
    c.frontDesk,
    c.frontDeskPhone,
    c.email,
    c.frontDeskEmail,
    c.managerName,
    c.managerPhone,
    c.gmName,
    c.gmPhone,
    c.ownerName,
    c.ownerPhone,
    c.addressLine1,
    c.city,
    c.state,
  ]
    .filter((x) => typeof x === "string")
    .join(" ");
  if (includesNeedle(contactBlob, needleNorm)) {
    reasons.push(`Contact details match "${titleCasePhrase(needleNorm)}"`);
  }

  if (
    typeof d.checkInTime === "string" &&
    includesNeedle(d.checkInTime, needleNorm)
  ) {
    reasons.push(`Check-in time matches`);
  }
  if (
    typeof d.checkOutTime === "string" &&
    includesNeedle(d.checkOutTime, needleNorm)
  ) {
    reasons.push(`Check-out time matches`);
  }

  return reasons;
}
