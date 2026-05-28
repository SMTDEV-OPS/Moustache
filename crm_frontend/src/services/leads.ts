import { API_BASE_URL, withAuthHeaders } from "./api";

export type LeadStatus =
  | "NEW"
  | "IN_PROGRESS"
  | "TENTATIVE"
  | "CONFIRMED"
  | "LOST"
  | "CLOSED_AUTO"
  // Backend values
  | "CONTACTED"
  | "QUOTATION_SHARED"
  | "PAYMENT_PENDING"
  | "PAYMENT_PENDING"
  | "ON_HOLD";

export type LeadSource =
  | "DIRECT_CALL"
  | "UNIT"
  | "EMAIL"
  | "REPEAT_GUEST"
  | "REFERRAL"
  | "CORPORATE_OFFICE"
  | "BRAND_WEBSITE"
  | "SOCIAL"
  | "VIP_MR_CHOPRA"
  | "TRAVEL_AGENT"
  | "WALK_IN"
  | "EVENT_MICE"
  | "IVR"
  | "WHATSAPP"
  | "MANUAL"
  | "CSV_UPLOAD";

export type ClosedReason =
  | "PRICE"
  | "NO_AVAILABILITY"
  | "GUEST_NOT_RESPONDING"
  | "OTHER"
  | "SOLD_OUT"
  | "BUDGET"
  | "BOOKED_OTA"
  | "BOOKED_WEBSITE"
  | "BOOKED_OTHER_PROPERTY"
  | "NO_RESPONSE"
  | "POLICY_UNDER_18"
  | "POLICY_LOCAL_ID"
  | "POLICY_PET"
  | "POLICY_ALCOHOL"
  | "POLICY_CREDIT_CARD"
  | "PROPERTY_MAINTENANCE";

export type HeatLevel = "COLD" | "WARM" | "HOT" | "NOT_INTERESTED";

export interface LeadGuests {
  adults?: number;
  children?: number;
}

/** Snapshot of contact info used for this lead inquiry (preferred for display) */
export interface LeadContactDetails {
  name: string;
  phone?: string;
  email?: string;
}

/** Get display contact info: prefer contactDetails (inquiry snapshot), fall back to guest */
export function getLeadContactInfo(lead: {
  contactDetails?: LeadContactDetails | null;
  guestId?: string | GuestInfo;
}): { name: string; phone: string; email: string } {
  const guest = typeof lead.guestId === "object" && lead.guestId !== null ? lead.guestId : null;
  return {
    name:
      lead.contactDetails?.name ||
      guest?.name ||
      "",
    phone:
      lead.contactDetails?.phone ??
      guest?.phone ??
      "",
    email:
      lead.contactDetails?.email ??
      guest?.email ??
      "",
  };
}

export interface GuestInfo {
  _id?: string;
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
}

export interface AccountInfo {
  _id?: string;
  id?: string;
  name?: string;
  type?: string;
  city?: string;
}

export interface LeadItineraryRoom {
  roomCategory?: string;
  roomPreference?: string;
  numberOfGuests?: string;
}

export interface LeadItinerary {
  id?: string;
  _id?: string;
  hotelName?: string;
  propertyId?: string;
  checkInDate?: string;
  checkOutDate?: string;
  roomCategory?: string;
  roomPreference?: string;
  numberOfGuests?: string;
  /** Multiple rooms per hotel stay */
  rooms?: LeadItineraryRoom[];
}

export interface Lead {
  id: string;
  leadNumber: string;
  guestId?: string | GuestInfo;
  contactDetails?: LeadContactDetails;
  accountId?: string | AccountInfo;
  propertyId?: string;
  source: string;
  leadType: string;
  status: LeadStatus;
  stageId?: string; // New dynamic pipeline stage
  heatLevel: HeatLevel;
  score?: number;     // New field
  budget?: number;    // New field
  bookingWindow?: string; // New field
  customerType?: string;  // New field
  tags?: string[];
  guests?: LeadGuests;
  assignedToUserId?: string;
  assignedRegionId?: string;
  createdAt?: string;
  itineraries?: LeadItinerary[]; // New populated line items
  customData?: Record<string, any>; // Dynamic custom fields
  // Additional form fields
  alternateContact?: string;
  occupation?: string;
  bookingSource?: string;
  specialRequests?: string;
  isCorporateBooking?: boolean;
  companyName?: string;
  pmsReservationId?: string;
  gstin?: string;
  estimatedValue?: string;
  notes?: string;
  closedReason?: string; // Add closedReason
}

