import { API_BASE_URL, withAuthHeaders } from "./api";

export type CustomFieldType = "TEXT" | "NUMBER" | "DATE" | "DROPDOWN" | "BOOLEAN" | "TEXTAREA";
export type CustomFieldModule = "leads" | "contacts" | "accounts" | "tickets";

// Represents an option for dropdown fields
export interface CustomFieldOption {
    label: string;
    value: string;
}

// Represents the structure of a custom field definition from the backend
export interface CustomFieldDefinition {
    _id: string;
    module: CustomFieldModule;
    fieldName: string;
    label: string;
    dataType: CustomFieldType;
    options?: CustomFieldOption[];
    isRequired: boolean;
    order: number;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
}

// DTO for creating or updating a custom field
export interface CustomFieldPayload {
    module: CustomFieldModule;
    fieldName: string;
    label: string;
    dataType: CustomFieldType;
    options?: CustomFieldOption[];
    isRequired?: boolean;
    order?: number;
    isActive?: boolean;
}

export const CustomFieldsService = {
    /**
     * Fetch all active custom fields for a specific module (used by standard UI forms)
     */
    getActiveFieldsForModule: async (moduleName: CustomFieldModule): Promise<CustomFieldDefinition[]> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields/module/${moduleName}`, { headers: withAuthHeaders() });
        if (!response.ok) throw new Error("Failed to fetch fields");
        return response.json();
    },

    /**
     * Fetch ALL custom fields (active/inactive) for a module (used by Admin Module Builder)
     */
    getAllFieldsForModuleParams: async (moduleName: CustomFieldModule): Promise<CustomFieldDefinition[]> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields/admin/module/${moduleName}`, { headers: withAuthHeaders() });
        if (!response.ok) throw new Error("Failed to fetch admin fields");
        return response.json();
    },

    /**
     * Create a new custom field definition
     */
    createField: async (payload: CustomFieldPayload): Promise<CustomFieldDefinition> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields`, {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to create field");
        return response.json();
    },

    /**
     * Update an existing custom field definition
     */
    updateField: async (id: string, payload: Partial<CustomFieldPayload>): Promise<CustomFieldDefinition> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields/${id}`, {
            method: "PUT",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to update field");
        return response.json();
    },

    /**
     * Soft delete / deactivate a custom field
     */
    deactivateField: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields/${id}`, { method: "DELETE", headers: withAuthHeaders() });
        if (!response.ok) throw new Error("Failed to deactivate field");
    },

    /**
     * Reorder custom fields vertically in the UI
     */
    reorderFields: async (orderedIds: string[]): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/custom-fields/reorder`, {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ orderedIds }),
        });
        if (!response.ok) throw new Error("Failed to reorder fields");
    },
};
