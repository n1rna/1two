"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CalendarDays,
  ChevronDown,
  Loader2,
  RefreshCw,
  Sparkles,
  Sun,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useKim } from "@/components/kim";
import type { KimSelection } from "@/components/kim";
import {
  disconnectGCal,
  exchangeGCalCode,
  getDaySummaries,
  getGCalAuthUrl,
  getGCalStatus,
  getLifeProfile,
  listGCalEvents,
  type DaySummary,
  type GCalEvent,
  type GCalStatus,
} from "@/lib/life";
import { useTranslation } from "react-i18next";

// ─── Timezone context ─────────────────────────────────────────────────────────

const browserTz = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
})();

const CalendarTzContext = createContext<string>(browserTz);

function useTz(): string {
  return useContext(CalendarTzContext);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the year/month/day/hour/minute of `d` as seen in the given timezone. */
function partsInTz(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  // Intl returns "24" for midnight in hour12:false mode — normalise to 0.
  const rawHour = map.hour === "24" ? "0" : map.hour;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(rawHour),
    minute: Number(map.minute),
  };
}

function dateKeyInTz(d: Date, tz: string): string {
  const p = partsInTz(d, tz);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function hourOfDayInTz(d: Date, tz: string): number {
  const p = partsInTz(d, tz);
  return p.hour + p.minute / 60;
}

function formatEventTime(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(new Date(isoString));
}

function formatDayHeader(dateStr: string, tz: string): string {
  // dateStr is a tz-local YYYY-MM-DD. Compare against today's tz-local key.
  const todayKey = dateKeyInTz(new Date(), tz);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowKey = dateKeyInTz(tomorrow, tz);

  // Build a Date anchored at noon UTC on that day so toLocaleDateString renders
  // the correct weekday/month/day regardless of browser zone.
  const anchor = new Date(`${dateStr}T12:00:00Z`);
  const dayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: tz,
  }).format(anchor);

  if (dateStr === todayKey) return `Today, ${dayLabel}`;
  if (dateStr === tomorrowKey) return `Tomorrow, ${dayLabel}`;
  return dayLabel;
}

function formatWeekdayShort(dateStr: string, tz: string): string {
  const anchor = new Date(`${dateStr}T12:00:00Z`);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    timeZone: tz,
  }).format(anchor);
}

function formatDayNumber(dateStr: string): string {
  // dateStr is YYYY-MM-DD; the day-of-month digits are literally the last two.
  return String(Number(dateStr.slice(8, 10)));
}

// ─── Calendar grid helpers ────────────────────────────────────────────────────

const CAL_START_HOUR = 0;
const CAL_END_HOUR = 24;
const TOTAL_HOURS = CAL_END_HOUR - CAL_START_HOUR;

