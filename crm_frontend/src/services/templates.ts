import { API_BASE_URL, withAuthHeaders } from "./api";

export type TemplateMedium = "EMAIL" | "WHATSAPP";

export interface Template {
  id: string;
  name: string;
  medium: TemplateMedium;
  subject?: string; // For EMAIL only
  body: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateTemplatePayload {
  name: string;
  medium: TemplateMedium;
  subject?: string;
  body: string;
  isActive?: boolean;
}

export interface UpdateTemplatePayload {
  name?: string;
  medium?: TemplateMedium;
  subject?: string;
  body?: string;
  isActive?: boolean;
}

const mapTemplate = (raw: any): Template => {
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  };
};

export const listTemplates = async (medium?: TemplateMedium): Promise<Template[]> => {
  const params = new URLSearchParams();
  if (medium) {
    params.append("medium", medium);
  }

  const url = `${API_BASE_URL}/templates${params.toString() ? `?${params.toString()}` : ""}`;

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch templates";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map(mapTemplate);
};

export const getTemplate = async (id: string): Promise<Template> => {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch template";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapTemplate(await response.json());
};

export const createTemplate = async (
  payload: CreateTemplatePayload
): Promise<Template> => {
  const response = await fetch(`${API_BASE_URL}/templates`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create template";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapTemplate(await response.json());
};

export const updateTemplate = async (
  id: string,
  payload: UpdateTemplatePayload
): Promise<Template> => {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update template";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapTemplate(await response.json());
};

export const deleteTemplate = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/templates/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete template";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

// Available placeholders for templates
export const TEMPLATE_PLACEHOLDERS = [
  { key: "{{guestName}}", description: "Guest's name" },
  { key: "{{propertyName}}", description: "Property name" },
  { key: "{{checkInDate}}", description: "Check-in date" },
  { key: "{{checkOutDate}}", description: "Check-out date" },
  { key: "{{leadNumber}}", description: "Lead reference number" },
];

