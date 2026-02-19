import { API_BASE_URL, withAuthHeaders } from "./api";

export interface PaymentLink {
  id: string;
  leadId: string;
  guestId?: string;
  gateway: "RAZORPAY" | "PAYU" | "HDFC" | "OTHER";
  amount: number;
  currency: string;
  status: "CREATED" | "SENT" | "PARTIALLY_PAID" | "PAID" | "EXPIRED" | "FAILED";
  paymentBreakup?: Array<{
    amount: number;
    paidAt?: string;
  }>;
  externalReference?: string;
  createdAt: string;
  paidAt?: string;
}

export interface CreatePaymentLinkPayload {
  gateway: "RAZORPAY" | "PAYU" | "HDFC" | "OTHER";
  amount: number;
  currency?: string;
}

/**
 * Create payment link for a lead
 */
export async function createPaymentLink(
  leadId: string,
  payload: CreatePaymentLinkPayload
): Promise<PaymentLink> {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/payment-links`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create payment link";
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
  return { id: id ?? _id, ...rest } as PaymentLink;
}

/**
 * Update payment link status
 */
export async function updatePaymentLinkStatus(
  paymentLinkId: string,
  status: PaymentLink["status"]
): Promise<PaymentLink> {
  const response = await fetch(`${API_BASE_URL}/payment-links/${paymentLinkId}/status`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    let message = "Unable to update payment link status";
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
  return { id: id ?? _id, ...rest } as PaymentLink;
}

/**
 * Get payment links for a lead
 */
export async function getPaymentLinksForLead(leadId: string): Promise<PaymentLink[]> {
  // Note: This endpoint might need to be created in the backend
  // For now, we'll use a placeholder that can be updated
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/payment-links`, {
    method: "GET",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    // If endpoint doesn't exist, return empty array
    if (response.status === 404) {
      return [];
    }
    throw new Error("Unable to fetch payment links");
  }

  const raw = await response.json();
  return Array.isArray(raw)
    ? raw.map((item: any) => {
        const { _id, id, ...rest } = item;
        return { id: id ?? _id, ...rest } as PaymentLink;
      })
    : [];
}

