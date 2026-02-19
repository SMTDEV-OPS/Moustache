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

