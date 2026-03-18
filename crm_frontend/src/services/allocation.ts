import { API_BASE_URL, withAuthHeaders } from "./api";

export interface AllocationConfig {
  daily_lead_cap?: string;
  allocation_window_hours?: string;
  overflow_mode?: string;
  alert_threshold_percent?: string;
  tl_notification_user_ids?: string;
}

export interface AgentWorkload {
  agentId: string;
  agentName: string;
  agentEmail?: string;
  lead_count: number;
  daily_cap: number;
  is_available: boolean;
}

export interface WorkloadResponse {
  date: string;
  workloads: AgentWorkload[];
}

const BASE = `${API_BASE_URL}/api/admin/allocation`;

function getOrgId(): string {
  const org = (typeof window !== "undefined" && (window as any).__ORG_ID__) || "";
  return org || "69ae144fae23030b62f901f5";
}

export async function getAllocationConfig(orgId?: string): Promise<Record<string, string>> {
  const oid = orgId || getOrgId();
  const response = await fetch(`${BASE}/config?orgId=${oid}`, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch allocation config");
  }
  const raw = (await response.json()) as any;
  const map: Record<string, string> = {};
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item.key && item.value !== undefined) map[item.key] = String(item.value);
    }
  } else if (typeof raw === "object" && raw !== null) {
    for (const [key, val] of Object.entries(raw)) {
      if (val && typeof val === "object" && "value" in val) {
        map[key] = String((val as any).value);
      } else if (typeof val === "string") {
        map[key] = val;
      }
    }
  }
  return map;
}

export async function updateAllocationConfig(
  keys: Record<string, string>,
  orgId?: string
): Promise<void> {
  const oid = orgId || getOrgId();
  const response = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orgId: oid, keys }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update allocation config");
  }
}

export async function getAllocationWorkload(orgId?: string, date?: string): Promise<WorkloadResponse> {
  const oid = orgId || getOrgId();
  let url = `${BASE}/workload?orgId=${oid}`;
  if (date) url += `&date=${date}`;
  const response = await fetch(url, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch workload");
  }
  const raw = (await response.json()) as any;
  return {
    date: raw.date ?? date ?? new Date().toISOString().slice(0, 10),
    workloads: raw.workloads ?? raw.data ?? [],
  };
}

export async function updateAgentAvailability(
  agentId: string,
  is_available: boolean,
  orgId?: string,
  date?: string
): Promise<void> {
  const oid = orgId || getOrgId();
  let url = `${BASE}/workload/${agentId}/availability?orgId=${oid}`;
  if (date) url += `&date=${date}`;
  const response = await fetch(url, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ is_available }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update availability");
  }
}
