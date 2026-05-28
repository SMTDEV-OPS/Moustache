import { API_BASE_URL, withAuthHeaders } from "./api";

export type WorkflowMedium = "CALL" | "EMAIL" | "WHATSAPP";
export type WorkflowExecutionMode = "AUTO" | "MANUAL" | "BOTH";

export interface EmailTemplateConfig {
  templateId?: string;
  inlineSubject?: string;
  inlineBody?: string;
}

export interface WhatsAppTemplateConfig {
  templateId?: string;
  inlineMessage?: string;
}

export interface StepTemplates {
  email?: EmailTemplateConfig;
  whatsapp?: WhatsAppTemplateConfig;
}

export interface WorkflowStep {
  stepNumber: number;
  name: string;
  offsetDays: number;
  offsetHours?: number;
  mediums: WorkflowMedium[];
  executionMode: WorkflowExecutionMode;
  templates?: StepTemplates;
  possibleOutcomes: string[];
  isActive: boolean;
}

export interface WorkflowCondition {
  leadType?: string;
  source?: string;
  propertyId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  appliesTo?: WorkflowCondition;
  steps: WorkflowStep[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateWorkflowPayload {
  name: string;
  appliesTo?: WorkflowCondition;
  steps: Omit<WorkflowStep, "stepNumber">[];
  isActive?: boolean;
}

export interface UpdateWorkflowPayload {
  name?: string;
  appliesTo?: WorkflowCondition;
  steps?: WorkflowStep[];
  isActive?: boolean;
}

const mapWorkflow = (raw: any): Workflow => {
  const { _id, id, ...rest } = raw;
  return {
    id: id ?? _id,
    ...rest,
  };
};

export const listWorkflows = async (): Promise<Workflow[]> => {
  const response = await fetch(`${API_BASE_URL}/workflows`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch workflows";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map(mapWorkflow);
};

export const getWorkflow = async (id: string): Promise<Workflow> => {
  const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapWorkflow(await response.json());
};

export const createWorkflow = async (
  payload: CreateWorkflowPayload
): Promise<Workflow> => {
  // Auto-assign step numbers
  const stepsWithNumbers = payload.steps.map((step, index) => ({
    ...step,
    stepNumber: index + 1,
  }));

  const response = await fetch(`${API_BASE_URL}/workflows`, {
    method: "POST",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify({
      ...payload,
      steps: stepsWithNumbers,
    }),
  });

  if (!response.ok) {
    let message = "Unable to create workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapWorkflow(await response.json());
};

export const updateWorkflow = async (
  id: string,
  payload: UpdateWorkflowPayload
): Promise<Workflow> => {
  const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    method: "PATCH",
    headers: withAuthHeaders({
      "Content-Type": "application/json",
    }),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let message = "Unable to update workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return mapWorkflow(await response.json());
};

export const deleteWorkflow = async (id: string): Promise<void> => {
  const response = await fetch(`${API_BASE_URL}/workflows/${id}`, {
    method: "DELETE",
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to delete workflow";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
};

