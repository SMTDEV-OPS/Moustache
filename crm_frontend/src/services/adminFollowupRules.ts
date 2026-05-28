import { API_BASE_URL, withAuthHeaders } from "./api";

export type FollowupBucket = "Hot" | "Warm" | "Cold" | "Inactive";

export interface FollowupRule {
  _id: string;
  bucket: FollowupBucket;
  followup_number: number;
  offset_hours?: number | null;
  offset_days?: number | null;
  description?: string;
  template_id?: string;
  is_active: boolean;
  display_order: number;
}

export type CreateFollowupRulePayload = Omit<FollowupRule, "_id">;
export type UpdateFollowupRulePayload = Partial<CreateFollowupRulePayload>;

const BASE = `${API_BASE_URL}/api/admin/followup-rules`;

export async function listFollowupRules(): Promise<Record<FollowupBucket, FollowupRule[]>> {
  const response = await fetch(BASE, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch follow-up rules");
  }
  const raw = (await response.json()) as Record<string, any[]>;
  const result: Record<string, FollowupRule[]> = {
    Hot: [],
    Warm: [],
    Cold: [],
    Inactive: [],
  };
  for (const [bucket, arr] of Object.entries(raw)) {
    result[bucket as FollowupBucket] = (arr ?? []).map((r: any) => ({
      _id: r._id,
      bucket: r.bucket ?? bucket,
      followup_number: r.followup_number ?? 1,
      offset_hours: r.offset_hours,
      offset_days: r.offset_days,
      description: r.description,
      template_id: r.template_id,
      is_active: r.is_active ?? true,
      display_order: r.display_order ?? 0,
    }));
  }
  return result;
}

export async function createFollowupRule(payload: CreateFollowupRulePayload): Promise<FollowupRule> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.errors?.[0] || "Failed to create rule");
  }
  const r = (await response.json()) as any;
  return {
    _id: r._id,
    bucket: r.bucket,
    followup_number: r.followup_number,
    offset_hours: r.offset_hours,
    offset_days: r.offset_days,
    description: r.description,
    template_id: r.template_id,
    is_active: r.is_active ?? true,
    display_order: r.display_order ?? 0,
  };
}

export async function updateFollowupRule(id: string, payload: UpdateFollowupRulePayload): Promise<FollowupRule> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update rule");
  }
  const r = (await response.json()) as any;
  return {
    _id: r._id,
    bucket: r.bucket,
    followup_number: r.followup_number,
    offset_hours: r.offset_hours,
    offset_days: r.offset_days,
    description: r.description,
    template_id: r.template_id,
    is_active: r.is_active ?? true,
    display_order: r.display_order ?? 0,
  };
}

export async function deleteFollowupRule(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to delete rule");
  }
}

export async function reorderFollowupRules(orderedIds: { id: string; display_order: number }[]): Promise<void> {
  const response = await fetch(`${BASE}/reorder`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to reorder rules");
  }
}
