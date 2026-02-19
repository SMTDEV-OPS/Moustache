import { API_BASE_URL, withAuthHeaders } from "./api";

export type AccountType = "TRAVEL_AGENT" | "CORPORATE" | "EVENT_PLANNER" | "AIRLINES" | "GOVERNMENT" | "OTHER";
export type OrganizationType = "CORPORATE" | "TRAVEL_AGENT" | "EVENT_PLANNER" | "PCO" | "AIRLINE" | "GOVERNMENT" | "EMBASSY_CONSULATE" | "PSU" | "CUSTOM";
export type AccountLevel = "MASTER" | "PARENT" | "BRANCH" | "SUBSIDIARY";
export type IndustrySize = "SMALL" | "MEDIUM" | "LARGE";
export type ContractingType = "LOCAL_CONTRACTING" | "LOCAL_RFP" | "GLOBAL_RFP" | "ANNUAL_CONTRACT";
export type AccountClassification = "ACQUISITION" | "DEVELOPMENT" | "RETENTION";

export interface Account {
  id: string;
  // Basic Information
  name: string;
  organizationType: OrganizationType;
  customOrganizationType?: string;

  // Conglomerate
  conglomerateId?: string | null;
  conglomerateName?: string;

  // Hierarchy
  accountLevel: AccountLevel;
  isHeadquarter: boolean;
  canChangeHeadquarter?: boolean;
  headquarterName?: string;
  type: AccountType; // Legacy
  parentAccountId?: string | null;

  // Address Information
  addressLine1?: string;
  addressLine2?: string;
  zip?: string;
  city?: string;
  subCity?: string;
  state?: string;
  country?: string;
  zone?: string;
  locality?: string;
  pmsProfileId?: string;

  // Contact Information
  email?: string;
  secondaryEmail?: string;
  boardLine?: string;
  fax?: string;
  website?: string;

  // Business Information
  industry?: string;
  marketSegment?: string;
  gstin?: string;
  panNumber?: string;
  accountClassification?: string; // Legacy

  // Industry Classification
  industryCategory?: string;
  industrySubCategory?: string;
  industrySize?: IndustrySize;

  industryStatus?: string; // Legacy
  officeStatus?: string;
  travelAgentImplant?: string;
  salesTeam?: string;
  contractingType?: string; // Legacy
  pmsSource?: string;

  // Contracting
  contractingTypes?: Array<{
    type: ContractingType;
    fromMonth: number;
    toMonth: number;
  }>;

  // Account Type Classification
  accountType?: AccountClassification;
  accountTypeOverride?: AccountClassification;

  // Sales & Credit Information
  businessPotentialCity?: string;
  primarySalesPerson?: string;
  secondarySalesPerson?: string;

  // Sales Team Assignment
  primaryAccountManager?: {
    userId: string;
    name: string;
    city: string;
  };
  secondaryAccountManagers?: Array<{
    userId: string;
    name: string;
    city: string;
  }>;

  customerBlacklist?: boolean;
  creditAllowed?: boolean;
  creditLimits?: number;
  creditDays?: number;
  billingInstruction?: string;

  // Loyalty Information
  loyaltyProgram?: string;
  loyaltyNumber?: string;
  loyaltyCreditPoint?: number;

  // Hotel/Property Related
  hotel?: string;
  hotelCity?: string;
  starCategory?: string;
  office?: string;
  travelAgencyType?: string;
  distance?: number;
  roomNight?: number;
  rate?: number;
  remarks?: string;

  // Additional fields
  marketArea?: string;
  competitor?: string;

  // Legacy fields (keeping for backward compatibility)
  primaryContact?: {
    name?: string;
    phone?: string;
    email?: string;
  };
  notes?: string;

  createdAt?: string;
  updatedAt?: string;
  // Hierarchy-related fields (populated from API)
  children?: Account[];
  parentAccount?: Account;
}

export interface AccountListQuery {
  organizationTypes?: OrganizationType[];
  city?: string;
  accountType?: AccountClassification;
  accountLevel?: AccountLevel;
}

export const searchAccounts = async (query: string): Promise<Account[]> => {
  const response = await fetch(`${API_BASE_URL}/accounts/search?q=${encodeURIComponent(query)}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    return [];
  }

  const raw = (await response.json()) as any[];
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

export const listAccounts = async (
  query?: AccountListQuery
): Promise<Account[]> => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const url =
    `${API_BASE_URL}/accounts` +
    (params.toString() ? `?${params.toString()}` : "");

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  // Ensure we always return an array
  if (!Array.isArray(raw)) {
    console.warn("Accounts API returned non-array response:", raw);
    return [];
  }
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

export const createAccount = async (
  account: Omit<Account, "id" | "createdAt" | "updatedAt">
): Promise<Account> => {
  const response = await fetch(`${API_BASE_URL}/accounts`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(account),
  });

  if (!response.ok) {
    let message = "Unable to create account";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Account;
};

export const updateAccount = async (
  accountId: string,
  account: Partial<Omit<Account, "id" | "createdAt" | "updatedAt">>
): Promise<Account> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(account),
  });

  if (!response.ok) {
    let message = "Unable to update account";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Account;
};

export const deleteAccount = async (accountId: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete account";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

// Hierarchy-related API functions
export const getAccountById = async (accountId: string): Promise<Account> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch account";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Account;
};

export const getRootAccounts = async (): Promise<Account[]> => {
  const response = await fetch(`${API_BASE_URL}/accounts/roots`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch root accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  if (!Array.isArray(raw)) {
    console.warn("Root accounts API returned non-array response:", raw);
    return [];
  }
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

export const getAccountChildren = async (accountId: string): Promise<Account[]> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/children`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch child accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  if (!Array.isArray(raw)) {
    console.warn("Children API returned non-array response:", raw);
    return [];
  }
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

export const getAccountDescendants = async (accountId: string): Promise<Account[]> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/descendants`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch descendant accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  if (!Array.isArray(raw)) {
    console.warn("Descendants API returned non-array response:", raw);
    return [];
  }
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

export const getAccountHierarchy = async (accountId: string): Promise<Account> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/hierarchy`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch account hierarchy";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Account;
};

export const getAccountParents = async (accountId: string): Promise<Account[]> => {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/parents`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch parent accounts";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  if (!Array.isArray(raw)) {
    console.warn("Parents API returned non-array response:", raw);
    return [];
  }
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return {
      id: id ?? _id,
      ...rest,
    } as Account;
  });
};

