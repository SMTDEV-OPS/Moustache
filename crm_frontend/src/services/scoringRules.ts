import { API_BASE_URL, withAuthHeaders } from "./api";

export interface ScoringCondition {
    field: string;
    operator: "is" | "is_not" | "contains" | "starts_with" | "greater_than" | "less_than" | "is_empty" | "is_not_empty";
    value: any;
}

export interface ScoringRule {
    _id: string;
    name: string;
    description?: string;
    module: "leads" | "tickets";
    isActive: boolean;
    priority: number;
    conditionLogic: "AND" | "OR";
    conditions: ScoringCondition[];
    points: number;
    createdAt?: string;
    updatedAt?: string;
}

export const ScoringService = {
    getRules: async (moduleName: string = "leads"): Promise<ScoringRule[]> => {
        const response = await fetch(`${API_BASE_URL}/scoring-rules?module=${moduleName}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch scoring rules");
        return response.json();
    },

    createRule: async (data: Partial<ScoringRule>): Promise<ScoringRule> => {
        const response = await fetch(`${API_BASE_URL}/scoring-rules`, {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to create scoring rule");
        return response.json();
    },

    updateRule: async (id: string, data: Partial<ScoringRule>): Promise<ScoringRule> => {
        const response = await fetch(`${API_BASE_URL}/scoring-rules/${id}`, {
            method: "PATCH",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update scoring rule");
        return response.json();
    },

    deleteRule: async (id: string): Promise<void> => {
        const response = await fetch(`${API_BASE_URL}/scoring-rules/${id}`, {
            method: "DELETE",
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to delete scoring rule");
    },
};
