import { API_BASE_URL, withAuthHeaders } from "./api";

export type IntegrationStatus = "connected" | "error" | "pending" | "disconnected";

export interface IntegrationConfig {
  _id: string;
  orgId: string;
  provider: string;
  is_configured: boolean;
  status: IntegrationStatus;
  last_verified_at?: string;
  webhook_url?: string;
  is_active: boolean;
}

export interface WebhookFieldMapping {
  _id: string;
  source_field: string;
  target_field_slug: string;
  transform: "none" | "uppercase" | "lowercase" | "phone_normalize" | "date_parse";
}

export interface CreateIntegrationPayload {
  orgId?: string;
  provider: string;
  config_json: Record<string, any>;
  webhook_url?: string;
  is_active?: boolean;
}

export interface CreateMappingPayload {
  source_field: string;
  target_field_slug: string;
  transform?: WebhookFieldMapping["transform"];
}

const BASE = `${API_BASE_URL}/api/admin/integrations`;

export async function listIntegrations(orgId?: string): Promise<IntegrationConfig[]> {
  const url = orgId ? `${BASE}?orgId=${orgId}` : BASE;
  const response = await fetch(url, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch integrations");
  }
  const raw = (await response.json()) as any[];
  return raw.map((i: any) => ({
    _id: i._id,
    orgId: i.orgId?.toString?.() ?? i.orgId,
    provider: i.provider,
    is_configured: i.is_configured ?? !!i.config_json,
    status: i.status ?? "disconnected",
    last_verified_at: i.last_verified_at,
    webhook_url: i.webhook_url,
    is_active: i.is_active ?? true,
  }));
}

export async function createIntegration(payload: CreateIntegrationPayload): Promise<IntegrationConfig> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create integration");
  }
  const i = (await response.json()) as any;
  return {
    _id: i._id,
    orgId: i.orgId?.toString?.() ?? i.orgId,
    provider: i.provider,
    is_configured: i.is_configured ?? true,
    status: i.status ?? "pending",
    last_verified_at: i.last_verified_at,
    webhook_url: i.webhook_url,
    is_active: i.is_active ?? true,
  };
}

export async function updateIntegration(
  id: string,
  payload: Partial<CreateIntegrationPayload>
): Promise<IntegrationConfig> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update integration");
  }
  const i = (await response.json()) as any;
  return {
    _id: i._id,
    orgId: i.orgId?.toString?.() ?? i.orgId,
    provider: i.provider,
    is_configured: i.is_configured ?? true,
    status: i.status ?? "pending",
    last_verified_at: i.last_verified_at,
    webhook_url: i.webhook_url,
    is_active: i.is_active ?? true,
  };
}

export async function deleteIntegration(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to delete integration");
  }
}

export async function verifyIntegration(id: string): Promise<{ verified: boolean; status: string }> {
  const response = await fetch(`${BASE}/${id}/verify`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Verification failed");
  }
  const r = (await response.json()) as any;
  return { verified: r.verified ?? false, status: r.status ?? "pending" };
}

export async function listMappings(integrationId: string): Promise<WebhookFieldMapping[]> {
  const response = await fetch(`${BASE}/${integrationId}/mappings`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch mappings");
  }
  const raw = (await response.json()) as any[];
  return raw.map((m: any) => ({
    _id: m._id,
    source_field: m.source_field,
    target_field_slug: m.target_field_slug,
    transform: m.transform ?? "none",
  }));
}

export async function createMapping(
  integrationId: string,
  payload: CreateMappingPayload
): Promise<WebhookFieldMapping> {
  const response = await fetch(`${BASE}/${integrationId}/mappings`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create mapping");
  }
  const m = (await response.json()) as any;
  return {
    _id: m._id,
    source_field: m.source_field,
    target_field_slug: m.target_field_slug,
    transform: m.transform ?? "none",
  };
}

export async function updateMapping(
  integrationId: string,
  mappingId: string,
  payload: Partial<CreateMappingPayload>
): Promise<WebhookFieldMapping> {
  const response = await fetch(`${BASE}/${integrationId}/mappings/${mappingId}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update mapping");
  }
  const m = (await response.json()) as any;
  return {
    _id: m._id,
    source_field: m.source_field,
    target_field_slug: m.target_field_slug,
    transform: m.transform ?? "none",
  };
}

export async function deleteMapping(integrationId: string, mappingId: string): Promise<void> {
  const response = await fetch(`${BASE}/${integrationId}/mappings/${mappingId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to delete mapping");
  }
}
