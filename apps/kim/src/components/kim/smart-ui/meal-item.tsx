"use client";

import { useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Check,
  ChefHat,
  Info,
  Scale,
  Utensils,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartDivider } from "./smart-divider";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { Stepper } from "./stepper";
import { ChipToggle } from "./chip-toggle";
import { useSmartActions } from "./actions";

/**
 * Narrow meal shape derived from `MealItem` — only the fields this card
 * reads. We avoid a hard dependency on the full MealItem type so the
 * module works against whatever `AskKimButton` attached (which may be
 * a partial snapshot for older items).
 */
interface MealItemSnapshot {
  name?: string;
  meal_type?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  tags?: string[];
}

export function MealItemSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent, smartQuick } = useSmartActions();
  const meal = (item.snapshot ?? {}) as MealItemSnapshot;

  const [scaleOpen, setScaleOpen] = useState(false);
  const [portions, setPortions] = useState(1);
  const [toggles, setToggles] = useState({
    highProtein: (meal.tags ?? []).includes("high-protein"),
    quick: (meal.tags ?? []).includes("quick") || (meal.tags ?? []).includes("quick-prep"),
    vegetarian: (meal.tags ?? []).includes("vegetarian"),
  });

  const kicker = useMemo(
    () => (meal.meal_type ? meal.meal_type.toUpperCase() : undefined),
    [meal.meal_type],
  );
  const macroSub = [
    meal.protein_g != null ? `P ${Math.round(meal.protein_g)}g` : null,
    meal.carbs_g != null ? `C ${Math.round(meal.carbs_g)}g` : null,
    meal.fat_g != null ? `F ${Math.round(meal.fat_g)}g` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const fireSwap = (extra?: string) =>
    smartAgent({
      actionKey: "meal_item.swap",
      label: t("meal_item.swap"),
      item,
      systemContext: extra,
    });

  const flipToggle = (key: keyof typeof toggles) => {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    const active = [
      next.highProtein ? "high-protein" : null,
      next.quick ? "quick" : null,
      next.vegetarian ? "vegetarian" : null,
    ].filter(Boolean);
    fireSwap(
      active.length > 0
        ? `Preferences: ${active.join(", ")}`
        : "No extra preferences",
    );
  };

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Utensils className="h-3 w-3" />}
          kicker={kicker}
          title={meal.name ?? item.label}
          sub={macroSub || undefined}
          meta={
            meal.calories != null ? (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {Math.round(meal.calories)} kcal
              </span>
            ) : null
          }
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<ArrowLeftRight className="h-3.5 w-3.5" />}
            label={t("meal_item.swap")}
            onClick={() => fireSwap()}
          />
          <QaBtn
            icon={<Scale className="h-3.5 w-3.5" />}
            label={t("meal_item.scale_portion")}
            onClick={() => setScaleOpen((v) => !v)}
          />
          <QaBtn
            icon={<ChefHat className="h-3.5 w-3.5" />}
            label={t("meal_item.pantry_subs")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_item.pantry_subs",
                label: t("meal_item.pantry_subs"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Check className="h-3.5 w-3.5" />}
            label={t("meal_item.mark_eaten")}
            onClick={() =>
              // No "eaten" field on MealItem today — still fires smartQuick
              // with a no-op so the silent "Done." marker is consistent with
              // other quick actions. Replace with a real endpoint once meal
              // items support an `eaten` flag.
              void smartQuick({
                label: t("meal_item.mark_eaten"),
                item,
                successAck: t("ack.marked_eaten"),
                errorAck: t("ack.failed"),
                apiCall: async () => {
                  return;
                },
              })
            }
          />
          <QaBtn
            icon={<Info className="h-3.5 w-3.5" />}
            label={t("meal_item.details")}
            onClick={() =>
              smartAgent({
                actionKey: "meal_item.details",
                label: t("meal_item.details"),
                item,
              })
            }
          />
        </QaGrid>

        {scaleOpen && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">×</span>
            <Stepper
              value={portions}
              min={0.5}
              max={3}
              step={0.25}
              onChange={setPortions}
              label="portions"
            />
            <button
              type="button"
              onClick={() => {
                smartAgent({
                  actionKey: "meal_item.scale_portion",
                  label: `${t("meal_item.scale_portion")} × ${portions}`,
                  item,
                  systemContext: `Scale this meal to ${portions}× portions.`,
                });
                setScaleOpen(false);
              }}
              className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded border border-border hover:bg-muted"
            >
              {t("common.commit")}
            </button>
          </div>
        )}

        <SmartDivider />

        <div className="flex flex-wrap gap-1.5">
          <ChipToggle
            label="high-protein"
            on={toggles.highProtein}
            onChange={() => flipToggle("highProtein")}
          />
          <ChipToggle
            label="quick"
            on={toggles.quick}
            onChange={() => flipToggle("quick")}
          />
          <ChipToggle
            label="vegetarian"
            on={toggles.vegetarian}
            onChange={() => flipToggle("vegetarian")}
          />
        </div>
      </SmartBody>
    </SmartCard>
  );
}
