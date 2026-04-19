"use client";

import { useTranslation } from "react-i18next";
import {
  Activity,
  Calendar,
  Check,
  ChevronDown,
  Dumbbell,
  Repeat,
  Utensils,
  X,
  type LucideIcon,
} from "lucide-react";
import { useKim } from "../kim-provider";
import type { SelectableKind } from "../types";
import { EventSmartCard } from "./event";
import { ExerciseSmartCard } from "./exercise";
import { MealItemSmartCard } from "./meal-item";
import { MealPlanSmartCard } from "./meal-plan";
import { MetricSmartCard } from "./metric";
import { RoutineSmartCard } from "./routine";
import { SessionSmartCard } from "./session";
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
  session: Dumbbell,
  routine: Repeat,
};

/** i18n key for the pretty-print kind label (see kim.json: `kind_*`). */
const KIND_I18N_KEY: Partial<Record<SelectableKind, string>> = {
  "meal-item": "kind_meal_item",
  "meal-plan": "kind_meal_plan",
  exercise: "kind_exercise",
  event: "kind_event",
  task: "kind_task",
  metric: "kind_metric",
  session: "kind_session",
  routine: "kind_routine",
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
 *
 * When `selection.length > 1` a `+N` badge renders on both the collapsed bar
 * and the top-right of the expanded module so the user knows supporting
 * context exists. Primary × remove is also exposed so the slot is a
 * fully-controllable primary-context UI. (QBL-114)
 */
export function SmartUiSlot() {
  const { selection, smartUiCollapsed, expandSmartUi, removeSelection } = useKim();
  const { t } = useTranslation("kim");
  const primary = selection[0];
  if (!primary) return null;

  let card: React.ReactNode = null;
  switch (primary.kind) {
    case "meal-item":
      card = <MealItemSmartCard item={primary} />;
      break;
    case "meal-plan":
      card = <MealPlanSmartCard item={primary} />;
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
    case "session":
      card = <SessionSmartCard item={primary} />;
      break;
    case "routine":
      card = <RoutineSmartCard item={primary} />;
      break;
    default:
      card = null;
  }

  if (!card) return null;

  const supportingCount = Math.max(0, selection.length - 1);
  const hasSupporting = supportingCount > 0;

  if (smartUiCollapsed) {
    const Icon = KIND_ICON[primary.kind];
    const kindKey = KIND_I18N_KEY[primary.kind];
    const kindLabel = kindKey ? t(kindKey) : primary.kind;
    return (
      <div className="px-5 pb-3 pt-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={expandSmartUi}
            aria-label={t("smart_ui_expand")}
            title={t("smart_ui_expand")}
            className="group flex h-9 flex-1 items-center gap-2.5 rounded-md border border-border bg-card px-2.5 text-left transition-colors hover:bg-muted"
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
            {hasSupporting && (
              <span
                className="shrink-0 rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground"
                aria-label={`+${supportingCount} supporting`}
                title={`+${supportingCount} supporting`}
              >
                +{supportingCount}
              </span>
            )}
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform group-hover:rotate-180"
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={() => removeSelection(primary.kind, primary.id)}
            aria-label="Remove primary context"
            title="Remove primary context"
            className="shrink-0 flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-5 pb-3 pt-1">
      <div className="relative">
        {card}
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5">
          {hasSupporting && (
            <span
              className="pointer-events-auto rounded-full border border-border bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground"
              aria-label={`+${supportingCount} supporting`}
              title={`+${supportingCount} supporting`}
            >
              +{supportingCount}
            </span>
          )}
          <button
            type="button"
            onClick={() => removeSelection(primary.kind, primary.id)}
            aria-label="Remove primary context"
            title="Remove primary context"
            className="pointer-events-auto flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3 w-3" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