export type LeadScope = "own" | "team" | "all";

export interface LeadListQuery {
  status?: string;
  assigneeId?: string;
  propertyId?: string;
  fromDate?: string;
  toDate?: string;
  heat?: string;
  scope?: LeadScope;
}

export type AssignmentMode = "auto" | "manual";

export interface CreateLeadPayload {
  guestId?: string;
  guestContact?: {
    name: string;
    phone?: string;
    email?: string;
  };
  propertyId?: string;
  accountId?: string;
  source: string;
  leadType: string;
  budget?: number;
  bookingWindow?: string;
  customerType?: string;
  hotels?: (Omit<LeadItinerary, 'id' | '_id'> & { rooms?: LeadItineraryRoom[] })[];
  occasion?: string;
  isFirstTimeGuest?: boolean;
  heatLevel?: HeatLevel;
  customData?: Record<string, any>; // Dynamic custom fields
  // Additional form fields
  alternateContact?: string;
  occupation?: string;
  bookingSource?: string;
  specialRequests?: string;
  isCorporateBooking?: boolean;
  companyName?: string;
  gstin?: string;
  estimatedValue?: string;
  notes?: string;
  // Assignment options
  assignmentMode?: AssignmentMode;
  assignedToUserId?: string;
  roomsRequested?: number;
  followUp?: { dueAt: string; notes?: string };
  preserveManualHeatLevel?: boolean;
}

export interface EligibleAssignee {
  id: string;
  name: string;
  email: string;
  openLeadCount: number;
  isOnline: boolean;
}

export interface LeadActivity {
  _id: string;
  type: string;
  note?: string;
  dueAt?: string;
  performedAt?: string;
  performedByUserId?: string | { _id: string; name: string; email?: string };
  fromStatus?: string;
  toStatus?: string;
  // Assignment tracking fields
  fromUserId?: string | { _id: string; name: string; email?: string };
  toUserId?: string | { _id: string; name: string; email?: string };
  assignedByUserId?: string | { _id: string; name: string; email?: string };
  employeeGroupId?: string;
}

export interface LeadCommunication {
  _id: string;
  channel: string;
  direction: string;
  disposition?: string;
  summary?: string;
  messageContent?: string;
  emailMessageId?: string;
  createdAt?: string;
  performedByUserId?: string;
}

export interface LeadDetail {
  lead: Lead;
  activities: LeadActivity[];
  communications: LeadCommunication[];
  previousCommunications?: LeadCommunication[];
}

export interface UpdateLeadPayload {
  status?: LeadStatus;
  stageId?: string;
  heatLevel?: HeatLevel;
  callStatus?: string;
  notes?: string;
  hotels?: Omit<LeadItinerary, 'id' | '_id'>[];
  occasion?: string;
  budget?: number;
  customerType?: string;
  bookingWindow?: string;
  source?: string;
  leadType?: string;
  assignedToUserId?: string;
  contactDetails?: LeadContactDetails;
  closedReason?: string;
  customData?: Record<string, any>;
  accountId?: string;
  estimatedValue?: string;
  alternateContact?: string;
  specialRequests?: string;
  companyName?: string;
  roomsRequested?: number;
}

export const listLeads = async (
  query?: LeadListQuery
): Promise<Lead[]> => {
  const params = new URLSearchParams();
  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }

  const url =
    `${API_BASE_URL}/leads` +
    (params.toString() ? `?${params.toString()}` : "");

  const response = await fetch(url, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch leads";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((l) => {
    const { _id, id, ...rest } = l;
    return {
      id: id ?? _id,
      ...rest,
    } as Lead;
  });
};

export const createLead = async (
  payload: CreateLeadPayload
): Promise<Lead> => {
  const response = await fetch(`${API_BASE_URL}/leads`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create lead";
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
  } as Lead;
};

export interface TestAssignmentPayload {
  source?: string;
  leadType?: string;
  budget?: number;
  bookingWindow?: string;
  customerType?: string;
  customData?: Record<string, any>;
  propertyId?: string;
  accountId?: string;
}

export interface TestAssignmentResult {
  assignment: {
    assignedToUserId?: string;
    assignmentMethod?: string;
    assignmentSource?: string;
    assignmentRuleName?: string;
    isOverflow?: boolean;
    reason?: string;
  };
  orgId?: string;
}

