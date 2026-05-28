export const emptyAccountForm = {
  name: "",
  organizationType: "CORPORATE",
  customOrganizationType: "",
  conglomerateId: null as string | null,
  accountLevel: "MASTER",
  profileStatus: false,
  accountType: "ACQUISITION",
  accountTypeOverride: false,
  parentAccountId: null as string | null,
  propertyIds: [] as string[],
  zone: "",
  city: "",
  state: "",
  locality: "",
  country: "India",
  addressLine1: "",
  zip: "",
  gstin: "",
  panNumber: "",
  pmsProfileId: "",
  email: "",
  website: "",
  industryCategory: "",
  industrySubCategory: "",
  industrySize: "MEDIUM",
  contractingTypes: [] as { type: string; fromMonth?: number; toMonth?: number; fromYear?: number; toYear?: number }[],
  primaryAccountManager: { userId: "", name: "", city: "" },
  secondaryAccountManagers: [] as { userId?: string; name: string; city: string }[],
};

export type AccountFormData = typeof emptyAccountForm;

/** Stored values stay uppercase; labels are proper case for UI */
export const ACCOUNT_TYPE_OPTIONS = [
  { value: "ACQUISITION", label: "Acquisition" },
  { value: "DEVELOPMENT", label: "Development" },
  { value: "RETENTION", label: "Retention" },
] as const;

export function formatAccountTypeLabel(value: string | undefined): string {
  if (!value) return "—";
  const match = ACCOUNT_TYPE_OPTIONS.find((o) => o.value === value);
  if (match) return match.label;
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/** Stored values stay uppercase; labels are proper case for UI */
export const CONTRACTING_TYPE_OPTIONS = [
  { value: "LOCAL_CONTRACTING", label: "Local contracting" },
  { value: "LOCAL_RFP", label: "Local RFP" },
  { value: "GLOBAL_RFP", label: "Global RFP" },
  { value: "ANNUAL_CONTRACT", label: "Annual contract" },
] as const;

export function formatContractingTypeLabel(value: string | undefined): string {
  if (!value) return "—";
  const match = CONTRACTING_TYPE_OPTIONS.find((o) => o.value === value);
  if (match) return match.label;
  return value
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatContractingPeriod(entry: {
  fromMonth?: number;
  toMonth?: number;
  fromYear?: number;
  toYear?: number;
}): string {
  const fm = entry.fromMonth ?? 1;
  const tm = entry.toMonth ?? 12;
  const fy = entry.fromYear ?? new Date().getFullYear();
  const ty = entry.toYear ?? fy;
  return `${MONTH_SHORT[fm - 1] ?? fm} ${fy} → ${MONTH_SHORT[tm - 1] ?? tm} ${ty}`;
}

export function defaultContractingPeriod(): {
  fromMonth: number;
  toMonth: number;
  fromYear: number;
  toYear: number;
} {
  const fromYear = new Date().getFullYear();
  const fromMonth = 4;
  const toMonth = 3;
  const toYear = fromMonth > toMonth ? fromYear + 1 : fromYear;
  return { fromMonth, toMonth, fromYear, toYear };
}

import {
  POSTCARD_PROPERTY_NAMES,
  buildPostcardPropertyOptions,
  type PostcardPropertyOption,
} from "@/constants/postcardProperties";

export { POSTCARD_PROPERTY_NAMES as POSTCARD_ACCOUNT_PROPERTY_NAMES };

export type AccountHierarchyProperty = PostcardPropertyOption & { city?: string };

/** Map canonical property names to API property records (by name match) */
export function buildAccountHierarchyProperties(
  apiProperties: Array<{ _id: string; name: string; location?: { city?: string } }>
): AccountHierarchyProperty[] {
  return buildPostcardPropertyOptions(apiProperties).map((o) => {
    const match = apiProperties.find((p) => p._id === o.id);
    return { ...o, city: match?.location?.city };
  });
}
