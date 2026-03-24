/** Rate grid row: room type + rate slab (CAT) with occupancy rates */
export interface RateGridRow {
  id: string;
  roomType: string;
  rateSlab: string;
  single: number;
  double: number;
  triple: number;
  rn: number;
  inclusions: string[];
  remarks: string;
}

/** Inclusion code and full name mapping */
export interface InclusionNomenclature {
  code: string;
  fullName: string;
}

/** Full rate grid data for B2B or B2C */
export interface RateGridData {
  rows: RateGridRow[];
  inclusionNomenclature: InclusionNomenclature[];
  additionalRemarks: string;
}

/** Combined B2B + B2C rate grid value (both saved together) */
export interface RateGridValue {
  b2b: RateGridData;
  b2c: RateGridData;
  inclusionNomenclature: InclusionNomenclature[];
  additionalRemarks: string;
}

/** Default room types and rate slabs (configurable) */
export const DEFAULT_ROOM_TYPES = ["Superior", "Deluxe", "Premium", "Suite 1"] as const;
export const DEFAULT_RATE_SLABS = ["CAT A", "CAT B", "CAT C"] as const;

/** Default inclusion nomenclature */
export const DEFAULT_INCLUSIONS: InclusionNomenclature[] = [
  { code: "BF", fullName: "Inclusive of Breakfast" },
  { code: "WIFI", fullName: "WiFi Included" },
];

export function createEmptyRow(roomType: string, rateSlab: string): RateGridRow {
  return {
    id: `${roomType}-${rateSlab}`.replace(/\s+/g, "-"),
    roomType,
    rateSlab,
    single: 0,
    double: 0,
    triple: 0,
    rn: 0,
    inclusions: [],
    remarks: "",
  };
}

export function createEmptyGrid(
  roomTypes: string[] = [...DEFAULT_ROOM_TYPES],
  rateSlabs: string[] = [...DEFAULT_RATE_SLABS]
): RateGridData {
  const rows: RateGridRow[] = [];
  for (const rt of roomTypes) {
    for (const rs of rateSlabs) {
      rows.push(createEmptyRow(rt, rs));
    }
  }
  return {
    rows,
    inclusionNomenclature: [...DEFAULT_INCLUSIONS],
    additionalRemarks: "",
  };
}

export function createEmptyRateGridValue(
  roomTypes?: string[],
  rateSlabs?: string[]
): RateGridValue {
  const empty = createEmptyGrid(roomTypes, rateSlabs);
  const b2cRows = empty.rows.map((r) => ({ ...r, id: `${r.id}-b2c` }));
  return {
    b2b: { ...empty, rows: empty.rows.map((r) => ({ ...r })) },
    b2c: { ...empty, rows: b2cRows },
    inclusionNomenclature: [...DEFAULT_INCLUSIONS],
    additionalRemarks: "",
  };
}

/** Normalize API response to valid RateGridValue */
export function normalizeRateGridValue(raw: unknown): RateGridValue {
  const v = raw as Partial<RateGridValue>;
  const inc = v?.inclusionNomenclature ?? DEFAULT_INCLUSIONS;
  const emptyRow = (r: Partial<RateGridRow>): RateGridRow => ({
    id: r?.id ?? "",
    roomType: r?.roomType ?? "",
    rateSlab: r?.rateSlab ?? "",
    single: Number(r?.single) || 0,
    double: Number(r?.double) || 0,
    triple: Number(r?.triple) || 0,
    rn: Number(r?.rn) || 0,
    inclusions: Array.isArray(r?.inclusions) ? r.inclusions : [],
    remarks: String(r?.remarks ?? ""),
  });
  const b2bRows = Array.isArray(v?.b2b?.rows) ? v.b2b.rows.map(emptyRow) : [];
  const b2cRows =
    Array.isArray(v?.b2c?.rows) && v.b2c.rows.length > 0
      ? v.b2c.rows.map(emptyRow)
      : b2bRows.length > 0
        ? b2bRows.map((r) => ({ ...r, id: `${r.roomType}-${r.rateSlab}`.replace(/\s+/g, "-") + "-b2c", single: 0, double: 0, triple: 0, rn: 0, inclusions: [], remarks: "" }))
        : createEmptyGrid().rows.map((r) => ({ ...r, id: `${r.id}-b2c` }));
  return {
    b2b: {
      rows: b2bRows,
      inclusionNomenclature: inc,
      additionalRemarks: String(v?.b2b?.additionalRemarks ?? v?.additionalRemarks ?? ""),
    },
    b2c: {
      rows: b2cRows,
      inclusionNomenclature: inc,
      additionalRemarks: String(v?.b2c?.additionalRemarks ?? v?.additionalRemarks ?? ""),
    },
    inclusionNomenclature: inc,
    additionalRemarks: String(v?.additionalRemarks ?? ""),
  };
}
