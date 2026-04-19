"use client";

import { useKim } from "../kim-provider";
import { EventSmartCard } from "./event";
import { ExerciseSmartCard } from "./exercise";
import { MealSmartCard } from "./meal";
import { MetricSmartCard } from "./metric";
import { TaskSmartCard } from "./task";

/**
 * Renders the smart-UI card matching the first (primary) selection. Mounted
 * above the composer inside the kim drawer. Returns null when the selection
 * is empty or its kind has no registered module yet.
 *
 * Render flow:
 *   selection[0].kind === "meal-item" | "meal-plan" → <MealSmartCard />
 *   selection[0].kind === "exercise"                → <ExerciseSmartCard />
 *   (future) event / task / metric                  → their respective cards
 */
export function SmartUiSlot() {
  const { selection } = useKim();
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

  return (
    <div className="px-5 pb-3 pt-1">
      {card}
    </div>
  );
}
