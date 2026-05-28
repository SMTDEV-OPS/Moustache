/** Field sales lead source → backend LeadSource enum */
export const FIELD_SALES_SOURCES = [
  { value: "DOMESTIC_TA", label: "Domestic TA" },
  { value: "INBOUND_TA", label: "Inbound TA" },
  { value: "FTO", label: "FTO" },
  { value: "DIRECT_GUEST", label: "Direct Guest" },
  { value: "CORPORATE_COMPANY", label: "Corporate company" },
  { value: "EVENT_MGMT", label: "Event Management Company" },
  { value: "WEDDING_PLANNER", label: "Wedding Planner" },
] as const;

export const SOURCES_REQUIRING_ACCOUNT = new Set([
  "DOMESTIC_TA",
  "INBOUND_TA",
  "CORPORATE_COMPANY",
  "EVENT_MGMT",
  "WEDDING_PLANNER",
]);

export const MEAL_PLAN_OPTIONS = ["EP", "CP", "MAP", "AP"] as const;

/** Leisure occasions first, then corporate */
export const OCCASION_OPTIONS = [
  "Honeymoon",
  "Anniversary",
  "Birthday",
  "Family vacation",
  "Weekend getaway",
  "Leisure / Holiday",
  "MICE",
  "Wedding",
  "Corporate offsite",
  "Conference",
  "Other",
] as const;

export interface ItineraryPricingLine {
  roomCategory: string;
  mealPlan: string;
  ratePerNight: string;
  inclusions: string;
}
