"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
  Repeat,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { ListShell, ListRows } from "@/components/list-shell";
import { ActiveToggle } from "@/components/active-toggle";
import { SelectCheckbox } from "@/components/kim";
import {
  createLifeRoutine,
  deleteLifeRoutine,
  listLifeRoutines,
  updateLifeRoutine,
  type LifeRoutine,
} from "@/lib/life";

const DAYS_OF_WEEK = [
  { value: "monday", short: "Mon" },
  { value: "tuesday", short: "Tue" },
  { value: "wednesday", short: "Wed" },
  { value: "thursday", short: "Thu" },
  { value: "friday", short: "Fri" },
  { value: "saturday", short: "Sat" },
  { value: "sunday", short: "Sun" },
];

const inputCls = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50";

export function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return "No schedule set";
  const s = schedule as Record<string, unknown>;
  const freq = s.frequency as string | undefined;
  const days = s.days as (number | string)[] | undefined;
  const time = s.time as string | undefined;
  const interval = s.interval as number | undefined;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (freq === "daily") {
    return time ? `Every day at ${time}` : "Every day";
  }
  if (freq === "weekly" && days?.length) {
    const dayNames = days
      .map((d) => typeof d === "number" ? (DAY_NAMES[d] ?? String(d)) : String(d).charAt(0).toUpperCase() + String(d).slice(1, 3))
      .join(", ");
    return time ? `${dayNames} at ${time}` : dayNames;
  }
  if ((freq === "every_n_days" || freq === "custom") && interval) {
    return time ? `Every ${interval} days at ${time}` : `Every ${interval} days`;
  }
  return freq ?? "Custom schedule";
}

// ─── Config editors ───────────────────────────────────────────────────────────

function CallLovedOnesConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.contacts) ? c : { contacts: [] }; } catch { return { contacts: [] }; } })();
  const contacts: { name: string; frequency: string }[] = parsed.contacts ?? [];

  const update = (newContacts: { name: string; frequency: string }[]) => {
    onChange(JSON.stringify({ ...parsed, contacts: newContacts }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">People to call</p>
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.name}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], name: e.target.value }; update(n); }}
            placeholder="Name"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={c.frequency}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], frequency: e.target.value }; update(n); }}
            className={cn(inputCls, "w-32")}
          >
            <option value="daily">Daily</option>
            <option value="every_other_day">Every other day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button onClick={() => update(contacts.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...contacts, { name: "", frequency: "weekly" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add contact
      </button>
    </div>
  );
}

function GymConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.variations) ? c : { variations: [] }; } catch { return { variations: [] }; } })();
  const variations: { day: string; workout: string }[] = parsed.variations ?? [];

  const update = (newVars: { day: string; workout: string }[]) => {
    onChange(JSON.stringify({ ...parsed, variations: newVars }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Workout variations</p>
      {variations.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={v.day}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], day: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.short}</option>)}
          </select>
          <input
            type="text"
            value={v.workout}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], workout: e.target.value }; update(n); }}
            placeholder="e.g. Upper body, Cardio, Legs"
            className={cn(inputCls, "flex-1")}
          />
          <button onClick={() => update(variations.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...variations, { day: "monday", workout: "" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add variation
      </button>
    </div>
  );
}

function ReadingConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.books) ? c : { books: [] }; } catch { return { books: [] }; } })();
  const books: { title: string; status: string }[] = parsed.books ?? [];

  const update = (newBooks: { title: string; status: string }[]) => {
    onChange(JSON.stringify({ ...parsed, books: newBooks }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Reading list</p>
      {books.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={b.title}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], title: e.target.value }; update(n); }}
            placeholder="Book title"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={b.status}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], status: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            <option value="queued">Queued</option>
            <option value="reading">Reading</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => update(books.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...books, { title: "", status: "queued" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add book
      </button>
    </div>
  );
}


// ─── Card ─────────────────────────────────────────────────────────────────────

function RoutineCard({
  routine,
  onDelete,
  onToggleActive,
  onOpen,
}: {
  routine: LifeRoutine;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50",
        !routine.active && "opacity-50",
      )}
      onClick={() => onOpen(routine.id)}
    >
      <SelectCheckbox
        kind="routine"
        id={routine.id}
        label={routine.name}
        snapshot={{
          name: routine.name,
          description: routine.description,
          active: routine.active,
          schedule: routine.schedule,
        }}
      />

      <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 bg-primary/10 text-primary">
        <Repeat className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{routine.name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {formatSchedule(routine.schedule)}
          {routine.description ? ` · ${routine.description}` : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ActiveToggle
          active={routine.active}
          onChange={(next) => onToggleActive(routine.id, next)}
          label={routine.active ? "Pause routine" : "Resume routine"}
        />

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(routine.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Top-level view ──────────────────────────────────────────────────────────

export function RoutinesView() {
  const router = useRouter();
  const [routines, setRoutines] = useState<LifeRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLifeRoutines();
      setRoutines(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggleActive = useCallback(async (id: string, active: boolean) => {
    try {
      const updated = await updateLifeRoutine(id, { active });
      setRoutines((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setError(String(e));
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeRoutine(id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirmDeleteId(null);
    }
  }, []);

  const activeCount = routines.filter((r) => r.active).length;

  return (
    <ListShell
      title="Routines"
      subtitle={
        routines.length > 0
          ? `${activeCount} active · ${routines.length} total`
          : "Recurring habits Kim helps you keep"
      }
      toolbar={
        <>
          <button
            onClick={load}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <div className="flex-1" />
          <Link
            href={routes.marketplace({ kind: "routine" })}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            title="Browse routine templates from the community"
          >
            <Store className="h-3.5 w-3.5" />
            Browse Templates
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => router.push(routes.routineNew)}
          >
            <Plus className="h-3.5 w-3.5" />
            New Routine
          </Button>
        </>
      }
    >
      <div>
        {error && (
          <div className="flex items-center gap-2 mx-3 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => { setError(null); load(); }} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="px-3 py-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && routines.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No routines yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create one from scratch, let Kim draft it, or fork a community template.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => router.push(routes.routineNew)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Routine
              </Button>
              <Link
                href={routes.marketplace({ kind: "routine" })}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                Browse Templates
              </Link>
            </div>
          </div>
        )}

        {!loading && routines.length > 0 && (
          <ListRows>
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onDelete={setConfirmDeleteId}
                onToggleActive={handleToggleActive}
                onOpen={(id) => router.push(routes.routine(id))}
              />
            ))}
          </ListRows>
        )}
      </div>

      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Routine</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this routine? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListShell>
  );
}
