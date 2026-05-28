import { useMemo } from "react";
import {
  addDays,
  format,
  isSameDay,
  isToday,
  startOfWeek,
  endOfWeek,
  addWeeks,
  startOfDay,
} from "date-fns";
import { Button } from "@/components/ui/button";
import { Phone, Calendar, CheckSquare } from "lucide-react";

export interface WeekPlannerEvent {
  id: string;
  title: string;
  subtitle?: string;
  startTime: Date;
  endTime?: Date;
  type: "activity" | "followup" | "task";
  accountName?: string;
  color?: string;
  onClick?: () => void;
}

interface WeekPlannerGridProps {
  events: WeekPlannerEvent[];
  weekStart: Date;
  onWeekStartChange?: (weekStart: Date) => void;
  onSlotClick?: (date: Date, hour: number) => void;
  onEventClick?: (event: WeekPlannerEvent) => void;
  workWeekOnly?: boolean;
}

const TYPE_COLORS = {
  activity: "bg-blue-100 border-blue-400 text-blue-900",
  followup: "bg-amber-100 border-amber-400 text-amber-900",
  task: "bg-violet-100 border-violet-400 text-violet-900",
};

const START_HOUR = 7;
const END_HOUR = 21;
const HOUR_HEIGHT = 56;

function eventIcon(type: WeekPlannerEvent["type"]) {
  if (type === "activity") return <Phone className="h-3 w-3" />;
  if (type === "followup") return <Calendar className="h-3 w-3" />;
  return <CheckSquare className="h-3 w-3" />;
}

