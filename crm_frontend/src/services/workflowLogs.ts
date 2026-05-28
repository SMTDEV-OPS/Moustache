import { API_BASE_URL, withAuthHeaders } from "./api";

export type WorkflowExecutionStatus = "started" | "completed" | "failed" | "skipped";

export interface WorkflowExecutionLog {
  id: string;
  workflowId: { id: string; name?: string; trigger_event?: string } | string;
  leadId: string;
  trigger_event: string;
  status: WorkflowExecutionStatus;
  conditions_result?: boolean;
  actions_summary_json?: Array<{ action_id: string; status: string; error?: string }>;
  executed_at: string;
  createdAt?: string;
}

export async function getWorkflowLogsForLead(
  leadId: string
): Promise<WorkflowExecutionLog[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/admin/workflows/logs/lead/${leadId}`,
    {
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to fetch workflow logs";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const raw = (await response.json()) as any[];
  return raw.map((log: any) => {
    const wf = log.workflowId;
    return {
      id: log._id ?? log.id,
      workflowId:
        typeof wf === "object"
          ? {
              id: wf._id ?? wf.id,
              name: wf.name,
              trigger_event: wf.trigger_event,
            }
          : wf,
      leadId: log.leadId,
      trigger_event: log.trigger_event,
      status: log.status,
      conditions_result: log.conditions_result,
      actions_summary_json: log.actions_summary_json ?? [],
      executed_at: log.executed_at,
      createdAt: log.createdAt,
    };
  });
}
