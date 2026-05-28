import { API_BASE_URL, withAuthHeaders } from "./api";

export type CustomFieldType =
  | "TEXT"
  | "NUMBER"
  | "DATE"
  | "DROPDOWN"
  | "BOOLEAN"
  | "TEXTAREA"
  | "MULTI_SELECT"
  | "PHONE"
  | "URL";

export interface CustomFieldOption {
  label: string;
  value: string;
}

export interface AdminField {
  _id: string;
  name: string;
  slug: string;
  label: string;
  dataType: CustomFieldType;
  options?: CustomFieldOption[];
  entity_type: "lead" | "contact" | "deal";
  mandatory_at_stage_id?: string;
  is_tag: boolean;
  is_unique_identifier: boolean;
  utm_capture: boolean;
  display_order: number;
  is_active: boolean;
}

export interface CreateFieldPayload {
  name: string;
  slug?: string;
  dataType: CustomFieldType;
  entity_type?: "lead" | "contact" | "deal";
  options?: CustomFieldOption[];
  mandatory_at_stage_id?: string;
  is_tag?: boolean;
  is_unique_identifier?: boolean;
  utm_capture?: boolean;
  display_order?: number;
  is_active?: boolean;
}

export interface UpdateFieldPayload extends Partial<CreateFieldPayload> {
  slug?: never;
  entity_type?: never;
}

const BASE = `${API_BASE_URL}/api/admin/fields`;

export async function listAdminFields(
  entity: "lead" | "contact" | "deal" = "lead",
  options?: { includeInactive?: boolean }
): Promise<AdminField[]> {
  const params = new URLSearchParams({ entity });
  if (options?.includeInactive) {
    params.set("include_inactive", "true");
  }

  const response = await fetch(`${BASE}?${params.toString()}`, { headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to fetch fields");
  }
  const raw = (await response.json()) as any[];
  return raw.map((f: any) => ({
    _id: f._id,
    name: f.name ?? f.label,
    slug: f.slug,
    label: f.label ?? f.name,
    dataType: f.dataType ?? f.type,
    options: f.options,
    entity_type: f.entity_type ?? "lead",
    mandatory_at_stage_id: f.mandatory_at_stage_id,
    is_tag: f.is_tag ?? false,
    is_unique_identifier: f.is_unique_identifier ?? false,
    utm_capture: f.utm_capture ?? false,
    display_order: f.display_order ?? f.order ?? 0,
    is_active: f.is_active ?? f.isActive ?? true,
  }));
}

export async function createAdminField(payload: CreateFieldPayload): Promise<AdminField> {
  const response = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create field");
  }
  const f = (await response.json()) as any;
  return {
    _id: f._id,
    name: f.name ?? f.label,
    slug: f.slug,
    label: f.label ?? f.name,
    dataType: f.dataType,
    options: f.options,
    entity_type: f.entity_type ?? "lead",
    mandatory_at_stage_id: f.mandatory_at_stage_id,
    is_tag: f.is_tag ?? false,
    is_unique_identifier: f.is_unique_identifier ?? false,
    utm_capture: f.utm_capture ?? false,
    display_order: f.display_order ?? 0,
    is_active: f.is_active ?? true,
  };
}

export async function updateAdminField(id: string, payload: UpdateFieldPayload): Promise<AdminField> {
  const response = await fetch(`${BASE}/${id}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to update field");
  }
  const f = (await response.json()) as any;
  return {
    _id: f._id,
    name: f.name ?? f.label,
    slug: f.slug,
    label: f.label ?? f.name,
    dataType: f.dataType,
    options: f.options,
    entity_type: f.entity_type ?? "lead",
    mandatory_at_stage_id: f.mandatory_at_stage_id,
    is_tag: f.is_tag ?? false,
    is_unique_identifier: f.is_unique_identifier ?? false,
    utm_capture: f.utm_capture ?? false,
    display_order: f.display_order ?? 0,
    is_active: f.is_active ?? true,
  };
}

export async function deleteAdminField(id: string): Promise<void> {
  const response = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to delete field");
  }
}

export async function reorderAdminFields(orderedIds: { id: string; display_order: number }[]): Promise<void> {
  const response = await fetch(`${BASE}/reorder`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ orderedIds }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to reorder fields");
  }
}