/** Step a tz-local YYYY-MM-DD day key by ±N days without drifting across zones. */
function addDaysToKey(key: string, days: number): string {
  const base = new Date(`${key}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, "0")}-${String(base.getUTCDate()).padStart(2, "0")}`;
}

function isTodayKey(key: string, tz: string): boolean {
  return key === dateKeyInTz(new Date(), tz);
}

function getEventFraction(isoString: string, tz: string): number {
  const hours = hourOfDayInTz(new Date(isoString), tz);
  return (hours - CAL_START_HOUR) / TOTAL_HOURS;
}

function getDurationFraction(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
  return Math.max(durationHours / TOTAL_HOURS, 30 / (60 * TOTAL_HOURS));
}

function getCurrentTimeFraction(tz: string): number {
  const hours = hourOfDayInTz(new Date(), tz);
  return (hours - CAL_START_HOUR) / TOTAL_HOURS;
}

function getEventsForDateKey(
  events: GCalEvent[],
  dateKey: string,
  tz: string,
): GCalEvent[] {
  return events.filter((ev) => {
    if (ev.allDay) {
      // allDay events come back as a YYYY-MM-DD string in `start`.
      return ev.start === dateKey || ev.start.slice(0, 10) === dateKey;
    }
    return dateKeyInTz(new Date(ev.start), tz) === dateKey;
  });
}

type CalView = "day" | "week";

// ─── Header ───────────────────────────────────────────────────────────────────

function CalendarHeader({
  view,
  setView,
  currentKey,
  onPrev,
  onNext,
  onToday,
  onRefresh,
  refreshing,
  showSummary,
  onToggleSummary,
}: {
  view: CalView;
  setView: (v: CalView) => void;
  currentKey: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  showSummary?: boolean;
  onToggleSummary?: () => void;
}) {
  const { t } = useTranslation("calendar");
  const tz = useTz();
  const label = (() => {
    if (view === "day") {
      return formatDayHeader(currentKey, tz);
    }
    const endKey = addDaysToKey(currentKey, 6);
    const startAnchor = new Date(`${currentKey}T12:00:00Z`);
    const endAnchor = new Date(`${endKey}T12:00:00Z`);
    const fmt = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      timeZone: tz,
    });
    return `${fmt.format(startAnchor)} – ${fmt.format(endAnchor)}`;
  })();

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40 shrink-0 flex-wrap">
      <button
        onClick={onPrev}
        className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label={t("previous_aria")}
      >
        <ChevronDown className="h-3.5 w-3.5 rotate-90" />
      </button>
      <span className="text-sm font-semibold min-w-[140px] text-center select-none">{label}</span>
      <button
        onClick={onNext}
        className="h-6 w-6 flex items-center justify-center rounded-md border border-border/50 hover:bg-muted text-muted-foreground hover:text-foreground"
        aria-label={t("next_aria")}
      >
        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
      </button>

      <button onClick={onToday} className="text-xs text-primary hover:underline ml-1">
        {t("today_btn")}
      </button>

      <div className="flex-1" />

      <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5 gap-0.5">
        {(["day", "week"] as CalView[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "text-xs px-3 py-1 font-medium rounded-md transition-all",
              view === v
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {v === "day" ? t("view_day") : t("view_week")}
          </button>
        ))}
      </div>

      {onToggleSummary && (
        <button
          onClick={onToggleSummary}
          className={cn(
            "flex items-center gap-1 px-2 h-7 rounded-md text-xs font-medium border",
            showSummary
              ? "bg-primary/10 text-primary border-primary/30"
              : "text-muted-foreground hover:text-foreground border-border/60 hover:bg-muted/50",
          )}
          title={showSummary ? t("summary_hide_tooltip") : t("summary_show_tooltip")}
        >
          <Sun className="h-3 w-3" />
          <span className="hidden sm:inline">{t("summary_btn")}</span>
        </button>
      )}

      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50"
          title={t("refresh_events_tooltip")}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        </button>
      )}
    </div>
  );
}

// ─── Grid pieces ──────────────────────────────────────────────────────────────

function TimeGutter({ hourHeight }: { hourHeight: number }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => CAL_START_HOUR + i);
  return (
    <div className="shrink-0 w-14 relative" style={{ height: TOTAL_HOURS * hourHeight }}>
      {hours.map((h) => (
        <div
          key={h}
          className="absolute right-2 -translate-y-1/2 text-[10px] uppercase tracking-wide text-muted-foreground/50 leading-none select-none text-right"
          style={{ top: (h - CAL_START_HOUR) * hourHeight }}
        >
          {String(h % 24).padStart(2, "0")}
        </div>
      ))}
    </div>
  );
}

function HourLines({ hourHeight }: { hourHeight: number }) {
  const hours = Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => i);
  return (
    <>
      {hours.map((i) => (
        <div key={i}>
          <div
            className="absolute left-0 right-0 border-t border-border/20 pointer-events-none"
            style={{ top: i * hourHeight }}
          />
          {i < TOTAL_HOURS && (
            <div
              className="absolute left-0 right-0 border-t border-border/10 border-dashed pointer-events-none"
              style={{ top: i * hourHeight + hourHeight / 2 }}
            />
          )}
        </div>
      ))}
    </>
  );
}

function CurrentTimeBar({ hourHeight }: { hourHeight: number }) {
  const tz = useTz();
  const fraction = getCurrentTimeFraction(tz);
  if (fraction < 0 || fraction > 1) return null;
  const top = fraction * TOTAL_HOURS * hourHeight;
  return (
    <div className="absolute left-0 right-0 pointer-events-none z-20" style={{ top }}>
      <div className="relative flex items-center">
        <div className="h-[6px] w-[6px] rounded-full bg-red-500/80 shrink-0 -ml-[3px]" />
        <div className="flex-1 h-px bg-red-500/80" />
      </div>
    </div>
  );
}

// ─── Overlap layout ───────────────────────────────────────────────────────────

interface LayoutedEvent {
  ev: GCalEvent;
  col: number;
  totalCols: number;
}

