import { API_BASE_URL, withAuthHeaders } from "@/services/api";

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: string;
  leadId?: string;
}

export interface HolidayEntry {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  type: "public_holiday" | "season";
  region?: string;
}

export interface TargetsSummary {
  period: string;
  metric: string;
  target: number;
  achieved: number;
  remaining: number;
  fyLabel?: string;
}

export interface ConversionFy {
  conversionPct: number;
  createdInFy: number;
  converted: number;
  fyStart: string;
  fyEnd: string;
}

export async function fetchCalendarEvents(from: string, to: string, scope = "team") {
  const res = await fetch(
    `${API_BASE_URL}/api/accounts-dashboard/calendar?from=${from}&to=${to}&scope=${scope}`,
    { headers: withAuthHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load calendar");
  const data = await res.json();
  return (data.events || []) as CalendarEvent[];
}

export async function fetchHolidays(from: string, to: string) {
  const res = await fetch(
    `${API_BASE_URL}/api/accounts-dashboard/holidays?from=${from}&to=${to}`,
    { headers: withAuthHeaders() }
  );
  if (!res.ok) throw new Error("Failed to load holidays");
  const data = await res.json();
  return (data.holidays || []) as HolidayEntry[];
}

export async function fetchTargetsSummary(period: "mtd" | "ytd") {
  const res = await fetch(`${API_BASE_URL}/api/accounts-dashboard/targets?period=${period}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load targets");
  return (await res.json()) as TargetsSummary;
}

export async function fetchConversionFy(scope = "team") {
  const res = await fetch(`${API_BASE_URL}/api/accounts-dashboard/conversion-fy?scope=${scope}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load conversion");
  return (await res.json()) as ConversionFy;
}

export interface OrgSalesSettings {
  financialYearStartMonth: number;
  financialYearStartDay: number;
  achievementMetric: "revenue" | "booked_leads";
}

export interface SalesTargetRow {
  _id?: string;
  year: number;
  month: number;
  userId?: string;
  targetAmount?: number;
  targetCount?: number;
}

export async function fetchSalesSettings() {
  const res = await fetch(`${API_BASE_URL}/api/accounts-dashboard/sales-settings`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load sales settings");
  return (await res.json()) as OrgSalesSettings;
}

export async function updateSalesSettings(body: Partial<OrgSalesSettings>) {
  const res = await fetch(`${API_BASE_URL}/api/accounts-dashboard/sales-settings`, {
    method: "PUT",
    headers: { ...withAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save sales settings");
  return (await res.json()) as OrgSalesSettings;
}

export async function listSalesTargets(year: number) {
  const res = await fetch(`${API_BASE_URL}/api/sales-targets?year=${year}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to load targets");
  return (await res.json()) as SalesTargetRow[];
}

export async function upsertSalesTarget(body: {
  year: number;
  month: number;
  userId?: string;
  targetAmount?: number;
  targetCount?: number;
}) {
  const res = await fetch(`${API_BASE_URL}/api/sales-targets`, {
    method: "PUT",
    headers: { ...withAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to save target");
  return (await res.json()) as SalesTargetRow;
}

export async function listHolidaysAdmin() {
  const res = await fetch(`${API_BASE_URL}/api/holidays`, { headers: withAuthHeaders() });
  if (!res.ok) throw new Error("Failed to load holidays");
  return (await res.json()) as HolidayEntry[];
}

export async function createHoliday(body: {
  name: string;
  startDate: string;
  endDate: string;
  type: "public_holiday" | "season";
  region?: string;
}) {
  const res = await fetch(`${API_BASE_URL}/api/holidays`, {
    method: "POST",
    headers: { ...withAuthHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to create holiday");
  return (await res.json()) as HolidayEntry;
}

export async function deleteHoliday(id: string) {
  const res = await fetch(`${API_BASE_URL}/api/holidays/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete holiday");
}