export const testAssignment = async (payload: TestAssignmentPayload): Promise<TestAssignmentResult> => {
  const response = await fetch(`${API_BASE_URL}/leads/test-assignment`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    let message = "Test assignment failed";
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

export const getLeadDetail = async (leadId: string): Promise<LeadDetail> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch lead";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any;
  const { lead, activities, communications, previousCommunications } = raw;
  const { _id, id, guestId, ...rest } = lead ?? {};

  // Handle guestId - can be string ID or populated object
  let mappedGuestId: string | GuestInfo | undefined;
  if (guestId) {
    if (typeof guestId === "string" || typeof guestId === "object") {
      // If it's an object (populated), keep it as is
      // If it's a string, keep it as is
      mappedGuestId = guestId;
    }
  }

  const mappedLead: Lead = {
    id: id ?? _id,
    guestId: mappedGuestId,
    ...rest,
  };

  return {
    lead: mappedLead,
    activities: activities ?? [],
    communications: communications ?? [],
    previousCommunications: previousCommunications ?? [],
  };
};

export const updateLead = async (
  leadId: string,
  payload: UpdateLeadPayload
): Promise<Lead> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update lead";
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
  } as Lead;
};

/**
 * Get eligible users for manual assignment based on lead type
 */
export const getEligibleAssignees = async (
  leadType: string
): Promise<EligibleAssignee[]> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/eligible-assignees?leadType=${encodeURIComponent(leadType)}`,
    {
      headers: withAuthHeaders(),
    }
  );

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

  return response.json();
};

// ============================================
// Lead Workflow State API
// ============================================

export type WorkflowStepStatus = "PENDING" | "EXECUTED" | "SKIPPED";

export interface StepExecutionDetail {
  medium: "CALL" | "EMAIL" | "WHATSAPP";
  mode: "AUTO" | "MANUAL";
  taskId?: string;
  communicationId?: string;
}

export interface StepExecution {
  stepNumber: number;
  scheduledAt: string;
  executedAt?: string;
  status: WorkflowStepStatus;
  executionDetails?: StepExecutionDetail[];
  outcome?: string;
  outcomeNote?: string;
  outcomeRecordedAt?: string;
  outcomeRecordedByUserId?: string;
}

export interface LeadWorkflowState {
  id: string;
  leadId: string;
  workflowId: string | { _id: string; name: string; steps: any[] };
  currentStepNumber: number;
  stepExecutions: StepExecution[];
  isCompleted: boolean;
  isPaused: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadWorkflowStateResponse {
  workflowState: LeadWorkflowState | null;
  message?: string;
}

/**
 * Get workflow state for a lead
 */
export const getLeadWorkflowState = async (
  leadId: string
): Promise<LeadWorkflowStateResponse> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/workflow`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch workflow state";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const data = await response.json();

  // Handle case where no workflow is assigned
  if (data.workflowState === null || data.message) {
    return { workflowState: null, message: data.message };
  }

  // Map the response
  const { _id, id, ...rest } = data;
  return {
    workflowState: {
      id: id ?? _id,
      ...rest,
    },
  };
};

/**
 * Record outcome for a workflow step
 */
export const recordWorkflowOutcome = async (
  leadId: string,
  stepNumber: number,
  outcome: string,
  outcomeNote?: string
): Promise<LeadWorkflowState> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/workflow/record-outcome`,
    {
      method: "POST",
      headers: withAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ stepNumber, outcome, outcomeNote }),
    }
  );

  if (!response.ok) {
    let message = "Unable to record outcome";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest };
};

/**
 * Skip a workflow step
 */
export const skipWorkflowStep = async (
  leadId: string,
  stepNumber: number,
  reason?: string
): Promise<LeadWorkflowState> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/workflow/skip-step`,
    {
      method: "POST",
      headers: withAuthHeaders({
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ stepNumber, reason }),
    }
  );

  if (!response.ok) {
    let message = "Unable to skip step";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest };
};

/**
 * Pause lead workflow
 */
export const pauseLeadWorkflow = async (
  leadId: string
): Promise<LeadWorkflowState> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/workflow/pause`,
    {
      method: "POST",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to pause workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest };
};

/**
 * Resume lead workflow
 */
export const resumeLeadWorkflow = async (
  leadId: string
): Promise<LeadWorkflowState> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/workflow/resume`,
    {
      method: "POST",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to resume workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest };
};

/**
 * Add a note to a lead
 */
export const addLeadNote = async (
  leadId: string,
  note: string
): Promise<LeadActivity> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/notes`, {
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
  return { id: id ?? _id, ...rest } as LeadActivity;
};

