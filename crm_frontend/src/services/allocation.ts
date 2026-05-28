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

export async function getAllocationConfig(): Promise<Record<string, string>> {
  const response = await fetch(`${BASE}/config`, { headers: withAuthHeaders() });
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

export async function updateAllocationConfig(keys: Record<string, string>): Promise<void> {
  const response = await fetch(`${BASE}/config`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ keys }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update allocation config");
  }
}

export async function getAllocationWorkload(date?: string): Promise<WorkloadResponse> {
  const url = `${BASE}/workload${date ? `?date=${date}` : ""}`;
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
  date?: string
): Promise<void> {
  let url = `${BASE}/workload/${agentId}/availability`;
  if (date) url += `?date=${date}`;
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
