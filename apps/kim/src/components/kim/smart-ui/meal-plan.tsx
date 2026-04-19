"use client";

import { useState } from "react";
import {
  Gauge,
  RefreshCw,
  Scale,
  ShoppingBasket,
  Shuffle,
  Utensils,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { Stepper } from "./stepper";
import { useSmartActions } from "./actions";

/**
 * Narrow shape read from a `HealthMealPlan` snapshot. Covers both the list
 * row snapshot (title / dietType / targetCalories / mealCount) and the
 * detail-page snapshot (meals[]). All actions route through the agent —
 * there's no whole-day mutating endpoint today.
 */
interface MealPlanSnapshot {
  title?: string;
  planType?: string;
  dietType?: string;
  targetCalories?: number | null;
  active?: boolean;
  mealCount?: number;
  meals?: unknown[];
}

export function MealPlanSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const p = (item.snapshot ?? {}) as MealPlanSnapshot;

  const [scaleOpen, setScaleOpen] = useState(false);
  const [scaleFactor, setScaleFactor] = useState(1);

  const mealCount = p.mealCount ?? p.meals?.length;
  const kicker = p.dietType ? p.dietType.toUpperCase() : p.planType?.toUpperCase();
  const subParts: string[] = [];
  if (typeof mealCount === "number") {
    subParts.push(`${mealCount} meal${mealCount === 1 ? "" : "s"}`);
  }
  if (p.planType && p.dietType) subParts.push(p.planType);
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Utensils className="h-3 w-3" />}
          kicker={kicker}
          title={p.title ?? item.label}
          sub={sub}
          meta={
            p.targetCalories != null ? (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {Math.round(p.targetCalories)} kcal
              </span>
            ) : null
          }
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            label={t("meal_plan.regenerate")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_plan.regenerate",
                label: t("meal_plan.regenerate"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Shuffle className="h-3.5 w-3.5" />}
            label={t("meal_plan.swap_cuisine")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_plan.swap_cuisine",
                label: t("meal_plan.swap_cuisine"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={t("meal_plan.change_macros")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_plan.change_macros",
                label: t("meal_plan.change_macros"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Scale className="h-3.5 w-3.5" />}
            label={t("meal_plan.scale_day")}
            onClick={() => setScaleOpen((v) => !v)}
          />
          <QaBtn
            icon={<ShoppingBasket className="h-3.5 w-3.5" />}
            label={t("meal_plan.grocery_list")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_plan.grocery_list",
                label: t("meal_plan.grocery_list"),
                item,
              })
            }
          />
        </QaGrid>

        {scaleOpen && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">×</span>
            <Stepper
              value={scaleFactor}
              min={0.5}
              max={2}
              step={0.1}
              onChange={setScaleFactor}
              label="day scale"
            />
            <button
              type="button"
              onClick={() => {
                smartAgent({
                  actionKey: "meal_plan.scale_day",
                  label: `${t("meal_plan.scale_day")} × ${scaleFactor.toFixed(
                    2,
                  )}`,
                  item,
                  systemContext: `Scale the whole day's calories and macros by ${scaleFactor.toFixed(
                    2,
                  )}×.`,
                });
                setScaleOpen(false);
              }}
              className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded border border-border hover:bg-muted"
            >
              {t("common.commit")}
            </button>
          </div>
        )}
      </SmartBody>
    </SmartCard>
  );
}
