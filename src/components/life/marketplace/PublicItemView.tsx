"use client";

import type * as React from "react";
import { cn } from "@/lib/utils";
import type { MarketplaceItem } from "@/lib/marketplace";

// ─── Shared helpers ───────────────────────────────────────────────────────────

const ROUTINE_TYPE_COLORS: Record<string, string> = {
  call_loved_ones: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  gym: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  reading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  custom: "bg-muted text-muted-foreground",
};

const ROUTINE_TYPE_LABELS: Record<string, string> = {
  call_loved_ones: "Call Loved Ones",
  gym: "Gym",
  reading: "Reading",
  custom: "Custom",
};

const HEALTH_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/15 text-green-600 dark:text-green-400",
  draft: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  archived: "bg-muted text-muted-foreground",
};

const HEALTH_DIFFICULTY_COLORS: Record<string, string> = {
  easy: "text-green-500",
  moderate: "text-amber-500",
  hard: "text-orange-500",
  extreme: "text-red-500",
};

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return "No schedule set";
  const s = schedule as Record<string, unknown>;
  const freq = s.frequency as string | undefined;
  const days = s.days as (number | string)[] | undefined;
  const time = s.time as string | undefined;
  const interval = s.interval as number | undefined;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (freq === "daily") return time ? `Every day at ${time}` : "Every day";
  if (freq === "weekly" && days?.length) {
    const dayNames = days
      .map((d) =>
        typeof d === "number"
          ? (DAY_NAMES[d] ?? String(d))
          : String(d).charAt(0).toUpperCase() + String(d).slice(1, 3)
      )
      .join(", ");
    return time ? `${dayNames} at ${time}` : dayNames;
  }
  if ((freq === "every_n_days" || freq === "custom") && interval) {
    return time ? `Every ${interval} days at ${time}` : `Every ${interval} days`;
  }
  return freq ?? "Custom schedule";
}

// ─── Routine read-only view ────────────────────────────────────────────────────

interface RoutineContent {
  name?: string;
  type?: string;
  description?: string;
  schedule?: unknown;
  config?: unknown;
  active?: boolean;
}

