import { API_BASE_URL, withAuthHeaders, getAuthToken } from "./api";

export type KnowledgeBaseType =
  | "PROPERTY"
  | "FACTSHEET"
  | "TEMPLATE"
  | "RESOURCE"
  | "PROPERTY_DIRECTORY";

/** Mirrors backend `IPropertyDirectoryContent` (v2 + legacy fields). */
export interface IPropertyDirectoryCityEntry {
  name: string;
  distanceOrNotes?: string;
}

export type DirectoryTierLabel = "Hostel" | "Select" | "Luxuria" | "Cowork";

export interface IPropertyDirectoryRoom {
  /** v2 */
  category?: string;
  /** legacy */
  name?: string;
  count: number;
  isAC?: boolean;
  isEnsuite?: boolean;
  ac?: boolean;
  ensuite?: boolean;
  notes?: string;
}

export interface IPropertyDirectoryContent {
  tier?: DirectoryTierLabel | string;
  region?: string;
  city?: string;
  address?: string;
  landmark?: string;
  contact?: {
    frontDesk?: string;
    managerName?: string;
    managerPhone?: string;
    ownerName?: string;
    ownerPhone?: string;
    email?: string;
    mapLink?: string;
    frontDeskPhone?: string;
    frontDeskEmail?: string;
    gmName?: string;
    gmPhone?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  checkInTime?: string;
  checkOutTime?: string;
  buildingHighlights?: string[];
  rooms?: IPropertyDirectoryRoom[];
  amenities?: {
    room?: string[];
    hotel?: string[];
    safety?: string[];
    safetySecurity?: string[];
    frontOffice?: string[];
  };
  cityInfo?: {
    restaurants?: IPropertyDirectoryCityEntry[];
    shopping?: IPropertyDirectoryCityEntry[];
    nightlife?: IPropertyDirectoryCityEntry[];
    attractions?: IPropertyDirectoryCityEntry[];
    importantPlaces?: IPropertyDirectoryCityEntry[];
    streetFood?: IPropertyDirectoryCityEntry[];
  };
  cityGuide?: {
    restaurants?: IPropertyDirectoryCityEntry[];
    shopping?: IPropertyDirectoryCityEntry[];
    nightlife?: IPropertyDirectoryCityEntry[];
    attractions?: IPropertyDirectoryCityEntry[];
    importantPlaces?: IPropertyDirectoryCityEntry[];
    streetFood?: IPropertyDirectoryCityEntry[];
  };
  lastImportedAt?: string;
  importSource?: string;
}

/** Backend card inside `GET /knowledge-base/directory` regions map. */
export interface DirectoryPropertyCardDto {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  kbId: string | null;
  tier: string;
  city: string;
  region: string;
  content: Record<string, unknown> | null;
  updatedAt: string | null;
}

export type GroupedDirectoryResponse = {
  regions: Record<string, DirectoryPropertyCardDto[]>;
};

/** Mirrors backend `IFactSheetContent` for FACTSHEET items. */
export interface IFactSheetContent {
  propertyAddress?: string;
  mapLocation?: string;
  checkInTime?: string;
  checkOutTime?: string;
  roomCategories?: Array<{
    name: string;
    capacity?: number;
    sizesqft?: number;
    isAC?: boolean;
    isDorm?: boolean;
  }>;
  inHouseRules?: string[];
  additionalCharges?: Array<{
    item: string;
    amount?: string;
  }>;
  propertyPolicy?: string[];
  nearbyAttractions?: string[];
  nearbyRestaurants?: string[];
  pocDetails?: {
    frontDeskPhone?: string;
    frontDeskEmail?: string;
    gmName?: string;
    gmPhone?: string;
  };
  generalInfo?: string[];
  roomAmenities?: string[];
  hotelAmenities?: string[];
  promotionsAndOffers?: string[];
  specialRemarks?: string;
}

export interface KBForQuotationResponse {
  property: {
    id: string;
    name: string;
    tier: string;
    branding: {
      primaryFont?: string;
      secondaryFont?: string;
      colorScheme?: {
        primary?: string;
        accent?: string;
        background?: string;
        text?: string;
      };
    };
    contactEmail: string;
    contactPhone: string;
    mapLocation: string;
  };
  factsheet: IFactSheetContent | null;
}

function normalizeFactSheetContent(
  raw: KBForQuotationResponse["factsheet"]
): IFactSheetContent | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }
  return Object.keys(raw).length > 0 ? raw : null;
}

