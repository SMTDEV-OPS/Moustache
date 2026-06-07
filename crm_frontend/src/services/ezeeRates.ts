import { useEffect, useState } from "react";
import { API_BASE_URL, withAuthHeaders } from "@/services/api";
import { getEzeeSeparateSourceMappingCached, type EzeeSeparateSourceMapping } from "@/services/pms";

export type MealPlanOption = { id: string; name: string };
export type EzeeRatesLookupMap = Record<string, { base: number; extraAdult?: number; extraChild?: number }>;

export type PmsRatePatch = {
  baseRate: number | "";
  extraAdultRate?: number;
  extraChildRate?: number;
  ratePlanId?: string;
  ratePlanName?: string;
  rateUnavailable: boolean;
};

export type RoomRateFieldsValue = {
  mealPlanId?: string;
  mealPlanName?: string;
  ratePlanId?: string;
  ratePlanName?: string;
  estimatedRate?: number;
  extraAdultRate?: number;
  extraChildRate?: number;
  rateSource?: "pms" | "manual";
};

function isDefaultUnmappedName(name: unknown): boolean {
  return String(name || "")
    .trim()
    .toLowerCase()
    .includes("default unmapped");
}

export function isEzeeDefaultUnmappedRateType(
  mapping: EzeeSeparateSourceMapping | undefined,
  rateTypeId: string | undefined
): boolean {
  const id = String(rateTypeId || "").trim();
  if (!id || !mapping) return false;
  const rt = (mapping.rateTypes ?? []).find((x) => String(x.id || "").trim() === id);
  return isDefaultUnmappedName(rt?.name);
}

function normName(s?: string) {
  const raw = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\(a\/c\)|a\/c|a\\\/c/gi, "ac")
    .replace(/non\s*-?\s*ac/gi, "non ac")
    .replace(/&/g, " and ")
    .replace(/\bwith\b/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return raw;
}

export function resolveEzeeRoomTypeId(
  mapping: EzeeSeparateSourceMapping | undefined,
  roomTypeId?: string,
  roomTypeName?: string
): string | undefined {
  const rid = roomTypeId?.trim();
  if (rid && (mapping?.roomTypes ?? []).some((rt) => rt.id?.trim() === rid)) return rid;
  const n = normName(roomTypeName);
  if (!n) return rid || undefined;
  const mRoomTypes = mapping?.roomTypes ?? [];
  const hits = mRoomTypes.filter((rt) => normName(rt.name) === n);
  if (hits.length === 1) return hits[0].id?.trim() || rid || undefined;
  const fuzzy = mRoomTypes.filter((rt) => {
    const rn = normName(rt.name);
    if (!rn) return false;
    return rn.includes(n) || n.includes(rn);
  });
  if (fuzzy.length === 1) return fuzzy[0].id?.trim() || rid || undefined;
  return rid || undefined;
}

export function resolveEzeeRoomType(
  mapping: EzeeSeparateSourceMapping | undefined,
  roomTypeId?: string,
  roomTypeName?: string
) {
  const rid = resolveEzeeRoomTypeId(mapping, roomTypeId, roomTypeName);
  if (!mapping || !rid) return undefined;
  const hit = (mapping.roomTypes ?? []).find((rt) => rt.id?.trim() === rid);
  if (!hit) return undefined;
  if (isDefaultUnmappedName(hit.name)) return undefined;
  return { id: hit.id.trim(), name: (hit.name || "").trim() || `Room ${hit.id.trim()}` };
}

