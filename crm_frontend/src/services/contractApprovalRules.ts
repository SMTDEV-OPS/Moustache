import { API_BASE_URL, withAuthHeaders } from "./api";

export interface ApprovalStep {
  step: number;
  approverType: "specific_user" | "role" | "reports_to_submitter";
  approverUserId?: string;
  approverRoleId?: string;
  label?: string;
}

export interface ContractApprovalRule {
  _id: string;
  name: string;
  description?: string;
  priority: number;
  condition_field: string;
  condition_operator: string;
  condition_value: string | string[];
  applyToAll: boolean;
  approvalSteps: ApprovalStep[];
  is_active: boolean;
}

const BASE = `${API_BASE_URL}/contract-approval-rules`;

export const listContractApprovalRules = async (): Promise<ContractApprovalRule[]> => {
  const res = await fetch(BASE, { headers: withAuthHeaders() });
  if (!res.ok) throw new Error("Failed to fetch contract approval rules");
  return res.json();
};

export const createContractApprovalRule = async (
  data: Omit<ContractApprovalRule, "_id">
): Promise<ContractApprovalRule> => {
  const res = await fetch(BASE, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create rule");
  return res.json();
};

export const updateContractApprovalRule = async (
  id: string,
  data: Partial<ContractApprovalRule>
): Promise<ContractApprovalRule> => {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update rule");
  return res.json();
};

export const deleteContractApprovalRule = async (id: string): Promise<void> => {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE", headers: withAuthHeaders() });
  if (!res.ok) throw new Error("Failed to delete rule");
};

export const reorderContractApprovalRules = async (
  items: { id: string; priority: number }[]
): Promise<ContractApprovalRule[]> => {
  const res = await fetch(`${BASE}/reorder`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(items),
  });
  if (!res.ok) throw new Error("Failed to reorder rules");
  return res.json();
};
