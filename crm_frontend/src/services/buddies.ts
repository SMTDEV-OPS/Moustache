import { API_BASE_URL, withAuthHeaders } from "./api";

export interface BuddyAssignment {
  _id: string;
  userId: {
    _id: string;
    name: string;
    email: string;
      };
  buddyUserId: {
    _id: string;
    name: string;
    email: string;
      };
  effectiveFrom: string;
  effectiveTo?: string;
  reason?: string;
  createdByUserId?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ActiveBuddyAssignment {
  _id: string;
  userId: string;
  buddyUserId: {
    _id: string;
    name: string;
    email: string;
  };
  effectiveFrom: string;
  effectiveTo?: string;
  reason?: string;
}

export interface BuddyReport {
  userId: string;
  fromDate?: string;
  toDate?: string;
  assignmentsCount: number;
  assignedToBuddies: number;
  receivedAsBuddy: number;
  assignments: Array<{
    buddyUserId: string;
    effectiveFrom: string;
    effectiveTo?: string;
    reason?: string;
  }>;
}

export interface CreateBuddyAssignmentInput {
  buddyUserId: string;
  effectiveFrom: string;
  effectiveTo?: string;
  reason?: string;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: withAuthHeaders({
      "Content-Type": "application/json",
      ...options.headers,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

export async function assignBuddy(
  data: CreateBuddyAssignmentInput
): Promise<{ ok: boolean }> {
  return apiRequest(`/buddies/buddy`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getBuddyHistory(): Promise<BuddyAssignment[]> {
  return apiRequest(`/buddies/history`);
}

export async function getActiveBuddyAssignment(): Promise<ActiveBuddyAssignment | null> {
  return apiRequest(`/buddies/active`);
}

export async function getAllBuddyAssignments(): Promise<BuddyAssignment[]> {
  return apiRequest("/buddies/all");
}

export async function getBuddyReport(
  fromDate?: string,
  toDate?: string
): Promise<BuddyReport> {
  const params = new URLSearchParams();
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);
  
  return apiRequest(`/buddies/report?${params.toString()}`);
}

export interface UpdateBuddyAssignmentInput {
  effectiveFrom?: string;
  effectiveTo?: string | null;
  reason?: string;
}

export async function cancelActiveBuddyAssignment(): Promise<{
  ok: boolean;
  message: string;
  cancelledCount: number;
}> {
  return apiRequest(`/buddies/active`, {
    method: "DELETE",
  });
}

export async function cancelBuddyAssignment(
  assignmentId: string
): Promise<{
  ok: boolean;
  message: string;
  assignment: {
    id: string;
    effectiveFrom: string;
    effectiveTo: string;
    wasActive: boolean;
  };
}> {
  return apiRequest(`/buddies/assignment/${assignmentId}`, {
    method: "DELETE",
  });
}

export async function updateBuddyAssignment(
  assignmentId: string,
  data: UpdateBuddyAssignmentInput
): Promise<{
  ok: boolean;
  message: string;
  assignment: {
    id: string;
    effectiveFrom: string;
    effectiveTo?: string;
    reason?: string;
  };
}> {
  return apiRequest(`/buddies/assignment/${assignmentId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

