"use client";

import { useTranslation } from "react-i18next";
import {
  Activity,
  Apple,
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
import { CtxChip } from "../ctx-chip";
import type { SelectableKind } from "../types";
import { DietProfileSmartCard } from "./diet-profile";
import { EventSmartCard } from "./event";
import { ExerciseSmartCard } from "./exercise";
import { GymProfileSmartCard } from "./gym-profile";
import { MealItemSmartCard } from "./meal-item";
import { MealPlanSmartCard } from "./meal-plan";
import { MetricSmartCard } from "./metric";
import { RoutineSmartCard } from "./routine";
import { SessionSmartCard } from "./session";
import { TaskSmartCard } from "./task";

const KIND_ICON: Partial<Record<SelectableKind, LucideIcon>> = {
  "meal-item": Utensils,
  "meal-plan": Utensils,
  exercise: Dumbbell,
  event: Calendar,
  task: Check,
  metric: Activity,
  session: Dumbbell,
  routine: Repeat,
  "diet-profile": Apple,
  "gym-profile": Dumbbell,
};

const KIND_I18N_KEY: Partial<Record<SelectableKind, string>> = {
  "meal-item": "kind_meal_item",
  "meal-plan": "kind_meal_plan",
  exercise: "kind_exercise",
  event: "kind_event",
  task: "kind_task",
  metric: "kind_metric",
  session: "kind_session",
  routine: "kind_routine",
  "diet-profile": "kind_diet_profile",
  "gym-profile": "kind_gym_profile",
};

export function SmartUiSlot() {
  const {
    selection,
    primaryKey,
    smartUiCollapsed,
    expandSmartUi,
    removeSelection,
    promoteSelection,
  } = useKim();
  const { t } = useTranslation("kim");

  if (selection.length === 0) return null;

  const primary =
    (primaryKey &&
      selection.find(
        (s) => s.kind === primaryKey.kind && s.id === primaryKey.id,
      )) ||
    selection[0];

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
    case "diet-profile":
      card = <DietProfileSmartCard item={primary} />;
      break;
    case "gym-profile":
      card = <GymProfileSmartCard item={primary} />;
      break;
    default:
      card = null;
  }

  if (!card) return null;

  // Stack shows EVERY attached item in insertion order. Primary is
  // highlighted so users know which one the card above represents.
  const stack =
    selection.length > 0 ? (
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="kim-mono text-[9.5px] uppercase tracking-[0.18em] mr-0.5 shrink-0"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          {t("drawer_context_label")}
        </span>
        {selection.map((s) => {
          const isPrimary = s.kind === primary.kind && s.id === primary.id;
          return (
            <CtxChip
              key={`${s.kind}-${s.id}`}
              selection={s}
              highlight={isPrimary}
              onRemove={() => removeSelection(s.kind, s.id)}
              onClick={
                isPrimary ? undefined : () => promoteSelection(s.kind, s.id)
              }
            />
          );
        })}
      </div>
    ) : null;

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
        {stack}
      </div>
    );
  }

  return (
    <div className="px-5 pb-3 pt-1">
      <div className="relative">
        {card}
        <div className="pointer-events-none absolute right-3 top-3 flex items-center gap-1.5">
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
      {stack}
    </div>
  );
}
