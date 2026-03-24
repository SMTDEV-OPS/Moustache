import { API_BASE_URL, withAuthHeaders } from "./api";

export type ContactActivityType = "SALES_CALL" | "TELECALL" | "EMAIL" | "CLIENT_SITE_INSPECTION";

export type ContactActivityStatus = "ACTIVE" | "CANCELLED";

export type ContactActivityAttendeeResponse =
  | "NEEDS_ACTION"
  | "ACCEPTED"
  | "DECLINED"
  | "TENTATIVE";

export type ContactActivityAttendeeKind = "INTERNAL" | "EXTERNAL";

export interface ContactActivityAttendee {
  kind: ContactActivityAttendeeKind;
  userId?: string | { _id: string; name?: string; email?: string };
  contactId?: string | { _id: string; name?: string; email?: string };
  name: string;
  email: string;
  responseStatus: ContactActivityAttendeeResponse;
  respondedAt?: string;
}

export interface ContactActivity {
  id: string;
  _id?: string;
  accountId: string;
  contactId: string;
  activityType: ContactActivityType;
  status?: ContactActivityStatus;
  startsAt?: string;
  endsAt?: string;
  category?: string;
  reminderMinutesBefore?: number;
  attendees?: ContactActivityAttendee[];
  purpose?: string;
  discussion?: string;
  output?: string;
  followUp?: string;
  performedByUserId?: { _id: string; name?: string; email?: string };
  performedAt: string;
  leadId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListContactActivitiesQuery {
  accountId: string;
  contactId?: string;
  from?: string;
  to?: string;
  status?: ContactActivityStatus;
}

export const listContactActivities = async (
  accountIdOrQuery: string | ListContactActivitiesQuery,
  contactId?: string
): Promise<ContactActivity[]> => {
  const query: ListContactActivitiesQuery =
    typeof accountIdOrQuery === "string"
      ? { accountId: accountIdOrQuery, contactId }
      : accountIdOrQuery;

  const params = new URLSearchParams({ accountId: query.accountId });
  if (query.contactId) params.set("contactId", query.contactId);
  if (query.from) params.set("from", query.from);
  if (query.to) params.set("to", query.to);
  if (query.status) params.set("status", query.status);
  const response = await fetch(
    `${API_BASE_URL}/contact-activities?${params}`,
    { headers: withAuthHeaders() }
  );
  if (!response.ok) throw new Error("Failed to fetch activities");
  const raw = await response.json();
  return (raw || []).map((a: any) => ({ id: a._id || a.id, ...a }));
};

export const createContactActivity = async (
  payload: Omit<ContactActivity, "id" | "performedAt">
): Promise<ContactActivity> => {
  const response = await fetch(`${API_BASE_URL}/contact-activities`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to create activity");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const updateContactActivity = async (
  id: string,
  payload: Partial<
    Pick<
      ContactActivity,
      | "activityType"
      | "purpose"
      | "discussion"
      | "output"
      | "followUp"
      | "status"
      | "startsAt"
      | "endsAt"
      | "category"
      | "reminderMinutesBefore"
      | "attendees"
    >
  >
): Promise<ContactActivity> => {
  const response = await fetch(`${API_BASE_URL}/contact-activities/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to update activity");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
}

export const cancelContactActivity = async (id: string): Promise<ContactActivity> => {
  const response = await fetch(`${API_BASE_URL}/contact-activities/${id}/cancel`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
  });
  if (!response.ok) throw new Error("Failed to cancel activity");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const rsvpContactActivity = async (
  id: string,
  payload: { responseStatus: ContactActivityAttendeeResponse; attendeeEmail?: string }
): Promise<ContactActivity> => {
  const response = await fetch(`${API_BASE_URL}/contact-activities/${id}/rsvp`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error("Failed to RSVP");
  const raw = await response.json();
  return { id: raw._id || raw.id, ...raw };
};

export const listMyPendingContactActivityReminders = async (): Promise<ContactActivity[]> => {
  const response = await fetch(`${API_BASE_URL}/contact-activities/pending-reminders/me`, {
    headers: withAuthHeaders(),
  });
  if (!response.ok) throw new Error("Failed to fetch pending reminders");
  const raw = await response.json();
  return (raw || []).map((a: any) => ({ id: a._id || a.id, ...a }));
};
