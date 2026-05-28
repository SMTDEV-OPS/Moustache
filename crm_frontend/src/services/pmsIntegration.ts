import { API_BASE_URL, withAuthHeaders } from "./api";

export interface PmsFieldMapping {
  _id?: string;
  id?: string;
  pmsField: string;
  systemField: string;
  direction: "PMS_TO_SYSTEM" | "SYSTEM_TO_PMS" | "BIDIRECTIONAL";
  isActive: boolean;
  description?: string;
}

export interface PmsSyncResult {
  message: string;
  accountId: string;
  pmsProfileId?: string;
  status: string;
  syncableFields?: string[];
  syncableData?: string[];
}

export const syncAccountFromPms = async (accountId: string): Promise<PmsSyncResult> => {
  const response = await fetch(`${API_BASE_URL}/pms/sync-account/${accountId}`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "PMS sync failed");
  }
  return response.json();
};

export const syncPotentialFromPms = async (accountId: string): Promise<PmsSyncResult> => {
  const response = await fetch(`${API_BASE_URL}/pms/sync-potential/${accountId}`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "PMS potential sync failed");
  }
  return response.json();
};

export const getFieldMappings = async (): Promise<PmsFieldMapping[]> => {
  const response = await fetch(`${API_BASE_URL}/pms/field-mappings`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch field mappings");
  }
  return response.json();
};

export const updateFieldMapping = async (mapping: Omit<PmsFieldMapping, "_id" | "id">): Promise<PmsFieldMapping> => {
  const response = await fetch(`${API_BASE_URL}/pms/field-mappings`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(mapping),
  });
  if (!response.ok) {
    throw new Error("Failed to update field mapping");
  }
  return response.json();
};

export const deleteFieldMapping = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/pms/field-mappings/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Failed to delete field mapping");
  }
};
