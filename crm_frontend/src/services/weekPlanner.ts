import { API_BASE_URL, withAuthHeaders } from "./api";

export interface WeekPlannerActivity {
  _id: string;
  activityType: string;
  category?: string;
  startsAt: string;
  endsAt?: string;
  purpose?: string;
  contactId?: { name: string };
  accountId?: { _id: string; name: string };
}

export interface WeekPlannerTask {
  _id: string;
  title: string;
  dueAt: string;
  type: string;
  status: string;
  accountId?: { _id: string; name: string };
}

export interface WeekPlannerFollowUp {
  _id: string;
  name: string;
  followUpDate: string;
  followUpNote?: string;
}

export interface WeekPlannerAccount {
  _id: string;
  name: string;
  followUpDate?: string;
  followUpNote?: string;
}

export interface WeekPlannerData {
  accounts: WeekPlannerAccount[];
  activities: WeekPlannerActivity[];
  tasks: WeekPlannerTask[];
  followUps: WeekPlannerFollowUp[];
  range: { from: string; to: string };
}

export const getWeekPlannerData = async (
  from: Date,
  to: Date
): Promise<WeekPlannerData> => {
  const params = new URLSearchParams({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  const res = await fetch(`${API_BASE_URL}/accounts/week-planner?${params.toString()}`, {
    headers: withAuthHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch week planner data");
  return res.json();
};

export const createAccountTask = async (data: {
  title: string;
  description?: string;
  accountId: string;
  dueAt: string;
  type?: string;
}): Promise<WeekPlannerTask> => {
  const res = await fetch(`${API_BASE_URL}/tasks`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ ...data, ownerUserId: "me" }),
  });
  if (!res.ok) throw new Error("Failed to create task");
  return res.json();
};

