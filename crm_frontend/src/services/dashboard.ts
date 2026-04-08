import { API_BASE_URL, withAuthHeaders } from "./api";
import { Lead } from "./leads";

export interface DashboardStats {
  totalLeads: number;
  todayLeads: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  confirmed: number;
  newLeads: number;
  contacted: number;
  conversionRate: number;
  leadsBySource: Record<string, number>;
}

export interface DashboardAlert {
  leadId: string;
  message: string;
  minutesOld: number;
  type: "checkin_urgent" | "checkin_critical" | "followup_overdue" | "no_response";
}

export interface DashboardData {
  stats: DashboardStats;
  recentLeads: Lead[];
  alerts: DashboardAlert[];
}

function mapSummaryLead(raw: Record<string, unknown>): Lead {
  const { _id, id, ...rest } = raw;
  return {
    id: String(id ?? _id ?? ""),
    ...rest,
  } as Lead;
}

export const getDashboardData = async (scope: "own" | "team" | "all" = "own"): Promise<DashboardData> => {
  try {
    const leadsResponse = await fetch(
      `${API_BASE_URL}/leads/summary?scope=${encodeURIComponent(scope)}`,
      { headers: withAuthHeaders() }
    );

    if (!leadsResponse.ok) {
      throw new Error("Failed to fetch dashboard summary");
    }

    const body = (await leadsResponse.json()) as {
      stats: DashboardStats;
      recentLeads?: Record<string, unknown>[];
      alerts?: DashboardAlert[];
    };

    const recentLeads = (body.recentLeads || []).map((r) => mapSummaryLead(r));

    return {
      stats: body.stats,
      recentLeads,
      alerts: Array.isArray(body.alerts) ? body.alerts : [],
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw error;
  }
};