/** Hotel directory list row (flattened from GET /knowledge-base/directory `{ regions }`). */
export interface HotelDirectoryEntry {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  tier: string;
  city: string;
  region: string;
  /** KnowledgeBase document _id when a PROPERTY_DIRECTORY row exists */
  directoryItemId: string | null;
  /** Label from directory content when present (e.g. Cowork) */
  directoryTierLabel?: string;
  content: IPropertyDirectoryContent | null;
  updatedAt: string | null;
}

export function flattenGroupedDirectory(
  data: GroupedDirectoryResponse
): HotelDirectoryEntry[] {
  const regions = data.regions;
  if (!regions || typeof regions !== "object") return [];
  const out: HotelDirectoryEntry[] = [];
  for (const cards of Object.values(regions)) {
    if (!Array.isArray(cards)) continue;
    for (const card of cards) {
      const content = card.content as IPropertyDirectoryContent | null;
      const dirTier =
        content && typeof content.tier === "string" ? content.tier : undefined;
      out.push({
        propertyId: card.propertyId,
        propertyName: card.propertyName,
        propertyCode: card.propertyCode,
        tier: card.tier,
        city: card.city,
        region: card.region,
        directoryItemId: card.kbId,
        directoryTierLabel: dirTier,
        content,
        updatedAt: card.updatedAt,
      });
    }
  }
  return out;
}

export const getHotelDirectory = async (): Promise<HotelDirectoryEntry[]> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-base/directory`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) {
    let message = "Unable to load hotel directory";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const data = (await response.json()) as
    | GroupedDirectoryResponse
    | { entries?: HotelDirectoryEntry[] };
  if ("regions" in data && data.regions) {
    return flattenGroupedDirectory(data);
  }
  const legacy = (data as { entries?: HotelDirectoryEntry[] }).entries;
  return Array.isArray(legacy) ? legacy : [];
};

export interface DirectorySearchHit {
  propertyId: string;
  propertyName: string;
  propertyCode: string;
  kbId: string | null;
  tier: string;
  city: string;
  region: string;
  matchReasons: string[];
}

export const searchHotelDirectory = async (
  q: string
): Promise<DirectorySearchHit[]> => {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/directory/search?${params.toString()}`,
    { headers: withAuthHeaders() }
  );
  if (!response.ok) {
    let message = "Directory search failed";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const data = (await response.json()) as {
    results?: Array<{
      propertyId: string;
      propertyName: string;
      propertyCode: string;
      kbId?: string | null;
      tier?: string;
      city?: string;
      region?: string;
      matchedFields?: string[];
      matchReasons?: string[];
    }>;
  };
  const rows = Array.isArray(data.results) ? data.results : [];
  return rows.map((r) => ({
    propertyId: r.propertyId,
    propertyName: r.propertyName,
    propertyCode: r.propertyCode,
    kbId: r.kbId ?? null,
    tier: r.tier ?? "",
    city: r.city ?? "",
    region: r.region ?? "",
    matchReasons:
      Array.isArray(r.matchedFields) && r.matchedFields.length
        ? r.matchedFields
        : Array.isArray(r.matchReasons)
          ? r.matchReasons
          : [],
  }));
};

export interface DirectoryImportSummary {
  imported: number;
  failed: string[];
  skipped: string[];
}

export const importDirectoryFromExcel = async (
  file: File
): Promise<DirectoryImportSummary> => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/directory/import`,
    {
      method: "POST",
      headers: withAuthHeaders(),
      body: formData,
    }
  );
  if (!response.ok) {
    let message = "Excel import failed";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json() as Promise<DirectoryImportSummary>;
};

export const updateDirectoryEntry = async (
  propertyId: string,
  content: Partial<IPropertyDirectoryContent> & Record<string, unknown>
): Promise<KnowledgeBaseItem> => {
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/directory/${propertyId}`,
    {
      method: "PATCH",
      headers: withAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(content),
    }
  );
  if (!response.ok) {
    let message = "Unable to update directory entry";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return response.json();
};

