import * as XLSX from "xlsx";
import { PropertyModel } from "../models/property";
import type {
  DirectoryTierLabel,
  IPropertyDirectoryContent,
  ICityInfoItem,
  IRoomCategory,
} from "../models/knowledgeBase";
import { KnowledgeBaseService } from "./knowledgeBaseService";

const SKIP_SHEETS = new Set(
  ["Contact Info", "Sheet Update Status", "contact info", "sheet update status"].map(
    (s) => s.toLowerCase()
  )
);

export const CITY_TO_REGION: Record<string, string> = {
  jaipur: "Rajasthan",
  jaisalmer: "Rajasthan",
  jodhpur: "Rajasthan",
  pushkar: "Rajasthan",
  ranthambore: "Rajasthan",
  udaipur: "Rajasthan",
  jawai: "Rajasthan",
  bir: "Himachal Pradesh",
  koksar: "Himachal Pradesh",
  manali: "Himachal Pradesh",
  mcleodganj: "Himachal Pradesh",
  mcleod: "Himachal Pradesh",
  shoja: "Himachal Pradesh",
  bhimtal: "Uttarakhand",
  mukteshwar: "Uttarakhand",
  mussoorie: "Uttarakhand",
  nainital: "Uttarakhand",
  naukuchiatal: "Uttarakhand",
  rishikesh: "Uttarakhand",
  pahalgam: "Jammu & Kashmir",
  srinagar: "Jammu & Kashmir",
  goa: "Goa",
  mandrem: "Goa",
  khajuraho: "Madhya Pradesh",
  panarpani: "Madhya Pradesh",
  delhi: "Delhi NCR",
  agra: "Delhi NCR",
  coimbatore: "Tamil Nadu",
  gangtok: "Sikkim",
  daman: "Dadra & Nagar Haveli",
  varanasi: "Uttar Pradesh",
};

function cellStr(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number" && !Number.isNaN(v)) return String(v);
  if (typeof v === "string") return v.trim();
  if (v instanceof Date) return v.toISOString();
  return String(v).trim();
}

function detectTier(text: string): DirectoryTierLabel {
  const t = text.toLowerCase();
  if (t.includes("luxuria")) return "Luxuria";
  if (t.includes("select")) return "Select";
  if (t.includes("cowork")) return "Cowork";
  if (t.includes("hostel")) return "Hostel";
  return "Hostel";
}

function inferCityRegion(name: string): { city: string; region: string } {
  const lower = name.toLowerCase();
  for (const [key, region] of Object.entries(CITY_TO_REGION)) {
    if (lower.includes(key)) {
      const city = key.charAt(0).toUpperCase() + key.slice(1);
      return { city, region };
    }
  }
  return { city: "", region: "India" };
}

function parseRoomCell(raw: string, generalInfoBlob: string): IRoomCategory | null {
  const s = raw.trim();
  if (!s) return null;
  const m = s.match(/^(.+?)\s*\((\d+)\)\s*$/);
  const category = m ? m[1].trim() : s;
  const count = m ? parseInt(m[2], 10) : 1;
  const low = category.toLowerCase();
  const gi = generalInfoBlob.toLowerCase();
  const isAC = /\bac\b|a\/c|air\s*condition/i.test(category);
  const isEnsuite =
    /ensuite|en-suite|attached\s*wash|attached\s*bath/i.test(category) ||
    /all\s*rooms?\s*ensuite/i.test(gi) ||
    /\(ensuite\)/i.test(s);
  return {
    category,
    count: Number.isFinite(count) ? count : 1,
    isAC,
    isEnsuite,
  };
}

function splitCityCell(raw: string): ICityInfoItem {
  const s = raw.trim();
  if (!s) return { name: "" };
  const dist = s.match(/\(([^)]+)\)\s*$/);
  if (dist) {
    const name = s.slice(0, s.lastIndexOf("(")).trim();
    return { name, distanceOrNotes: dist[1].trim() };
  }
  const km = s.match(/(.+?)\s+([\d.]+\s*kms?)\s*$/i);
  if (km) {
    return { name: km[1].trim(), distanceOrNotes: km[2].trim() };
  }
  return { name: s };
}

