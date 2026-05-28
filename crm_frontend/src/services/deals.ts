import { API_BASE_URL, withAuthHeaders } from "./api";

export type DealStage =
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "WON"
  | "LOST"
  | "NA";

export interface Deal {
  id: string;
  _id?: string;
  accountId: string;
  name: string;
  stage: DealStage;
  value: number;
  currency?: string;
  probability?: number;
  expectedCloseDate?: string;
  ownerUserId?: { _id: string; name?: string; email?: string };
  leadId?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

const mapDeal = (raw: any): Deal => ({
  id: raw._id || raw.id,
  ...raw,
});

export const listDeals = async (accountId: string, includeNa?: boolean): Promise<Deal[]> => {
  const params = new URLSearchParams({ accountId });
  if (includeNa) params.set("includeNa", "true");
  const response = await fetch(
    `${API_BASE_URL}/deals?${params.toString()}`,
    { headers: withAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch deals");
  const raw = await response.json();
  return (raw || []).map(mapDeal);
};

export const createDeal = async (
  payload: Omit<Deal, "id" | "createdAt" | "updatedAt">
): Promise<Deal> => {
  const response = await fetch(`${API_BASE_URL}/deals`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create deal");
  }
  const raw = await response.json();
  return mapDeal(raw);
};

export const updateDeal = async (
  id: string,
  payload: Partial<Omit<Deal, "id" | "accountId" | "createdAt" | "updatedAt">>
): Promise<Deal> => {
  const response = await fetch(`${API_BASE_URL}/deals/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update deal");
  const raw = await response.json();
  return mapDeal(raw);
};

export const deleteDeal = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/deals/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to delete deal");
};
