import { API_BASE_URL, withAuthHeaders } from "./api";

export interface AuditLogEntry {
  _id: string;
  entity_type: string;
  entity_id?: string;
  action: string;
  userId?: { _id: string; name: string; email?: string };
  before?: Record<string, any>;
  after?: Record<string, any>;
  createdAt: string;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface AuditLogFilters {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  orgId?: string;
}

const BASE = `${API_BASE_URL}/api/admin/audit-log`;

export async function listAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.entity_type) params.set("entity_type", filters.entity_type);
  if (filters.entity_id) params.set("entity_id", filters.entity_id);
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.orgId) params.set("orgId", filters.orgId);

  const url = params.toString() ? `${BASE}?${params}` : BASE;
  const response = await fetch(url, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch audit log");
  }
  return response.json();
}