function parseSheet(
  sheetName: string,
  matrix: string[][]
): IPropertyDirectoryContent | null {
  if (!matrix.length) return null;

  const title = cellStr(matrix[0]?.[0]) || sheetName;
  if (/^sheet update|^contact info/i.test(title)) return null;

  const address = cellStr(matrix[1]?.[2]);
  const landmark = cellStr(matrix[1]?.[4]);
  const frontDesk = cellStr(matrix[2]?.[2]);
  const secondary = cellStr(matrix[2]?.[3]);
  const email = cellStr(matrix[3]?.[2]);

  let managerName: string | undefined;
  let managerPhone: string | undefined;
  if (secondary) {
    const parts = secondary.split(/\s{2,}|\t/).filter(Boolean);
    if (parts.length >= 2) {
      managerName = parts[0];
      managerPhone = parts.slice(1).join(" ");
    } else {
      const m = secondary.match(/^(.+?)\s+(\+?\d[\d\s\-]{6,})$/);
      if (m) {
        managerName = m[1].trim();
        managerPhone = m[2].trim();
      }
    }
  }

  const buildingHighlights: string[] = [];
  const rooms: IRoomCategory[] = [];
  const amenities = {
    room: [] as string[],
    hotel: [] as string[],
    safety: [] as string[],
    frontOffice: [] as string[],
  };
  let generalBlob = "";

  for (let r = 6; r < Math.min(matrix.length, 40); r++) {
    const row = matrix[r] ?? [];
    const col1 = cellStr(row[1]);
    const col2 = cellStr(row[2]);
    const col3 = cellStr(row[3]);
    const col4 = cellStr(row[4]);
    const col5 = cellStr(row[5]);
    const col6 = cellStr(row[6]);
    if (!col1 && !col2 && !col3 && !col4 && !col5 && !col6) {
      if (rooms.length || buildingHighlights.length) break;
      continue;
    }
    if (col1) {
      buildingHighlights.push(col1);
      generalBlob += ` ${col1}`;
    }
    if (col2) {
      const room = parseRoomCell(col2, generalBlob);
      if (room) rooms.push(room);
    }
    if (col3)
      col3
        .split(/[,•\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => amenities.room.push(x));
    if (col4)
      col4
        .split(/[,•\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => amenities.hotel.push(x));
    if (col5)
      col5
        .split(/[,•\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => amenities.safety.push(x));
    if (col6)
      col6
        .split(/[,•\n]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .forEach((x) => amenities.frontOffice.push(x));
  }

  const cityInfo = {
    restaurants: [] as ICityInfoItem[],
    shopping: [] as ICityInfoItem[],
    nightlife: [] as ICityInfoItem[],
    attractions: [] as ICityInfoItem[],
    importantPlaces: [] as ICityInfoItem[],
    streetFood: [] as ICityInfoItem[],
  };

  let cityStart = -1;
  for (let r = 0; r < matrix.length; r++) {
    const a = cellStr(matrix[r]?.[0]).toLowerCase();
    if (a.includes("city information")) {
      cityStart = r + 2;
      break;
    }
  }

  if (cityStart > 0) {
    for (let r = cityStart; r < matrix.length; r++) {
      const row = matrix[r] ?? [];
      const c1 = cellStr(row[1]);
      const c2 = cellStr(row[2]);
      const c3 = cellStr(row[3]);
      const c4 = cellStr(row[4]);
      const c5 = cellStr(row[5]);
      const c6 = cellStr(row[6]);
      if (!c1 && !c2 && !c3 && !c4 && !c5 && !c6) {
        if (
          cityInfo.restaurants.length ||
          cityInfo.attractions.length
        )
          break;
        continue;
      }
      if (c1) cityInfo.restaurants.push(splitCityCell(c1));
      if (c2) cityInfo.shopping.push(splitCityCell(c2));
      if (c3) cityInfo.nightlife.push(splitCityCell(c3));
      if (c4) cityInfo.attractions.push(splitCityCell(c4));
      if (c5) cityInfo.importantPlaces.push(splitCityCell(c5));
      if (c6) cityInfo.streetFood.push(splitCityCell(c6));
    }
  }

  const { city, region } = inferCityRegion(`${sheetName} ${title}`);
  const tier = detectTier(`${sheetName} ${title}`);

  return {
    tier,
    region,
    city,
    address: address || title,
    landmark: landmark || undefined,
    contact: {
      frontDesk: frontDesk || undefined,
      managerName,
      managerPhone,
      email: email || undefined,
    },
    buildingHighlights,
    rooms,
    amenities,
    cityInfo,
    importSource: "excel_import",
  };
}

async function resolvePropertyId(
  displayName: string,
  sheetName: string
): Promise<string | null> {
  const blob = `${displayName} ${sheetName}`.toLowerCase();
  const keywords = Object.keys(CITY_TO_REGION).filter((k) => blob.includes(k));
  const candidates = await PropertyModel.find({ status: "ACTIVE" }).lean();

  type Scored = { id: string; score: number };
  const scored: Scored[] = [];

  for (const p of candidates) {
    const pname = (p.name || "").toLowerCase();
    let score = 0;
    if (pname.includes(displayName.toLowerCase().slice(0, 12))) score += 5;
    for (const k of keywords) {
      if (pname.includes(k)) score += 3;
    }
    if (sheetName && pname.includes(sheetName.toLowerCase().slice(0, 8)))
      score += 2;
    if (score > 0) {
      scored.push({ id: p._id.toString(), score });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.id ?? null;
}

export interface DirectoryImportSummary {
  imported: number;
  failed: string[];
  skipped: string[];
}

export class DirectoryImportService {
  static async importWorkbook(
    buffer: Buffer,
    userId: string
  ): Promise<DirectoryImportSummary> {
    const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const failed: string[] = [];
    const skipped: string[] = [];
    let imported = 0;

    for (const sheetName of wb.SheetNames) {
      if (SKIP_SHEETS.has(sheetName.trim().toLowerCase())) {
        skipped.push(sheetName);
        continue;
      }
      const sheet = wb.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as string[][];

      const content = parseSheet(sheetName, matrix);
      if (!content) {
        skipped.push(sheetName);
        continue;
      }

      const displayName = cellStr(matrix[0]?.[0]) || sheetName;
      const propertyId = await resolvePropertyId(displayName, sheetName);
      if (!propertyId) {
        failed.push(`${sheetName}: no matching ACTIVE property`);
        continue;
      }

      await KnowledgeBaseService.upsertDirectoryEntry(
        propertyId,
        content as unknown as Record<string, unknown>,
        userId,
        "excel_import",
        false
      );
      imported += 1;
    }

    return { imported, failed, skipped };
  }
}
