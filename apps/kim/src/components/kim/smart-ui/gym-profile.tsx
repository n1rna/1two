"use client";

import { BookOpen, CalendarDays, Clock, Dumbbell, Target, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { useSmartActions } from "./actions";

/**
 * Narrow shape read from a `HealthProfile` snapshot — only the gym-facing
 * fields. The Health page attaches the profile with a gym-only snapshot
 * (see QBL-117). Degrades gracefully when fields are missing.
 */
interface GymProfileSnapshot {
  fitnessLevel?: string;
  fitnessGoal?: string;
  daysPerWeek?: number;
  preferredDurationMin?: number;
  availableEquipment?: string[];
  physicalLimitations?: string[];
  workoutLikes?: string[];
  workoutDislikes?: string[];
}

export function GymProfileSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const g = (item.snapshot ?? {}) as GymProfileSnapshot;

  const kicker = g.fitnessLevel ? g.fitnessLevel.toUpperCase() : undefined;
  const subParts: string[] = [];
  if (g.fitnessGoal) subParts.push(g.fitnessGoal);
  if (typeof g.daysPerWeek === "number" && g.daysPerWeek > 0) {
    subParts.push(`${g.daysPerWeek}× / week`);
  }
  if (typeof g.preferredDurationMin === "number" && g.preferredDurationMin > 0) {
    subParts.push(`${g.preferredDurationMin} min`);
  }
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  const equipmentMeta =
    (g.availableEquipment?.length ?? 0) > 0 ? (
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {g.availableEquipment!.length} kit
      </span>
    ) : null;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Dumbbell className="h-3 w-3" />}
          kicker={kicker}
          title={item.label}
          sub={sub}
          meta={equipmentMeta}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<Target className="h-3.5 w-3.5" />}
            label={t("gym_profile.change_goal")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.change_goal",
                label: t("gym_profile.change_goal"),
                item,
              })
            }
          />
          <QaBtn
            icon={<CalendarDays className="h-3.5 w-3.5" />}
            label={t("gym_profile.set_days")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.set_days",
                label: t("gym_profile.set_days"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Clock className="h-3.5 w-3.5" />}
            label={t("gym_profile.set_duration")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.set_duration",
                label: t("gym_profile.set_duration"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Wrench className="h-3.5 w-3.5" />}
            label={t("gym_profile.equipment")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.equipment",
                label: t("gym_profile.equipment"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Dumbbell className="h-3.5 w-3.5" />}
            label={t("gym_profile.preferences")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.preferences",
                label: t("gym_profile.preferences"),
                item,
              })
            }
          />
          <QaBtn
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label={t("gym_profile.explain")}
            onClick={() =>
              smartAgent({
                actionKey: "gym_profile.explain",
                label: t("gym_profile.explain"),
                item,
              })
            }
          />
        </QaGrid>
      </SmartBody>
    </SmartCard>
  );
}
