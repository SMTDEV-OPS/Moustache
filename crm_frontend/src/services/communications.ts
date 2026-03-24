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
  metadata?: {
    messageId?: string;
    threadId?: string;
    from?: { name?: string; email: string } | string;
    to?: string;
    subject?: string;
  };
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
  to: string;
  subject: string;
  bodyText: string;
  bodyHtml: string;
  threadId?: string;
  replyToMessageId?: string;
  references?: string;
}

export async function sendEmailFromLead(
  leadId: string,
  payload: SendEmailPayload
): Promise<any> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/email/send`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to send email";
    let code: string | undefined;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
      if (data?.code) code = data.code;
    } catch {
      // ignore
    }
    const error = new Error(message) as Error & { code?: string };
    error.code = code;
    throw error;
  }

  const data = await response.json();
  return data.communication ?? data;
}

export async function getLeadEmailThread(
  leadId: string,
  threadId: string
): Promise<CommunicationTimelineItem[]> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/email/thread/${encodeURIComponent(threadId)}`, {
    method: "GET",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error("Unable to fetch email thread");
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

