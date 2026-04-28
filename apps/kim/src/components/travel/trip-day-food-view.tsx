"use client";

import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import type {
  Activity,
  Destination,
  Reservation,
  Trip,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";
import { cn } from "@/lib/utils";
import { LensSummaryStrip } from "./trip-day-transport-view";

export type MealSlot = "breakfast" | "lunch" | "dinner";

const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "dinner"];

interface FilledMeal {
  kind: "filled";
  id: string;
  slot: MealSlot;
  time: string | null;
  name: string;
  cuisine: string | null;
  area: string | null;
  costAmount: number | null;
  costCurrency: string;
  status: "no-res" | "kim-suggested" | "draft" | "included";
  note: string | null;
}

interface EmptyMeal {
  kind: "empty";
  slot: MealSlot;
  area: string | null;
}

type Meal = FilledMeal | EmptyMeal;

interface FoodDay {
  index: number; // 1-based day number
  date: Date;
  destination: Destination | null;
  meals: Meal[];
}

export function TripDayFoodView({
  trip,
  nights,
  destinationByDay,
  activities,
  reservations,
}: {
  trip: Trip;
  nights: number;
  destinationByDay: (Destination | null)[];
  activities: Activity[];
  reservations: Reservation[];
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();

  const days = useMemo(
    () =>
      buildFoodDays({ trip, nights, destinationByDay, activities, reservations }),
    [trip, nights, destinationByDay, activities, reservations],
  );

  const allMeals = days.flatMap((d) => d.meals);
  const totalSlots = allMeals.length;
  const filled = allMeals.filter((m): m is FilledMeal => m.kind === "filled").length;
  const empty = totalSlots - filled;
  const reserved = allMeals.filter(
    (m) => m.kind === "filled" && (m.status === "draft" || m.status === "included"),
  ).length;
  const filledMeals = allMeals.filter(
    (m): m is FilledMeal => m.kind === "filled" && m.costAmount != null,
  );
  const avgPerMeal =
    filledMeals.length > 0
      ? Math.round(
          filledMeals.reduce((s, m) => s + (m.costAmount ?? 0), 0) / filledMeals.length,
        )
      : 0;

  return (
    <div>
      <LensSummaryStrip
        items={[
          {
            label: t("day_lens_food_summary_filled"),
            value: String(filled),
            ratio: totalSlots || undefined,
          },
          {
            label: t("day_lens_food_summary_empty"),
            value: String(empty),
            valueClass: "text-muted-foreground",
          },
          {
            label: t("day_lens_food_summary_reserved"),
            value: String(reserved),
            valueClass: "travel-accent",
          },
          {
            label: t("day_lens_food_summary_avg"),
            value:
              avgPerMeal > 0
                ? formatMoney(avgPerMeal, trip.budgetCurrency)
                : "—",
          },
        ]}
        cta={{
          label: t("day_lens_food_cta"),
          onClick: () =>
            askKim(t("day_lens_food_ask_kim", { trip: trip.title })),
          show: empty > 0 || totalSlots === 0,
        }}
      />

      {days.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          {t("day_empty_hint")}
        </div>
      ) : (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(280px,1fr))]">
          {days.map((d) => (
            <FoodDayCard
              key={d.date.toISOString()}
              day={d}
              onSuggest={(slot) =>
                askKim(
                  t("day_lens_food_suggest_ask_kim", {
                    slot: t(`day_lens_food_slot_${slot}`),
                    destination: d.destination?.name ?? trip.title,
                    date: formatDate(d.date),
                  }),
                )
              }
              currency={trip.budgetCurrency}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FoodDayCard({
  day,
  onSuggest,
  currency,
}: {
  day: FoodDay;
  onSuggest: (slot: MealSlot) => void;
  currency: string;
}) {
  const { t } = useTranslation("travel");
  return (
    <div className="rounded-[10px] border border-border bg-card p-3">
      <div className="flex items-start gap-3 border-b border-dashed border-border pb-3">
        <span className="inline-flex items-center rounded-full travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide">
          {t("day_label", { num: day.index })}
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">
            {day.destination?.name ?? t("day_unscheduled")}
          </div>
          <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            {formatDate(day.date)}
          </div>
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-3">
        {day.meals.map((m, i) => (
          <li key={`${day.index}-${m.slot}-${i}`}>
            <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
              <span className="inline-flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    m.kind === "filled" ? "travel-accent-fill" : "bg-muted-foreground/40",
                  )}
                />
                {t(`day_lens_food_slot_${m.slot}`)}
              </span>
              {m.kind === "filled" && m.time && (
                <span className="text-muted-foreground tabular-nums">{m.time}</span>
              )}
            </div>
            <div className="mt-1.5">
              {m.kind === "filled" ? (
                <FilledMealCard meal={m} currency={currency} />
              ) : (
                <EmptyMealButton meal={m} onSuggest={() => onSuggest(m.slot)} />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilledMealCard({ meal, currency }: { meal: FilledMeal; currency: string }) {
  const { t } = useTranslation("travel");

  const tagClass: Record<FilledMeal["status"], string> = {
    "no-res": "bg-muted text-muted-foreground",
    "kim-suggested": "travel-accent travel-accent-bg travel-accent-border ring-1 ring-inset",
    draft: "bg-[rgb(216_138_106_/_0.12)] text-[rgb(var(--rust))] ring-1 ring-inset ring-[rgb(216_138_106_/_0.32)]",
    included: "bg-emerald-500/10 text-emerald-500 ring-1 ring-inset ring-emerald-500/30",
  };

  return (
    <div className="rounded-md border border-border bg-background px-3.5 py-3">
      <div className="text-[14px] leading-tight font-medium">{meal.name}</div>
      {meal.cuisine && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
          {meal.cuisine}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
        <span className="text-muted-foreground truncate">{meal.area ?? ""}</span>
        <span className="tabular-nums">
          {meal.costAmount != null
            ? formatMoney(meal.costAmount, meal.costCurrency || currency)
            : t("day_lens_food_tag_included")}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "inline-flex rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide",
            tagClass[meal.status],
          )}
        >
          {t(`day_lens_food_tag_${meal.status}`)}
        </span>
      </div>
      {meal.note && (
        <div className="mt-2 text-[11px] text-muted-foreground">{meal.note}</div>
      )}
    </div>
  );
}

function EmptyMealButton({
  meal,
  onSuggest,
}: {
  meal: EmptyMeal;
  onSuggest: () => void;
}) {
  const { t } = useTranslation("travel");
  return (
    <button
      type="button"
      onClick={onSuggest}
      className="group flex w-full items-center justify-between gap-2 rounded-md border border-dashed border-border bg-transparent px-3 py-2.5 text-left transition-colors hover:bg-[var(--sand-bg)] hover:travel-accent-border"
    >
      <span className="truncate text-[12px] text-muted-foreground">
        {meal.area
          ? t("day_lens_food_empty_area", { area: meal.area })
          : t("day_lens_food_empty")}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase tracking-wide travel-accent">
        <Sparkles size={11} /> {t("day_lens_food_suggest")}
      </span>
    </button>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildFoodDays({
  trip,
  nights,
  destinationByDay,
  activities,
  reservations,
}: {
  trip: Trip;
  nights: number;
  destinationByDay: (Destination | null)[];
  activities: Activity[];
  reservations: Reservation[];
}): FoodDay[] {
  if (!trip.startDate || nights < 0) return [];
  const start = new Date(trip.startDate + "T00:00:00");

  const food: Array<{
    iso: string;
    slot: MealSlot;
    meal: FilledMeal;
    sortAt: number;
  }> = [];

  for (const a of activities) {
    if (!isFoodActivity(a) || !a.startAt) continue;
    const iso = a.startAt.slice(0, 10);
    const slot = slotForIso(a.startAt);
    food.push({
      iso,
      slot,
      sortAt: Date.parse(a.startAt) || 0,
      meal: {
        kind: "filled",
        id: a.id,
        slot,
        time: formatTime(a.startAt),
        name: a.title,
        cuisine: a.category && a.category !== "food" ? a.category : null,
        area: a.address || null,
        costAmount: a.costAmount,
        costCurrency: a.costCurrency || trip.budgetCurrency,
        status: "kim-suggested",
        note: a.notes || null,
      },
    });
  }

  for (const r of reservations) {
    if (r.kind !== "restaurant" || !r.startAt) continue;
    const iso = r.startAt.slice(0, 10);
    const slot = slotForIso(r.startAt);
    food.push({
      iso,
      slot,
      sortAt: Date.parse(r.startAt) || 0,
      meal: {
        kind: "filled",
        id: r.id,
        slot,
        time: formatTime(r.startAt),
        name: r.title,
        cuisine: readPayloadString(r, "cuisine"),
        area: r.destPlace || readPayloadString(r, "area"),
        costAmount: r.costAmount,
        costCurrency: r.costCurrency || trip.budgetCurrency,
        status:
          r.status === "booked"
            ? "no-res"
            : r.status === "planned"
              ? "draft"
              : "no-res",
        note: readPayloadString(r, "note"),
      },
    });
  }

  const days: FoodDay[] = [];
  for (let i = 0; i <= nights; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const iso = d.toISOString().slice(0, 10);
    const dest = destinationByDay[i] ?? null;

    const onDay = food.filter((f) => f.iso === iso).sort((a, b) => a.sortAt - b.sortAt);
    const bySlot: Partial<Record<MealSlot, FilledMeal>> = {};
    for (const item of onDay) {
      if (!bySlot[item.slot]) bySlot[item.slot] = item.meal;
    }

    const meals: Meal[] = SLOT_ORDER.map((slot) => {
      const filled = bySlot[slot];
      if (filled) return filled;
      return {
        kind: "empty",
        slot,
        area: dest?.region || dest?.name || null,
      };
    });

    days.push({
      index: i + 1,
      date: d,
      destination: dest,
      meals,
    });
  }

  return days;
}

function isFoodActivity(a: Activity): boolean {
  if (!a.category) return false;
  return a.category === "food" || a.category === "dining";
}

function slotForIso(iso: string): MealSlot {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "lunch";
  const h = d.getHours();
  if (h < 11) return "breakfast";
  if (h < 16) return "lunch";
  return "dinner";
}

function formatTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

function readPayloadString(r: Reservation, key: string): string | null {
  const v = r.payload?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}
