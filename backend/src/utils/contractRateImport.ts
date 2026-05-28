import type { IRateGridRow, IRateGridValue } from "../models/contract";

const DEFAULT_ROOM_TYPES = ["Superior", "Deluxe", "Premium", "Suite 1"];
const DEFAULT_RATE_SLABS = ["CAT A", "CAT B", "CAT C"];
const DEFAULT_INCLUSIONS = [
  { code: "BF", fullName: "Inclusive of Breakfast" },
  { code: "WIFI", fullName: "WiFi Included" },
];

function cell(r: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = r[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  }
  return "";
}

function num(r: Record<string, unknown>, ...keys: string[]): number {
  const s = cell(r, ...keys);
  if (!s) return 0;
  const n = Number(s);
  return Number.isNaN(n) ? 0 : n;
}

function isFullRateGridRow(r: Record<string, unknown>): boolean {
  const roomType = cell(r, "Room Type", "RoomType", "roomType");
  const cat = cell(r, "CAT", "cat", "RateSlab", "Rate Slab", "rateSlab");
  const hasOccupancy =
    cell(r, "Single", "single") !== "" ||
    cell(r, "Double", "double") !== "" ||
    cell(r, "Triple", "triple") !== "";
  return !!(roomType || cat) && (hasOccupancy || cell(r, "RN", "rn") !== "");
}

function isLegacyPricingRow(r: Record<string, unknown>): boolean {
  const roomCategory = cell(
    r,
    "roomCategory",
    "RoomCategory",
    "Room Category",
    "category",
    "Category"
  );
  const rateRaw = cell(r, "rate", "Rate");
  return !!roomCategory && rateRaw !== "";
}

function parseInclusions(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapFullRateRow(r: Record<string, unknown>): IRateGridRow | null {
  const roomType = cell(r, "Room Type", "RoomType", "roomType") || "Unknown";
  const rateSlab = cell(r, "CAT", "cat", "RateSlab", "Rate Slab", "rateSlab") || "Standard";
  if (!roomType && !rateSlab) return null;

  const channel = cell(r, "Channel", "channel").toUpperCase();
  const idBase = `${roomType}-${rateSlab}`.replace(/\s+/g, "-");
  const id = channel === "B2C" ? `${idBase}-b2c` : idBase;

  return {
    id,
    roomType,
    rateSlab,
    single: num(r, "Single", "single", "Single (₹)"),
    double: num(r, "Double", "double", "Double (₹)"),
    triple: num(r, "Triple", "triple", "Triple (₹)"),
    rn: num(r, "RN", "rn", "Room Nights"),
    inclusions: parseInclusions(cell(r, "Inclusion", "inclusion", "Inclusions", "inclusions")),
    remarks: cell(r, "Remarks", "remarks", "Additional Remarks"),
  };
}

function emptyGridRows(channel: "b2b" | "b2c"): IRateGridRow[] {
  const rows: IRateGridRow[] = [];
  for (const rt of DEFAULT_ROOM_TYPES) {
    for (const rs of DEFAULT_RATE_SLABS) {
      const idBase = `${rt}-${rs}`.replace(/\s+/g, "-");
      rows.push({
        id: channel === "b2c" ? `${idBase}-b2c` : idBase,
        roomType: rt,
        rateSlab: rs,
        single: 0,
        double: 0,
        triple: 0,
        rn: 0,
        inclusions: [],
        remarks: "",
      });
    }
  }
  return rows;
}

function createEmptyRateGridValue(): IRateGridValue {
  const inc = [...DEFAULT_INCLUSIONS];
  return {
    b2b: { rows: emptyGridRows("b2b"), inclusionNomenclature: inc, additionalRemarks: "" },
    b2c: { rows: emptyGridRows("b2c"), inclusionNomenclature: inc, additionalRemarks: "" },
    inclusionNomenclature: inc,
    additionalRemarks: "",
  };
}

export type ImportResult =
  | { format: "rateGrid"; rateGrid: IRateGridValue }
  | { format: "pricingGrid"; pricingGrid: Array<{
      roomCategory: string;
      rate: number;
      inclusions?: string;
      rn?: number;
      remarks?: string;
    }> }
  | { format: "error"; message: string };

export function importContractSpreadsheet(rows: Record<string, unknown>[]): ImportResult {
  if (!rows.length) {
    return { format: "error", message: "No data rows found in file" };
  }

  const fullFormat = rows.some(isFullRateGridRow);
  if (fullFormat) {
    const b2bRows: IRateGridRow[] = [];
    const b2cRows: IRateGridRow[] = [];

    for (const r of rows) {
      if (!isFullRateGridRow(r)) continue;
      const channel = cell(r, "Channel", "channel").toUpperCase();
      const mapped = mapFullRateRow(r);
      if (!mapped) continue;
      if (channel === "B2C") b2cRows.push(mapped);
      else b2bRows.push(mapped);
    }

    if (b2bRows.length === 0 && b2cRows.length === 0) {
      return {
        format: "error",
        message:
          "No valid rate rows. Required columns: Room Type, CAT, Single, Double, Triple, RN (optional: Inclusion, Remarks, Channel)",
      };
    }

    const base = createEmptyRateGridValue();
    const merge = (existing: IRateGridRow[], imported: IRateGridRow[]) => {
      if (imported.length === 0) return existing;
      const byId = new Map(existing.map((row) => [row.id, row]));
      for (const row of imported) byId.set(row.id, row);
      return Array.from(byId.values());
    };

    const rateGrid: IRateGridValue = {
      ...base,
      b2b: {
        ...base.b2b,
        rows: merge(base.b2b.rows, b2bRows),
      },
      b2c: {
        ...base.b2c,
        rows: merge(base.b2c.rows, b2cRows),
      },
    };

    return { format: "rateGrid", rateGrid };
  }

  const legacy = rows.filter(isLegacyPricingRow);
  if (legacy.length > 0) {
    const pricingGrid = legacy
      .map((r) => {
        const roomCategory = cell(
          r,
          "roomCategory",
          "RoomCategory",
          "Room Category",
          "category",
          "Category"
        );
        const rate = num(r, "rate", "Rate");
        if (!roomCategory || Number.isNaN(rate)) return null;
        const rnRaw = cell(r, "rn", "RN", "Room Nights");
        const rn = rnRaw ? Number(rnRaw) : undefined;
        return {
          roomCategory,
          rate,
          inclusions: cell(r, "inclusions", "Inclusions") || undefined,
          rn: rn !== undefined && !Number.isNaN(rn) ? rn : undefined,
          remarks: cell(r, "remarks", "Remarks", "Additional Remarks") || undefined,
        };
      })
      .filter(Boolean) as Array<{
        roomCategory: string;
        rate: number;
        inclusions?: string;
        rn?: number;
        remarks?: string;
      }>;

    return { format: "pricingGrid", pricingGrid };
  }

  return {
    format: "error",
    message:
      "Unrecognized format. Use full template: Room Type, CAT, Single, Double, Triple, RN, Inclusion, Remarks, Channel — or legacy: roomCategory, rate, inclusions, rn, remarks",
  };
}
