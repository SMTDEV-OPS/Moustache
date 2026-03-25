import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  isValidPhoneNumber,
  type CountryCode,
} from "libphonenumber-js";

/** Strip spaces; keep leading + and digits. */
export function normalizePhoneE164(value: string): string {
  return value.replace(/\s+/g, "").trim();
}

const regionNames = typeof Intl !== "undefined" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;

/**
 * One row per territory (ISO), sorted by label for stable dropdown order.
 * SearchableSelect searches by label.
 */
export const COUNTRY_PHONE_OPTIONS: { value: string; label: string }[] = getCountries()
  .map((iso) => {
    const code = getCountryCallingCode(iso as CountryCode);
    const name = regionNames?.of(iso) ?? iso;
    return {
      value: iso,
      label: `${name} (+${code})`,
    };
  })
  .sort((a, b) => a.label.localeCompare(b.label));

/**
 * Longest-prefix match rows for incomplete / non-parseable numbers.
 * Same dial code appears for multiple territories (e.g. US/CA); first match wins for fallback only.
 */
const DIAL_PREFIX_ROWS: { dial: string; iso: CountryCode }[] = (() => {
  const rows = getCountries().map((iso) => ({
    dial: `+${getCountryCallingCode(iso as CountryCode)}`,
    iso: iso as CountryCode,
  }));
  rows.sort((a, b) => b.dial.length - a.dial.length);
  return rows;
})();

const DEFAULT_ISO: CountryCode = "IN";

/**
 * Split stored E.164 (+…) into ISO territory + national digits for the form.
 * Uses libphonenumber when possible; otherwise longest matching ITU prefix (fixes +44 vs +447, etc.).
 */
export function parsePhoneForForm(value: string | undefined): {
  iso: CountryCode;
  nationalDigits: string;
} {
  const normalized = normalizePhoneE164(value ?? "");
  if (!normalized) {
    return { iso: DEFAULT_ISO, nationalDigits: "" };
  }

  const parsed = parsePhoneNumberFromString(normalized);
  if (parsed?.country) {
    return {
      iso: parsed.country,
      nationalDigits: parsed.nationalNumber,
    };
  }

  if (!normalized.startsWith("+")) {
    return { iso: DEFAULT_ISO, nationalDigits: normalized.replace(/\D/g, "") };
  }

  for (const row of DIAL_PREFIX_ROWS) {
    if (normalized.startsWith(row.dial)) {
      const national = normalized.slice(row.dial.length).replace(/\D/g, "");
      return { iso: row.iso, nationalDigits: national };
    }
  }

  return {
    iso: DEFAULT_ISO,
    nationalDigits: normalized.slice(1).replace(/\D/g, ""),
  };
}

export function buildE164FromIso(iso: CountryCode, nationalDigits: string): string {
  const digits = nationalDigits.replace(/\D/g, "");
  if (!digits) return "";
  return `+${getCountryCallingCode(iso)}${digits}`;
}

export function isValidE164Phone(value: string): boolean {
  const n = normalizePhoneE164(value);
  if (!n.startsWith("+")) return false;
  return isValidPhoneNumber(n);
}