export function WeekPlannerGrid({
  events,
  weekStart,
  onWeekStartChange,
  onSlotClick,
  onEventClick,
  workWeekOnly = false,
}: WeekPlannerGridProps) {
  const normalizedWeekStart = startOfWeek(weekStart, { weekStartsOn: 1 });
  const days = useMemo(() => {
    const count = workWeekOnly ? 5 : 7;
    return Array.from({ length: count }, (_, i) => addDays(normalizedWeekStart, i));
  }, [normalizedWeekStart, workWeekOnly]);

  const visibleEvents = useMemo(() => {
    const weekEnd = endOfWeek(normalizedWeekStart, { weekStartsOn: 1 });
    return events.filter((e) => e.startTime >= normalizedWeekStart && e.startTime <= weekEnd);
  }, [events, normalizedWeekStart]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, WeekPlannerEvent[]>();
    for (const day of days) map.set(format(day, "yyyy-MM-dd"), []);
    for (const event of visibleEvents) {
      const key = format(event.startTime, "yyyy-MM-dd");
      if (map.has(key)) map.get(key)!.push(event);
    }
    for (const [, dayEvents] of map) {
      dayEvents.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
    }
    return map;
  }, [days, visibleEvents]);

  const now = new Date();
  const isCurrentWeek = now >= normalizedWeekStart && now <= endOfWeek(normalizedWeekStart, { weekStartsOn: 1 });
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const timelineStart = START_HOUR * 60;
  const timelineEnd = END_HOUR * 60;
  const nowTop =
    nowMinutes >= timelineStart && nowMinutes <= timelineEnd
      ? ((nowMinutes - timelineStart) / 60) * HOUR_HEIGHT
      : -1;

  const slotRows = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">
          {format(normalizedWeekStart, "MMM d")} - {format(endOfWeek(normalizedWeekStart, { weekStartsOn: 1 }), "MMM d, yyyy")}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onWeekStartChange?.(addWeeks(normalizedWeekStart, -1))}>
            Prev
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWeekStartChange?.(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => onWeekStartChange?.(addWeeks(normalizedWeekStart, 1))}>
            Next
          </Button>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-background">
        <div className="grid" style={{ gridTemplateColumns: `80px repeat(${days.length}, minmax(0, 1fr))` }}>
          <div className="border-b px-2 py-3 text-xs text-muted-foreground">Time</div>
          {days.map((day) => (
            <div key={day.toISOString()} className="border-b border-l px-2 py-2">
              <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
              <div
                className={`inline-flex mt-1 h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                  isToday(day) ? "bg-primary text-primary-foreground" : "text-foreground"
                }`}
              >
                {format(day, "d")}
              </div>
            </div>
          ))}

          <div className="relative">
            {slotRows.map((hour) => (
              <div key={hour} className="h-14 border-b px-2 pt-1 text-xs text-muted-foreground">
                {format(new Date().setHours(hour, 0, 0, 0), "h a")}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(dayKey) || [];
            const columns: WeekPlannerEvent[][] = [];
            for (const event of dayEvents) {
              const start = event.startTime.getHours() * 60 + event.startTime.getMinutes();
              const end = event.endTime
                ? event.endTime.getHours() * 60 + event.endTime.getMinutes()
                : start + 30;
              let placed = false;
              for (const col of columns) {
                const last = col[col.length - 1];
                const lastEnd = last.endTime
                  ? last.endTime.getHours() * 60 + last.endTime.getMinutes()
                  : last.startTime.getHours() * 60 + last.startTime.getMinutes() + 30;
                if (lastEnd <= start) {
                  col.push(event);
                  placed = true;
                  break;
                }
              }
              if (!placed) columns.push([event]);
              void end;
            }
            const colCount = Math.max(1, Math.min(columns.length, 3));

            const flattened = columns.flatMap((col, columnIndex) =>
              col.map((event) => ({ event, columnIndex }))
            );
            const hiddenCount = columns.length > 3 ? columns.slice(3).reduce((a, c) => a + c.length, 0) : 0;

            return (
              <div
                key={day.toISOString()}
                className="relative border-l"
                style={{ height: `${(END_HOUR - START_HOUR) * HOUR_HEIGHT}px` }}
              >
                {slotRows.map((hour) => (
                  <button
                    key={`${day.toISOString()}-${hour}`}
                    type="button"
                    className="absolute left-0 right-0 border-b hover:bg-muted/30"
                    style={{ top: `${(hour - START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                    onClick={() => onSlotClick?.(day, hour)}
                  />
                ))}

                {isCurrentWeek && isSameDay(day, now) && nowTop >= 0 && (
                  <div className="absolute left-0 right-0 z-10 border-t-2 border-red-500" style={{ top: `${nowTop}px` }} />
                )}

                {flattened
                  .filter(({ columnIndex }) => columnIndex < 3)
                  .map(({ event, columnIndex }) => {
                    const startMinutes = event.startTime.getHours() * 60 + event.startTime.getMinutes();
                    const endMinutes = event.endTime
                      ? event.endTime.getHours() * 60 + event.endTime.getMinutes()
                      : startMinutes + 30;
                    const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
                    const height = Math.max(28, ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT);
                    const width = `calc(${100 / colCount}% - 6px)`;
                    const left = `calc(${(100 / colCount) * columnIndex}% + 3px)`;
                    return (
                      <button
                        key={event.id}
                        type="button"
                        className={`absolute z-20 rounded border px-2 py-1 text-left text-xs shadow-sm ${event.color ?? TYPE_COLORS[event.type]}`}
                        style={{ top: `${top}px`, height: `${height}px`, width, left }}
                        onClick={() => {
                          event.onClick?.();
                          onEventClick?.(event);
                        }}
                        title={`${event.title}${event.subtitle ? ` - ${event.subtitle}` : ""}`}
                      >
                        <div className="flex items-center gap-1 font-medium">
                          {eventIcon(event.type)}
                          <span className="truncate">{event.title}</span>
                        </div>
                        {event.subtitle && <div className="truncate opacity-90">{event.subtitle}</div>}
                      </button>
                    );
                  })}

                {hiddenCount > 0 && (
                  <div className="absolute bottom-1 left-1 right-1 z-30 rounded bg-background/95 px-2 py-1 text-[11px] text-muted-foreground border">
                    +{hiddenCount} more
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

