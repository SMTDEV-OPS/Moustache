import { API_BASE_URL, withAuthHeaders } from "./api";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RuleModule = "leads" | "tickets";
export type AssignTo = "group" | "user" | "round_robin_group";
export type ConditionLogic = "AND" | "OR";
export type ConditionOperator =
    | "is"
    | "is_not"
    | "contains"
    | "starts_with"
    | "greater_than"
    | "less_than"
    | "is_empty"
    | "is_not_empty";

export interface RuleCondition {
    field: string;
    operator: ConditionOperator;
    value?: string | number | boolean | string[];
}

export interface AssignmentRuleV2 {
    _id: string;
    name: string;
    description?: string;
    module: RuleModule;
    isActive: boolean;
    priority: number;
    applyToAll: boolean;
    conditionLogic: ConditionLogic;
    conditions: RuleCondition[];
    assignTo: AssignTo;
    employeeGroupId?: string | { _id: string; name?: string; groupName?: string };
    specificUserId?: string | { _id: string; name: string; email: string };
    createdAt: string;
    updatedAt: string;
}

export interface CreateAssignmentRuleV2Payload {
    name: string;
    description?: string;
    module: RuleModule;
    isActive?: boolean;
    priority?: number;
    applyToAll?: boolean;
    conditionLogic?: ConditionLogic;
    conditions?: RuleCondition[];
    assignTo: AssignTo;
    employeeGroupId?: string;
    specificUserId?: string;
}

// ── API helpers ────────────────────────────────────────────────────────────────

const BASE = `${API_BASE_URL}/assignment-rules-v2-api`;

async function handleResponse<T>(res: Response, errMsg: string): Promise<T> {
    if (!res.ok) {
        let message = errMsg;
        try {
            const data = await res.json();
            if (data?.error) message = data.error;
            if (data?.message) message = data.message;
        } catch { /* ignore */ }
        throw new Error(message);
    }
    return res.json();
}

// ── CRUD ───────────────────────────────────────────────────────────────────────

export const listAssignmentRulesV2 = async (module: RuleModule): Promise<AssignmentRuleV2[]> => {
    const res = await fetch(`${BASE}/${module}`, { headers: withAuthHeaders() });
    return handleResponse<AssignmentRuleV2[]>(res, "Unable to fetch rules");
};

export const getAssignmentRuleV2 = async (id: string): Promise<AssignmentRuleV2> => {
    const res = await fetch(`${BASE}/details/${id}`, { headers: withAuthHeaders() });
    return handleResponse<AssignmentRuleV2>(res, "Unable to fetch rule");
};

export const createAssignmentRuleV2 = async (
    payload: CreateAssignmentRuleV2Payload
): Promise<AssignmentRuleV2> => {
    const res = await fetch(BASE, {
        method: "POST",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    return handleResponse<AssignmentRuleV2>(res, "Unable to create rule");
};

export const updateAssignmentRuleV2 = async (
    id: string,
    payload: Partial<CreateAssignmentRuleV2Payload>
): Promise<AssignmentRuleV2> => {
    const res = await fetch(`${BASE}/${id}`, {
        method: "PATCH",
        headers: withAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
    });
    return handleResponse<AssignmentRuleV2>(res, "Unable to update rule");
};

export const deleteAssignmentRuleV2 = async (id: string): Promise<void> => {
    const res = await fetch(`${BASE}/${id}`, {
        method: "DELETE",
        headers: withAuthHeaders(),
    });
    await handleResponse<{ message: string }>(res, "Unable to delete rule");
};
