import { API_BASE_URL, withAuthHeaders } from "@/services/api";

export interface DuplicateLeadMatch {
  leadId: string;
  leadNumber: string;
  reason: string;
  contactName?: string;
}

export async function checkDuplicateLeads(body: {
  phone?: string;
  email?: string;
  accountId?: string;
  checkIn?: string;
  checkOut?: string;
  excludeLeadId?: string;
}): Promise<DuplicateLeadMatch[]> {
  const response = await fetch(`${API_BASE_URL}/leads/check-duplicate`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Duplicate check failed");
  }
  const data = await response.json();
  return data.matches || [];
}
