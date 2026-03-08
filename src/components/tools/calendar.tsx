"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
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

type ViewMode = "3day" | "week" | "month" | "3month" | "year";

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
  { value: "3day", label: "3 Days" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "3month", label: "Quarter" },
  { value: "year", label: "Year" },
];

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const STORAGE_KEY = "1two:calendar-markers";

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

/** Build a set of date keys for every day between two keys (inclusive). */
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

// ─── Component ──────────────────────────────────────

export function CalendarTool() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [anchor, setAnchor] = useState(new Date());
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Drag-select state kept in refs to avoid re-renders mid-drag
  const dragRef = useRef<{ active: boolean; origin: string; prev: Set<string> }>({
    active: false,
    origin: "",
    prev: new Set(),
  });

  useEffect(() => {
    setMarkers(loadMarkers());
    setMounted(true);
  }, []);

  // Global mouseup to end drag
  useEffect(() => {
    const onUp = () => {
      dragRef.current.active = false;
    };
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
          case "3day":
            d.setDate(d.getDate() + dir * 3);
            break;
          case "week":
            d.setDate(d.getDate() + dir * 7);
            break;
          case "month":
            d.setMonth(d.getMonth() + dir);
            break;
          case "3month":
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
      e.preventDefault(); // prevent text selection
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

  const clearSelection = useCallback(() => {
    setSelectedDays(new Set());
  }, []);

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
      case "3day":
      case "week": {
        const s = viewMode === "3day" ? anchor : startOfWeek(anchor);
        const e = addDays(s, viewMode === "3day" ? 2 : 6);
        if (s.getMonth() === e.getMonth()) {
          return `${MONTH_NAMES[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`;
        }
        return `${MONTH_NAMES[s.getMonth()].slice(0, 3)} ${s.getDate()} – ${MONTH_NAMES[e.getMonth()].slice(0, 3)} ${e.getDate()}, ${s.getFullYear()}`;
      }
      case "month":
        return `${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`;
      case "3month": {
        const startMonth = Math.floor(anchor.getMonth() / 3) * 3;
        return `${MONTH_NAMES[startMonth].slice(0, 3)} – ${MONTH_NAMES[startMonth + 2].slice(0, 3)} ${anchor.getFullYear()}`;
      }
      case "year":
        return `${anchor.getFullYear()}`;
    }
  }, [viewMode, anchor]);

  if (!mounted) {
    return (
      <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col select-none">
      {/* Header */}
      <div className="border-b px-4 py-2 flex items-center gap-2 shrink-0 flex-wrap">
        <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold shrink-0">Calendar</span>

        <div className="ml-4 flex items-center gap-0.5">
          {VIEW_OPTIONS.map((v) => (
            <Button
              key={v.value}
              size="sm"
              variant={viewMode === v.value ? "default" : "ghost"}
              className="text-xs h-7 px-2.5"
              onClick={() => setViewMode(v.value)}
            >
              {v.label}
            </Button>
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
        <div className="flex-1 overflow-auto p-4 min-w-0">
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
          {viewMode === "3month" && (
            <ThreeMonthGrid
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
          {(viewMode === "week" || viewMode === "3day") && (
            <DayColumnsView
              start={viewMode === "week" ? startOfWeek(anchor) : anchor}
              count={viewMode === "week" ? 7 : 3}
              selectedDays={selectedDays}
              markers={markers}
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

// ─── Marker Editor (inline) ─────────────────────────

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
          <label className="text-[10px] text-muted-foreground mb-0.5 block">
            Start
          </label>
          <Input
            type="date"
            value={draft.start}
            onChange={(e) => setDraft({ ...draft, start: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex-1">
          <label className="text-[10px] text-muted-foreground mb-0.5 block">
            End
          </label>
          <Input
            type="date"
            value={draft.end}
            onChange={(e) => setDraft({ ...draft, end: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-muted-foreground mb-0.5 block">
          Color
        </label>
        <div className="flex gap-1.5">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`w-6 h-6 rounded-sm border-2 transition-all ${
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

// ─── Shared day-cell props ──────────────────────────

interface DayCellCallbacks {
  onDayMouseDown: (dk: string, e: React.MouseEvent) => void;
  onDayMouseEnter: (dk: string) => void;
}

// ─── Month Grid ─────────────────────────────────────

function MonthGrid({
  year,
  month,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
  mini,
}: {
  year: number;
  month: number;
  selectedDays: Set<string>;
  markers: Marker[];
  mini?: boolean;
} & DayCellCallbacks) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const cells: { date: Date; inMonth: boolean }[] = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month, -i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      cells.push({ date: new Date(year, month + 1, d), inMonth: false });
    }
  }

  if (mini) {
    return (
      <div>
        <p className="text-xs font-semibold text-center mb-1.5">
          {MONTH_NAMES[month]}
        </p>
        <div className="grid grid-cols-7 gap-0">
          {DAY_NAMES.map((d) => (
            <div
              key={d}
              className="text-[9px] text-muted-foreground text-center pb-0.5"
            >
              {d[0]}
            </div>
          ))}
          {cells.map((c, i) => {
            const dk = dateKey(c.date);
            const isSelected = selectedDays.has(dk);
            const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));
            const today = isToday(c.date);
            return (
              <div
                key={i}
                className={`text-[10px] h-5 w-full relative transition-colors flex items-center justify-center cursor-default
                  ${!c.inMonth ? "text-muted-foreground/30" : ""}
                  ${isSelected ? "bg-primary text-primary-foreground" : ""}
                  ${today && !isSelected ? "font-bold text-primary" : ""}
                  ${isWeekend(c.date) && c.inMonth && !isSelected ? "text-muted-foreground" : ""}
                  hover:bg-accent`}
                onMouseDown={(e) => onDayMouseDown(dk, e)}
                onMouseEnter={() => onDayMouseEnter(dk)}
              >
                {c.date.getDate()}
                {dayMarkers.length > 0 && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 flex gap-px">
                    {dayMarkers.slice(0, 3).map((m, j) => (
                      <span
                        key={j}
                        className="w-1 h-1 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                    ))}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 border-b">
        {DAY_NAMES.map((d) => (
          <div
            key={d}
            className="text-xs font-medium text-muted-foreground text-center py-1.5 border-r last:border-r-0"
          >
            {d}
          </div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1"
        style={{ gridAutoRows: "1fr" }}
      >
        {cells.map((c, i) => {
          const dk = dateKey(c.date);
          const isSelected = selectedDays.has(dk);
          const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));
          const today = isToday(c.date);
          return (
            <div
              key={i}
              className={`border-r border-b p-1.5 text-left transition-colors flex flex-col min-h-[72px] cursor-default
                ${!c.inMonth ? "bg-muted/20 text-muted-foreground/40" : ""}
                ${isSelected ? "bg-primary/10 ring-1 ring-inset ring-primary/30" : ""}
                ${isWeekend(c.date) && c.inMonth && !isSelected ? "bg-muted/10" : ""}
                hover:bg-accent/40`}
              onMouseDown={(e) => onDayMouseDown(dk, e)}
              onMouseEnter={() => onDayMouseEnter(dk)}
            >
              <span
                className={`text-xs leading-none inline-flex items-center justify-center ${
                  today
                    ? "bg-primary text-primary-foreground w-5 h-5 rounded-full"
                    : "w-5 h-5"
                }`}
              >
                {c.date.getDate()}
              </span>
              {dayMarkers.length > 0 && (
                <div className="mt-auto flex flex-col gap-0.5 w-full">
                  {dayMarkers.slice(0, 2).map((m) => (
                    <div
                      key={m.id}
                      className="text-[9px] leading-tight truncate px-1 py-px rounded-sm text-white font-medium"
                      style={{ backgroundColor: m.color }}
                    >
                      {m.label}
                    </div>
                  ))}
                  {dayMarkers.length > 2 && (
                    <span className="text-[9px] text-muted-foreground pl-1">
                      +{dayMarkers.length - 2} more
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3 Month Grid ───────────────────────────────────

function ThreeMonthGrid({
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
  return (
    <div className="grid grid-cols-3 gap-6 h-full">
      {[0, 1, 2].map((i) => {
        const m = startMonth + i;
        const y = year + Math.floor(m / 12);
        const mo = ((m % 12) + 12) % 12;
        return (
          <div key={i} className="flex flex-col">
            <h3 className="text-sm font-semibold text-center mb-2">
              {MONTH_NAMES[mo]} {y}
            </h3>
            <div className="flex-1">
              <MonthGrid
                year={y}
                month={mo}
                selectedDays={selectedDays}
                markers={markers}
                onDayMouseDown={onDayMouseDown}
                onDayMouseEnter={onDayMouseEnter}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Year Grid ──────────────────────────────────────

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
    <div className="grid grid-cols-4 gap-x-6 gap-y-4">
      {Array.from({ length: 12 }, (_, i) => (
        <MonthGrid
          key={i}
          year={year}
          month={i}
          selectedDays={selectedDays}
          markers={markers}
          onDayMouseDown={onDayMouseDown}
          onDayMouseEnter={onDayMouseEnter}
          mini
        />
      ))}
    </div>
  );
}

// ─── Day Columns View (3-day / Week) ────────────────

function DayColumnsView({
  start,
  count,
  selectedDays,
  markers,
  onDayMouseDown,
  onDayMouseEnter,
}: {
  start: Date;
  count: number;
  selectedDays: Set<string>;
  markers: Marker[];
} & DayCellCallbacks) {
  const days = Array.from({ length: count }, (_, i) => addDays(start, i));

  return (
    <div
      className="grid h-full gap-2"
      style={{ gridTemplateColumns: `repeat(${count}, 1fr)` }}
    >
      {days.map((d) => {
        const dk = dateKey(d);
        const isSelected = selectedDays.has(dk);
        const dayMarkers = markers.filter((m) => markerIncludesDay(m, dk));
        const today = isToday(d);
        return (
          <div
            key={dk}
            className={`border rounded p-4 text-left flex flex-col transition-colors cursor-default
              ${isSelected ? "bg-primary/10 ring-1 ring-primary/30" : ""}
              ${isWeekend(d) && !isSelected ? "bg-muted/20" : ""}
              hover:bg-accent/40`}
            onMouseDown={(e) => onDayMouseDown(dk, e)}
            onMouseEnter={() => onDayMouseEnter(dk)}
          >
            <div className="text-center mb-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">
                {DAY_NAMES[(d.getDay() + 6) % 7]}
              </p>
              <p
                className={`text-3xl font-light mt-1 ${
                  today ? "text-primary font-semibold" : ""
                }`}
              >
                {d.getDate()}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {MONTH_NAMES[d.getMonth()].slice(0, 3)} {d.getFullYear()}
              </p>
            </div>
            {dayMarkers.length > 0 && (
              <div className="mt-auto space-y-1.5 w-full">
                {dayMarkers.map((m) => (
                  <div
                    key={m.id}
                    className="text-xs truncate px-2 py-1 rounded text-white font-medium"
                    style={{ backgroundColor: m.color }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
