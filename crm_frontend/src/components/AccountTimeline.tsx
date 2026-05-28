import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfDay,
  endOfDay,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isToday,
  setHours,
  setMinutes,
} from "date-fns";
import {
  Loader2,
  Plus,
  Calendar,
  Phone,
  Mail,
  FileText,
  MessageSquare,
  ChevronDown,
} from "lucide-react";
import { WeekPlannerGrid, type WeekPlannerEvent } from "@/components/WeekPlannerGrid";
import { ActivityWizard } from "@/components/activities/ActivityWizard";
import { getAccountTimeline, type TimelineItem } from "@/services/accounts";
import { createAccountNote } from "@/services/accountNotes";
import {
  listContactActivities,
  cancelContactActivity,
  type ContactActivity,
} from "@/services/contactActivities";

const VIEW_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "workweek", label: "Work week" },
  { value: "month", label: "Month" },
  { value: "agenda", label: "Agenda" },
] as const;
type CalendarViewMode = (typeof VIEW_OPTIONS)[number]["value"];

const CATEGORY_COLORS: Record<string, string> = {
  Meeting: "bg-blue-100 text-blue-800 border-blue-200",
  "Follow-up": "bg-amber-100 text-amber-800 border-amber-200",
  Inspection: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Email: "bg-violet-100 text-violet-800 border-violet-200",
  Call: "bg-slate-100 text-slate-800 border-slate-200",
};

function getIconForSource(source: TimelineItem["source"]) {
  switch (source) {
    case "contact_activity":
      return <Phone className="h-4 w-4 text-blue-500" />;
    case "lead_activity":
      return <Calendar className="h-4 w-4 text-amber-500" />;
    case "communication":
      return <Mail className="h-4 w-4 text-emerald-500" />;
    case "note":
      return <FileText className="h-4 w-4 text-slate-500" />;
    default:
      return <MessageSquare className="h-4 w-4" />;
  }
}

function getSourceLabel(source: TimelineItem["source"]) {
  switch (source) {
    case "contact_activity":
      return "Activity";
    case "lead_activity":
      return "Lead";
    case "communication":
      return "Communication";
    case "note":
      return "Note";
    default:
      return source;
  }
}

interface AccountTimelineProps {
  accountId: string;
  /** When false, show only contact activities (no unified timeline). */
  useUnifiedTimeline?: boolean;
  canAddNote?: boolean;
  canAddActivity?: boolean;
}

