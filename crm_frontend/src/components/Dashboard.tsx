import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHelp } from "@/components/help/PageHelp";
import {
  Users,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Loader2,
  Layers,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getDashboardData, DashboardData, StageDistributionRow } from "@/services/dashboard";
import { listUsers, User } from "@/services/users";
import { Lead, getLeadContactInfo } from "@/services/leads";

const PIPELINE_BAR_FALLBACK_COLORS = [
  "#6366f1",
  "#3b82f6",
  "#0ea5e9",
  "#f59e0b",
  "#8b5cf6",
  "#22c55e",
  "#ef4444",
];

interface DashboardProps {
  onViewLead?: (leadId: string) => void;
  onViewAllLeads?: () => void;
}

const DASHBOARD_POLL_MS = 900_000;

const Dashboard = ({ onViewLead, onViewAllLeads }: DashboardProps) => {
  const { toast } = useToast();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"own" | "team" | "all">("own");

  const loadDashboardData = async (options?: { silent?: boolean }) => {
    try {
      if (!options?.silent) setLoading(true);
      const data = await getDashboardData(scope);
      setDashboardData(data);
    } catch (error) {
      if (!options?.silent) {
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to load dashboard data",
          variant: "destructive",
        });
      }
    } finally {
      if (!options?.silent) setLoading(false);
    }
  };

  useEffect(() => {
    void loadDashboardData();
    void loadUsers();
  }, [scope]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboardData({ silent: true });
    }, DASHBOARD_POLL_MS);
    return () => window.clearInterval(interval);
  }, [scope]);

  const loadUsers = async () => {
    try {
      const allUsers = await listUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  const getHeatBadge = (heat: string) => {
    const styles: Record<string, string> = {
      HOT: "bg-rose-50 text-rose-600 border-rose-200",
      WARM: "bg-amber-50 text-amber-600 border-amber-200",
      COLD: "bg-slate-100 text-slate-500 border-slate-200",
      NOT_INTERESTED: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[heat] || styles.COLD;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      NEW: "bg-blue-50 text-blue-600 border-blue-200",
      CONTACTED: "bg-purple-50 text-purple-600 border-purple-200",
      QUOTATION_SHARED: "bg-amber-50 text-amber-600 border-amber-200",
      PAYMENT_PENDING: "bg-yellow-50 text-yellow-600 border-yellow-200",
      CONFIRMED: "bg-emerald-50 text-emerald-600 border-emerald-200",
      CANCELLED: "bg-orange-50 text-orange-600 border-orange-200",
      LOST: "bg-slate-100 text-slate-500 border-slate-200",
      CLOSED_AUTO: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || styles.NEW;
  };

  const getStatusLabel = (lead: Lead): string => {
    if (lead.stageName?.trim()) return lead.stageName.trim();
    return lead.status.replace(/_/g, " ");
  };

  const getGuestName = (lead: Lead): string => {
    const { name } = getLeadContactInfo(lead);
    return name || "Unknown Guest";
  };

  const getPropertyName = (lead: Lead): string => {
    if (typeof lead.propertyId === "object" && lead.propertyId !== null) {
      return (lead.propertyId as any).name || lead.propertyId || "Not specified";
    }
    return lead.propertyId || "Not specified";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const { stats, recentLeads, alerts, stageDistribution } = dashboardData;
  const pipelineTotal =
    stageDistribution?.reduce((sum, row) => sum + row.count, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold text-slate-900">
              Good {getGreeting()}!
            </h1>
            <PageHelp title="Dashboard" relatedView="dashboard" />
          </div>
          <p className="text-slate-500 mt-1">Here's your hotel lead overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={scope === "own" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope("own")}
          >
            My Leads
          </Button>
          <Button
            variant={scope === "team" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope("team")}
          >
            Team Leads
          </Button>
          <Button
            variant={scope === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setScope("all")}
          >
            All Leads
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Action Required</span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert, i) => (
              <div
                key={`${alert.leadId}-${alert.type}-${i}`}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => {
                  console.log("Dashboard - Clicked alert with leadId:", alert.leadId);
                  if (alert.leadId) {
                    onViewLead?.(alert.leadId);
                  } else {
                    console.error("Dashboard - Alert has no leadId:", alert);
                  }
                }}
              >
                <span className="text-sm text-slate-700">{alert.message}</span>
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  {Math.floor(alert.minutesOld / 60)}h {alert.minutesOld % 60}m
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                <p className="text-sm text-muted-foreground mb-1">Total Leads</p>
                <p className="text-3xl font-bold text-slate-900">{stats.totalLeads}</p>
              </div>
              <div className="h-12 w-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Users className="h-6 w-6 text-slate-600" />
                  </div>
                </div>
            <div className="mt-4 flex items-center text-sm">
              <ArrowUpRight className="h-4 w-4 text-emerald-600 mr-1" />
              <span className="text-emerald-600 font-medium">+{stats.todayLeads}</span>
              <span className="text-slate-500 ml-1">today</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
                    <div>
                <p className="text-sm text-muted-foreground mb-1">Hot Leads</p>
                <p className="text-3xl font-bold text-rose-600">{stats.hotLeads}</p>
                    </div>
              <div className="h-12 w-12 bg-rose-50 rounded-lg flex items-center justify-center">
                <Flame className="h-6 w-6 text-rose-500" />
                  </div>
                </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-500">Warm: {stats.warmLeads}</span>
              <span className="text-slate-300 mx-2">|</span>
              <span className="text-slate-500">Cold: {stats.coldLeads}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
                    <div>
                <p className="text-sm text-muted-foreground mb-1">Confirmed</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.confirmed}</p>
                    </div>
              <div className="h-12 w-12 bg-emerald-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                  </div>
            <div className="mt-4 flex items-center text-sm">
              <TrendingUp className="h-4 w-4 text-emerald-600 mr-1" />
              <span className="text-emerald-600 font-medium">{stats.conversionRate}%</span>
              <span className="text-slate-500 ml-1">conversion</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Pending Action</p>
                <p className="text-3xl font-bold text-amber-600">{stats.newLeads}</p>
                    </div>
              <div className="h-12 w-12 bg-amber-50 rounded-lg flex items-center justify-center">
                <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                </div>
            <div className="mt-4 flex items-center text-sm">
              <span className="text-slate-500">Contacted: {stats.contacted}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leads */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 p-6">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xl font-bold">Recent Leads</CardTitle>
              <Button
                variant="ghost"
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                onClick={() => onViewAllLeads?.()}
              >
                View All
              </Button>
            </div>
        </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-100">
              {recentLeads.length === 0 ? (
                <div className="p-8 text-center text-slate-500">
                  No leads yet. Create your first lead!
                </div>
              ) : (
                recentLeads.map((lead, index) => {
                  const guestName = getGuestName(lead);
                  const propertyName = getPropertyName(lead);
                  return (
                    <div
                      key={lead.id || `lead-${index}`}
                      className="p-4 hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => {
                        console.log("Dashboard - Clicked lead with id:", lead.id, "lead:", lead);
                        if (lead.id) {
                          onViewLead?.(lead.id);
                        } else {
                          console.error("Dashboard - Lead has no id:", lead);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-slate-900 rounded-full flex items-center justify-center text-white font-medium">
                            {guestName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{guestName}</p>
                            <p className="text-sm text-slate-500">
                              {propertyName} • {lead.source}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getHeatBadge(lead.heatLevel)}>
                            {lead.heatLevel}
                          </Badge>
                          <Badge variant="outline" className={getStatusBadge(lead.status)}>
                            {getStatusLabel(lead)}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
          </div>
        </CardContent>
      </Card>

        {/* Lead Sources */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 p-6">
            <CardTitle className="text-xl font-bold">Lead Sources</CardTitle>
        </CardHeader>
          <CardContent className="p-6">
            {stats.leadsBySource && Object.keys(stats.leadsBySource).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(stats.leadsBySource)
                  .sort(([, a], [, b]) => (b as number) - (a as number))
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span className="text-sm text-slate-600 capitalize">
                          {source.replace(/_/g, " ")}
                        </span>
              </div>
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {count as number}
                      </span>
            </div>
                  ))}
              </div>
            ) : (
              <div className="text-center text-slate-500 py-8">No data yet</div>
            )}
        </CardContent>
      </Card>
      </div>

      {/* Pipeline Stages */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-6">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <Layers className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Pipeline stages
                </CardTitle>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {pipelineTotal > 0
                    ? `${pipelineTotal} lead${pipelineTotal === 1 ? "" : "s"} in this view`
                    : "No leads in this view yet"}
                </p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {stageDistribution && stageDistribution.length > 0 ? (
            <div className="space-y-4">
              {stageDistribution.map((row: StageDistributionRow, index: number) => {
                const share =
                  pipelineTotal > 0 ? Math.round((row.count / pipelineTotal) * 100) : 0;
                const barWidthPct =
                  pipelineTotal > 0 ? Math.max((row.count / pipelineTotal) * 100, row.count > 0 ? 2 : 0) : 0;
                const accent =
                  row.color ?? PIPELINE_BAR_FALLBACK_COLORS[index % PIPELINE_BAR_FALLBACK_COLORS.length];
                return (
                  <div
                    key={row.stage_id}
                    className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/40"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900"
                        style={{ backgroundColor: accent }}
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                            {row.stage_name}
                          </p>
                          <div className="flex shrink-0 items-baseline gap-2 tabular-nums">
                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {row.count}
                            </span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">
                              {pipelineTotal > 0 ? `${share}%` : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/90 dark:bg-slate-800">
                          <div
                            className="h-full rounded-full transition-[width] duration-500 ease-out"
                            style={{
                              width: `${barWidthPct}%`,
                              backgroundColor: accent,
                              opacity: row.count > 0 ? 0.92 : 0.2,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-slate-500 dark:text-slate-400">
              No default leads pipeline configured, or no stages yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
