import { API_BASE_URL, withAuthHeaders } from "./api";

export interface EmployeeGroup {
  _id: string;
  name: string;
  description?: string;
  teamType?: string;
  isActive: boolean;
}

export interface AssignmentRule {
  id: string;
  leadType: string;
  employeeGroupId: string | EmployeeGroup;
  isActive: boolean;
  priority: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateAssignmentRulePayload {
  leadType: string;
  employeeGroupId: string;
  isActive?: boolean;
  priority?: number;
}

export interface UpdateAssignmentRulePayload {
  employeeGroupId?: string;
  isActive?: boolean;
  priority?: number;
}

export const listAssignmentRules = async (): Promise<AssignmentRule[]> => {
  const response = await fetch(`${API_BASE_URL}/assignment-rules`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch assignment rules";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((r) => {
    const { _id, id, ...rest } = r;
    return { id: id ?? _id, ...rest } as AssignmentRule;
  });
};

export const getAssignmentRule = async (id: string): Promise<AssignmentRule> => {
  const response = await fetch(`${API_BASE_URL}/assignment-rules/${id}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch assignment rule";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id: ruleId, ...rest } = raw;
  return { id: ruleId ?? _id, ...rest } as AssignmentRule;
};

export const getAssignmentRuleByLeadType = async (
  leadType: string
): Promise<AssignmentRule | null> => {
  const response = await fetch(
    `${API_BASE_URL}/assignment-rules/by-lead-type/${leadType}`,
    {
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to fetch assignment rule";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  if (!raw) return null;

  const { _id, id, ...rest } = raw;
  return { id: id ?? _id, ...rest } as AssignmentRule;
};

export const createAssignmentRule = async (
  payload: CreateAssignmentRulePayload
): Promise<AssignmentRule> => {
  const response = await fetch(`${API_BASE_URL}/assignment-rules`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to create assignment rule";
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
  return { id: id ?? _id, ...rest } as AssignmentRule;
};

export const updateAssignmentRule = async (
  id: string,
  payload: UpdateAssignmentRulePayload
): Promise<AssignmentRule> => {
  const response = await fetch(`${API_BASE_URL}/assignment-rules/${id}`, {
    method: "PUT",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update assignment rule";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = await response.json();
  const { _id, id: ruleId, ...rest } = raw;
  return { id: ruleId ?? _id, ...rest } as AssignmentRule;
};

export const deleteAssignmentRule = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/assignment-rules/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete assignment rule";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

