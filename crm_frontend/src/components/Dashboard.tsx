import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  Flame,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Building2,
  Phone,
  ListTodo,
  CalendarClock,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getActionDashboardData,
  formatTatMinutes,
  type ActionDashboardData,
} from "@/services/dashboard";
import {
  getMockCallVolumeMetrics,
  getMockDailyCallSummary,
  CALL_VOLUME_CHART_COLORS,
} from "@/constants/dashboardCallMetrics";
import { ChartTooltip } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Lead, getLeadContactInfo } from "@/services/leads";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface DashboardProps {
  onViewLead?: (leadId: string) => void;
  onViewAllLeads?: () => void;
  onViewAccount?: (accountId: string) => void;
  onNavigateFollowUps?: () => void;
  onNavigateAccounts?: () => void;
  onNavigateCalls?: () => void;
}

const Dashboard = ({
  onViewLead,
  onViewAllLeads,
  onViewAccount,
  onNavigateFollowUps,
  onNavigateAccounts,
  onNavigateCalls,
}: DashboardProps) => {
  const { toast } = useToast();
  const [actionData, setActionData] = useState<ActionDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<"own" | "team" | "all">("own");

  useEffect(() => {
    void loadDashboardData();
  }, [scope]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getActionDashboardData(scope);
      setActionData(data);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to load dashboard data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      LOST: "bg-slate-100 text-slate-500 border-slate-200",
      CLOSED_AUTO: "bg-gray-100 text-gray-500 border-gray-200",
    };
    return styles[status] || styles.NEW;
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
    return <PageSkeleton variant="dashboard" />;
  }

  if (!actionData) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  const { stats, recentLeads, alerts } = actionData.leadData;
  const { taskSummary, openTasks, accountsDueFollowUp, recentActivities, tatSummary } =
    actionData;
  const mockCalls = getMockCallVolumeMetrics();
  const mockDaily = getMockDailyCallSummary();
  const callPieData = [
    { name: "Answered", value: mockCalls.answered, fill: CALL_VOLUME_CHART_COLORS.answered },
    { name: "Missed", value: mockCalls.missed, fill: CALL_VOLUME_CHART_COLORS.missed },
  ];
  const diningToday = tatSummary?.diningInquiriesToday ?? 0;
  const otherInquiriesToday = Math.max(0, stats.todayLeads - diningToday);

  const scopeBtn = (s: typeof scope, label: string) => (
    <Button
      variant={scope === s ? "default" : "outline"}
      size="sm"
      onClick={() => setScope(s)}
      className={cn(scope === s && "bg-primary text-white")}
    >
      {label}
    </Button>
  );

  return (
    <div className="space-y-6 animate-panel-enter">
      <PageHeader
        title={`Good ${getGreeting()}`}
        subtitle="Your priorities for today"
        actions={
          <div className="flex items-center gap-2">
            {scopeBtn("own", "My leads")}
            {scopeBtn("team", "Team")}
            {scopeBtn("all", "All")}
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => onNavigateFollowUps?.()}><Clock className="h-3.5 w-3.5 mr-1.5" />Follow-ups ({taskSummary.overdue + taskSummary.dueToday})</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigateAccounts?.()}><Building2 className="h-3.5 w-3.5 mr-1.5" />Accounts</Button>
        <Button variant="outline" size="sm" onClick={() => onViewAllLeads?.()}><Users className="h-3.5 w-3.5 mr-1.5" />Leads</Button>
        <Button variant="outline" size="sm" onClick={() => onNavigateCalls?.()}><Phone className="h-3.5 w-3.5 mr-1.5" />Call center</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2"><ListTodo className="h-4 w-4" />Action queue</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {openTasks.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No open tasks — you&apos;re caught up.</p>
            ) : (
              openTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors flex items-center justify-between gap-3"
                  onClick={() => {
                    if (task.leadId && onViewLead) onViewLead(task.leadId);
                    else onNavigateFollowUps?.();
                  }}
                >
                  <div>
                    <p className="text-sm font-medium text-text">{task.title}</p>
                    {task.dueAt && <p className="text-xs text-text-muted">Due {format(new Date(task.dueAt), "dd MMM yyyy HH:mm")}</p>}
                  </div>
                  <Badge variant="outline">{task.status}</Badge>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" />Account follow-ups</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {accountsDueFollowUp.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">No account follow-ups due.</p>
            ) : (
              accountsDueFollowUp.map((account) => (
                <button
                  key={account.id}
                  type="button"
                  className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                  onClick={() => onViewAccount?.(account.id)}
                >
                  <p className="text-sm font-medium">{account.name}</p>
                  <p className="text-xs text-text-muted">
                    {account.followUpDate ? format(new Date(account.followUpDate), "dd MMM yyyy") : "—"}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {recentActivities.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Recent account activities</CardTitle>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-border">
            {recentActivities.map((activity) => (
              <button
                key={activity._id}
                type="button"
                className="w-full text-left p-4 hover:bg-muted/40 transition-colors"
                onClick={() => activity.accountId?._id && onViewAccount?.(activity.accountId._id)}
              >
                <p className="text-sm font-medium">{activity.activityType.replace(/_/g, " ")}</p>
                <p className="text-xs text-text-muted">
                  {activity.accountId?.name} · {activity.startsAt ? format(new Date(activity.startsAt), "dd MMM HH:mm") : ""}
                </p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {alerts.length > 0 && (
        <div className="rounded-md border border-warm-bg bg-warm-bg/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="font-semibold text-amber-800">Action Required</span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map((alert, i) => (
              <div
                key={`${alert.leadId}-${alert.type}-${i}`}
                className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-100 cursor-pointer hover:bg-amber-50 transition-colors"
                onClick={() => alert.leadId && onViewLead?.(alert.leadId)}
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-surface shadow-sm">
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Call volume</CardTitle>
            <p className="text-xs text-text-muted mt-1">
              Sample data — connect CTI for live metrics
            </p>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <div className="h-[180px] w-[180px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={callPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={75}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {callPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">{mockCalls.received}</span> received
                </p>
                <p className="text-emerald-600">
                  <span className="font-medium">{mockCalls.answered}</span> answered
                </p>
                <p className="text-rose-600">
                  <span className="font-medium">{mockCalls.missed}</span> missed
                </p>
                <Button variant="link" size="sm" className="h-auto p-0" onClick={() => onNavigateCalls?.()}>
                  Open call center
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Today&apos;s summary</CardTitle>
            <p className="text-xs text-text-muted mt-1">Calls (sample) · leads (live)</p>
          </CardHeader>
          <CardContent className="p-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-muted">Calls received</span>
              <span className="font-medium">{mockDaily.callsReceived}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Calls answered</span>
              <span className="font-medium text-emerald-600">{mockDaily.callsAnswered}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Calls missed</span>
              <span className="font-medium text-rose-600">{mockDaily.callsMissed}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between">
              <span className="text-text-muted">Leads generated</span>
              <span className="font-medium">{stats.todayLeads}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Restaurant inquiries</span>
              <span className="font-medium">{diningToday}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Other inquiries</span>
              <span className="font-medium">{otherInquiriesToday}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold">Response TAT</CardTitle>
            <p className="text-xs text-text-muted mt-1">Turnaround time (calls &amp; email)</p>
          </CardHeader>
          <CardContent className="p-4 space-y-4 text-sm">
            <div>
              <p className="text-text-muted mb-1">Avg call response</p>
              <p className="text-2xl font-semibold text-text">
                {formatTatMinutes(tatSummary?.avgCallResponseMinutes)}
              </p>
              {tatSummary?.callSampleSize != null && tatSummary.callSampleSize > 0 && (
                <p className="text-xs text-text-faint">{tatSummary.callSampleSize} leads sampled</p>
              )}
            </div>
            <div>
              <p className="text-text-muted mb-1">Avg email response</p>
              <p className="text-2xl font-semibold text-text">
                {formatTatMinutes(tatSummary?.avgEmailResponseMinutes)}
              </p>
              {tatSummary?.emailSampleSize != null && tatSummary.emailSampleSize > 0 && (
                <p className="text-xs text-text-faint">{tatSummary.emailSampleSize} threads sampled</p>
              )}
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
                      onClick={() => lead.id && onViewLead?.(lead.id)}
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
                            {lead.status.replace(/_/g, " ")}
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
    </div>
  );
};

export default Dashboard;
