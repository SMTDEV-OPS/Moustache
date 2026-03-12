import { API_BASE_URL, withAuthHeaders } from "./api";

export interface SavedFilter {
  _id: string;
  name: string;
  entity_type: "lead" | "contact" | "deal";
  filter_json: {
    conditions: Array<{ field: string; operator: string; value?: unknown }>;
    logic?: "AND" | "OR";
  };
  orgId: string;
  is_shared?: boolean;
  is_system?: boolean;
  created_by?: string;
}

export interface ApplyFilterParams {
  orgId: string;
  scope?: "own" | "team" | "all";
  page?: number;
  limit?: number;
}

export interface ApplyFilterResult<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export async function listFilters(
  entity: string,
  orgId: string
): Promise<SavedFilter[]> {
  const params = new URLSearchParams({ entity, orgId });
  const response = await fetch(`${API_BASE_URL}/filters?${params}`, {
    headers: withAuthHeaders(),
  });

  if (!response.ok) {
    let message = "Unable to fetch filters";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}

export async function applyFilter<T = unknown>(
  filterId: string,
  params: ApplyFilterParams
): Promise<ApplyFilterResult<T>> {
  const search = new URLSearchParams({
    orgId: params.orgId,
    scope: params.scope ?? "own",
    page: String(params.page ?? 1),
    limit: String(params.limit ?? 25),
  });
  const response = await fetch(
    `${API_BASE_URL}/filters/${filterId}/apply?${search}`,
    {
      method: "POST",
      headers: withAuthHeaders(),
    }
  );

  if (!response.ok) {
    let message = "Unable to apply filter";
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return response.json();
}
