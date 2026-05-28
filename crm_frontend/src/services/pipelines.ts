import { API_BASE_URL, withAuthHeaders } from "./api";

export interface PipelineStage {
    _id: string;
    name: string;
    description?: string;
    order: number;
    color?: string;
    probability?: number;
    isTerminal: boolean;
    terminalType?: "WON" | "LOST";
    pipelineId?: string;
    mandatory_fields_json?: string[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Pipeline {
    _id: string;
    name: string;
    description?: string;
    module: string;
    isActive: boolean;
    isDefault: boolean;
    stages: PipelineStage[];
    createdAt?: string;
    updatedAt?: string;
}

export const PipelineService = {
    getModulePipelines: async (moduleName: string = "leads"): Promise<Pipeline[]> => {
        const response = await fetch(`${API_BASE_URL}/pipelines?module=${moduleName}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch pipelines");
        return response.json();
    },

    getPipeline: async (id: string): Promise<Pipeline> => {
        const response = await fetch(`${API_BASE_URL}/pipelines/${id}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch pipeline");
        return response.json();
    },

    getDefaultPipeline: async (moduleName: string = "leads"): Promise<Pipeline> => {
        const response = await fetch(`${API_BASE_URL}/pipelines/default/${moduleName}`, {
            headers: withAuthHeaders(),
        });
        if (!response.ok) throw new Error("Failed to fetch default pipeline");
        return response.json();
    },

    createPipeline: async (data: Partial<Pipeline>): Promise<Pipeline> => {
        const response = await fetch(`${API_BASE_URL}/pipelines`, {
            method: "POST",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to create pipeline");
        return response.json();
    },

    updatePipeline: async (id: string, data: Partial<Pipeline>): Promise<Pipeline> => {
        const response = await fetch(`${API_BASE_URL}/pipelines/${id}`, {
            method: "PATCH",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(data),
        });
        if (!response.ok) throw new Error("Failed to update pipeline");
        return response.json();
    },

    updateStages: async (pipelineId: string, stages: Partial<PipelineStage>[]): Promise<PipelineStage[]> => {
        const response = await fetch(`${API_BASE_URL}/pipelines/${pipelineId}/stages`, {
            method: "PUT",
            headers: withAuthHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(stages),
        });
        if (!response.ok) throw new Error("Failed to update stages");
        return response.json();
    },
};
