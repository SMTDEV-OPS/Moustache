import { API_BASE_URL, withAuthHeaders } from "./api";

export interface CallQualityScore {
  id: string;
  leadId: string;
  scored_by: { id: string; name: string; email?: string };
  scores_json: Record<string, number>;
  weighted_total: number;
  notes?: string;
  createdAt: string;
}

export interface CallQualityDimension {
  id: string;
  name: string;
  description?: string;
  weight_percent: number;
  display_order: number;
  is_active: boolean;
}

export async function getCallQuality(leadId: string): Promise<CallQualityScore[]> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/call-quality`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch call quality scores";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((s: any) => ({
    id: s._id ?? s.id,
    leadId: s.leadId,
    scored_by: s.scored_by,
    scores_json: s.scores_json ?? (s.scoresJson || {}),
    weighted_total: s.weighted_total ?? s.weightedTotal ?? 0,
    notes: s.notes,
    createdAt: s.createdAt,
  }));
}

export async function submitCallQuality(
  leadId: string,
  payload: { scoresJson: Record<string, number>; notes?: string }
): Promise<CallQualityScore> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/call-quality`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to submit call quality score";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const s = (await response.json()) as any;
  return {
    id: s._id ?? s.id,
    leadId: s.leadId,
    scored_by: s.scored_by,
    scores_json: s.scores_json ?? s.scoresJson ?? {},
    weighted_total: s.weighted_total ?? s.weightedTotal ?? 0,
    notes: s.notes,
    createdAt: s.createdAt,
  };
}

function mapDimension(d: any): CallQualityDimension {
  return {
    id: d._id ?? d.id,
    name: d.name,
    description: d.description,
    weight_percent: d.weight_percent ?? d.weightPercent ?? 0,
    display_order: d.display_order ?? d.displayOrder ?? 0,
    is_active: d.is_active !== false,
  };
}

export async function getCallQualityDimensions(): Promise<CallQualityDimension[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/call-quality/dimensions`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch call quality dimensions";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw
    .filter((d: any) => d.is_active !== false)
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(mapDimension);
}

/** For admin Scoring page - returns all dimensions including inactive */
export async function getAllCallQualityDimensions(): Promise<CallQualityDimension[]> {
  const response = await fetch(`${API_BASE_URL}/api/admin/call-quality/dimensions`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch dimensions");
  }
  const raw = (await response.json()) as any[];
  return raw
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map(mapDimension);
}

const DIMENSIONS_BASE = `${API_BASE_URL}/api/admin/call-quality/dimensions`;

export interface CreateDimensionPayload {
  name: string;
  description?: string;
  weight_percent: number;
  display_order: number;
  is_active?: boolean;
}

export async function createCallQualityDimension(payload: CreateDimensionPayload): Promise<CallQualityDimension> {
  const response = await fetch(DIMENSIONS_BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to create dimension");
  }
  const d = (await response.json()) as any;
  return mapDimension(d);
}

export async function updateCallQualityDimension(
  id: string,
  payload: Partial<CreateDimensionPayload>
): Promise<CallQualityDimension> {
  const response = await fetch(`${DIMENSIONS_BASE}/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to update dimension");
  }
  const d = (await response.json()) as any;
  return mapDimension(d);
}

export async function deleteCallQualityDimension(id: string): Promise<void> {
  const response = await fetch(`${DIMENSIONS_BASE}/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || data?.error || "Failed to delete dimension");
  }
}
