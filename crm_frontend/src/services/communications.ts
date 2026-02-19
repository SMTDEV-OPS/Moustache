import { API_BASE_URL, withAuthHeaders } from "./api";

export interface CommunicationTimelineItem {
  id: string;
  type: "communication" | "email";
  channel: "CALL" | "EMAIL" | "WHATSAPP" | "SMS";
  direction: "INBOUND" | "OUTBOUND";
  summary?: string;
  messageContent?: string;
  disposition?: string;
  performedByUserId?: string;
  createdAt?: string;
  receivedAt?: string;
  sentAt?: string;
  emailMessageId?: string;
  from?: { name?: string; email: string };
  to?: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  inReplyTo?: string;
  threadId?: string;
}

/**
 * Get unified communication timeline for a lead
 */
export async function getCommunicationTimeline(
  leadId: string
): Promise<CommunicationTimelineItem[]> {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/communication-timeline`,
    {
      method: "GET",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    // Fallback to old endpoint if new one doesn't exist
    if (response.status === 404) {
      return [];
    }
    throw new Error("Unable to fetch communication timeline");
  }

  return response.json();
}

/**
 * Send email from user's account
 */
export interface SendEmailPayload {
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
}

export async function sendEmailFromLead(
  leadId: string,
  payload: SendEmailPayload
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/send-email`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to send email";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Send SMS (placeholder)
 */
export interface SendSMSPayload {
  phone: string;
  message: string;
}

export async function sendSMSFromLead(
  leadId: string,
  payload: SendSMSPayload
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/send-sms`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to send SMS";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Send WhatsApp (placeholder)
 */
export interface SendWhatsAppPayload {
  phone: string;
  message: string;
}

export async function sendWhatsAppFromLead(
  leadId: string,
  payload: SendWhatsAppPayload
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/send-whatsapp`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to send WhatsApp message";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

/**
 * Update call status
 */
export async function updateCallStatus(
  leadId: string,
  callStatus: "QUOTATION_SHARED" | "PAYMENT_PENDING" | "NOT_INTERESTED"
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/call-status`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ callStatus }),
  });

  if (!response.ok) {
    let message = "Unable to update call status";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

