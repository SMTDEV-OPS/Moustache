import { API_BASE_URL, withAuthHeaders } from "./api";

export type ContractStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "REJECTED";
export type ContractChannel = "B2B" | "B2C";

export interface ContractPricingRow {
  roomCategory: string;
  rate: number;
  inclusions?: string;
  rn?: number;
  remarks?: string;
}

export interface ContractRateGridValue {
  b2b: {
    rows: Array<{
      id: string;
      roomType: string;
      rateSlab: string;
      single: number;
      double: number;
      triple: number;
      rn: number;
      inclusions: string[];
      remarks: string;
    }>;
    inclusionNomenclature?: Array<{ code: string; fullName: string }>;
    additionalRemarks?: string;
  };
  b2c: {
    rows: Array<{
      id: string;
      roomType: string;
      rateSlab: string;
      single: number;
      double: number;
      triple: number;
      rn: number;
      inclusions: string[];
      remarks: string;
    }>;
    inclusionNomenclature?: Array<{ code: string; fullName: string }>;
    additionalRemarks?: string;
  };
  inclusionNomenclature?: Array<{ code: string; fullName: string }>;
  additionalRemarks?: string;
}

export interface Contract {
  id: string;
  _id?: string;
  accountId: string;
  propertyIds: string[];
  companyName: string;
  contactId?: string;
  contactEmail?: string;
  channel: ContractChannel;
  status: ContractStatus;
  pricingGrid: ContractPricingRow[];
  rateGrid?: ContractRateGridValue;
  submittedByUserId?: string;
  approvals?: Array<{
    step: number;
    approverUserId: string;
    approverName?: string;
    label?: string;
    status: "PENDING" | "APPROVED" | "REJECTED";
    note?: string;
    actedAt?: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}

export const listContracts = async (accountId: string): Promise<Contract[]> => {
  const params = new URLSearchParams({ accountId });
  const response = await fetch(`${API_BASE_URL}/contracts?${params.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch contracts");
  const raw = await response.json();
  return (raw || []).map((c: any) => ({ id: c._id || c.id, ...c }));
};

export const createContract = async (payload: {
  accountId: string;
  propertyIds: string[];
  companyName: string;
  contactId?: string;
  contactEmail?: string;
  channel: ContractChannel;
  pricingGrid?: ContractPricingRow[];
}): Promise<Contract> => {
  const response = await fetch(`${API_BASE_URL}/contracts`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create contract");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const approveContract = async (id: string, note?: string): Promise<Contract> => {
  const response = await fetch(`${API_BASE_URL}/contracts/${id}/approve`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ note }),
  });
  if (!response.ok) throw new Error("Failed to approve contract");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const rejectContract = async (id: string, note?: string): Promise<Contract> => {
  const response = await fetch(`${API_BASE_URL}/contracts/${id}/reject`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ note }),
  });
  if (!response.ok) throw new Error("Failed to reject contract");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const updateContractRateGrid = async (
  contractId: string,
  rateGrid: ContractRateGridValue
): Promise<Contract> => {
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ rateGrid }),
  });
  if (!response.ok) throw new Error("Failed to update contract rate grid");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const uploadContractPricingExcel = async (contractId: string, file: File): Promise<Contract> => {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE_URL}/contracts/${contractId}/upload-excel`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: form,
  });
  if (!response.ok) throw new Error("Failed to upload pricing grid");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

