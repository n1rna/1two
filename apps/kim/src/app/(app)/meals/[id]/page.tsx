"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Sun, Sandwich, Moon, Cookie } from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import { ActiveToggle } from "@/components/active-toggle";
import { PublishControl } from "@/components/marketplace/PublishControl";
import { Selectable, useKim, useKimAutoContext, useKimEffect } from "@/components/kim";
import { MealDetailDialog } from "@/components/meals/meal-detail-dialog";
import { GroceryListCard } from "@/components/meals/grocery-list-card";
import { BulkEditBar } from "@/components/meals/bulk-edit-bar";
import {
  MealEditsPreviewDialog,
  type MealEditProposal,
} from "@/components/meals/meal-edits-preview-dialog";
import {
  getMealPlan,
  updateMealPlan,
  type GroceryItem,
  type HealthMealPlan,
  type MealItem,
  type SupplementItem,
} from "@/lib/health";
import { CheckSquare, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

type MealSlot = "breakfast" | "lunch" | "dinner" | "snack";

const MEAL_SLOTS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];

const SLOT_META: Record<
  MealSlot,
  {
    label: string;
    time: string;
    Icon: React.ComponentType<{ size?: number; className?: string }>;
    tint: string;
  }
> = {
  breakfast: { label: "Breakfast", time: "07:00", Icon: Sun,      tint: "text-teal-500" },
  lunch:     { label: "Lunch",     time: "12:30", Icon: Sandwich, tint: "text-orange-500" },
  dinner:    { label: "Dinner",    time: "19:00", Icon: Moon,     tint: "text-indigo-500" },
  snack:     { label: "Snack",     time: "any",   Icon: Cookie,   tint: "text-emerald-500" },
};

const DAY_LABELS: Record<string, string> = {
  monday: "Mon",
  tuesday: "Tue",
  wednesday: "Wed",
  thursday: "Thu",
  friday: "Fri",
  saturday: "Sat",
  sunday: "Sun",
  any: "Any day",
};

const WEEK_DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
type WeekDay = (typeof WEEK_DAYS)[number];

function normalizeDay(raw?: string): WeekDay | "any" {
  if (!raw) return "any";
  const k = raw.trim().toLowerCase();
  const match = WEEK_DAYS.find((d) => d === k || d.startsWith(k.slice(0, 3)));
  return match ?? "any";
}

function normalizeSlot(raw?: string): MealSlot {
  const k = (raw ?? "").trim().toLowerCase();
  if (MEAL_SLOTS.includes(k as MealSlot)) return k as MealSlot;
  return "snack";
}

interface DayTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

function emptyTotals(): DayTotals {
  return { calories: 0, protein: 0, carbs: 0, fat: 0 };
}

function addMealToTotals(t: DayTotals, m: MealItem): DayTotals {
  return {
    calories: t.calories + (m.calories ?? 0),
    protein: t.protein + (m.protein_g ?? 0),
    carbs: t.carbs + (m.carbs_g ?? 0),
    fat: t.fat + (m.fat_g ?? 0),
  };
}