export const compareDirectoryProperties = async (
  propertyIds: string[]
): Promise<KnowledgeBaseItem[]> => {
  const ids = propertyIds.slice(0, 3).filter(Boolean);
  if (ids.length === 0) return [];
  const params = new URLSearchParams({ ids: ids.join(",") });
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/directory/compare?${params.toString()}`,
    { headers: withAuthHeaders() }
  );
  if (!response.ok) {
    let message = "Compare failed";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  const data = (await response.json()) as { items?: KnowledgeBaseItem[] };
  return Array.isArray(data.items) ? data.items : [];
};

export const getKBForQuotation = async (
  propertyId: string
): Promise<KBForQuotationResponse> => {
  const params = new URLSearchParams({ propertyId });
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/for-quotation?${params.toString()}`,
    { headers: withAuthHeaders(), cache: "no-store" }
  );

  if (!response.ok) {
    let message = "Unable to load property knowledge base";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = (await response.json()) as KBForQuotationResponse;
  return {
    ...data,
    factsheet: normalizeFactSheetContent(data?.factsheet ?? null),
  };
};

export interface KnowledgeBaseFile {
  _id: string;
  filename: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export interface KnowledgeBaseItem {
  _id: string;
  type: KnowledgeBaseType;
  propertyId: {
    _id: string;
    name: string;
    code: string;
  };
  title: string;
  description?: string;
  content?: Record<string, unknown>;
  files: KnowledgeBaseFile[];
  isActive: boolean;
  createdBy: {
    _id: string;
    name: string;
    email: string;
  };
  updatedBy: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseListQuery {
  propertyId?: string;
  type?: KnowledgeBaseType;
  search?: string;
  isActive?: boolean;
}

export interface CreateKnowledgeBaseInput {
  type: KnowledgeBaseType;
  propertyId: string;
  title: string;
  description?: string;
  content?: Record<string, unknown>;
}

export interface UpdateKnowledgeBaseInput {
  title?: string;
  description?: string;
  content?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * Get list of knowledge base items
 */
export const getKnowledgeBaseItems = async (
  query?: KnowledgeBaseListQuery
): Promise<KnowledgeBaseItem[]> => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        params.append(key, String(value));
      }
    });
  }

  const url =
    `${API_BASE_URL}/knowledge-base` +
    (params.toString() ? `?${params.toString()}` : "");

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch knowledge base items";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();
  return Array.isArray(data) ? data : [];
};

/**
 * Get a single knowledge base item by ID
 */
export const getKnowledgeBaseItem = async (
  id: string
): Promise<KnowledgeBaseItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-base/${id}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch knowledge base item";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Create a new knowledge base item
 */
export const createKnowledgeBaseItem = async (
  input: CreateKnowledgeBaseInput
): Promise<KnowledgeBaseItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-base`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Unable to create knowledge base item";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Update a knowledge base item
 */
export const updateKnowledgeBaseItem = async (
  id: string,
  input: UpdateKnowledgeBaseInput
): Promise<KnowledgeBaseItem> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-base/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    let message = "Unable to update knowledge base item";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Delete a knowledge base item
 */
export const deleteKnowledgeBaseItem = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/knowledge-base/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete knowledge base item";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

/**
 * Upload files to a knowledge base item
 */
export const uploadFiles = async (
  id: string,
  files: File[]
): Promise<KnowledgeBaseItem> => {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch(`${API_BASE_URL}/knowledge-base/${id}/files`, {
    method: "POST",
    headers: withAuthHeaders(), // Don't set Content-Type, let browser set it with boundary
    body: formData,
  });

  if (!response.ok) {
    let message = "Unable to upload files";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Delete a file from a knowledge base item
 */
export const deleteFile = async (
  itemId: string,
  fileId: string
): Promise<KnowledgeBaseItem> => {
  const response = await fetch(
    `${API_BASE_URL}/knowledge-base/${itemId}/files/${fileId}`,
    {
      method: "DELETE",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to delete file";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
};

/**
 * Get download URL for a file
 */
export const getFileDownloadUrl = (fileId: string): string => {
  const token = getAuthToken();
  return `${API_BASE_URL}/knowledge-base/files/${fileId}${token ? `?token=${token}` : ""}`;
};

/**
 * Download a file
 */
export const downloadFile = async (fileId: string): Promise<Blob> => {
  const response = await fetch(getFileDownloadUrl(fileId), {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to download file";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.blob();
};

/**
 * Search knowledge base items
 */
export const searchKnowledgeBase = async (
  propertyId: string,
  searchQuery: string
): Promise<KnowledgeBaseItem[]> => {
  return getKnowledgeBaseItems({
    propertyId,
    search: searchQuery,
  });
};

