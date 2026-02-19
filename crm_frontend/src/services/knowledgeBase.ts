import { API_BASE_URL, withAuthHeaders, getAuthToken } from "./api";

export type KnowledgeBaseType = "PROPERTY" | "FACTSHEET" | "TEMPLATE" | "RESOURCE";

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