export function roomTypeOptionsFromMapping(
  mapping: EzeeSeparateSourceMapping | undefined
): { id: string; name: string }[] {
  return (mapping?.roomTypes ?? [])
    .map((rt) => ({ id: String(rt.id || "").trim(), name: String(rt.name || "").trim() }))
    .filter((rt) => rt.id && !isDefaultUnmappedName(rt.name))
    .map((rt) => ({ id: rt.id, name: rt.name || `Room ${rt.id}` }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function mealPlanOptionsForRoomType(
  mapping: EzeeSeparateSourceMapping | undefined,
  roomTypeId?: string,
  roomTypeName?: string
): MealPlanOption[] {
  if (!mapping) return [];
  const rid = resolveEzeeRoomTypeId(mapping, roomTypeId, roomTypeName);
  if (!rid) return [];

  const plans = (mapping.ratePlans ?? [])
    .map((p) => ({
      roomTypeId: String(p.roomTypeId || "").trim(),
      rateTypeId: String(p.rateTypeId || "").trim(),
      id: String(p.id || "").trim(),
      name: String(p.name || "").trim(),
    }))
    .filter((p) => p.roomTypeId === rid)
    .filter((p) => p.id && !isDefaultUnmappedName(p.name))
    .filter((p) => p.rateTypeId && !isEzeeDefaultUnmappedRateType(mapping, p.rateTypeId));

  const uniqueRateTypeIds = Array.from(new Set(plans.map((p) => p.rateTypeId)));
  const out: MealPlanOption[] = [];
  for (const rateTypeId of uniqueRateTypeIds) {
    const rt = (mapping.rateTypes ?? []).find((x) => String(x.id || "").trim() === rateTypeId);
    const name = String(rt?.name || "").trim();
    out.push({ id: rateTypeId, name: name || "Meal plan" });
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function resolveRatePlanForSelection(
  mapping: EzeeSeparateSourceMapping | undefined,
  roomTypeId: string | undefined,
  roomTypeName: string | undefined,
  rateTypeId: string | undefined
): { ratePlanId: string; ratePlanName: string } | undefined {
  if (!mapping) return undefined;
  const rid = resolveEzeeRoomTypeId(mapping, roomTypeId, roomTypeName);
  const rtId = String(rateTypeId || "").trim();
  if (!rid || !rtId) return undefined;
  if (isEzeeDefaultUnmappedRateType(mapping, rtId)) return undefined;

  const matched = (mapping.ratePlans ?? [])
    .map((p) => ({
      id: String(p.id || "").trim(),
      roomTypeId: String(p.roomTypeId || "").trim(),
      rateTypeId: String(p.rateTypeId || "").trim(),
      name: String(p.name || "").trim(),
    }))
    .filter((p) => p.id && !isDefaultUnmappedName(p.name))
    .filter((p) => p.roomTypeId === rid && p.rateTypeId === rtId);

  if (matched.length === 0) return undefined;
  matched.sort((a, b) => (a.name || a.id).localeCompare(b.name || b.id));
  const first = matched[0];
  return { ratePlanId: first.id, ratePlanName: first.name || `Rate plan ${first.id}` };
}

export function rateLookupKey(
  roomTypeId: string | undefined,
  ratePlanId: string | undefined
): string | undefined {
  const rt = String(roomTypeId || "").trim();
  const rp = String(ratePlanId || "").trim();
  if (!rt || !rp) return undefined;
  return `${rt}_${rp}`;
}

export function pmsRatePatchFromLookup(
  key: string | undefined,
  rateMap: EzeeRatesLookupMap | undefined
): Pick<PmsRatePatch, "baseRate" | "extraAdultRate" | "extraChildRate" | "rateUnavailable"> {
  if (!key || !rateMap) {
    return { baseRate: "", extraAdultRate: undefined, extraChildRate: undefined, rateUnavailable: false };
  }
  const hit = rateMap[key];
  if (hit?.base !== undefined) {
    return {
      baseRate: hit.base,
      extraAdultRate: hit.extraAdult,
      extraChildRate: hit.extraChild,
      rateUnavailable: false,
    };
  }
  return { baseRate: "", extraAdultRate: undefined, extraChildRate: undefined, rateUnavailable: true };
}

export function buildRateFieldsFromPms(
  mapping: EzeeSeparateSourceMapping | undefined,
  rateMap: EzeeRatesLookupMap | undefined,
  roomTypeId: string | undefined,
  roomTypeName: string | undefined,
  mealPlanId: string | undefined
): RoomRateFieldsValue {
  const plan = resolveRatePlanForSelection(mapping, roomTypeId, roomTypeName, mealPlanId);
  const key = rateLookupKey(roomTypeId, plan?.ratePlanId);
  const patch = pmsRatePatchFromLookup(key, rateMap);
  const mealOpts = mealPlanOptionsForRoomType(mapping, roomTypeId, roomTypeName);
  const mealName = mealOpts.find((m) => m.id === mealPlanId)?.name;
  return {
    mealPlanId,
    mealPlanName: mealName,
    ratePlanId: plan?.ratePlanId,
    ratePlanName: plan?.ratePlanName,
    estimatedRate: patch.baseRate === "" ? undefined : Number(patch.baseRate),
    extraAdultRate: patch.extraAdultRate,
    extraChildRate: patch.extraChildRate,
    rateSource: "pms",
  };
}

export async function fetchEzeeRatesLookup(
  hotelId: string,
  fromDate: string,
  toDate: string
): Promise<EzeeRatesLookupMap> {
  const q = new URLSearchParams({ hotelId, fromDate, toDate });
  const res = await fetch(`${API_BASE_URL}/api/ezee/rates?${q.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) return {};
  return (await res.json()) as EzeeRatesLookupMap;
}

export function useEzeeRatesForProperty(
  propertyId: string | undefined,
  fromDate: string | undefined,
  toDate: string | undefined
) {
  const [mapping, setMapping] = useState<EzeeSeparateSourceMapping | undefined>();
  const [rateMap, setRateMap] = useState<EzeeRatesLookupMap>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!propertyId || !fromDate || !toDate) {
      setMapping(undefined);
      setRateMap({});
      setLoading(false);
      return;
    }
    if (new Date(fromDate) >= new Date(toDate)) return;

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    Promise.all([
      getEzeeSeparateSourceMappingCached(propertyId),
      fetchEzeeRatesLookup(propertyId, fromDate, toDate),
    ])
      .then(([m, rates]) => {
        if (cancelled) return;
        setMapping(m);
        setRateMap(rates);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load PMS rates");
        setMapping(undefined);
        setRateMap({});
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [propertyId, fromDate, toDate]);

  return { mapping, rateMap, loading, error };
}
