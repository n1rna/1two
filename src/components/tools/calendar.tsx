"use client";

import {
  useState,
  useCallback,
  useMemo,
  useEffect,
  useRef,
} from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Pencil,
  X,
  Check,
  CalendarDays,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────

type ViewMode = "day" | "week" | "month" | "quarter" | "year";

interface Marker {
  id: string;
  label: string;
  start: string; // YYYY-MM-DD
  end: string;
  color: string;
}

// ─── Constants ──────────────────────────────────────

const COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#f97316",
];

const VIEW_OPTIONS: { value: ViewMode; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "quarter", label: "Quarter" },
  { value: "year", label: "Year" },
];

// Mon-first day names
const DAY_NAMES_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_NAMES_LETTER = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STORAGE_KEY = "1two:calendar-markers";

// 24 hours for the time grid
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 56; // px per hour

// ─── Helpers ────────────────────────────────────────

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function startOfWeek(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d: Date): boolean {
  return isSameDay(d, new Date());
}

function loadMarkers(): Marker[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : [];
  } catch {
    return [];
  }
}

function saveMarkersToStorage(markers: Marker[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(markers));
}

function markerIncludesDay(m: Marker, dk: string): boolean {
  return dk >= m.start && dk <= m.end;
}

function formatDateShort(dk: string): string {
  const d = parseDate(dk);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}

function randomColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

function rangeBetween(a: string, b: string): Set<string> {
  const set = new Set<string>();
  const start = a < b ? a : b;
  const end = a < b ? b : a;
  let cur = parseDate(start);
  const endDate = parseDate(end);
  while (cur <= endDate) {
    set.add(dateKey(cur));
    cur = addDays(cur, 1);
  }
  return set;
}

// Returns Mon-first day index (0=Mon … 6=Sun)
function monFirstDayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

// Build the cells array for a month grid (Mon-first, padded)
function buildMonthCells(year: number, month: number) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1);
  const startOffset = monFirstDayIndex(firstDay);
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ date: new Date(year, month + 1, d), inMonth: false });
  }
  return cells;
}

// ─── Shared types ────────────────────────────────────

interface DayCellCallbacks {
  onDayMouseDown: (dk: string, e: React.MouseEvent) => void;
  onDayMouseEnter: (dk: string) => void;
}

// ─── Event layout helpers for month view ─────────────

interface MarkerSlot {
  marker: Marker;
  /** position of this slot within the cell (0-indexed) */
  slot: number;
  /** visual appearance relative to this cell */
  position: "single" | "start" | "middle" | "end";
}

function getMarkerSlotsForDay(
  dk: string,
  cells: { date: Date; inMonth: boolean }[],
  markers: Marker[]
): MarkerSlot[] {
  // Build a stable slot assignment per marker per row so spanning works
  // For each marker that covers this day, figure out position
  const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));

  return dayMarkers.map((m, idx) => {
    const startKey = m.start;
    const endKey = m.end;
    let position: MarkerSlot["position"] = "single";
    if (startKey === endKey) {
      position = "single";
    } else if (dk === startKey) {
      position = "start";
    } else if (dk === endKey) {
      position = "end";
    } else {
      position = "middle";
    }
    return { marker: m, slot: idx, position };
  });
}

// ─── Time grid helpers ───────────────────────────────

function getCurrentTimePercent(): number {
  const now = new Date();
  return (now.getHours() * 60 + now.getMinutes()) / (24 * 60);
}

// ─── Main Component ──────────────────────────────────