export function AccountTimeline({ accountId, useUnifiedTimeline = true, canAddNote = true, canAddActivity = true }: AccountTimelineProps) {
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<CalendarViewMode>("agenda");
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [activities, setActivities] = useState<ContactActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [activityInitialDate, setActivityInitialDate] = useState<Date | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteContent, setNoteContent] = useState("");
  const hasLoadedOnce = useRef(false);

  const timelineFetchKey = useMemo(() => {
    if (useUnifiedTimeline) return `unified:${accountId}`;
    if (viewMode === "month") return `month:${accountId}:${format(currentMonth, "yyyy-MM")}`;
    if (viewMode === "day") return `day:${accountId}:${format(selectedDate, "yyyy-MM-dd")}`;
    if (viewMode === "week" || viewMode === "workweek") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
      return `week:${accountId}:${format(start, "yyyy-MM-dd")}:${viewMode}`;
    }
    return `agenda:${accountId}`;
  }, [accountId, useUnifiedTimeline, viewMode, currentMonth, selectedDate]);

  const loadTimeline = useCallback(async (opts?: { from?: Date; to?: Date }) => {
    const showFullSpinner = !hasLoadedOnce.current;
    if (showFullSpinner) setLoading(true);
    try {
      if (useUnifiedTimeline) {
        const data = await getAccountTimeline(accountId);
        setItems(data);
      } else {
        const query =
          opts?.from || opts?.to
            ? {
                accountId,
                from: opts?.from?.toISOString(),
                to: opts?.to?.toISOString(),
              }
            : accountId;
        const acts = await listContactActivities(query as any);
        setActivities(acts);
        const mapped: TimelineItem[] = (acts || []).map((a: any) => ({
          id: a._id || a.id,
          source: "contact_activity",
          date: a.startsAt || a.performedAt,
          summary: `${a.activityType?.replace(/_/g, " ")}${a.contactId?.name ? ` • ${a.contactId.name}` : ""}${a.category ? ` • ${a.category}` : ""}`,
          detail: a,
        }));
        mapped.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        setItems(mapped);
      }
    } catch (err) {
      toast({
        title: "Error",
        description: useUnifiedTimeline ? "Failed to load timeline" : "Failed to load activities",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [accountId, useUnifiedTimeline, toast]);

  useEffect(() => {
    hasLoadedOnce.current = false;
  }, [accountId]);

  useEffect(() => {
    const now = new Date();
    if (useUnifiedTimeline) {
      void loadTimeline();
      return;
    }
    if (viewMode === "month") {
      void loadTimeline({ from: startOfMonth(currentMonth), to: endOfMonth(currentMonth) });
      return;
    }
    if (viewMode === "day") {
      void loadTimeline({ from: startOfDay(selectedDate), to: endOfDay(selectedDate) });
      return;
    }
    if (viewMode === "week" || viewMode === "workweek") {
      const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
      const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
      void loadTimeline({ from: start, to: end });
      return;
    }
    const from = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    void loadTimeline({ from, to: new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000) });
  }, [timelineFetchKey, loadTimeline, useUnifiedTimeline, viewMode, currentMonth, selectedDate]);

  const openActivityWizard = (date: Date) => {
    if (!canAddActivity) return;
    setActivityInitialDate(date);
    setIsActivityDialogOpen(true);
  };

  const handleActivityDialogChange = (open: boolean) => {
    setIsActivityDialogOpen(open);
    if (!open) setActivityInitialDate(undefined);
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      toast({ title: "Validation", description: "Note content is required", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    try {
      await createAccountNote(accountId, noteContent.trim());
      setIsNoteDialogOpen(false);
      setNoteContent("");
      await loadTimeline();
      toast({ title: "Success", description: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to add note", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      });
    } catch {
      return d;
    }
  };

  const getActivitiesForDay = (day: Date) =>
    items.filter((i) => isSameDay(new Date(i.date), day));

  const getCategoryBadgeClass = (category?: string) => {
    if (!category) return "bg-muted text-muted-foreground border-border";
    return CATEGORY_COLORS[category] || "bg-muted text-muted-foreground border-border";
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const selectedDateActivities = useMemo(
    () => items.filter((i) => isSameDay(new Date(i.date), selectedDate)),
    [items, selectedDate]
  );

  const monthStart = startOfMonth(currentMonth);
  const firstDayOfWeek = monthStart.getDay();
  const daysBeforeMonth = Array.from({ length: firstDayOfWeek }, () => null);

  const showInitialSpinner = loading && !hasLoadedOnce.current;

  if (showInitialSpinner) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-surface p-0.5" role="group">
          {VIEW_OPTIONS.map((v) => (
            <Button
              key={v.value}
              variant={viewMode === v.value ? "secondary" : "ghost"}
              size="sm"
              className="h-8"
              onClick={() => setViewMode(v.value)}
            >
              {v.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAddNote && (
            <Button onClick={() => setIsNoteDialogOpen(true)} variant="outline" size="sm">
              <FileText className="h-4 w-4 mr-2" /> Add note
            </Button>
          )}
          {canAddActivity && (
            <Button onClick={() => setIsActivityDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Add activity
            </Button>
          )}
        </div>
      </div>

      {viewMode === "agenda" ? (
        items.length === 0 ? (
          <Card className="border-border bg-surface">
            <CardContent className="py-14 text-center">
              <Calendar className="h-12 w-12 mx-auto mb-3 text-text-muted opacity-50" />
              <p className="font-medium text-text">No activities yet</p>
              <p className="text-sm text-text-muted mt-1 max-w-sm mx-auto">
                Log calls, meetings, and follow-ups to build your account timeline.
              </p>
              {canAddActivity && (
                <div className="flex justify-center gap-2 mt-5">
                  {canAddNote && (
                    <Button variant="outline" onClick={() => setIsNoteDialogOpen(true)}>
                      Add note
                    </Button>
                  )}
                  <Button onClick={() => setIsActivityDialogOpen(true)}>Add activity</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <Collapsible key={`${item.source}-${item.id}`} defaultOpen={false}>
                <Card className="border-border">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                      <div className="mt-0.5">{getIconForSource(item.source)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {getSourceLabel(item.source)}
                          </Badge>
                          {item.source === "contact_activity" && item.detail?.category && (
                            <Badge variant="outline" className={`text-xs ${getCategoryBadgeClass(item.detail.category)}`}>
                              {item.detail.category}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {formatDate(item.date)}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1 truncate">{item.summary}</p>
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-0 border-t border-border">
                      {item.source === "contact_activity" && item.detail && (
                        <div className="pt-3 space-y-2 text-sm">
                          {(item.detail.startsAt || item.detail.endsAt) && (
                            <div>
                              <span className="font-medium text-muted-foreground">When: </span>
                              <span>
                                {item.detail.startsAt ? formatDate(item.detail.startsAt) : "—"}{" "}
                                {item.detail.endsAt ? `→ ${formatDate(item.detail.endsAt)}` : ""}
                              </span>
                            </div>
                          )}
                          {item.detail.purpose && (
                            <div>
                              <span className="font-medium text-muted-foreground">Purpose: </span>
                              <span>{item.detail.purpose}</span>
                            </div>
                          )}
                          {item.detail.discussion && (
                            <div>
                              <span className="font-medium text-muted-foreground">Discussion: </span>
                              <span>{item.detail.discussion}</span>
                            </div>
                          )}
                          {item.detail.output && (
                            <div>
                              <span className="font-medium text-muted-foreground">Output: </span>
                              <span>{item.detail.output}</span>
                            </div>
                          )}
                          {item.detail.followUp && (
                            <div>
                              <span className="font-medium text-muted-foreground">Follow-up: </span>
                              <span>{item.detail.followUp}</span>
                            </div>
                          )}
                        </div>
                      )}
                      {item.source === "note" && item.detail?.content && (
                        <div className="pt-3 text-sm whitespace-pre-wrap">{item.detail.content}</div>
                      )}
                      {item.source === "communication" && item.detail?.summary && (
                        <div className="pt-3 text-sm">{item.detail.summary}</div>
                      )}
                      {item.source === "lead_activity" && item.detail?.note && (
                        <div className="pt-3 text-sm">{item.detail.note}</div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        )
      ) : viewMode === "month" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <Card className="lg:col-span-1 border-border">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">
                  {viewMode === "month"
                    ? "Month"
                    : viewMode === "day"
                      ? "Day"
                      : viewMode === "week"
                        ? "Week"
                        : "Work week"}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (viewMode === "month") {
                        const prev = new Date(currentMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setCurrentMonth(prev);
                      } else if (viewMode === "day") {
                        setSelectedDate(addDays(selectedDate, -1));
                      } else {
                        setSelectedDate(addDays(selectedDate, -7));
                      }
                    }}
                  >
                    ‹
                  </Button>
                  <span className="text-sm font-medium min-w-[100px] text-center">
                    {viewMode === "month"
                      ? format(currentMonth, "MMMM yyyy")
                      : viewMode === "day"
                        ? format(selectedDate, "MMM d, yyyy")
                        : `${format(startOfWeek(selectedDate, { weekStartsOn: 0 }), "MMM d")}–${format(
                            endOfWeek(selectedDate, { weekStartsOn: 0 }),
                            "MMM d"
                          )}`}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (viewMode === "month") {
                        const next = new Date(currentMonth);
                        next.setMonth(next.getMonth() + 1);
                        setCurrentMonth(next);
                      } else if (viewMode === "day") {
                        setSelectedDate(addDays(selectedDate, 1));
                      } else {
                        setSelectedDate(addDays(selectedDate, 7));
                      }
                    }}
                  >
                    ›
                  </Button>
                </div>
              </div>

              {viewMode === "month" ? (
                <>
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="text-xs font-semibold text-muted-foreground text-center py-2">
                        {day}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {daysBeforeMonth.map((_, idx) => (
                      <div key={`empty-${idx}`} className="aspect-square" />
                    ))}
                    {calendarDays.map((day) => {
                      const dayActivities = getActivitiesForDay(day);
                      const isSelected = isSameDay(day, selectedDate);
                      const isTodayDate = isToday(day);

                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(day)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setSelectedDate(day);
                            openActivityWizard(day);
                          }}
                          title={
                            canAddActivity
                              ? "Click to select day · Double-click to add activity"
                              : undefined
                          }
                          className={`aspect-square rounded-sm text-sm transition-colors ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : isTodayDate
                                ? "bg-accent text-accent-foreground font-semibold"
                                : "hover:bg-muted text-foreground"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span>{format(day, "d")}</span>
                            {dayActivities.length > 0 && (
                              <div className="flex gap-0.5 mt-0.5 justify-center">
                                {dayActivities.length <= 3
                                  ? dayActivities.map((_, i) => (
                                      <div
                                        key={i}
                                        className={`h-1.5 w-1.5 rounded-full ${
                                          isSelected ? "bg-primary-foreground/60" : "bg-primary"
                                        }`}
                                      />
                                    ))
                                  : (
                                      <span className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-primary"}`}>
                                        {dayActivities.length}
                                      </span>
                                    )}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-7 gap-1">
                    {(viewMode === "day"
                      ? [selectedDate]
                      : eachDayOfInterval({
                          start: startOfWeek(selectedDate, { weekStartsOn: 0 }),
                          end: endOfWeek(selectedDate, { weekStartsOn: 0 }),
                        }).filter((d) => (viewMode === "workweek" ? d.getDay() >= 1 && d.getDay() <= 5 : true))
                    ).map((day) => {
                      const dayActivities = getActivitiesForDay(day);
                      const isSelected = isSameDay(day, selectedDate);
                      const isTodayDate = isToday(day);
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => setSelectedDate(day)}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            setSelectedDate(day);
                            openActivityWizard(day);
                          }}
                          title={
                            canAddActivity
                              ? "Click to select · Double-click to add activity"
                              : undefined
                          }
                          className={`rounded-md border border-border px-2 py-2 text-left hover:bg-muted ${
                            isSelected ? "bg-muted" : ""
                          }`}
                        >
                          <div className="text-xs font-semibold">{format(day, "EEE d")}</div>
                          <div className={`text-[10px] ${isTodayDate ? "text-primary" : "text-muted-foreground"}`}>
                            {dayActivities.length} events
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Week/work-week/day views are rendered as a Teams-style date strip in v1; the hour-grid layout will be
                    added next.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Day detail panel */}
          <div className="lg:col-span-2 space-y-2">
            <h3 className="font-semibold text-sm text-muted-foreground">
              Activities for {format(selectedDate, "MMMM d, yyyy")}
            </h3>
            {selectedDateActivities.length === 0 ? (
              <div className="py-4 space-y-2">
                <p className="text-sm text-muted-foreground">No activities on this day.</p>
                {canAddActivity && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openActivityWizard(selectedDate)}
                  >
                    <Plus className="h-4 w-4 mr-2" /> Add activity on this day
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {selectedDateActivities.map((item) => (
                  <Collapsible key={`${item.source}-${item.id}`} defaultOpen={false}>
                    <Card className="border-border">
                      <CollapsibleTrigger asChild>
                        <div className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/50 rounded-lg transition-colors">
                          <div className="mt-0.5">{getIconForSource(item.source)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {getSourceLabel(item.source)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {formatDate(item.date)}
                              </span>
                            </div>
                            <p className="text-sm font-medium mt-1 truncate">{item.summary}</p>
                          </div>
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-0 border-t border-border">
                          {item.source === "contact_activity" && item.detail && (
                            <div className="pt-3 space-y-2 text-sm">
                              {item.detail.purpose && (
                                <div>
                                  <span className="font-medium text-muted-foreground">Purpose: </span>
                                  <span>{item.detail.purpose}</span>
                                </div>
                              )}
                              {item.detail.discussion && (
                                <div>
                                  <span className="font-medium text-muted-foreground">Discussion: </span>
                                  <span>{item.detail.discussion}</span>
                                </div>
                              )}
                              {item.detail.output && (
                                <div>
                                  <span className="font-medium text-muted-foreground">Output: </span>
                                  <span>{item.detail.output}</span>
                                </div>
                              )}
                              {item.detail.followUp && (
                                <div>
                                  <span className="font-medium text-muted-foreground">Follow-up: </span>
                                  <span>{item.detail.followUp}</span>
                                </div>
                              )}
                            </div>
                          )}
                          {item.source === "note" && item.detail?.content && (
                            <div className="pt-3 text-sm whitespace-pre-wrap">{item.detail.content}</div>
                          )}
                          {item.source === "communication" && item.detail?.summary && (
                            <div className="pt-3 text-sm">{item.detail.summary}</div>
                          )}
                          {item.source === "lead_activity" && item.detail?.note && (
                            <div className="pt-3 text-sm">{item.detail.note}</div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <WeekPlannerGrid
          events={items
            .filter((item) => {
              const d = new Date(item.date);
              if (viewMode === "day") {
                return isSameDay(d, selectedDate);
              }
              const ws = startOfWeek(selectedDate, { weekStartsOn: 1 });
              const we = endOfWeek(selectedDate, { weekStartsOn: 1 });
              if (viewMode === "workweek") {
                const day = d.getDay();
                return d >= ws && d <= we && day >= 1 && day <= 5;
              }
              return d >= ws && d <= we;
            })
            .map((item) => ({
              id: item.id,
              title: item.summary || "Activity",
              subtitle:
                item.source === "contact_activity"
                  ? item.detail?.contactId?.name || item.detail?.accountId?.name
                  : item.detail?.accountId?.name,
              startTime: new Date(item.date),
              endTime: item.detail?.endsAt ? new Date(item.detail.endsAt) : undefined,
              type:
                item.source === "note"
                  ? "task"
                  : item.source === "contact_activity"
                    ? "activity"
                    : "followup",
            })) as WeekPlannerEvent[]}
          weekStart={viewMode === "day" ? startOfWeek(selectedDate, { weekStartsOn: 1 }) : startOfWeek(selectedDate, { weekStartsOn: 1 })}
          workWeekOnly={viewMode === "workweek"}
          onWeekStartChange={(nextWeekStart) => setSelectedDate(nextWeekStart)}
          onSlotClick={(day, hour) => {
            const slotStart = setHours(setMinutes(day, 0), hour);
            openActivityWizard(slotStart);
          }}
        />
      )}

      {/* Add Note Dialog */}
      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label>Note</Label>
            <Textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Enter your note..."
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote} disabled={isSubmitting || !noteContent.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Add Note
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ActivityWizard
        open={isActivityDialogOpen}
        onOpenChange={handleActivityDialogChange}
        accountId={accountId}
        initialDate={activityInitialDate}
        onSuccess={loadTimeline}
      />
    </div>
  );
}
