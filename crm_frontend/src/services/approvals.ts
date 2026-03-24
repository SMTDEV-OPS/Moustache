import { API_BASE_URL, withAuthHeaders } from "./api";

export interface UserSnippet {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
}

export interface ApprovalRequest {
    _id: string;
    entityType: "ACCOUNT" | "CONTACT" | "LEAD";
    entityName: string;
    payload: unknown;
    status: "PENDING" | "APPROVED" | "REJECTED";
    submittedBy?: UserSnippet;
    reviewedBy?: UserSnippet;
    reviewerNotes?: string;
    createdAt: string;
    updatedAt: string;
}

export const listApprovals = async (status?: string): Promise<ApprovalRequest[]> => {
    const url = new URL(`${API_BASE_URL}/approvals`);
    if (status) url.searchParams.append("status", status);

    const res = await fetch(url.toString(), {
        headers: withAuthHeaders(),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch approvals");
    }
    return res.json();
};

export const approveRequest = async (id: string): Promise<unknown> => {
    const res = await fetch(`${API_BASE_URL}/approvals/${id}/approve`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to approve request");
    }
    return res.json();
};

export const rejectRequest = async (id: string, notes?: string): Promise<unknown> => {
    const res = await fetch(`${API_BASE_URL}/approvals/${id}/reject`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ notes }),
    });
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to reject request");
    }
    return res.json();
};