export function CalendarTool() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [nowPercent, setNowPercent] = useState(getCurrentTimePercent());

  const dragRef = useRef<{ active: boolean; origin: string; prev: Set<string> }>({
    active: false,
    origin: "",
    prev: new Set(),
  });

  useEffect(() => {
    setMarkers(loadMarkers());
    setMounted(true);
  }, []);

  // Update live time indicator every minute
  useEffect(() => {
    const id = setInterval(() => setNowPercent(getCurrentTimePercent()), 60_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onUp = () => { dragRef.current.active = false; };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, []);

  const updateMarkers = useCallback((fn: (prev: Marker[]) => Marker[]) => {
    setMarkers((prev) => {
      const next = fn(prev);
      saveMarkersToStorage(next);
      return next;
    });
  }, []);

  // ─── Navigation ─────────────────

  const navigate = useCallback(
    (dir: number) => {
      setAnchor((prev) => {
        const d = new Date(prev);
        switch (viewMode) {
          case "day":
            d.setDate(d.getDate() + dir);
            break;
          case "week":
            d.setDate(d.getDate() + dir * 7);
            break;
          case "month":
            d.setMonth(d.getMonth() + dir);
            break;
          case "quarter":
            d.setMonth(d.getMonth() + dir * 3);
            break;
          case "year":
            d.setFullYear(d.getFullYear() + dir);
            break;
        }
        return d;
      });
    },
    [viewMode]
  );

  const goToday = useCallback(() => setAnchor(new Date()), []);

  // ─── Drag-to-select ─────────────

  const onDayMouseDown = useCallback(
    (dk: string, e: React.MouseEvent) => {
      e.preventDefault();
      const prev = e.shiftKey ? new Set(selectedDays) : new Set<string>();
      dragRef.current = { active: true, origin: dk, prev };
      setSelectedDays(new Set([...prev, dk]));
    },
    [selectedDays]
  );

  const onDayMouseEnter = useCallback((dk: string) => {
    const drag = dragRef.current;
    if (!drag.active) return;
    const range = rangeBetween(drag.origin, dk);
    setSelectedDays(new Set([...drag.prev, ...range]));
  }, []);

  const clearSelection = useCallback(() => setSelectedDays(new Set()), []);

  // ─── Selection Info ─────────────

  const selectionInfo = useMemo(() => {
    if (selectedDays.size === 0) return null;
    const sorted = [...selectedDays].sort();
    const dates = sorted.map(parseDate);
    const weekdays = dates.filter((d) => !isWeekend(d)).length;
    const weekends = dates.filter((d) => isWeekend(d)).length;
    return {
      count: dates.length,
      weekdays,
      weekends,
      start: sorted[0],
      end: sorted[sorted.length - 1],
    };
  }, [selectedDays]);

  // ─── Marker CRUD ────────────────

  const createMarker = useCallback(() => {
    const sorted = [...selectedDays].sort();
    const start = sorted[0] || dateKey(new Date());
    const end = sorted[sorted.length - 1] || dateKey(new Date());
    const id = crypto.randomUUID();
    const label = `Marker ${markers.length + 1}`;
    const marker: Marker = { id, label, start, end, color: randomColor() };
    updateMarkers((prev) => [...prev, marker]);
    setEditingId(id);
    clearSelection();
  }, [selectedDays, markers.length, updateMarkers, clearSelection]);

  const saveMarker = useCallback(
    (m: Marker) => {
      updateMarkers((prev) => {
        const idx = prev.findIndex((x) => x.id === m.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = m;
          return next;
        }
        return [...prev, m];
      });
      setEditingId(null);
    },
    [updateMarkers]
  );

  const deleteMarker = useCallback(
    (id: string) => {
      updateMarkers((prev) => prev.filter((m) => m.id !== id));
      if (editingId === id) setEditingId(null);
    },
    [updateMarkers, editingId]
  );

  // ─── Summary ────────────────────

  const summary = useMemo(() => {
    if (markers.length === 0) return null;
    const allDays = new Set<string>();
    const overlapMap = new Map<string, number>();
    for (const m of markers) {
      let cur = parseDate(m.start);
      const end = parseDate(m.end);
      while (cur <= end) {
        const dk = dateKey(cur);
        allDays.add(dk);
        overlapMap.set(dk, (overlapMap.get(dk) || 0) + 1);
        cur = addDays(cur, 1);
      }
    }
    const overlapDays = [...overlapMap.values()].filter((v) => v > 1).length;
    const allDates = [...allDays].map(parseDate);
    const wkdays = allDates.filter((d) => !isWeekend(d)).length;
    return {
      markerCount: markers.length,
      totalDays: allDays.size,
      weekdays: wkdays,
      weekends: allDays.size - wkdays,
      overlapDays,
    };
  }, [markers]);

  // ─── Title ──────────────────────

  const title = useMemo(() => {
    switch (viewMode) {
      case "day":
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getDate()}, ${anchor.getFullYear()}`;
      case "week": {
        const s = startOfWeek(anchor);
        const e = addDays(s, 6);
        if (s.getMonth() === e.getMonth()) {
          return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
        }
        return `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${s.getFullYear()}`;
      }
      case "month":
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
      case "quarter": {
        const sm = Math.floor(anchor.getMonth() / 3) * 3;
        return `${MONTH_NAMES[sm].slice(0, 3)} – ${MONTH_NAMES[sm + 2].slice(0, 3)} ${anchor.getFullYear()}`;
      }
      case "year":
        return `${anchor.getFullYear()}`;
    }
  }, [viewMode, anchor]);

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col select-none">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold shrink-0">Calendar</span>

        <div className="ml-4 flex items-center rounded-md border overflow-hidden">
          {VIEW_OPTIONS.map((v) => (
            <button
              key={v.value}
              className={`text-xs h-7 px-3 border-r last:border-r-0 transition-colors cursor-pointer
                ${viewMode === v.value
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
                }`}
              onClick={() => setViewMode(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs px-3"
            onClick={goToday}
          >
            Today
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => navigate(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 text-sm font-medium">{title}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex min-h-0">
        {/* Calendar area */}
        <div className="flex-1 overflow-auto min-w-0">
          {viewMode === "month" && (
            <MonthGrid
              year={anchor.getFullYear()}
              month={anchor.getMonth()}
              selectedDays={selectedDays}
              markers={markers}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          )}
          {viewMode === "quarter" && (
            <QuarterGrid
              year={anchor.getFullYear()}
              startMonth={Math.floor(anchor.getMonth() / 3) * 3}
              selectedDays={selectedDays}
              markers={markers}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          )}
          {viewMode === "year" && (
            <YearGrid
              year={anchor.getFullYear()}
              selectedDays={selectedDays}
              markers={markers}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          )}
          {viewMode === "week" && (
            <TimeGrid
              start={startOfWeek(anchor)}
              count={7}
              selectedDays={selectedDays}
              markers={markers}
              nowPercent={nowPercent}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          )}
          {viewMode === "day" && (
            <TimeGrid
              start={anchor}
              count={1}
              selectedDays={selectedDays}
              markers={markers}
              nowPercent={nowPercent}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          )}
        </div>

        {/* Sidebar */}
        <div className="w-72 border-l overflow-auto p-4 space-y-4 shrink-0">
          {/* Selection info */}
          {selectionInfo && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Selection</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={clearSelection}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground font-medium">
                    {selectionInfo.count}
                  </span>{" "}
                  day{selectionInfo.count !== 1 ? "s" : ""} selected
                </p>
                <p>
                  {selectionInfo.weekdays} weekday
                  {selectionInfo.weekdays !== 1 ? "s" : ""},{" "}
                  {selectionInfo.weekends} weekend day
                  {selectionInfo.weekends !== 1 ? "s" : ""}
                </p>
                <p className="font-mono text-[11px]">
                  {formatDateShort(selectionInfo.start)} →{" "}
                  {formatDateShort(selectionInfo.end)}
                </p>
              </div>
              <Button
                size="sm"
                className="w-full text-xs h-7"
                onClick={createMarker}
              >
                <Plus className="h-3 w-3 mr-1" /> Create Marker
              </Button>
            </div>
          )}

          {/* Markers list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Markers{markers.length > 0 && ` (${markers.length})`}
              </h3>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs px-2"
                onClick={createMarker}
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {markers.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No markers yet. Select days on the calendar and create one, or
                click Add.
              </p>
            )}
            {markers.map((m) =>
              editingId === m.id ? (
                <MarkerEditor
                  key={m.id}
                  marker={m}
                  onSave={saveMarker}
                  onCancel={() => setEditingId(null)}
                  onDelete={() => deleteMarker(m.id)}
                />
              ) : (
                <div
                  key={m.id}
                  className="flex items-start gap-2 group text-xs p-2 rounded border bg-card hover:bg-accent/30 transition-colors"
                >
                  <div
                    className="w-3 h-3 rounded-sm shrink-0 mt-0.5"
                    style={{ backgroundColor: m.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {m.label || "Untitled"}
                    </p>
                    <p className="text-muted-foreground">
                      {formatDateShort(m.start)} → {formatDateShort(m.end)}
                    </p>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0"
                      onClick={() => setEditingId(m.id)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 w-5 p-0 text-destructive"
                      onClick={() => deleteMarker(m.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>

          {/* Summary */}
          {summary && (
            <div className="space-y-2 border-t pt-4">
              <h3 className="text-sm font-semibold">Summary</h3>
              <div className="text-xs space-y-1 text-muted-foreground">
                <p>
                  <span className="text-foreground font-medium">
                    {summary.markerCount}
                  </span>{" "}
                  marker{summary.markerCount !== 1 ? "s" : ""}
                </p>
                <p>
                  <span className="text-foreground font-medium">
                    {summary.totalDays}
                  </span>{" "}
                  total days covered
                </p>
                <p>
                  {summary.weekdays} weekday{summary.weekdays !== 1 ? "s" : ""},{" "}
                  {summary.weekends} weekend{summary.weekends !== 1 ? "s" : ""}
                </p>
                {summary.overlapDays > 0 && (
                  <p className="text-primary font-medium">
                    {summary.overlapDays} day
                    {summary.overlapDays !== 1 ? "s" : ""} with overlapping
                    markers
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Marker Editor ───────────────────────────────────

function MarkerEditor({
  marker,
  onSave,
  onCancel,
  onDelete,
}: {
  marker: Marker;
  onSave: (m: Marker) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({ ...marker });

  return (
    <div className="border rounded p-3 space-y-2.5 bg-muted/30">
      <Input
        placeholder="Marker name"
        value={draft.label}
        onChange={(e) => setDraft({ ...draft, label: e.target.value })}
        className="h-8 text-xs"
        autoFocus
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground mb-0.5 block">Start</label>
          <Input
            type="date"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground mb-0.5 block">End</label>
          <Input
            type="date"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground mb-0.5 block">Color</label>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-sm border-2 transition-all cursor-pointer ${
                draft.color === c
                  ? "border-foreground scale-110"
                  : "border-transparent hover:border-muted-foreground/30"
              }`}
              style={{ backgroundColor: c }}
              onClick={() => setDraft({ ...draft, color: c })}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-1.5 pt-1">
        <Button
          size="sm"
          className="h-7 text-xs flex-1"
          onClick={() => onSave(draft)}
        >
          <Check className="h-3 w-3 mr-1" /> Save
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Month Grid ──────────────────────────────────────
// Uses border-l + border-t on each cell, container has border-r + border-b.
// No gap – borders are shared/adjacent.

function MonthGrid({
  year,
  month,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  year: number;
  month: number;
  selectedDays: Set<string>;
  markers: Marker[];
} & DayCellCallbacks) {
  const cells = buildMonthCells(year, month);

  return (
    <div className="flex flex-col h-full border-r border-b">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-l border-t">
        {DAY_NAMES_SHORT.map((d, i) => (
          <div
            key={d}
            className={`text-xs font-medium text-center py-2 border-l border-t
              ${i >= 5 ? "text-muted-foreground" : "text-muted-foreground"}`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Cells */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "1fr" }}>
        {cells.map((c, i) => {
          const dk = dateKey(c.date);
          const isSelected = selectedDays.has(dk);
          const today = isToday(c.date);
          const weekend = isWeekend(c.date);
          const slots = getMarkerSlotsForDay(dk, cells, markers);
          const MAX_SLOTS = 3;
          const visibleSlots = slots.slice(0, MAX_SLOTS);
          const overflow = slots.length - MAX_SLOTS;

          return (
            <div
              key={i}
              className={`border-l border-t p-1 flex flex-col min-h-16 cursor-default transition-colors
                ${!c.inMonth ? "bg-muted/20" : weekend ? "bg-muted/10" : ""}
                ${isSelected ? "bg-primary/10" : "hover:bg-accent/30"}`}
              onMouseDown={(e) => onDayMouseDown(dk, e)}
              onMouseEnter={() => onDayMouseEnter(dk)}
            >
              {/* Date number */}
              <div className="flex items-start justify-between mb-0.5">
                <span
                  className={`text-xs leading-none inline-flex items-center justify-center w-5 h-5 rounded-full font-medium
                    ${today
                      ? "bg-primary text-primary-foreground"
                      : !c.inMonth
                      ? "text-muted-foreground/40"
                      : isSelected
                      ? "text-primary font-semibold"
                      : "text-foreground"
                    }`}
                >
                  {c.date.getDate()}
                </span>
              </div>

              {/* Markers */}
              <div className="flex flex-col gap-px mt-0.5">
                {visibleSlots.map(({ marker: m, position }) => {
                  const isStart = position === "start" || position === "single";
                  const isEnd = position === "end" || position === "single";
                  return (
                    <div
                      key={m.id}
                      className={`text-[9px] leading-tight px-1 py-px font-medium text-white overflow-hidden whitespace-nowrap
                        ${isStart && isEnd ? "rounded" : ""}
                        ${isStart && !isEnd ? "rounded-l rounded-r-none" : ""}
                        ${!isStart && isEnd ? "rounded-r rounded-l-none" : ""}
                        ${!isStart && !isEnd ? "rounded-none" : ""}
                        ${position === "middle" || position === "end" ? "-ml-px" : ""}
                        ${position === "start" || position === "middle" ? "-mr-px" : ""}
                      `}
                      style={{ backgroundColor: m.color }}
                    >
                      {isStart ? m.label : "\u00A0"}
                    </div>
                  );
                })}
                {overflow > 0 && (
                  <span className="text-[9px] text-muted-foreground pl-1">
                    +{overflow} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Quarter Grid (3 months, no gaps) ────────────────
// Renders a continuous 21-column grid (3 months × 7 days)
// with month headers above each 7-column section.

function QuarterGrid({
  year,
  startMonth,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  year: number;
  startMonth: number;
  selectedDays: Set<string>;
  markers: Marker[];
} & DayCellCallbacks) {
  const months = [0, 1, 2].map((offset) => {
    const rawMonth = startMonth + offset;
    const y = year + Math.floor(rawMonth / 12);
    const m = ((rawMonth % 12) + 12) % 12;
    return { year: y, month: m };
  });

  return (
    <div className="flex flex-col h-full">
      {/* Month name headers */}
      <div className="grid grid-cols-3 border-l border-t border-r">
        {months.map(({ year: y, month: m }, i) => (
          <div
            key={i}
            className="text-xs font-semibold text-center py-1.5 border-l border-t first:border-l-0 text-muted-foreground"
          >
            {MONTH_NAMES[m]} {y}
          </div>
        ))}
      </div>

      {/* 3 side-by-side month grids sharing borders */}
      <div className="flex flex-1 border-r border-b">
        {months.map(({ year: y, month: m }, i) => (
          <div key={i} className="flex-1 flex flex-col border-l">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-t">
              {DAY_NAMES_LETTER.map((d, j) => (
                <div
                  key={j}
                  className="text-[9px] font-medium text-muted-foreground text-center py-1.5 border-l first:border-l-0"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Cells */}
            <QuarterMonthCells
              year={y}
              month={m}
              selectedDays={selectedDays}
              markers={markers}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function QuarterMonthCells({
  year,
  month,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  year: number;
  month: number;
  selectedDays: Set<string>;
  markers: Marker[];
} & DayCellCallbacks) {
  const cells = buildMonthCells(year, month);

  return (
    <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "1fr" }}>
      {cells.map((c, i) => {
        const dk = dateKey(c.date);
        const isSelected = selectedDays.has(dk);
        const today = isToday(c.date);
        const weekend = isWeekend(c.date);
        const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));

        return (
          <div
            key={i}
            className={`border-l border-t first:border-l-0 p-0.5 flex flex-col min-h-10 cursor-default transition-colors text-center
              ${!c.inMonth ? "bg-muted/20" : weekend ? "bg-muted/10" : ""}
              ${isSelected ? "bg-primary/10" : "hover:bg-accent/30"}`}
            onMouseDown={(e) => onDayMouseDown(dk, e)}
            onMouseEnter={() => onDayMouseEnter(dk)}
          >
            <span
              className={`text-[10px] leading-none inline-flex items-center justify-center mx-auto w-4 h-4 rounded-full font-medium
                ${today
                  ? "bg-primary text-primary-foreground"
                  : !c.inMonth
                  ? "text-muted-foreground/30"
                  : isSelected
                  ? "text-primary font-semibold"
                  : "text-foreground"
                }`}
            >
              {c.date.getDate()}
            </span>
            {dayMarkers.length > 0 && (
              <div className="flex flex-wrap gap-px justify-center mt-px">
                {dayMarkers.slice(0, 2).map((m) => (
                  <span
                    key={m.id}
                    className="w-1 h-1 rounded-full shrink-0"
                    style={{ backgroundColor: m.color }}
                  />
                ))}
                {dayMarkers.length > 2 && (
                  <span
                    className="w-1 h-1 rounded-full shrink-0 bg-muted-foreground/40"
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Year Grid ───────────────────────────────────────
// Seamless 4×3 grid — months share borders, no gaps.
// Each month has a tiny 3-letter label on the first row instead of a header bar.

function YearGrid({
  year,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  year: number;
  selectedDays: Set<string>;
  markers: Marker[];
} & DayCellCallbacks) {
  return (
    <div className="h-full flex flex-col">
      {/* Day-letter header row — shared across all 4 columns */}
      <div className="grid grid-cols-4 shrink-0 border-b">
        {Array.from({ length: 4 }, (_, col) => (
          <div key={col} className={`grid grid-cols-7 ${col > 0 ? "border-l" : ""}`}>
            {DAY_NAMES_LETTER.map((d, j) => (
              <div
                key={j}
                className="text-[8px] text-muted-foreground text-center py-1"
              >
                {d}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* 3 rows × 4 columns of months */}
      <div className="grid grid-cols-4 grid-rows-3 flex-1 min-h-0">
        {Array.from({ length: 12 }, (_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          return (
            <YearMonth
              key={i}
              year={year}
              month={i}
              selectedDays={selectedDays}
              markers={markers}
              onDayMouseDown={onDayMouseDown}
              onDayMouseEnter={onDayMouseEnter}
              borderTop={row > 0}
              borderLeft={col > 0}
            />
          );
        })}
      </div>
    </div>
  );
}

function YearMonth({
  year,
  month,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
  borderTop,
  borderLeft,
}: {
  year: number;
  month: number;
  selectedDays: Set<string>;
  markers: Marker[];
  borderTop: boolean;
  borderLeft: boolean;
} & DayCellCallbacks) {
  const cells = buildMonthCells(year, month);

  return (
    <div className={`flex flex-col ${borderTop ? "border-t" : ""} ${borderLeft ? "border-l" : ""}`}>
      {/* Cells grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "1fr" }}>
        {cells.map((c, i) => {
          const dk = dateKey(c.date);
          const isSelected = selectedDays.has(dk);
          const today = isToday(c.date);
          const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));
          // Show month label on first cell of the month
          const isFirst = c.inMonth && c.date.getDate() === 1;

          return (
            <div
              key={i}
              className={`relative text-[10px] flex items-center justify-center cursor-default transition-colors
                ${!c.inMonth ? "text-muted-foreground/20" : ""}
                ${isSelected ? "bg-primary/15" : "hover:bg-accent/40"}`}
              onMouseDown={(e) => onDayMouseDown(dk, e)}
              onMouseEnter={() => onDayMouseEnter(dk)}
            >
              {/* Inline month label — replaces the day number on the 1st */}
              {isFirst ? (
                <span className="text-[9px] font-semibold text-muted-foreground">
                  {MONTH_NAMES[month].slice(0, 3)}
                </span>
              ) : (
                <span
                  className={`inline-flex items-center justify-center w-[18px] h-[18px] rounded-full text-[10px]
                    ${today ? "bg-primary text-primary-foreground text-[9px] font-semibold" : ""}
                    ${isSelected && !today ? "font-bold text-primary" : ""}
                  `}
                >
                  {c.date.getDate()}
                </span>
              )}
              {dayMarkers.length > 0 && !isFirst && (
                <span
                  className="absolute bottom-px left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                  style={{ backgroundColor: dayMarkers[0].color }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Grid (Day + Week views) ───────────────────

function TimeGrid({
  start,
  count,
  selectedDays,
  markers,
  nowPercent,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  start: Date;
  count: number;
  selectedDays: Set<string>;
  markers: Marker[];
  nowPercent: number;
} & DayCellCallbacks) {
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));
  const totalHours = 24;
  const gridHeight = totalHours * HOUR_HEIGHT;

  // Markers that touch any of the visible days → show in all-day row
  const allDayMarkers = markers.filter((m) =>
    days.some((d) => markerIncludesDay(m, dateKey(d)))
  );

  return (
    <div className="flex flex-col h-full">
      {/* Sticky column headers */}
      <div className="flex shrink-0 border-b">
        {/* Gutter */}
        <div className="w-14 shrink-0 border-r" />

        {/* Day columns */}
        {days.map((d, i) => {
          const dk = dateKey(d);
          const today = isToday(d);
          const weekend = isWeekend(d);
          return (
            <div
              key={dk}
              className={`flex-1 border-r last:border-r-0 py-2 text-center cursor-default select-none transition-colors
                ${weekend ? "bg-muted/20" : ""}
                ${selectedDays.has(dk) ? "bg-primary/10" : ""}
              `}
              onMouseDown={(e) => onDayMouseDown(dk, e)}
              onMouseEnter={() => onDayMouseEnter(dk)}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {DAY_NAMES_SHORT[(d.getDay() + 6) % 7]}
              </p>
              <p
                className={`text-lg font-light mt-0.5 leading-none inline-flex items-center justify-center w-8 h-8 rounded-full
                  ${today ? "bg-primary text-primary-foreground font-semibold text-base" : ""}
                `}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* All-day row */}
      {allDayMarkers.length > 0 && (
        <div className="flex shrink-0 border-b min-h-7">
          <div className="w-14 shrink-0 border-r flex items-center justify-end pr-1">
            <span className="text-[9px] text-muted-foreground">all day</span>
          </div>
          {days.map((d) => {
            const dk = dateKey(d);
            const dayMark = allDayMarkers.filter((m) => markerIncludesDay(m, dk));
            return (
              <div key={dk} className="flex-1 border-r last:border-r-0 p-0.5 flex flex-col gap-px">
                {dayMark.map((m) => (
                  <div
                    key={m.id}
                    className="text-[9px] px-1 py-px rounded text-white font-medium leading-tight truncate"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Scrollable time area */}
      <div className="flex-1 overflow-auto">
        <div className="flex" style={{ height: gridHeight }}>
          {/* Hour labels gutter */}
          <div className="w-14 shrink-0 border-r relative">
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute w-full flex justify-end pr-1"
                style={{ top: h * HOUR_HEIGHT - 7 }}
              >
                {h > 0 && (
                  <span className="text-[9px] text-muted-foreground">
                    {String(h).padStart(2, "0")}:00
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Day columns with time grid */}
          {days.map((d, colIdx) => {
            const dk = dateKey(d);
            const weekend = isWeekend(d);
            const showNow = isToday(d);

            return (
              <div
                key={dk}
                className={`flex-1 border-r last:border-r-0 relative
                  ${weekend ? "bg-muted/10" : ""}
                `}
                style={{ height: gridHeight }}
              >
                {/* Hour lines */}
                {HOURS.map((h) => (
                  <div
                    key={h}
                    className="absolute w-full border-t border-border/60"
                    style={{ top: h * HOUR_HEIGHT }}
                  >
                    {/* Half-hour dashed line */}
                    <div
                      className="absolute w-full border-t border-dashed border-border/30"
                      style={{ top: HOUR_HEIGHT / 2 }}
                    />
                  </div>
                ))}

                {/* Live time indicator */}
                {showNow && (
                  <div
                    className="absolute left-0 right-0 z-10 pointer-events-none"
                    style={{ top: nowPercent * gridHeight }}
                  >
                    <div className="relative flex items-center">
                      <div className="w-2 h-2 rounded-full bg-red-500 -ml-1 shrink-0" />
                      <div className="flex-1 h-px bg-red-500" />
                    </div>
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
