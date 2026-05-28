import { API_BASE_URL, withAuthHeaders } from "./api";

export type TicketStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "RESOLVED"
  | "CLOSED"
  | "CANCELLED";

export type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TicketCategory =
  | "TECHNICAL"
  | "BILLING"
  | "GENERAL"
  | "FEATURE_REQUEST"
  | "BUG_REPORT";

export interface GuestInfo {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface UserInfo {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  guestId?: string | GuestInfo;
  accountId?: string;
  propertyId?: string;
  assignedToUserId?: string | UserInfo;
  assignedTeamType?: string;
  assignedRegionId?: string;
  createdByUserId?: string | UserInfo;
  resolvedAt?: string;
  resolvedByUserId?: string | UserInfo;
  resolutionNotes?: string;
  tags?: string[];
  attachments?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export type TicketScope = "own" | "team" | "all";

export interface TicketListQuery {
  status?: string;
  assigneeId?: string;
  priority?: string;
  category?: string;
  scope?: TicketScope;
}

export type AssignmentMode = "auto" | "manual";

export interface CreateTicketPayload {
  title: string;
  description: string;
  category: TicketCategory;
  priority?: TicketPriority;
  guestId?: string;
  accountId?: string;
  propertyId?: string;
  assignedToUserId?: string;
  tags?: string[];
  assignmentMode?: AssignmentMode;
}

export interface EligibleAssignee {
  id: string;
  name: string;
  email: string;
  teamType?: string;
}

export interface TicketActivity {
  _id: string;
  type: string;
  note?: string;
  performedAt?: string;
  performedByUserId?: string | UserInfo;
  fromStatus?: string;
  toStatus?: string;
  fromPriority?: string;
  toPriority?: string;
  // Assignment tracking fields
  fromUserId?: string | UserInfo;
  toUserId?: string | UserInfo;
  assignedByUserId?: string | UserInfo;
}

export interface TicketDetail {
  ticket: Ticket;
  activities: TicketActivity[];
}

export interface UpdateTicketPayload {
  status?: TicketStatus;
  priority?: TicketPriority;
  title?: string;
  description?: string;
  category?: TicketCategory;
  assignedToUserId?: string;
  tags?: string[];
}

export const listTickets = async (
  query?: TicketListQuery
): Promise<Ticket[]> => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const url =
    `${API_BASE_URL}/tickets` +
    (params.toString() ? `?${params.toString()}` : "");

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch tickets";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((t) => {
    const { _id, id, ...rest } = t;
    return {
      id: id ?? _id,
      ...rest,
    } as Ticket;
  });
};

export const createTicket = async (
  payload: CreateTicketPayload
): Promise<Ticket> => {
  const response = await fetch(`${API_BASE_URL}/tickets`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create ticket";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Ticket;
};

export const getTicketDetail = async (
  ticketId: string
): Promise<TicketDetail> => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch ticket";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { ticket, activities } = raw;
  const { _id, id, guestId, assignedToUserId, createdByUserId, resolvedByUserId, ...rest } =
    ticket ?? {};

  // Handle populated fields
  let mappedGuestId: string | GuestInfo | undefined;
  if (guestId) {
    if (typeof guestId === "string" || typeof guestId === "object") {
      mappedGuestId = guestId;
    }
  }

  let mappedAssignedToUserId: string | UserInfo | undefined;
  if (assignedToUserId) {
    if (typeof assignedToUserId === "string" || typeof assignedToUserId === "object") {
      mappedAssignedToUserId = assignedToUserId;
    }
  }

  let mappedCreatedByUserId: string | UserInfo | undefined;
  if (createdByUserId) {
    if (typeof createdByUserId === "string" || typeof createdByUserId === "object") {
      mappedCreatedByUserId = createdByUserId;
    }
  }

  let mappedResolvedByUserId: string | UserInfo | undefined;
  if (resolvedByUserId) {
    if (typeof resolvedByUserId === "string" || typeof resolvedByUserId === "object") {
      mappedResolvedByUserId = resolvedByUserId;
    }
  }

  const mappedTicket: Ticket = {
    id: id ?? _id,
    guestId: mappedGuestId,
    assignedToUserId: mappedAssignedToUserId,
    createdByUserId: mappedCreatedByUserId,
    resolvedByUserId: mappedResolvedByUserId,
    ...rest,
  };

  return {
    ticket: mappedTicket,
    activities: activities ?? [],
  };
};

export const updateTicket = async (
  ticketId: string,
  payload: UpdateTicketPayload
): Promise<Ticket> => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update ticket";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Ticket;
};

/**
 * Get eligible users for manual assignment
 */
export const getEligibleAssignees = async (): Promise<EligibleAssignee[]> => {
  const response = await fetch(`${API_BASE_URL}/tickets/eligible-assignees`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch eligible assignees";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((u) => {
    const { _id, id, ...rest } = u;
    return {
      id: id ?? _id,
      ...rest,
    } as EligibleAssignee;
  });
};

/**
 * Add a note to a ticket
 */
export const addTicketNote = async (
  ticketId: string,
  note: string
): Promise<TicketActivity> => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/notes`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    let message = "Unable to add note";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest } as TicketActivity;
};

/**
 * Resolve a ticket
 */
export const resolveTicket = async (
  ticketId: string,
  resolutionNotes?: string
): Promise<Ticket> => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/resolve`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ resolutionNotes }),
  });

  if (!response.ok) {
    let message = "Unable to resolve ticket";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest } as Ticket;
};

/**
 * Reopen a ticket
 */
export const reopenTicket = async (
  ticketId: string,
  note?: string
): Promise<Ticket> => {
  const response = await fetch(`${API_BASE_URL}/tickets/${ticketId}/reopen`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ note }),
  });

  if (!response.ok) {
    let message = "Unable to reopen ticket";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest } as Ticket;
};

/**
 * Add an activity to a ticket
 */
export const addTicketActivity = async (
  ticketId: string,
  type: string,
  note?: string
): Promise<TicketActivity> => {
  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/activities`,
    {
      method: "POST",
      headers: withAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ type, note }),
    }
  );

  if (!response.ok) {
    let message = "Unable to add activity";
    try {
      const data = await response.json();
      if (data?.message) {
        message = data.message;
      } else if (data?.error?.message) {
        message = data.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest } as TicketActivity;
};

/**
 * Get activities for a ticket
 */
export const getTicketActivities = async (
  ticketId: string
): Promise<TicketActivity[]> => {
  const response = await fetch(
    `${API_BASE_URL}/tickets/${ticketId}/activities`,
    {
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to fetch activities";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((a) => {
    const { _id, id, ...rest } = a;
    return { id: id ?? _id, ...rest } as TicketActivity;
  });
};

