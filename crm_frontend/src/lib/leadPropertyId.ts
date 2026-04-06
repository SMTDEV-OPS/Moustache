/** Normalize populated refs / ObjectId-like values to a 24-char hex id string. */
function coerceMongoIdString(raw: unknown): string | null {
  if (raw == null) return null;
  if (typeof raw === "string") {
    const t = raw.trim();
    return t.length > 0 ? t : null;
  }
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.$oid === "string") return o.$oid;
    const nested = o._id ?? o.id;
    if (typeof nested === "string") return nested;
    if (nested != null && typeof nested === "object") {
      const inner = nested as { $oid?: unknown; toString?: () => string };
      if (typeof inner.$oid === "string") return inner.$oid;
    }
    if (typeof (o as { toString?: () => string }).toString === "function") {
      const s = String((o as { toString: () => string }).toString());
      if (/^[a-f0-9]{24}$/i.test(s)) return s;
    }
  }
  return null;
}

/** Resolve Mongo property id from a lead or nested lead on detail. */
export function extractLeadPropertyId(
  lead: unknown,
  nestedLead?: unknown
): string | null {
  const candidates: unknown[] = [
    (lead as { propertyId?: unknown })?.propertyId,
    (lead as { itineraries?: Array<{ propertyId?: unknown }> })?.itineraries?.[0]
      ?.propertyId,
    (nestedLead as { propertyId?: unknown })?.propertyId,
    (
      nestedLead as { itineraries?: Array<{ propertyId?: unknown }> }
    )?.itineraries?.[0]?.propertyId,
  ];

  for (const raw of candidates) {
    const id = coerceMongoIdString(raw);
    if (id) return id;
  }
  return null;
}