function layoutEvents(events: GCalEvent[]): LayoutedEvent[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => {
    const diff = new Date(a.start).getTime() - new Date(b.start).getTime();
    if (diff !== 0) return diff;
    return (
      new Date(b.end).getTime() -
      new Date(b.start).getTime() -
      (new Date(a.end).getTime() - new Date(a.start).getTime())
    );
  });

  const result: LayoutedEvent[] = [];
  const columns: number[] = [];

  for (const ev of sorted) {
    const start = new Date(ev.start).getTime();
    const end = new Date(ev.end).getTime();
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      if (columns[c] <= start) {
        columns[c] = end;
        result.push({ ev, col: c, totalCols: 0 });
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push(end);
      result.push({ ev, col: columns.length - 1, totalCols: 0 });
    }
  }

  for (const item of result) {
    const s = new Date(item.ev.start).getTime();
    const e = new Date(item.ev.end).getTime();
    let maxCol = item.col;
    for (const other of result) {
      const os = new Date(other.ev.start).getTime();
      const oe = new Date(other.ev.end).getTime();
      if (os < e && oe > s) {
        maxCol = Math.max(maxCol, other.col);
      }
    }
    item.totalCols = maxCol + 1;
  }

  return result;
}

// ─── Event colors ─────────────────────────────────────────────────────────────

const GCAL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  "1":  { bg: "bg-[#7986cb]/25", border: "border-[#7986cb]", text: "text-[#7986cb]" },
  "2":  { bg: "bg-[#33b679]/25", border: "border-[#33b679]", text: "text-[#33b679]" },
  "3":  { bg: "bg-[#8e24aa]/25", border: "border-[#8e24aa]", text: "text-[#8e24aa]" },
  "4":  { bg: "bg-[#e67c73]/25", border: "border-[#e67c73]", text: "text-[#e67c73]" },
  "5":  { bg: "bg-[#f6bf26]/25", border: "border-[#f6bf26]", text: "text-[#f6bf26]" },
  "6":  { bg: "bg-[#f4511e]/25", border: "border-[#f4511e]", text: "text-[#f4511e]" },
  "7":  { bg: "bg-[#039be5]/25", border: "border-[#039be5]", text: "text-[#039be5]" },
  "8":  { bg: "bg-[#616161]/25", border: "border-[#616161]", text: "text-[#616161]" },
  "9":  { bg: "bg-[#3f51b5]/25", border: "border-[#3f51b5]", text: "text-[#3f51b5]" },
  "10": { bg: "bg-[#0b8043]/25", border: "border-[#0b8043]", text: "text-[#0b8043]" },
  "11": { bg: "bg-[#d50000]/25", border: "border-[#d50000]", text: "text-[#d50000]" },
};

const FALLBACK_COLORS = [
  { bg: "bg-blue-500/20",    border: "border-blue-500",    text: "text-blue-500" },
  { bg: "bg-emerald-500/20", border: "border-emerald-500", text: "text-emerald-500" },
  { bg: "bg-violet-500/20",  border: "border-violet-500",  text: "text-violet-500" },
  { bg: "bg-teal-500/20",   border: "border-teal-500",   text: "text-teal-500" },
  { bg: "bg-rose-500/20",    border: "border-rose-500",    text: "text-rose-500" },
  { bg: "bg-cyan-500/20",    border: "border-cyan-500",    text: "text-cyan-500" },
  { bg: "bg-pink-500/20",    border: "border-pink-500",    text: "text-pink-500" },
  { bg: "bg-teal-500/20",    border: "border-teal-500",    text: "text-teal-500" },
];

function getEventColor(ev: GCalEvent) {
  if (ev.colorId && GCAL_COLORS[ev.colorId]) return GCAL_COLORS[ev.colorId];
  let hash = 0;
  const s = ev.summary || ev.id;
  for (let i = 0; i < s.length; i++) hash = ((hash << 5) - hash + s.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(hash) % FALLBACK_COLORS.length];
}

// ─── Skeleton + event block + all-day ─────────────────────────────────────────

