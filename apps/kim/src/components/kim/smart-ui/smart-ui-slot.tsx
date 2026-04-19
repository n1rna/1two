"use client";

import { useTranslation } from "react-i18next";
import {
  Activity,
  Calendar,
  Check,
  ChevronDown,
  Dumbbell,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import { useKim } from "../kim-provider";
import type { SelectableKind } from "../types";
import { EventSmartCard } from "./event";
import { ExerciseSmartCard } from "./exercise";
import { MealSmartCard } from "./meal";
import { MetricSmartCard } from "./metric";
import { TaskSmartCard } from "./task";

/**
 * Lucide icon per selection kind. Mirrors the icons each module uses in its
 * SmartHead, so the collapsed bar and the expanded card feel visually
 * consistent. Kinds without a registered module render null further down.
 */
const KIND_ICON: Partial<Record<SelectableKind, LucideIcon>> = {
  "meal-item": Utensils,
  "meal-plan": Utensils,
  exercise: Dumbbell,
  event: Calendar,
  task: Check,
  metric: Activity,
};

/** i18n key for the pretty-print kind label (see kim.json: `kind_*`). */
const KIND_I18N_KEY: Partial<Record<SelectableKind, string>> = {
  "meal-item": "kind_meal",
  "meal-plan": "kind_meal",
  exercise: "kind_exercise",
  event: "kind_event",
  task: "kind_task",
  metric: "kind_metric",
};

/**
 * Renders the smart-UI card matching the first (primary) selection. Mounted
 * above the composer inside the kim drawer. Returns null when the selection
 * is empty or its kind has no registered module yet.
 *
 * Render flow:
 *   selection[0].kind === "meal-item" | "meal-plan" → <MealSmartCard />
 *   selection[0].kind === "exercise"                → <ExerciseSmartCard />
 *   (future) event / task / metric                  → their respective cards
 *
 * When `smartUiCollapsed` is true the module collapses to a one-row bar that
 * the user can click to re-expand. (QBL-113)
 */
export function SmartUiSlot() {
  const { selection, smartUiCollapsed, expandSmartUi } = useKim();
  const { t } = useTranslation("kim");
  const primary = selection[0];
  if (!primary) return null;

  let card: React.ReactNode = null;
  switch (primary.kind) {
    case "meal-item":
    case "meal-plan":
      card = <MealSmartCard item={primary} />;
      break;
    case "exercise":
      card = <ExerciseSmartCard item={primary} />;
      break;
    case "event":
      card = <EventSmartCard item={primary} />;
      break;
    case "task":
      card = <TaskSmartCard item={primary} />;
      break;
    case "metric":
      card = <MetricSmartCard item={primary} />;
      break;
    default:
      card = null;
  }

  if (!card) return null;

  if (smartUiCollapsed) {
    const Icon = KIND_ICON[primary.kind];
    const kindKey = KIND_I18N_KEY[primary.kind];
    const kindLabel = kindKey ? t(kindKey) : primary.kind;
    return (
      <div className="px-5 pb-3 pt-1">
        <button
          type="button"
          onClick={expandSmartUi}
          aria-label={t("smart_ui_expand")}
          title={t("smart_ui_expand")}
          className="group flex h-9 w-full items-center gap-2.5 rounded-md border border-border bg-card px-2.5 text-left transition-colors hover:bg-muted"
        >
          <span
            className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] bg-accent/30 text-accent-foreground"
            aria-hidden
          >
            {Icon ? <Icon className="h-3 w-3" /> : null}
          </span>
          <span className="flex-1 truncate font-mono text-[11px] text-muted-foreground">
            <span className="uppercase tracking-[0.14em]">{kindLabel}</span>
            <span className="mx-1.5 text-muted-foreground/60">·</span>
            <span className="text-foreground">{primary.label}</span>
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:rotate-180"
            aria-hidden
          />
        </button>
      </div>
    );
  }

  return <div className="px-5 pb-3 pt-1">{card}</div>;
}
