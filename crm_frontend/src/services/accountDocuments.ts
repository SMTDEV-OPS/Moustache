import { API_BASE_URL, withAuthHeaders } from "./api";

export type AccountDocumentType = "CONTRACT" | "CERTIFICATE" | "AGREEMENT" | "OTHER";

export interface AccountDocument {
  id: string;
  _id?: string;
  accountId: string;
  name: string;
  fileUrl: string;
  mimeType?: string;
  size?: number;
  type?: AccountDocumentType;
  uploadedByUserId?: { _id: string; name?: string; email?: string };
  createdAt: string;
  updatedAt?: string;
}

export const listAccountDocuments = async (accountId: string): Promise<AccountDocument[]> => {
  const response = await fetch(
    `${API_BASE_URL}/account-documents?accountId=${encodeURIComponent(accountId)}`,
    { headers: withAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch documents");
  const raw = await response.json();
  return (raw || []).map((d: any) => ({ id: d._id || d.id, ...d }));
};

export const uploadAccountDocument = async (
  accountId: string,
  file: File,
  type: AccountDocumentType = "OTHER"
): Promise<AccountDocument> => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("accountId", accountId);
  formData.append("type", type);

  const response = await fetch(`${API_BASE_URL}/account-documents/upload`, {
    method: "POST",
    headers: withAuthHeaders(), // Don't set Content-Type; browser sets it with boundary for multipart
    body: formData,
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const msg =
      (data as { message?: string })?.message ||
      (data as { error?: string })?.error ||
      `Failed to upload document (${response.status})`;
    throw new Error(msg);
  }
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const deleteAccountDocument = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/account-documents/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to delete document");
};

export const downloadAccountDocument = async (id: string, fileName: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/account-documents/${id}/download`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to download document");
  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  a.remove();
};