function RoutineReadOnly({ content }: { content: unknown }) {
  const r = (content ?? {}) as RoutineContent;
  const typeLabel = ROUTINE_TYPE_LABELS[r.type ?? ""] ?? r.type ?? "Routine";
  const typeColor =
    ROUTINE_TYPE_COLORS[r.type ?? ""] ?? "bg-muted text-muted-foreground";

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              typeColor
            )}
          >
            {typeLabel}
          </span>
          {r.active != null && (
            <span className="text-[11px] text-muted-foreground">
              {r.active ? "Active" : "Inactive"}
            </span>
          )}
        </div>
        {r.description && (
          <p className="text-sm text-foreground leading-relaxed">{r.description}</p>
        )}
      </div>

      {!!r.schedule && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Schedule
          </label>
          <div className="rounded-md border bg-muted/30 px-3 py-2">
            <p className="text-sm">{formatSchedule(r.schedule)}</p>
            <pre className="text-[11px] font-mono text-muted-foreground mt-1 whitespace-pre-wrap">
              {JSON.stringify(r.schedule, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {!!r.config && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            Configuration
          </label>
          <pre className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] font-mono whitespace-pre-wrap overflow-x-auto">
            {JSON.stringify(r.config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Gym session read-only view ────────────────────────────────────────────────

interface ExerciseItem {
  id?: string;
  exercise_name?: string;
  sets?: number;
  reps?: string;
  weight?: string;
  rest_seconds?: number;
  notes?: string;
  superset_group?: string | null;
}

interface GymSessionContent {
  title?: string;
  description?: string;
  status?: string;
  difficulty_level?: string;
  target_muscle_groups?: string[];
  estimated_duration?: number | null;
  exercises?: ExerciseItem[];
}

function GymSessionReadOnly({ content }: { content: unknown }) {
  const s = (content ?? {}) as GymSessionContent;
  const exercises = s.exercises ?? [];
  const supersetColors = [
    "border-teal-500",
    "border-violet-500",
    "border-amber-500",
    "border-rose-500",
    "border-green-500",
  ];
  const supersetGroups: Record<string, string> = {};
  let colorIdx = 0;
  exercises.forEach((ex) => {
    if (ex.superset_group && !supersetGroups[ex.superset_group]) {
      supersetGroups[ex.superset_group] =
        supersetColors[colorIdx++ % supersetColors.length];
    }
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          {s.status && (
            <span
              className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium capitalize",
                HEALTH_STATUS_COLORS[s.status] ?? "bg-muted text-muted-foreground"
              )}
            >
              {s.status}
            </span>
          )}
          {s.difficulty_level && (
            <span
              className={cn(
                "text-[11px] capitalize font-medium",
                HEALTH_DIFFICULTY_COLORS[s.difficulty_level] ?? ""
              )}
            >
              {s.difficulty_level}
            </span>
          )}
        </div>
        {s.description && (
          <p className="text-xs text-muted-foreground">{s.description}</p>
        )}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {(s.target_muscle_groups ?? []).map((mg) => (
            <span
              key={mg}
              className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground capitalize"
            >
              {mg.replace(/_/g, " ")}
            </span>
          ))}
          {s.estimated_duration != null && (
            <span className="text-[11px] text-muted-foreground">
              {s.estimated_duration} min
            </span>
          )}
        </div>
      </div>

      {exercises.length > 0 && (
        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="px-3 py-2 border-b">
            <h3 className="text-sm font-semibold">
              Exercises{" "}
              <span className="text-muted-foreground font-normal text-xs">
                ({exercises.length})
              </span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b">
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Exercise
                  </th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground">
                    Sets
                  </th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground">
                    Reps
                  </th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground">
                    Weight
                  </th>
                  <th className="text-center px-2 py-2 font-medium text-muted-foreground">
                    Rest
                  </th>
                  <th className="text-left px-2 py-2 font-medium text-muted-foreground">
                    Notes
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {exercises.map((ex, i) => {
                  const supersetColor = ex.superset_group
                    ? supersetGroups[ex.superset_group]
                    : null;
                  return (
                    <tr
                      key={ex.id ?? i}
                      className={cn(
                        "hover:bg-muted/20",
                        supersetColor && `border-l-2 ${supersetColor}`
                      )}
                    >
                      <td className="px-3 py-1.5 font-medium">
                        {ex.exercise_name ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center tabular-nums">
                        {ex.sets ?? "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {ex.reps || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {ex.weight || "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {ex.rest_seconds ? `${ex.rest_seconds}s` : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {ex.notes || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Meal plan read-only view ──────────────────────────────────────────────────

interface MealItem {
  day?: string;
  meal_type: string;
  name: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

interface MealPlanContent {
  title?: string;
  plan_type?: string;
  diet_type?: string;
  target_calories?: number | null;
  content?: { meals?: MealItem[] };
  meals?: MealItem[];
}

function MealPlanReadOnly({ content }: { content: unknown }) {
  const p = (content ?? {}) as MealPlanContent;
  const meals: MealItem[] = p.content?.meals ?? p.meals ?? [];
  const isWeekly = p.plan_type === "weekly";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
        {p.plan_type && (
          <span className="capitalize">{p.plan_type} plan</span>
        )}
        {p.diet_type && (
          <>
            <span>·</span>
            <span className="capitalize">{p.diet_type.replace(/_/g, " ")}</span>
          </>
        )}
        {p.target_calories && (
          <>
            <span>·</span>
            <span>{Math.round(p.target_calories)} kcal target</span>
          </>
        )}
      </div>

      {meals.length > 0 && (
        <div className="rounded-lg border bg-muted/20 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b">
                  {isWeekly && (
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                      Day
                    </th>
                  )}
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Meal
                  </th>
                  <th className="text-left px-3 py-2 font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-muted-foreground">
                    Cal
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-teal-600 dark:text-teal-400">
                    P
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-blue-600 dark:text-blue-400">
                    C
                  </th>
                  <th className="text-right px-3 py-2 font-medium text-amber-600 dark:text-amber-400">
                    F
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {meals.map((meal, i) => (
                  <tr key={i} className="hover:bg-muted/20">
                    {isWeekly && (
                      <td className="px-3 py-2 text-muted-foreground capitalize">
                        {meal.day ?? ""}
                      </td>
                    )}
                    <td className="px-3 py-2 text-muted-foreground capitalize">
                      {meal.meal_type.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 font-medium">{meal.name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {meal.calories}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-teal-600 dark:text-teal-400">
                      {meal.protein_g != null ? `${meal.protein_g}g` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-blue-600 dark:text-blue-400">
                      {meal.carbs_g != null ? `${meal.carbs_g}g` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-amber-600 dark:text-amber-400">
                      {meal.fat_g != null ? `${meal.fat_g}g` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function RawJSON({ content }: { content: unknown }) {
  return (
    <details className="rounded-md border bg-muted/20">
      <summary className="cursor-pointer select-none px-3 py-2 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        Raw data
      </summary>
      <pre className="text-[11px] font-mono px-3 py-2 border-t whitespace-pre-wrap overflow-x-auto">
        {JSON.stringify(content, null, 2)}
      </pre>
    </details>
  );
}

export function PublicItemView({ item }: { item: MarketplaceItem }) {
  let body: React.ReactNode;
  if (item.kind === "routine") body = <RoutineReadOnly content={item.content} />;
  else if (item.kind === "gym_session") body = <GymSessionReadOnly content={item.content} />;
  else if (item.kind === "meal_plan") body = <MealPlanReadOnly content={item.content} />;
  else body = null;

  return (
    <div className="space-y-4">
      {body}
      <RawJSON content={item.content} />
    </div>
  );
}
