import { API_BASE_URL, withAuthHeaders, getAuthToken } from "./api";

export type KnowledgeBaseType =
  | "PROPERTY"
  | "FACTSHEET"
  | "TEMPLATE"
  | "RESOURCE"
  | "PROPERTY_GUIDE";

export interface PropertyGuideContent {
  contact?: { phone?: string; email?: string; website?: string };
  roomCategories?: string;
  rates?: Array<{ room: string; rate: string }>;
  amenities?: string[];
  facilities?: string[];
  experiences?: { attractions?: string; tours?: string; notes?: string };
  sellingStory?: { speciality?: string; marketingPitch?: string };
  policies?: Array<{ title: string; body: string }>;
  gallery?: Array<{ fileId: string; caption?: string; sortOrder: number }>;
  legacyDriveUrl?: string;
  propertyType?: string;
  location?: string;
}

export interface PropertyGuidePayload {
  guideId?: string;
  propertyId: string;
  propertyName: string;
  propertyCode?: string;
  city?: string;
  state?: string;
  content: PropertyGuideContent;
  galleryUrls: Array<{ fileId: string; url: string; caption?: string }>;
  thumbnailUrl?: string;
  shareToken?: string;
  shareEnabled: boolean;
  lastUpdated?: string;
}

export interface HubPropertyItem {
  propertyId: string;
  name: string;
  code: string;
  city?: string;
  state?: string;
  country?: string;
  thumbnailUrl?: string;
  hasGuide: boolean;
}

export interface KnowledgeSearchResult {
  properties: Array<{
    propertyId: string;
    propertyName: string;
    city?: string;
    sectionId?: string;
    label: string;
    snippet?: string;
  }>;
  matches: Array<{
    propertyId: string;
    propertyName: string;
    sectionId?: string;
    label: string;
    snippet: string;
  }>;
}

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

export interface ImportPropertyKnowledgeResult {
  propertyId: string;
  propertyName: string;
  propertyCreated: boolean;
  itemsUpserted: number;
  warnings: string[];
}

export async function importPropertyKnowledge(
  file: File,
  options?: { propertyId?: string; city?: string; state?: string; country?: string }
): Promise<ImportPropertyKnowledgeResult> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.propertyId) formData.append("propertyId", options.propertyId);
  if (options?.city) formData.append("city", options.city);
  if (options?.state) formData.append("state", options.state);
  if (options?.country) formData.append("country", options.country);

  const response = await fetch(`${API_BASE_URL}/knowledge-base/import`, {
    method: "POST",
    headers: withAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    let message = "Unable to import property workbook";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

export async function fetchKnowledgeHub(): Promise<HubPropertyItem[]> {
  const res = await fetch(`${API_BASE_URL}/knowledge-base/hub`, { headers: withAuthHeaders() });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Failed to load knowledge hub"));
  }
  const data = await res.json();
  return data.items || [];
}

export async function searchKnowledgeHub(q: string): Promise<KnowledgeSearchResult> {
  const res = await fetch(
    `${API_BASE_URL}/knowledge-base/search?q=${encodeURIComponent(q)}`,
    { headers: withAuthHeaders() }
  );
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Search failed"));
  }
  return res.json();
}

async function parseApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchPropertyGuide(propertyId: string): Promise<PropertyGuidePayload> {
  const res = await fetch(`${API_BASE_URL}/knowledge-base/guide/${propertyId}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Failed to load property guide"));
  }
  return res.json();
}

export async function savePropertyGuide(
  propertyId: string,
  body: {
    content: PropertyGuideContent;
    shareEnabled?: boolean;
    regenerateShareToken?: boolean;
  }
): Promise<PropertyGuidePayload> {
  const res = await fetch(`${API_BASE_URL}/knowledge-base/guide/${propertyId}`, {
    method: "PUT",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(await parseApiError(res, "Failed to save property guide"));
  }
  const data = await res.json();
  return data.payload as PropertyGuidePayload;
}

export async function fetchPublicPropertyGuide(shareToken: string): Promise<PropertyGuidePayload> {
  const res = await fetch(`${API_BASE_URL}/api/public/knowledge/${shareToken}`);
  if (!res.ok) throw new Error("Shared guide not found");
  return res.json();
}

export function getPublicGuideUrl(shareToken: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/share/knowledge/${shareToken}`;
}

export async function shareGuideEmail(
  guideId: string,
  body: { to: string; publicUrl: string; propertyName: string }
): Promise<{ mailtoUrl: string }> {
  const res = await fetch(`${API_BASE_URL}/knowledge-base/${guideId}/share-email`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to prepare email");
  return res.json();
}

