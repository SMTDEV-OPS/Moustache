import { API_BASE_URL, withAuthHeaders } from "./api";

export interface AccountNote {
  id: string;
  _id?: string;
  accountId: string;
  content: string;
  createdByUserId?: { _id: string; name?: string; email?: string };
  createdAt: string;
  updatedAt?: string;
}

export const listAccountNotes = async (accountId: string): Promise<AccountNote[]> => {
  const response = await fetch(`${API_BASE_URL}/account-notes?accountId=${encodeURIComponent(accountId)}`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch notes");
  const raw = await response.json();
  return (raw || []).map((n: any) => ({ id: n._id || n.id, ...n }));
};

export const createAccountNote = async (
  accountId: string,
  content: string
): Promise<AccountNote> => {
  const response = await fetch(`${API_BASE_URL}/account-notes`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ accountId, content }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data?.message || "Failed to create note");
  }
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const updateAccountNote = async (
  id: string,
  content: string
): Promise<AccountNote> => {
  const response = await fetch(`${API_BASE_URL}/account-notes/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ content }),
  });
  if (!response.ok) throw new Error("Failed to update note");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const deleteAccountNote = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/account-notes/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to delete note");
};