function EventSkeletons({ hourHeight, count = 3, compact, seed = 0 }: { hourHeight: number; count?: number; compact?: boolean; seed?: number }) {
  const skeletons = useMemo(() => {
    let h = seed;
    const next = () => { h = ((h * 1103515245 + 12345) & 0x7fffffff); return h; };
    const items: { startHour: number; duration: number }[] = [];
    for (let i = 0; i < (count ?? 3); i++) {
      const startHour = CAL_START_HOUR + 1 + (next() % (TOTAL_HOURS - 4));
      const duration = 0.5 + (next() % 3) * 0.5;
      items.push({ startHour, duration });
    }
    items.sort((a, b) => a.startHour - b.startHour);
    for (let i = 1; i < items.length; i++) {
      const prev = items[i - 1];
      if (items[i].startHour < prev.startHour + prev.duration + 0.5) {
        items[i].startHour = prev.startHour + prev.duration + 0.5;
      }
    }
    return items.filter((s) => s.startHour + s.duration <= CAL_END_HOUR);
  }, [count, seed]);

  return (
    <>
      {skeletons.map((s, i) => {
        const top = (s.startHour - CAL_START_HOUR) * hourHeight;
        const height = s.duration * hourHeight;
        return (
          <div
            key={i}
            className="absolute left-1 right-1 rounded-md bg-muted/40 animate-pulse border-l-[3px] border-muted-foreground/20 shadow-sm"
            style={{ top, height: Math.max(height, 20) }}
          >
            <div className="px-1.5 py-1 space-y-1">
              <div className={cn("rounded bg-muted-foreground/10", compact ? "h-1.5 w-10" : "h-2.5 w-20")} />
              {!compact && height > 30 && (
                <div className="h-2 w-14 rounded bg-muted-foreground/10" />
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}

function eventSelection(ev: GCalEvent): KimSelection {
  return {
    kind: "event",
    id: ev.id,
    label: ev.summary || "(No title)",
    snapshot: {
      summary: ev.summary,
      start: ev.start,
      end: ev.end,
      allDay: ev.allDay,
      location: ev.location,
      routineName: ev.routineName,
      htmlLink: ev.htmlLink,
    },
  };
}

function EventBlock({
  ev,
  hourHeight,
  compact,
  col,
  totalCols,
  isSummary,
}: {
  ev: GCalEvent;
  hourHeight: number;
  compact: boolean;
  col?: number;
  totalCols?: number;
  isSummary?: boolean;
}) {
  const tz = useTz();
  const { isSelected, toggleSelection, setOpen, addSelection } = useKim();
  const selected = !isSummary && isSelected("event", ev.id);
  const { t } = useTranslation("common");

  const topFraction = getEventFraction(ev.start, tz);
  const heightFraction = getDurationFraction(ev.start, ev.end);
  const totalPx = TOTAL_HOURS * hourHeight;
  const top = topFraction * totalPx;
  const height = heightFraction * totalPx;

  const c = col ?? 0;
  const tc = totalCols ?? 1;
  const widthPct = `${(1 / tc) * 100 - 1}%`;
  const leftPct = `${(c / tc) * 100}%`;

  const color = getEventColor(ev);

  const handleClick = (e: React.MouseEvent) => {
    if (isSummary) return;
    // Cmd/Ctrl-click opens the native Google Calendar link (old behaviour).
    if (e.metaKey || e.ctrlKey) {
      if (ev.htmlLink) window.open(ev.htmlLink, "_blank");
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    toggleSelection(eventSelection(ev));
    if (!selected) setOpen(true);
  };

  return (
    <div
      onClick={handleClick}
      title={`${ev.summary || "(No title)"}\n${formatEventTime(ev.start, tz)} – ${formatEventTime(ev.end, tz)}${isSummary ? "" : "\nClick to add to Kim · ⌘-click to open in Google"}`}
      className={cn(
        "absolute rounded-md overflow-hidden border-l-[3px] transition-all z-10 cursor-pointer group shadow-sm hover:shadow-md hover:brightness-105",
        color.bg,
        color.border,
        selected && "ring-2 ring-[color:rgb(232_176_92)] ring-offset-1 ring-offset-background",
      )}
      style={{ top, height: Math.max(height, 20), left: leftPct, width: widthPct }}
    >
      <div className="px-1.5 py-0.5 overflow-hidden h-full">
        <p className={cn("font-semibold leading-tight truncate", color.text, compact ? "text-[9px]" : "text-[11px]")}>
          {ev.summary || "(No title)"}
        </p>
        {!compact && height > 32 && (
          <p className={cn("text-[9px] leading-tight truncate font-normal opacity-60", color.text)}>
            {formatEventTime(ev.start, tz)} – {formatEventTime(ev.end, tz)}
          </p>
        )}
        {ev.routineName && height > 44 && (
          <p className={cn("text-[8px] leading-tight truncate opacity-50 mt-0.5", color.text)}>
            {ev.routineName}
          </p>
        )}
      </div>
      {!isSummary && height > 40 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            addSelection(eventSelection(ev));
            setOpen(true);
          }}
          aria-label={t("ask_kim")}
          title={t("ask_kim")}
          className={cn(
            "absolute top-1 right-1 hidden group-hover:inline-flex items-center justify-center",
            "h-4 w-4 rounded-full bg-background/80 text-foreground/70 hover:text-primary",
            "border border-border shadow-sm",
          )}
        >
          <Sparkles className="h-2.5 w-2.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function AllDayRow({ events }: { events: GCalEvent[]; compact: boolean }) {
  const { isSelected, toggleSelection, setOpen } = useKim();
  if (events.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/30 sticky top-0 z-20">
      {events.map((ev) => {
        const color = getEventColor(ev);
        const selected = isSelected("event", ev.id);
        return (
          <button
            key={ev.id}
            type="button"
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey) {
                if (ev.htmlLink) window.open(ev.htmlLink, "_blank");
                return;
              }
              e.preventDefault();
              e.stopPropagation();
              toggleSelection(eventSelection(ev));
              if (!selected) setOpen(true);
            }}
            className={cn(
              "rounded-md px-2 py-0.5 font-medium truncate max-w-full transition-all hover:brightness-105 text-[10px]",
              color.bg,
              color.text,
              selected && "ring-2 ring-[color:rgb(232_176_92)]",
            )}
            title={`${ev.summary || "(No title)"}\nClick to add to Kim · ⌘-click to open`}
          >
            {ev.summary || "(No title)"}
          </button>
        );
      })}
    </div>
  );
}

// ─── Day + multi-day views ────────────────────────────────────────────────────

function DayView({
  dateKey,
  events,
  loading,
  isSummary,
}: {
  dateKey: string;
  events: GCalEvent[];
  loading?: boolean;
  isSummary?: boolean;
}) {
  const tz = useTz();
  const hourHeight = 60;
  const dayEvents = getEventsForDateKey(events, dateKey, tz).filter((e) => !e.allDay);
  const allDayEvents = getEventsForDateKey(events, dateKey, tz).filter((e) => e.allDay);
  const isToday = isTodayKey(dateKey, tz);
  const scrollRef = useRef<HTMLDivElement>(null);

  // On mount / when the viewed date changes: scroll to the current time
  // (centered in the viewport) on today, or to 8am on any other day.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const totalPx = TOTAL_HOURS * hourHeight;
    const fraction = isToday
      ? getCurrentTimeFraction(tz)
      : Math.max(0, (8 - CAL_START_HOUR) / TOTAL_HOURS);
    const clampedFraction = Math.max(0, Math.min(1, fraction));
    // Center the indicator in the viewport when possible.
    const target = clampedFraction * totalPx - el.clientHeight / 2;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, isToday, tz]);

  const seed = Number(dateKey.slice(8, 10));

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto">
      <AllDayRow events={allDayEvents} compact={false} />
      <div className="flex">
        <TimeGutter hourHeight={hourHeight} />
        <div
          className={cn("flex-1 relative", isToday && "bg-primary/[0.02]")}
          style={{ height: TOTAL_HOURS * hourHeight }}
        >
          <HourLines hourHeight={hourHeight} />
          {isToday && <CurrentTimeBar hourHeight={hourHeight} />}
          {loading ? (
            <EventSkeletons hourHeight={hourHeight} count={4} seed={seed} />
          ) : (
            layoutEvents(dayEvents).map(({ ev, col, totalCols }) => (
              <EventBlock
                key={ev.id}
                ev={ev}
                hourHeight={hourHeight}
                compact={false}
                col={col}
                totalCols={totalCols}
                isSummary={isSummary}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function MultiDayView({
  startKey,
  days,
  events,
  loading,
  isSummary,
}: {
  startKey: string;
  days: number;
  events: GCalEvent[];
  loading?: boolean;
  isSummary?: boolean;
}) {
  const tz = useTz();
  const compact = days > 7;
  const hourHeight = compact ? 36 : 48;

  const columns: string[] = Array.from({ length: days }, (_, i) =>
    addDaysToKey(startKey, i),
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const weekHasToday = columns.some((k) => isTodayKey(k, tz));

  // Scroll to the current time indicator (centered) on mount and when the
  // week window changes. If the visible week doesn't contain today, scroll
  // to 8am instead.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const totalPx = TOTAL_HOURS * hourHeight;
    const fraction = weekHasToday
      ? getCurrentTimeFraction(tz)
      : Math.max(0, (8 - CAL_START_HOUR) / TOTAL_HOURS);
    const clamped = Math.max(0, Math.min(1, fraction));
    // The scroll container includes the sticky day-header row, so offset the
    // target by a small amount to account for it.
    const headerOffset = 40;
    const target = clamped * totalPx - el.clientHeight / 2 + headerOffset;
    el.scrollTop = Math.max(0, target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startKey, weekHasToday, hourHeight, tz]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="flex border-b border-border/40 bg-background sticky top-0 z-30">
        <div className="w-14 shrink-0" />
        {columns.map((key) => {
          const isToday = isTodayKey(key, tz);
          const dayNum = formatDayNumber(key);
          return (
            <div
              key={key}
              className={cn(
                "flex-1 min-w-0 text-center py-2 border-l border-border/15",
                isToday && "bg-primary/[0.02]",
              )}
            >
              <div
                className={cn(
                  "uppercase tracking-wide leading-none",
                  compact ? "text-[8px]" : "text-[10px]",
                  "text-muted-foreground/60",
                )}
              >
                {formatWeekdayShort(key, tz)}
              </div>
              {compact ? (
                <div
                  className={cn(
                    "leading-none mt-0.5 font-semibold text-[9px]",
                    isToday ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {dayNum}
                </div>
              ) : (
                <div className="leading-none mt-1 flex items-center justify-center">
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                      {dayNum}
                    </span>
                  ) : (
                    <span className="text-lg font-semibold text-foreground/80">{dayNum}</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {columns.some((k) => getEventsForDateKey(events, k, tz).some((e) => e.allDay)) && (
        <div className="flex border-b border-border/30">
          <div className="w-14 shrink-0 flex items-center justify-end pr-2">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground/40">all day</span>
          </div>
          {columns.map((key) => {
            const allDay = getEventsForDateKey(events, key, tz).filter((e) => e.allDay);
            return (
              <div key={key} className="flex-1 min-w-0 border-l border-border/15">
                <AllDayRow events={allDay} compact={compact} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex relative">
        <TimeGutter hourHeight={hourHeight} />
        {columns.map((key) => {
          const isToday = isTodayKey(key, tz);
          const dayEvents = loading
            ? []
            : getEventsForDateKey(events, key, tz).filter((e) => !e.allDay);
          const seedDay = Number(key.slice(8, 10));
          const seedMonth = Number(key.slice(5, 7));
          return (
            <div
              key={key}
              className={cn(
                "flex-1 min-w-0 relative border-l border-border/15",
                isToday && "bg-primary/[0.02]",
              )}
              style={{ height: TOTAL_HOURS * hourHeight }}
            >
              <HourLines hourHeight={hourHeight} />
              {isToday && <CurrentTimeBar hourHeight={hourHeight} />}
              {loading ? (
                <EventSkeletons
                  hourHeight={hourHeight}
                  count={2 + (seedDay % 3)}
                  compact={compact}
                  seed={seedDay * 31 + seedMonth}
                />
              ) : (
                layoutEvents(dayEvents).map(({ ev, col, totalCols }) => (
                  <EventBlock
                    key={ev.id}
                    ev={ev}
                    hourHeight={hourHeight}
                    compact={compact}
                    col={col}
                    totalCols={totalCols}
                    isSummary={isSummary}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Day summary view ─────────────────────────────────────────────────────────

const BLOCK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  sleep:           { bg: "bg-slate-800/60 dark:bg-slate-900/70", border: "border-slate-600/40",  text: "text-slate-300" },
  morning_routine: { bg: "bg-teal-400/20",                      border: "border-teal-400/50",  text: "text-teal-700 dark:text-teal-300" },
  commute:         { bg: "bg-zinc-500/15",                       border: "border-zinc-400/40",   text: "text-zinc-600 dark:text-zinc-300" },
  work:            { bg: "bg-blue-500/15",                       border: "border-blue-400/50",   text: "text-blue-700 dark:text-blue-300" },
  tasks:           { bg: "bg-cyan-500/15",                       border: "border-cyan-400/50",   text: "text-cyan-700 dark:text-cyan-300" },
  meal:            { bg: "bg-orange-400/20",                     border: "border-orange-400/50", text: "text-orange-700 dark:text-orange-300" },
  exercise:        { bg: "bg-green-500/15",                      border: "border-green-400/50",  text: "text-green-700 dark:text-green-300" },
  social:          { bg: "bg-purple-500/15",                     border: "border-purple-400/50", text: "text-purple-700 dark:text-purple-300" },
  personal:        { bg: "bg-indigo-500/15",                     border: "border-indigo-400/50", text: "text-indigo-700 dark:text-indigo-300" },
  project:         { bg: "bg-violet-500/15",                     border: "border-violet-400/50", text: "text-violet-700 dark:text-violet-300" },
  rest:            { bg: "bg-stone-500/10",                      border: "border-stone-400/30",  text: "text-stone-500 dark:text-stone-400" },
  errand:          { bg: "bg-rose-400/15",                       border: "border-rose-400/50",   text: "text-rose-700 dark:text-rose-300" },
};

const BLOCK_TYPE_COLOR_ID: Record<string, string> = {
  sleep: "8",
  morning_routine: "5",
  commute: "8",
  work: "9",
  tasks: "7",
  meal: "6",
  exercise: "2",
  social: "3",
  personal: "7",
  project: "1",
  rest: "",
  errand: "4",
};

/** Returns a UTC ISO string that, when projected to `tz`, shows the given wall clock time on the given day. */
function tzWallClockIso(dateKey: string, hh: number, mm: number, tz: string): string {
  const probe = new Date(
    `${dateKey}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`,
  );
  const proj = partsInTz(probe, tz);
  const deltaMin = (hh * 60 + mm) - (proj.hour * 60 + proj.minute);
  return new Date(probe.getTime() + deltaMin * 60_000).toISOString();
}

function summaryBlocksToEvents(summaries: DaySummary[], tz: string): GCalEvent[] {
  const events: GCalEvent[] = [];
  for (const summary of summaries) {
    if (!summary.blocks || summary.pending) continue;
    for (const block of summary.blocks) {
      const [sh, sm] = block.start.split(":").map(Number);
      const [eh, em] = block.end.split(":").map(Number);
      const startIso = tzWallClockIso(summary.date, sh, sm, tz);
      const endIso = tzWallClockIso(summary.date, eh, em, tz);

      events.push({
        id: `summary-${summary.date}-${block.start}-${block.type}`,
        summary: block.label,
        description: block.description,
        location: "",
        start: startIso,
        end: endIso,
        allDay: false,
        status: "confirmed",
        colorId: BLOCK_TYPE_COLOR_ID[block.type] ?? "",
        htmlLink: "",
      });
    }
  }
  return events;
}


// ─── Top-level CalendarView ───────────────────────────────────────────────────

export function CalendarView() {
  const [status, setStatus] = useState<GCalStatus | null>(null);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  // Tracks whether we've completed at least one successful events fetch.
  // Used to decide whether to show the skeleton (first load only) vs. keep
  // existing events on screen during refreshes / view changes.
  const [eventsEverLoaded, setEventsEverLoaded] = useState(false);
  const [summariesEverLoaded, setSummariesEverLoaded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<CalView>("day");
  // User's configured timezone from their life profile. Falls back to the
  // browser's detected zone until the profile loads (and stays as the
  // fallback if the profile has no timezone set).
  const [tz, setTz] = useState<string>(browserTz);
  const [currentKey, setCurrentKey] = useState<string>(() =>
    dateKeyInTz(new Date(), browserTz),
  );

  const [summaries, setSummaries] = useState<DaySummary[]>([]);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const daysToLoad = view === "day" ? 1 : 7;

  // Load the user's configured timezone once. If the profile has no tz set,
  // keep the browser fallback so the UI still works.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getLifeProfile();
        if (cancelled) return;
        if (profile.timezone && profile.timezone.trim() !== "") {
          setTz(profile.timezone);
          // Re-anchor the viewed day to "today" in the profile's zone so
          // first render doesn't show yesterday/tomorrow from the browser zone.
          setCurrentKey(dateKeyInTz(new Date(), profile.timezone));
        }
      } catch {
        /* non-fatal — stay on browser tz */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadEvents = useCallback(
    async (connected: boolean, startKey: string, numDays: number) => {
      if (!connected) return;
      setEventsLoading(true);
      try {
        const from = startKey;
        const to = addDaysToKey(startKey, numDays);
        const evs = await listGCalEvents(from, to);
        setEvents(evs);
        setEventsEverLoaded(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load events");
      } finally {
        setEventsLoading(false);
      }
    },
    [],
  );

  const loadSummaries = useCallback(async (connected: boolean, startKey: string) => {
    if (!connected) return;
    setSummariesLoading(true);
    try {
      const from = startKey;
      const to = addDaysToKey(startKey, 7);
      const result = await getDaySummaries(from, to);
      setSummaries(result);
      setSummariesEverLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load day summaries");
    } finally {
      setSummariesLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getGCalStatus();
      setStatus(s);
      if (s.connected) {
        await loadEvents(true, dateKeyInTz(new Date(), tz), 1);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar status");
    } finally {
      setLoading(false);
    }
  }, [loadEvents, tz]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setConnecting(true);
      exchangeGCalCode(code)
        .then(() => {
          window.history.replaceState(null, "", window.location.pathname);
          return loadStatus();
        })
        .catch((e) => setError(e instanceof Error ? e.message : "OAuth exchange failed"))
        .finally(() => setConnecting(false));
    } else {
      loadStatus();
    }
  }, [loadStatus]);

  useEffect(() => {
    if (status?.connected) {
      loadEvents(true, currentKey, daysToLoad);
      if (showSummary) {
        loadSummaries(true, currentKey);
      }
    }
  }, [view, currentKey, status?.connected, daysToLoad, loadEvents, showSummary, loadSummaries]);

  useEffect(() => {
    if (!showSummary || !status?.connected) return;
    const hasPending = summaries.some((s) => s.pending);
    if (!hasPending) return;
    const interval = setInterval(() => {
      loadSummaries(true, currentKey);
    }, 10000);
    return () => clearInterval(interval);
  }, [showSummary, summaries, status?.connected, currentKey, loadSummaries]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getGCalAuthUrl();
      window.open(url, "_self");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get auth URL");
      setConnecting(false);
    }
  };

  const handlePrev = () => {
    setCurrentKey((k) => addDaysToKey(k, -(view === "day" ? 1 : 7)));
  };
  const handleNext = () => {
    setCurrentKey((k) => addDaysToKey(k, view === "day" ? 1 : 7));
  };
  const handleToday = () => {
    setCurrentKey(dateKeyInTz(new Date(), tz));
  };

  if (loading || connecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status?.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Connect Google Calendar</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            View and manage your events directly from the Life Tool.
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive max-w-sm">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <Button size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Connect Google Calendar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => disconnectGCal()}>
          Reset
        </Button>
      </div>
    );
  }

  const displayEvents = showSummary ? summaryBlocksToEvents(summaries, tz) : events;
  // Only show the skeleton on the FIRST load. On subsequent refreshes or
  // view changes, keep the current events on screen and let the header's
  // spinner communicate the activity.
  const displayLoading = showSummary
    ? summariesLoading && !summariesEverLoaded
    : eventsLoading && !eventsEverLoaded;

  return (
    <CalendarTzContext.Provider value={tz}>
      <div className="h-full flex flex-col overflow-hidden">
        {error && (
          <div className="flex items-center gap-2 px-4 py-2 border-b border-destructive/20 bg-destructive/5 text-xs text-destructive shrink-0">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <CalendarHeader
          view={view}
          setView={setView}
          currentKey={currentKey}
          onPrev={handlePrev}
          onNext={handleNext}
          onToday={handleToday}
          onRefresh={() => {
            if (status?.connected) {
              loadEvents(true, currentKey, daysToLoad);
              if (showSummary) loadSummaries(true, currentKey);
            }
          }}
          refreshing={eventsLoading}
          showSummary={showSummary}
          onToggleSummary={() => setShowSummary((v) => !v)}
        />
        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {view === "day" ? (
            <DayView
              dateKey={currentKey}
              events={displayEvents}
              loading={displayLoading}
              isSummary={showSummary}
            />
          ) : (
            <MultiDayView
              startKey={currentKey}
              days={7}
              events={displayEvents}
              loading={displayLoading}
              isSummary={showSummary}
            />
          )}
        </div>
      </div>
    </CalendarTzContext.Provider>
  );
}