export default function MealPlanDetailPage() {
  const { t } = useTranslation("meals");
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<HealthMealPlan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    meal: MealItem;
    context: string;
    selectionId: string;
  } | null>(null);

  // Bulk edit mode state — when active, clicking a meal toggles its selection
  // for a batch request to Kim. Selection is a Set of selection_ids
  // (plan:day:slot:index).
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [preview, setPreview] = useState<{
    summary?: string;
    proposals: MealEditProposal[];
  } | null>(null);
  const { addSelection, clearSelection, askKim, setMode } = useKim();

  useEffect(() => {
    (async () => {
      try {
        setPlan(await getMealPlan(id));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [id]);

  useKimAutoContext(
    plan
      ? {
          kind: "meal-plan",
          id: plan.id,
          label: plan.title,
          snapshot: {
            title: plan.title,
            planType: plan.planType,
            dietType: plan.dietType,
            targetCalories: plan.targetCalories,
            active: plan.active,
            meals: plan.content?.meals ?? [],
          },
        }
      : null,
  );

  const meals = plan?.content?.meals ?? [];
  const supplements = plan?.content?.supplements ?? [];

  const { columns, bySlotDay, dayTotals, planTotals } = useMemo(() => {
    const isWeekly =
      plan?.planType === "weekly" || meals.some((m) => normalizeDay(m.day) !== "any");

    const finalColumns: (WeekDay | "any")[] = isWeekly ? WEEK_DAYS.slice() : ["any"];

    const bySlotDay: Record<MealSlot, Record<string, MealItem[]>> = {
      breakfast: {},
      lunch: {},
      dinner: {},
      snack: {},
    };
    const dayTotals: Record<string, DayTotals> = {};
    let planTotals = emptyTotals();

    for (const col of finalColumns) dayTotals[col] = emptyTotals();

    for (const m of meals) {
      const slot = normalizeSlot(m.meal_type);
      const day = normalizeDay(m.day);
      const col = isWeekly && day === "any" ? "monday" : day;
      if (!bySlotDay[slot][col]) bySlotDay[slot][col] = [];
      bySlotDay[slot][col].push(m);
      dayTotals[col] = addMealToTotals(dayTotals[col] ?? emptyTotals(), m);
      planTotals = addMealToTotals(planTotals, m);
    }

    return { columns: finalColumns, bySlotDay, dayTotals, planTotals };
  }, [plan, meals]);

  // Resolve a selection_id to the underlying MealItem + day/slot coords.
  // Must be defined BEFORE the early returns below so hook order stays stable
  // across renders (the err / !plan branches skip the rest of the component).
  const resolveMeal = useMemo(() => {
    if (!plan) return (_id: string) => null as { meal: MealItem; day: string; slot: MealSlot; index: number } | null;
    const map = new Map<
      string,
      { meal: MealItem; day: string; slot: MealSlot; index: number }
    >();
    for (const slot of MEAL_SLOTS) {
      for (const [day, list] of Object.entries(bySlotDay[slot])) {
        list.forEach((meal, index) => {
          map.set(`${plan.id}:${day}:${slot}:${index}`, {
            meal,
            day,
            slot,
            index,
          });
        });
      }
    }
    return (id: string) => map.get(id) ?? null;
  }, [plan, bySlotDay]);

  // Listen for Kim's propose_meal_edits tool call and open the preview dialog.
  // Registered before early returns so hook order is stable.
  useKimEffect("propose_meal_edits", async (data) => {
    if (!plan) return;
    const rawUpdates = (data?.updates ?? []) as Array<{
      selection_id?: string;
      patch?: Partial<MealItem>;
      reason?: string;
    }>;
    const proposals: MealEditProposal[] = [];
    for (const u of rawUpdates) {
      if (!u.selection_id || !u.patch) continue;
      const resolved = resolveMeal(u.selection_id);
      if (!resolved) continue;
      proposals.push({
        selectionId: u.selection_id,
        before: resolved.meal,
        patch: u.patch,
        reason: u.reason,
      });
    }
    if (proposals.length > 0) {
      setPreview({
        summary: typeof data?.summary === "string" ? data.summary : undefined,
        proposals,
      });
    }
  });

  if (err) {
    return (
      <PageShell title="Meal plan" backHref={routes.meals} backLabel={t("detail_back_label")}>
        <EmptyState title={err} />
      </PageShell>
    );
  }
  if (!plan) {
    return (
      <PageShell title="Loading…" backHref={routes.meals} backLabel={t("detail_back_label")}>
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </PageShell>
    );
  }

  const numDays = columns.length;
  const avgCalories = numDays > 0 ? Math.round(planTotals.calories / numDays) : 0;
  const targetKcal = plan.targetCalories ?? null;

  async function toggleActive(next: boolean) {
    if (!plan) return;
    const updated = await updateMealPlan(plan.id, { active: next });
    setPlan(updated);
  }

  async function handleSaveGrocery(items: GroceryItem[], generatedAt?: string) {
    if (!plan) return;
    const nextContent = {
      ...(plan.content ?? { meals: [] }),
      grocery: { items, generatedAt },
    };
    const updated = await updateMealPlan(plan.id, { content: nextContent });
    setPlan(updated);
  }

  // ── Bulk edit helpers ────────────────────────────────────────────────────

  const toggleBulk = (selectionId: string) => {
    setBulkSelected((cur) => {
      const next = new Set(cur);
      if (next.has(selectionId)) next.delete(selectionId);
      else next.add(selectionId);
      return next;
    });
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    setBulkSelected(new Set());
    clearSelection();
  };

  const selectAllForDay = (day: string) => {
    if (!plan) return;
    const planId = plan.id;
    const isWeekly =
      plan.planType === "weekly" ||
      meals.some((m) => normalizeDay(m.day) !== "any");
    const ids: string[] = [];
    for (const slot of MEAL_SLOTS) {
      const list = bySlotDay[slot][day] ?? [];
      list.forEach((_m, i) => {
        ids.push(`${planId}:${day}:${slot}:${i}`);
      });
    }
    // If daily plan, there's only "any" as a column; same id scheme.
    void isWeekly;
    setBulkSelected((cur) => {
      const next = new Set(cur);
      for (const id of ids) next.add(id);
      return next;
    });
  };

  const sendBulkPrompt = async (userPrompt: string) => {
    if (!plan || bulkSelected.size === 0) return;
    setBulkPending(true);
    try {
      // Pin every selected meal to Kim's context so the system prompt
      // carries full snapshots.
      clearSelection();
      for (const selId of bulkSelected) {
        const resolved = resolveMeal(selId);
        if (!resolved) continue;
        addSelection({
          kind: "meal-item",
          id: selId,
          label: resolved.meal.name,
          snapshot: resolved.meal as unknown as Record<string, unknown>,
        });
      }
      setMode("meals", true);

      // Send a structured prompt asking Kim to call propose_meal_edits.
      const ids = Array.from(bulkSelected);
      const prompt =
        `Bulk edit for meal plan ${plan.id}. Selected meals (selection_ids): ${ids.join(", ")}.\n\n` +
        `User request: ${userPrompt}\n\n` +
        `Please call propose_meal_edits with a list of per-meal patches. Only change fields that need to change.`;
      askKim(prompt);
    } finally {
      setBulkPending(false);
    }
  };

  const applyMealEdits = async (accepted: MealEditProposal[]) => {
    if (!plan) return;
    // Build the new meals array by merging patches in place. The
    // selection_id encodes (plan, day, slot, index) — we find the exact
    // MealItem in content.meals and replace it with {...existing, ...patch}.
    const next = meals.map((m, globalIdx) => {
      // Rebuild the selection_id that would have been generated for this
      // meal when the grid was computed.
      const slot = normalizeSlot(m.meal_type);
      const day = normalizeDay(m.day);
      const isWeekly =
        plan.planType === "weekly" ||
        meals.some((x) => normalizeDay(x.day) !== "any");
      const col = isWeekly && day === "any" ? "monday" : day;
      // Compute this meal's index *within its (day, slot) bucket*.
      const inBucketIdx = meals
        .slice(0, globalIdx)
        .filter((x) => {
          const xs = normalizeSlot(x.meal_type);
          const xd = normalizeDay(x.day);
          const xcol = isWeekly && xd === "any" ? "monday" : xd;
          return xs === slot && xcol === col;
        }).length;
      const selId = `${plan.id}:${col}:${slot}:${inBucketIdx}`;
      const proposal = accepted.find((p) => p.selectionId === selId);
      if (!proposal) return m;
      return { ...m, ...proposal.patch } as MealItem;
    });

    const nextContent = {
      ...(plan.content ?? { meals: [] }),
      meals: next,
    };
    const updated = await updateMealPlan(plan.id, { content: nextContent });
    setPlan(updated);
    exitBulkMode();
  };

  return (
    <PageShell
      title={plan.title}
      subtitle={`${plan.planType || "plan"} · ${plan.dietType || "—"}${targetKcal ? ` · target ${targetKcal} kcal/day` : ""}`}
      backHref={routes.meals}
      backLabel={t("detail_back_label")}
      actions={
        <>
          <div className="flex items-center gap-2 pr-1">
            <span className="text-xs text-muted-foreground">
              {plan.active ? t("active", { ns: "common" }) : t("inactive", { ns: "common" })}
            </span>
            <ActiveToggle
              active={plan.active}
              onChange={toggleActive}
              stopPropagation={false}
              label={plan.active ? t("disable_meal_plan") : t("enable_meal_plan")}
            />
          </div>
          <Button
            size="sm"
            variant={bulkMode ? "default" : "outline"}
            className="gap-1.5"
            onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
            title={bulkMode ? "Exit bulk edit" : "Bulk edit meals with Kim"}
          >
            <CheckSquare className="h-3 w-3" />
            {bulkMode ? "Done" : "Bulk edit"}
          </Button>
          <PublishControl
            kind="meal_plan"
            sourceId={plan.id}
            defaultTitle={plan.title}
          />
        </>
      }
    >
      <div className="flex flex-col gap-5 max-w-5xl">
        <PlanSummary
          totals={planTotals}
          avgCalories={avgCalories}
          targetKcal={targetKcal}
          numDays={numDays}
          mealCount={meals.length}
        />

        {supplements.length > 0 && (
          <SupplementsCard
            supplements={supplements}
            weekly={numDays > 1}
          />
        )}

        <GroceryListCard
          plan={plan}
          meals={meals}
          supplements={supplements}
          planDays={numDays}
          onSave={handleSaveGrocery}
        />

        {meals.length === 0 ? (
          <EmptyState title={t("detail_empty_title")} hint={t("detail_empty_hint")} />
        ) : (
          <WeekGrid
            planId={plan.id}
            columns={columns}
            bySlotDay={bySlotDay}
            dayTotals={dayTotals}
            targetKcal={targetKcal}
            bulkMode={bulkMode}
            bulkSelected={bulkSelected}
            onBulkToggle={toggleBulk}
            onInspect={(meal, context, selectionId) =>
              setDetail({ meal, context, selectionId })
            }
          />
        )}
      </div>
      <MealDetailDialog
        open={!!detail}
        onOpenChange={(next) => {
          if (!next) setDetail(null);
        }}
        meal={detail?.meal ?? null}
        context={detail?.context}
        selectionId={detail?.selectionId}
      />
      {bulkMode && (
        <BulkEditBar
          count={bulkSelected.size}
          days={columns.filter((c) => c !== "any") as string[]}
          onSelectDay={selectAllForDay}
          onCancel={exitBulkMode}
          onSend={sendBulkPrompt}
          pending={bulkPending}
        />
      )}
      <MealEditsPreviewDialog
        open={!!preview}
        onOpenChange={(next) => {
          if (!next) setPreview(null);
        }}
        summary={preview?.summary}
        proposals={preview?.proposals ?? []}
        onApply={applyMealEdits}
      />
    </PageShell>
  );
}

function PlanSummary({
  totals,
  avgCalories,
  targetKcal,
  numDays,
  mealCount,
}: {
  totals: DayTotals;
  avgCalories: number;
  targetKcal: number | null;
  numDays: number;
  mealCount: number;
}) {
  const { t } = useTranslation("meals");
  const totalMacroGrams = totals.protein + totals.carbs + totals.fat;
  const pct = (v: number) => (totalMacroGrams > 0 ? (v / totalMacroGrams) * 100 : 0);
  const pPct = pct(totals.protein);
  const cPct = pct(totals.carbs);
  const fPct = pct(totals.fat);
  const deltaVsTarget = targetKcal ? avgCalories - targetKcal : null;
  const deltaTone =
    deltaVsTarget == null
      ? "muted"
      : Math.abs(deltaVsTarget) <= (targetKcal ?? 0) * 0.05
        ? "good"
        : "warn";

  return (
    <Card>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label={t("detail_stat_avg_day")} value={`${avgCalories}`} suffix="kcal" />
        <Stat
          label={t("detail_stat_target")}
          value={targetKcal ? `${targetKcal}` : "—"}
          suffix={targetKcal ? "kcal" : undefined}
          hint={
            deltaVsTarget != null
              ? `${deltaVsTarget >= 0 ? "+" : ""}${deltaVsTarget} vs target`
              : undefined
          }
          hintTone={deltaTone}
        />
        <Stat label={t("detail_stat_days")} value={`${numDays}`} />
        <Stat label={t("detail_stat_meals")} value={`${mealCount}`} />
      </div>

      {totalMacroGrams > 0 && (
        <div className="mt-5 pt-5 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">{t("detail_macro_split")}</span>
            <span className="text-xs text-muted-foreground">{t("detail_plan_total")}</span>
          </div>
          <div className="h-2 w-full overflow-hidden flex bg-muted rounded-full">
            <div className="bg-sky-500" style={{ width: `${pPct}%` }} />
            <div className="bg-teal-500" style={{ width: `${cPct}%` }} />
            <div className="bg-rose-500" style={{ width: `${fPct}%` }} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
            <MacroLegend color="bg-sky-500" label="Protein" grams={totals.protein} pct={pPct} />
            <MacroLegend color="bg-teal-500" label="Carbs" grams={totals.carbs} pct={cPct} />
            <MacroLegend color="bg-rose-500" label="Fat" grams={totals.fat} pct={fPct} />
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({
  label,
  value,
  suffix,
  hint,
  hintTone = "muted",
}: {
  label: string;
  value: string;
  suffix?: string;
  hint?: string;
  hintTone?: "muted" | "good" | "warn";
}) {
  const toneClass =
    hintTone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : hintTone === "warn"
        ? "text-teal-600 dark:text-teal-400"
        : "text-muted-foreground";
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className={`mt-0.5 text-xs ${toneClass}`}>{hint}</div>}
    </div>
  );
}

function MacroLegend({
  color,
  label,
  grams,
  pct,
}: {
  color: string;
  label: string;
  grams: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
      <span>{label}</span>
      <span className="text-foreground/80">{Math.round(grams)}g</span>
      <span>· {Math.round(pct)}%</span>
    </div>
  );
}

function WeekGrid({
  planId,
  columns,
  bySlotDay,
  dayTotals,
  targetKcal,
  onInspect,
  bulkMode,
  bulkSelected,
  onBulkToggle,
}: {
  planId: string;
  columns: (WeekDay | "any")[];
  bySlotDay: Record<MealSlot, Record<string, MealItem[]>>;
  dayTotals: Record<string, DayTotals>;
  targetKcal: number | null;
  onInspect: (meal: MealItem, context: string, selectionId: string) => void;
  bulkMode: boolean;
  bulkSelected: Set<string>;
  onBulkToggle: (selectionId: string) => void;
}) {
  const { t } = useTranslation("meals");
  const colTemplate = `minmax(112px, 128px) repeat(${columns.length}, minmax(180px, 1fr))`;

  return (
    <div className="rounded-lg border border-border bg-card shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <div style={{ minWidth: `calc(128px + ${columns.length} * 180px)` }}>
          {/* Header row */}
          <div
            className="grid border-b border-border bg-muted/30"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="px-4 py-3 text-xs font-medium text-muted-foreground">
              {t("grid_header_meal")}
            </div>
            {columns.map((col) => (
              <div key={col} className="px-4 py-3 border-l border-border">
                <div className="text-sm font-semibold">
                  {DAY_LABELS[col] ?? col}
                </div>
              </div>
            ))}
          </div>

          {/* Slot rows */}
          {MEAL_SLOTS.map((slot) => {
            const hasAny = columns.some((c) => (bySlotDay[slot][c]?.length ?? 0) > 0);
            if (!hasAny) return null;
            const meta = SLOT_META[slot];
            const Icon = meta.Icon;
            return (
              <div
                key={slot}
                className="grid border-b border-border"
                style={{ gridTemplateColumns: colTemplate }}
              >
                <div className="px-4 py-3 flex items-start gap-2.5 bg-muted/20">
                  <Icon size={16} className={`mt-0.5 shrink-0 ${meta.tint}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium leading-tight">
                      {meta.label}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {meta.time}
                    </div>
                  </div>
                </div>
                {columns.map((col) => {
                  const items = bySlotDay[slot][col] ?? [];
                  return (
                    <div
                      key={`${slot}-${col}`}
                      className="border-l border-border p-2 flex flex-col gap-2 min-h-[96px]"
                    >
                      {items.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        </div>
                      ) : (
                        items.map((m, i) => (
                          <MealCell
                            key={`${slot}-${col}-${i}`}
                            planId={planId}
                            day={col}
                            slot={slot}
                            index={i}
                            meal={m}
                            onInspect={onInspect}
                            bulkMode={bulkMode}
                            bulkSelected={bulkSelected.has(
                              `${planId}:${col}:${slot}:${i}`,
                            )}
                            onBulkToggle={onBulkToggle}
                          />
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* Totals row */}
          <div
            className="grid bg-muted/30"
            style={{ gridTemplateColumns: colTemplate }}
          >
            <div className="px-4 py-3 text-xs font-medium text-muted-foreground">
              {t("grid_day_total")}
            </div>
            {columns.map((col) => {
              const t = dayTotals[col] ?? emptyTotals();
              const pctOfTarget = targetKcal ? (t.calories / targetKcal) * 100 : null;
              return (
                <div
                  key={`total-${col}`}
                  className="px-4 py-3 border-l border-border"
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-lg font-semibold tabular-nums">
                      {t.calories}
                    </span>
                    <span className="text-xs text-muted-foreground">kcal</span>
                  </div>
                  {pctOfTarget != null && (
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${
                          Math.abs(pctOfTarget - 100) <= 5
                            ? "bg-emerald-500"
                            : pctOfTarget > 110
                              ? "bg-rose-500"
                              : "bg-teal-500"
                        }`}
                        style={{ width: `${Math.min(pctOfTarget, 100)}%` }}
                      />
                    </div>
                  )}
                  <div className="mt-1.5 text-xs text-muted-foreground tabular-nums">
                    {Math.round(t.protein)}p · {Math.round(t.carbs)}c · {Math.round(t.fat)}f
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MealCell({
  planId,
  day,
  slot,
  index,
  meal,
  onInspect,
  bulkMode,
  bulkSelected,
  onBulkToggle,
}: {
  planId: string;
  day: string;
  slot: MealSlot;
  index: number;
  meal: MealItem;
  onInspect: (meal: MealItem, context: string, selectionId: string) => void;
  bulkMode: boolean;
  bulkSelected: boolean;
  onBulkToggle: (selectionId: string) => void;
}) {
  const totalMacros = (meal.protein_g ?? 0) + (meal.carbs_g ?? 0) + (meal.fat_g ?? 0);
  const pPct = totalMacros > 0 ? ((meal.protein_g ?? 0) / totalMacros) * 100 : 0;
  const cPct = totalMacros > 0 ? ((meal.carbs_g ?? 0) / totalMacros) * 100 : 0;
  const fPct = totalMacros > 0 ? ((meal.fat_g ?? 0) / totalMacros) * 100 : 0;
  const selectionId = `${planId}:${day}:${slot}:${index}`;
  const dayLabel = day === "any" ? "" : day.charAt(0).toUpperCase() + day.slice(1);
  const slotLabel = slot.charAt(0).toUpperCase() + slot.slice(1);
  const context = dayLabel ? `${dayLabel} · ${slotLabel}` : slotLabel;

  const cellClass = bulkMode
    ? `group rounded-md border bg-background transition-colors p-2.5 cursor-pointer ${
        bulkSelected
          ? "border-primary bg-primary/5 ring-2 ring-primary/30"
          : "border-border hover:border-primary/40"
      }`
    : "group rounded-md border border-border bg-background hover:border-foreground/20 hover:bg-accent/40 transition-colors p-2.5 cursor-pointer data-[selected=true]:border-foreground/40 data-[selected=true]:bg-accent";

  return (
    <Selectable
      kind="meal-item"
      id={selectionId}
      label={meal.name}
      snapshot={meal as unknown as Record<string, unknown>}
      className={cellClass}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => {
          // Modifier clicks are handled by Selectable (adds to Kim context).
          if (e.metaKey || e.ctrlKey || e.shiftKey) return;
          if (bulkMode) {
            onBulkToggle(selectionId);
            return;
          }
          onInspect(meal, context, selectionId);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (bulkMode) {
              onBulkToggle(selectionId);
            } else {
              onInspect(meal, context, selectionId);
            }
          }
        }}
        className="outline-none relative"
      >
        {bulkMode && (
          <div className="absolute -top-1 -left-1 z-10">
            <span
              className={
                "flex items-center justify-center h-4 w-4 rounded-sm border " +
                (bulkSelected
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-background border-border")
              }
              aria-hidden
            >
              {bulkSelected && (
                <svg
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3 w-3"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.7 5.3a1 1 0 010 1.4l-7 7a1 1 0 01-1.4 0l-4-4a1 1 0 111.4-1.4L9 11.6l6.3-6.3a1 1 0 011.4 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </span>
          </div>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug line-clamp-2">
              {meal.name}
            </div>
            {meal.description && (
              <div className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-snug">
                {meal.description}
              </div>
            )}
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-semibold tabular-nums leading-none">
              {meal.calories}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">kcal</div>
          </div>
        </div>

        {totalMacros > 0 && (
          <div className="mt-2 space-y-1">
            <div className="h-1 w-full rounded-full bg-muted overflow-hidden flex">
              <div className="bg-sky-500" style={{ width: `${pPct}%` }} />
              <div className="bg-teal-500" style={{ width: `${cPct}%` }} />
              <div className="bg-rose-500" style={{ width: `${fPct}%` }} />
            </div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {meal.protein_g ?? 0}p · {meal.carbs_g ?? 0}c · {meal.fat_g ?? 0}f
            </div>
          </div>
        )}
      </div>
    </Selectable>
  );
}

// ─── Supplements ──────────────────────────────────────────────────────────────

function SupplementsCard({
  supplements,
  weekly,
}: {
  supplements: SupplementItem[];
  weekly: boolean;
}) {
  // Group by timing for the summary strip.
  const byTiming = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of supplements) {
      const k = s.timing || "Any time";
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return Array.from(map.entries());
  }, [supplements]);

  // Daily supplements (no day) vs per-day supplements.
  const daily = supplements.filter((s) => !s.day || s.day.toLowerCase() === "any");
  const byDay = useMemo(() => {
    const m = new Map<string, SupplementItem[]>();
    for (const s of supplements) {
      const d = (s.day ?? "").toLowerCase();
      if (!d || d === "any") continue;
      const list = m.get(d) ?? [];
      list.push(s);
      m.set(d, list);
    }
    return m;
  }, [supplements]);

  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5">
      <div className="flex items-center justify-between px-4 py-3 border-b border-amber-500/20">
        <div className="flex items-center gap-2">
          <Pill className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <h2 className="text-sm font-semibold">Supplements</h2>
          <span className="text-xs text-muted-foreground">
            {supplements.length}{" "}
            {supplements.length === 1 ? "item" : "items"}
          </span>
        </div>
        {byTiming.length > 0 && (
          <div className="hidden sm:flex flex-wrap gap-1.5">
            {byTiming.map(([timing, count]) => (
              <span
                key={timing}
                className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-background px-2 py-0.5 text-[10px] text-amber-700 dark:text-amber-400"
              >
                {timing}
                <span className="font-mono tabular-nums">· {count}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {daily.length > 0 && (
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
              {weekly ? "Every day" : "Schedule"}
            </div>
            <ul className="divide-y divide-amber-500/20 rounded-md border border-amber-500/20 bg-background">
              {daily.map((s, i) => (
                <SupplementRow key={`daily-${i}`} s={s} />
              ))}
            </ul>
          </div>
        )}

        {weekly && byDay.size > 0 && (
          <div className="space-y-2">
            {WEEK_DAYS.filter((d) => byDay.has(d)).map((d) => (
              <div key={d}>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 capitalize">
                  {d}
                </div>
                <ul className="divide-y divide-amber-500/20 rounded-md border border-amber-500/20 bg-background">
                  {byDay.get(d)!.map((s, i) => (
                    <SupplementRow key={`${d}-${i}`} s={s} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SupplementRow({ s }: { s: SupplementItem }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 text-sm">
      <Pill className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{s.name}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {s.dose}
            {s.unit}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
            {s.form}
          </span>
        </div>
        {s.notes && (
          <div className="text-xs text-muted-foreground mt-0.5 truncate">
            {s.notes}
          </div>
        )}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">
        {s.timing}
      </span>
    </li>
  );
}
