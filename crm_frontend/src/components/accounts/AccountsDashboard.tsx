import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChartTooltip } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageSkeleton } from "@/components/patterns";
import { cn } from "@/lib/utils";
import { CRM_PATHS } from "@/navigation/crmPaths";
import {
  fetchCalendarEvents,
  fetchConversionFy,
  fetchHolidays,
  fetchTargetsSummary,
  type CalendarEvent,
  type ConversionFy,
  type HolidayEntry,
  type TargetsSummary,
} from "@/services/accountsDashboard";

const PIE_COLORS = { achieved: "#10b981", remaining: "#e2e8f0" };

function TargetsPieCard({
  title,
  summary,
  loading,
}: {
  title: string;
  summary: TargetsSummary | null;
  loading: boolean;
}) {
  const pieData = useMemo(() => {
    if (!summary) return [];
    const achieved = summary.achieved ?? 0;
    const remaining = Math.max(0, summary.remaining ?? 0);
    if (achieved === 0 && remaining === 0) {
      return [{ name: "No target set", value: 1, fill: PIE_COLORS.remaining }];
    }
    return [
      { name: "Achieved", value: achieved, fill: PIE_COLORS.achieved },
      { name: "Remaining", value: remaining, fill: PIE_COLORS.remaining },
    ];
  }, [summary]);

  const metricLabel =
    summary?.metric === "revenue" ? "Revenue (₹)" : "Booked leads";

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {summary && (
          <p className="text-xs text-muted-foreground mt-1">
            Target: {summary.target.toLocaleString()} · {metricLabel}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-4">
        {loading ? (
          <div className="h-[180px] animate-pulse rounded-md bg-muted" />
        ) : (
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <div className="h-[160px] w-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1 text-sm">
              <p>
                <span className="font-medium text-emerald-600">
                  {(summary?.achieved ?? 0).toLocaleString()}
                </span>{" "}
                achieved
              </p>
              <p className="text-muted-foreground">
                {(summary?.remaining ?? 0).toLocaleString()} to target
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AccountsDashboard() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [holidays, setHolidays] = useState<HolidayEntry[]>([]);
  const [mtd, setMtd] = useState<TargetsSummary | null>(null);
  const [ytd, setYtd] = useState<TargetsSummary | null>(null);
  const [conversion, setConversion] = useState<ConversionFy | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const from = format(startOfMonth(month), "yyyy-MM-dd");
      const to = format(endOfMonth(month), "yyyy-MM-dd");
      const [ev, hol, mtdData, ytdData, conv] = await Promise.all([
        fetchCalendarEvents(from, to),
        fetchHolidays(from, to),
        fetchTargetsSummary("mtd"),
        fetchTargetsSummary("ytd"),
        fetchConversionFy("team"),
      ]);
      setEvents(ev);
      setHolidays(hol);
      setMtd(mtdData);
      setYtd(ytdData);
      setConversion(conv);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(month),
        end: endOfMonth(month),
      }),
    [month]
  );

  const startPad = startOfMonth(month).getDay();

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) {
      const key = e.date.slice(0, 10);
      const list = map.get(key) || [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const holidayForDay = (day: Date) =>
    holidays.find((h) => {
      const start = parseISO(h.startDate.slice(0, 10));
      const end = parseISO(h.endDate.slice(0, 10));
      return day >= start && day <= end;
    });

  const dayEvents = selectedDay
    ? eventsByDate.get(format(selectedDay, "yyyy-MM-dd")) || []
    : [];

  if (loading && !mtd) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6 animate-panel-enter">
      <PageHeader
        title="Accounts Dashboard"
        subtitle="Upcoming check-ins, sales targets, and FY conversion"
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <TargetsPieCard title="MTD target vs achieved" summary={mtd} loading={loading} />
        <TargetsPieCard title="YTD target vs achieved" summary={ytd} loading={loading} />
        <Card className="border-border shadow-sm">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              Lead conversion (FY)
            </CardTitle>
            {conversion && (
              <p className="text-xs text-muted-foreground mt-1">
                {format(parseISO(conversion.fyStart), "d MMM yyyy")} –{" "}
                {format(parseISO(conversion.fyEnd), "d MMM yyyy")}
              </p>
            )}
          </CardHeader>
          <CardContent className="p-6">
            <p className="text-4xl font-bold text-primary">
              {conversion ? `${conversion.conversionPct.toFixed(1)}%` : "—"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {conversion?.converted ?? 0} booked of {conversion?.createdInFy ?? 0} created in FY
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Calendar
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Account-linked check-ins and holidays
            </p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth((m) => subMonths(m, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[120px] text-center text-sm font-medium">
              {format(month, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground mb-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEv = eventsByDate.get(key) || [];
              const hol = holidayForDay(day);
              const isSelected = selectedDay && isSameDay(day, selectedDay);
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    "relative min-h-[72px] rounded-md border p-1 text-left text-xs transition-colors",
                    hol?.type === "season" && "bg-amber-50/80 border-amber-100",
                    hol?.type === "public_holiday" && "bg-rose-50/60 border-rose-100",
                    !hol && "border-border hover:bg-muted/50",
                    isSelected && "ring-2 ring-primary",
                    isToday && "font-semibold"
                  )}
                >
                  <span className={cn(!isSameMonth(day, month) && "text-muted-foreground")}>
                    {format(day, "d")}
                  </span>
                  {hol && (
                    <span className="block truncate text-[10px] text-muted-foreground mt-0.5">
                      {hol.name}
                    </span>
                  )}
                  {dayEv.length > 0 && (
                    <span className="absolute bottom-1 left-1 right-1 flex gap-0.5 justify-center">
                      {dayEv.slice(0, 3).map((e) => (
                        <span
                          key={e.id}
                          className="h-1.5 w-1.5 rounded-full bg-primary"
                          title={e.title}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {selectedDay && (
            <div className="mt-4 rounded-md border border-border p-3">
              <p className="text-sm font-medium mb-2">
                {format(selectedDay, "EEEE, d MMMM yyyy")}
              </p>
              {dayEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground">No check-ins scheduled</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((e) => (
                    <li key={e.id} className="flex items-center justify-between text-sm">
                      <span>{e.title}</span>
                      {e.leadId && (
                        <Button
                          variant="link"
                          size="sm"
                          className="h-auto p-0"
                          onClick={() => navigate(CRM_PATHS.leadDetail(e.leadId!))}
                        >
                          View lead
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-primary" /> Check-in
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-6 rounded bg-amber-50 border border-amber-100" /> Season
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-6 rounded bg-rose-50 border border-rose-100" /> Public holiday
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AccountsDashboard;
