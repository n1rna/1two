"use client";

import { Activity, Apple, BookOpen, Flame, Gauge, Target, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartDivider } from "./smart-divider";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { ChipToggle } from "./chip-toggle";
import { useSmartActions } from "./actions";

/**
 * Narrow shape read from a `HealthProfile` snapshot — only the diet-facing
 * fields. The Health page attaches the profile with a diet-only snapshot
 * (see QBL-117), but we also tolerate richer snapshots so the card degrades
 * gracefully.
 */
interface DietProfileSnapshot {
  dietType?: string;
  dietGoal?: string;
  dietaryRestrictions?: string[];
  targetCalories?: number | null;
  proteinG?: number | null;
  carbsG?: number | null;
  fatG?: number | null;
  goalWeightKg?: number | null;
  weightKg?: number | null;
  activityLevel?: string;
}

/** Dietary chip restrictions we expose as toggles. */
const CHIP_KEYS = ["vegetarian", "vegan", "gluten-free", "dairy-free"] as const;
type ChipKey = (typeof CHIP_KEYS)[number];

export function DietProfileSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const d = (item.snapshot ?? {}) as DietProfileSnapshot;

  const kicker = d.dietType ? d.dietType.toUpperCase() : undefined;
  const subParts: string[] = [];
  if (d.dietGoal) subParts.push(d.dietGoal);
  if (d.targetCalories != null) subParts.push(`${d.targetCalories} kcal`);
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  const macroMeta =
    d.proteinG != null || d.carbsG != null || d.fatG != null ? (
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {[
          d.proteinG != null ? `P ${Math.round(d.proteinG)}` : null,
          d.carbsG != null ? `C ${Math.round(d.carbsG)}` : null,
          d.fatG != null ? `F ${Math.round(d.fatG)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      </span>
    ) : null;

  const restrictions = new Set(d.dietaryRestrictions ?? []);
  const chipOn = (key: ChipKey) => restrictions.has(key);

  const flipRestriction = (key: ChipKey) => {
    const next = !chipOn(key);
    smartAgent({
      actionKey: "diet_profile.restrictions",
      label: `${t("diet_profile.restrictions")} · ${key}${next ? " on" : " off"}`,
      item,
      systemContext: next
        ? `Add "${key}" to my dietary restrictions.`
        : `Remove "${key}" from my dietary restrictions.`,
    });
  };

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Apple className="h-3 w-3" />}
          kicker={kicker}
          title={item.label}
          sub={sub}
          meta={macroMeta}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<Utensils className="h-3.5 w-3.5" />}
            label={t("diet_profile.change_diet_type")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.change_diet_type",
                label: t("diet_profile.change_diet_type"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Gauge className="h-3.5 w-3.5" />}
            label={t("diet_profile.update_macros")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.update_macros",
                label: t("diet_profile.update_macros"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Flame className="h-3.5 w-3.5" />}
            label={t("diet_profile.set_calories")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.set_calories",
                label: t("diet_profile.set_calories"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Target className="h-3.5 w-3.5" />}
            label={t("diet_profile.set_goal_weight")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.set_goal_weight",
                label: t("diet_profile.set_goal_weight"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Activity className="h-3.5 w-3.5" />}
            label={t("diet_profile.activity_level")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.activity_level",
                label: t("diet_profile.activity_level"),
                item,
              })
            }
          />
          <QaBtn
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label={t("diet_profile.explain")}
            onClick={() =>
              smartAgent({
                actionKey: "diet_profile.explain",
                label: t("diet_profile.explain"),
                item,
              })
            }
          />
        </QaGrid>

        <SmartDivider />

        <div className="flex flex-wrap gap-1.5">
          {CHIP_KEYS.map((k) => (
            <ChipToggle
              key={k}
              label={k}
              on={chipOn(k)}
              onChange={() => flipRestriction(k)}
            />
          ))}
        </div>
      </SmartBody>
    </SmartCard>
  );
}
