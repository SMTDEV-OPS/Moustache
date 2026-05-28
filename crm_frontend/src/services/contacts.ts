import { API_BASE_URL, withAuthHeaders } from "./api";

export type KeyPersonnelRole = "ADMIN_HEAD" | "FINANCE_HEAD" | "SALES_HEAD" | "MARKETING_HEAD" | "COUNTRY_CITY_HEAD" | "ASSISTANT" | "HR_HEAD" | "TRAINING_HEAD";
export type ClientStatus = "PROMOTER" | "NEUTRAL" | "DETRACTOR";

export interface Contact {
    id: string;
    accountId: string;
    title?: string;
    name: string;
    designation?: string;
    isKeyPersonnel: boolean;
    keyPersonnelRole?: KeyPersonnelRole;
    officeAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };
    personalAddress?: {
        addressLine1?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };
    dateOfBirth?: string;
    weddingAnniversary?: string;
    isLoyaltyMember: boolean;
    loyaltyProgramName?: string;
    loyaltyNumber?: string;
    boardNumber?: string;
    officeNumber?: string;
    mobileNumber1?: string;
    mobileNumber2?: string;
    email?: string;
    clientStatus: ClientStatus;
    followUpDate?: string | null;
    followUpNote?: string;
}

export const getAccountContacts = async (accountId: string): Promise<Contact[]> => {
    const response = await fetch(`${API_BASE_URL}/contacts/account/${accountId}`, {
        headers: withAuthHeaders(),
    });
    if (!response.ok) return [];
    const raw = await response.json() as any[];
    return raw.map(c => ({ id: c._id || c.id, ...c }));
};

export const createContact = async (accountId: string, contact: Omit<Contact, "id">): Promise<Contact> => {
    const response = await fetch(`${API_BASE_URL}/contacts/account/${accountId}`, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(contact),
    });
    if (!response.ok) throw new Error("Failed to create contact");
    const raw = await response.json();
    return { id: raw._id || raw.id, ...raw };
};

export const updateContact = async (contactId: string, contact: Partial<Contact>): Promise<Contact> => {
    const response = await fetch(`${API_BASE_URL}/contacts/${contactId}`, {
        method: "PATCH",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(contact),
    });
    if (!response.ok) throw new Error("Failed to update contact");
    const raw = await response.json();
    return { id: raw._id || raw.id, ...raw };
};

export const deleteContact = async (contactId: string): Promise<void> => {
    const response = await fetch(`${API_BASE_URL}/contacts/${contactId}`, {
        method: "DELETE",
        headers: withAuthHeaders(),
    });
    if (!response.ok) throw new Error("Failed to delete contact");
};
