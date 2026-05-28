import { API_BASE_URL, withAuthHeaders } from "./api";
import { Lead } from "./leads";
import { listAccounts, type Account } from "./accounts";
import { getTaskSummary, listTasks, type Task } from "./tasks";
import { getWeekPlannerData, type WeekPlannerActivity } from "./weekPlanner";
import { startOfWeek, endOfWeek } from "date-fns";

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

export const getDashboardData = async (scope: "own" | "team" | "all" = "own"): Promise<DashboardData> => {
  try {
    // Fetch leads for statistics
    const leadsResponse = await fetch(`${API_BASE_URL}/leads?scope=${scope}&limit=1000`, {
      headers: withAuthHeaders(),
    });

    if (!leadsResponse.ok) {
      throw new Error("Failed to fetch leads");
    }

    const allLeads: Lead[] = await leadsResponse.json();

    // Calculate statistics
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayLeads = allLeads.filter(
      (lead) => lead.createdAt && new Date(lead.createdAt) >= today
    ).length;

    const hotLeads = allLeads.filter((lead) => lead.heatLevel === "HOT").length;
    const warmLeads = allLeads.filter((lead) => lead.heatLevel === "WARM").length;
    const coldLeads = allLeads.filter((lead) => lead.heatLevel === "COLD").length;
    const confirmed = allLeads.filter((lead) => lead.status === "CONFIRMED").length;
    const newLeads = allLeads.filter((lead) => lead.status === "NEW").length;
    const contacted = allLeads.filter((lead) => lead.status === "CONTACTED").length;

    const conversionRate =
      allLeads.length > 0 ? Math.round((confirmed / allLeads.length) * 100) : 0;

    // Calculate leads by source
    const leadsBySource: Record<string, number> = {};
    allLeads.forEach((lead) => {
      const source = lead.source || "UNKNOWN";
      leadsBySource[source] = (leadsBySource[source] || 0) + 1;
    });

    // Get recent leads (last 5)
    const recentLeads = allLeads
      .sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      })
      .slice(0, 5);

    // Generate alerts for urgent check-ins and overdue follow-ups
    const alerts: DashboardAlert[] = [];
    const now = new Date().getTime();

    allLeads.forEach((lead) => {
      // Check for urgent check-ins (within 3 days)
      if (lead.checkInDate) {
        const checkInDate = new Date(lead.checkInDate).getTime();
        const daysUntilCheckIn = Math.floor((checkInDate - now) / (1000 * 60 * 60 * 24));
        
        if (daysUntilCheckIn >= 0 && daysUntilCheckIn <= 3) {
          const hoursSinceCreated = lead.createdAt
            ? Math.floor((now - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60))
            : 0;

          if (daysUntilCheckIn <= 1) {
            alerts.push({
              leadId: lead.id,
              message: `Check-in in ${daysUntilCheckIn} day(s) - ${lead.leadNumber}`,
              minutesOld: hoursSinceCreated * 60,
              type: "checkin_critical",
            });
          } else if (daysUntilCheckIn <= 3) {
            alerts.push({
              leadId: lead.id,
              message: `Check-in in ${daysUntilCheckIn} days - ${lead.leadNumber}`,
              minutesOld: hoursSinceCreated * 60,
              type: "checkin_urgent",
            });
          }
        }
      }

      // Check for new leads without response (older than 1 hour)
      if (lead.status === "NEW" && lead.createdAt) {
        const hoursSinceCreated = Math.floor(
          (now - new Date(lead.createdAt).getTime()) / (1000 * 60 * 60)
        );
        if (hoursSinceCreated >= 1) {
          alerts.push({
            leadId: lead.id,
            message: `New lead without response - ${lead.leadNumber}`,
            minutesOld: hoursSinceCreated * 60,
            type: "no_response",
          });
        }
      }
    });

    // Sort alerts by urgency
    alerts.sort((a, b) => {
      const priorityOrder = {
        checkin_critical: 0,
        checkin_urgent: 1,
        followup_overdue: 2,
        no_response: 3,
      };
      return (
        (priorityOrder[a.type] ?? 99) - (priorityOrder[b.type] ?? 99) ||
        a.minutesOld - b.minutesOld
      );
    });

    return {
      stats: {
        totalLeads: allLeads.length,
        todayLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        confirmed,
        newLeads,
        contacted,
        conversionRate,
        leadsBySource,
      },
      recentLeads,
      alerts: alerts.slice(0, 10), // Limit to top 10 alerts
    };
  } catch (error) {
    console.error("Failed to fetch dashboard data:", error);
    throw error;
  }
};

export interface TatSummary {
  avgCallResponseMinutes: number | null;
  callSampleSize: number;
  avgEmailResponseMinutes: number | null;
  emailSampleSize: number;
  diningInquiriesToday?: number;
}

export interface ActionDashboardData {
  leadData: DashboardData;
  taskSummary: { overdue: number; dueToday: number; upcoming: number; completedToday: number };
  openTasks: Task[];
  accountsDueFollowUp: Account[];
  recentActivities: WeekPlannerActivity[];
  tatSummary?: TatSummary | null;
}

export async function getTatSummary(
  scope: "own" | "team" | "all" = "own"
): Promise<TatSummary | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/dashboard/tat-summary?scope=${scope}`, {
      headers: withAuthHeaders(),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function isFollowUpDue(account: Account, mode: "overdue" | "today"): boolean {
  if (!account.followUpDate) return false;
  const d = new Date(account.followUpDate);
  d.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (mode === "today") return d.getTime() === today.getTime();
  return d.getTime() < today.getTime();
}

export const getActionDashboardData = async (
  scope: "own" | "team" | "all" = "own"
): Promise<ActionDashboardData> => {
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  const [leadData, taskSummary, openTasks, accounts, planner, tatSummary] = await Promise.all([
    getDashboardData(scope),
    getTaskSummary().catch(() => ({ overdue: 0, dueToday: 0, upcoming: 0, completedToday: 0 })),
    listTasks({ status: "OPEN" }).catch(() => [] as Task[]),
    listAccounts({ myAccounts: true }).catch(() => [] as Account[]),
    getWeekPlannerData(weekStart, weekEnd).catch(() => ({ activities: [] as WeekPlannerActivity[], accounts: [], tasks: [], followUps: [], range: { from: "", to: "" } })),
    getTatSummary(scope),
  ]);

  const accountsDueFollowUp = accounts
    .filter((a) => isFollowUpDue(a, "overdue") || isFollowUpDue(a, "today"))
    .slice(0, 8);

  const recentActivities = [...(planner.activities || [])]
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .slice(0, 6);

  const sortedTasks = [...openTasks].sort((a, b) => {
    const da = a.dueAt ? new Date(a.dueAt).getTime() : Infinity;
    const db = b.dueAt ? new Date(b.dueAt).getTime() : Infinity;
    return da - db;
  });

  return {
    leadData,
    taskSummary,
    openTasks: sortedTasks.slice(0, 8),
    accountsDueFollowUp,
    recentActivities,
    tatSummary,
  };
};

export function formatTatMinutes(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

