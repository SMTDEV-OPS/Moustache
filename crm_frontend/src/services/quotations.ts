import { API_BASE_URL, withAuthHeaders } from "./api";

export type QuotationStatus = "SENT" | "REVISED" | "ACCEPTED" | "REJECTED";
export type SendVia = "EMAIL" | "WHATSAPP";

export interface QuotationRecipient {
  name?: string;
  email?: string;
  phone?: string;
}

export interface Quotation {
  id: string;
  leadId: string;
  versionNumber: number;
  propertyId?: string;
  kbFactsheetId?: string;
  propertyTier?: "HOSTEL" | "SELECT" | "LUXURIA";
  rooms?: number;
  rate?: number;
  taxes?: number;
  rateLines?: {
    roomTypeName: string;
    quantity: number;
    ratePerNight: number;
    hotelName?: string;
  }[];
  hotelQuotes?: {
    propertyId?: string;
    hotelName?: string;
    hotelAddress?: string;
    checkInDate?: string;
    checkOutDate?: string;
    nights?: number;
    rows: {
      roomTypeName?: string;
      mealPlanName?: string;
      ratePlanName?: string;
      roomNo?: string;
      adults?: number;
      children?: number;
      baseRate: number;
      discountPercent: number;
      discountedRate: number;
      taxPercent: number;
      taxAmount: number;
      total: number;
    }[];
    subtotal?: number;
    totalTax?: number;
    grandTotal?: number;
  }[];
  inclusions?: string;
  specialPackages?: string;
  sentVia?: SendVia;
  sentTo?: QuotationRecipient;
  sentAt?: string;
  status: QuotationStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateQuotationPayload {
  rooms?: number;
  rate?: number;
  taxes?: number;
  rateLines?: {
    roomTypeName: string;
    quantity: number;
    ratePerNight: number;
    hotelName?: string;
  }[];
  hotelQuotes?: {
    propertyId?: string;
    hotelName?: string;
    hotelAddress?: string;
    checkInDate?: string;
    checkOutDate?: string;
    nights?: number;
    rows: {
      roomTypeId?: string;
      roomTypeName?: string;
      mealPlanId?: string;
      mealPlanName?: string;
      ratePlanId?: string;
      ratePlanName?: string;
      roomNo?: string;
      adults?: number;
      children?: number;
      baseRate: number;
      discountPercent: number;
      discountedRate: number;
      taxPercent: number;
      taxAmount: number;
      total: number;
    }[];
    subtotal?: number;
    totalTax?: number;
    grandTotal?: number;
  }[];
  inclusions?: string;
  specialPackages?: string;
  sentVia?: SendVia;
  sentTo?: QuotationRecipient;
}

/**
 * Create and send a new quotation for a lead
 */
export const createQuotation = async (
  leadId: string,
  payload: CreateQuotationPayload
): Promise<Quotation> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/quotations`, {
    method: "POST",
    headers: withAuthHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create quotation";
    try {
      const data = await response.json();
      const err = data?.error ?? data;
      if (typeof err?.message === "string") message = err.message;
      const issues = err?.details?.issues;
      if (Array.isArray(issues) && issues.length > 0) {
        const first = issues[0] as { path?: unknown[]; message?: string };
        const path =
          Array.isArray(first.path) && first.path.length > 0
            ? `${first.path.join(".")}: `
            : "";
        message = `${message} (${path}${first.message ?? "invalid"})`;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  } as Quotation;
};

/**
 * Get all quotations for a lead (quotation history)
 */
export const listQuotations = async (leadId: string): Promise<Quotation[]> => {
  const response = await fetch(`${API_BASE_URL}/leads/${leadId}/quotations`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch quotations";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw: any[] = await response.json();
  return raw.map(({ _id, id, ...rest }) => ({
    id: id ?? _id,
    ...rest,
  })) as Quotation[];
};

/**
 * Update quotation status (e.g., mark as ACCEPTED or REJECTED)
 */
export const updateQuotationStatus = async (
  leadId: string,
  quotationId: string,
  status: QuotationStatus
): Promise<Quotation> => {
  const response = await fetch(
    `${API_BASE_URL}/leads/${leadId}/quotations/${quotationId}`,
    {
      method: "PATCH",
      headers: withAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ status }),
    }
  );

  if (!response.ok) {
    let message = "Unable to update quotation";
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
  return {
    id: id ?? _id,
    ...rest,
  } as Quotation;
};

