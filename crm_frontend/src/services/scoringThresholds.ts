import { API_BASE_URL, withAuthHeaders } from "./api";

export interface ScoringThreshold {
  _id: string;
  label: string;
  min_score: number;
  max_score: number;
  color: string;
  inactive_hours_warning?: number | null;
  inactive_hours_critical?: number | null;
  inactive_color_warning?: string | null;
  inactive_color_critical?: string | null;
  auto_action: "none" | "notify_tl" | "auto_lost";
}

export interface CreateThresholdPayload {
  label: string;
  min_score: number;
  max_score: number;
  color: string;
  inactive_hours_warning?: number | null;
  inactive_hours_critical?: number | null;
  inactive_color_warning?: string | null;
  inactive_color_critical?: string | null;
  auto_action: "none" | "notify_tl" | "auto_lost";
}

const BASE = `${API_BASE_URL}/api/admin/scoring/thresholds`;

export async function listScoringThresholds(): Promise<ScoringThreshold[]> {
  const response = await fetch(BASE, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to fetch thresholds");
  }
  const raw = (await response.json()) as any[];
  return raw.map((t: any) => ({
    _id: t._id,
    label: t.label,
    min_score: t.min_score,
    max_score: t.max_score,
    color: t.color,
    inactive_hours_warning: t.inactive_hours_warning,
    inactive_hours_critical: t.inactive_hours_critical,
    inactive_color_warning: t.inactive_color_warning,
    inactive_color_critical: t.inactive_color_critical,
    auto_action: t.auto_action ?? "none",
  }));
}

export async function createScoringThreshold(payload: CreateThresholdPayload): Promise<ScoringThreshold> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to create threshold");
  }
  const t = (await response.json()) as any;
  return {
    _id: t._id,
    label: t.label,
    min_score: t.min_score,
    max_score: t.max_score,
    color: t.color,
    inactive_hours_warning: t.inactive_hours_warning,
    inactive_hours_critical: t.inactive_hours_critical,
    inactive_color_warning: t.inactive_color_warning,
    inactive_color_critical: t.inactive_color_critical,
    auto_action: t.auto_action ?? "none",
  };
}

export async function updateScoringThreshold(id: string, payload: Partial<CreateThresholdPayload>): Promise<ScoringThreshold> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to update threshold");
  }
  const t = (await response.json()) as any;
  return {
    _id: t._id,
    label: t.label,
    min_score: t.min_score,
    max_score: t.max_score,
    color: t.color,
    inactive_hours_warning: t.inactive_hours_warning,
    inactive_hours_critical: t.inactive_hours_critical,
    inactive_color_warning: t.inactive_color_warning,
    inactive_color_critical: t.inactive_color_critical,
    auto_action: t.auto_action ?? "none",
  };
}

export async function deleteScoringThreshold(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to delete threshold");
  }
}
