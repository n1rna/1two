"use client";

import {
  BookOpen,
  Dumbbell,
  Flame,
  Play,
  Plus,
  Shuffle,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { useSmartActions } from "./actions";

/**
 * Narrow shape read from a `HealthSession` snapshot. Matches both the list
 * row snapshot (title/active/difficulty/duration/muscleGroups/exerciseCount)
 * and the detail-page snapshot (title/description/exercises[]). We don't
 * mutate via smart-UI — all actions route through the agent.
 */
interface SessionSnapshot {
  title?: string;
  description?: string;
  active?: boolean;
  difficulty?: string;
  difficultyLevel?: string;
  duration?: number | null;
  estimatedDuration?: number | null;
  muscleGroups?: string[];
  targetMuscleGroups?: string[];
  exerciseCount?: number;
  exercises?: { id: string; exerciseName: string }[];
}

export function SessionSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const s = (item.snapshot ?? {}) as SessionSnapshot;

  const difficulty = s.difficulty ?? s.difficultyLevel;
  const duration = s.duration ?? s.estimatedDuration ?? undefined;
  const muscles = s.muscleGroups ?? s.targetMuscleGroups ?? [];
  const exCount = s.exerciseCount ?? s.exercises?.length;

  const kicker = difficulty ? difficulty.toUpperCase() : undefined;
  const subParts: string[] = [];
  if (typeof duration === "number" && duration > 0) subParts.push(`${duration} min`);
  if (typeof exCount === "number") {
    subParts.push(`${exCount} exercise${exCount === 1 ? "" : "s"}`);
  }
  if (muscles.length > 0) subParts.push(muscles.join(", "));
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Dumbbell className="h-3 w-3" />}
          kicker={kicker}
          title={s.title ?? item.label}
          sub={sub}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<Play className="h-3.5 w-3.5" />}
            label={t("session.start")}
            onClick={() =>
              smartAgent({
                actionKey: "session.start",
                label: t("session.start"),
                item,
              })
            }
          />
          <QaBtn
            icon={<SkipForward className="h-3.5 w-3.5" />}
            label={t("session.finish_early")}
            variant="destructive"
            onClick={() =>
              smartAgent({
                actionKey: "session.finish_early",
                label: t("session.finish_early"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Plus className="h-3.5 w-3.5" />}
            label={t("session.add_exercise")}
            onClick={() =>
              smartAgent({
                actionKey: "session.add_exercise",
                label: t("session.add_exercise"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Shuffle className="h-3.5 w-3.5" />}
            label={t("session.swap")}
            onClick={() =>
              smartAgent({
                actionKey: "session.swap",
                label: t("session.swap"),
                item,
              })
            }
          />
          <QaBtn
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label={t("session.explain_progression")}
            onClick={() =>
              smartAgent({
                actionKey: "session.explain_progression",
                label: t("session.explain_progression"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Flame className="h-3.5 w-3.5" />}
            label={t("session.warmup")}
            onClick={() =>
              smartAgent({
                actionKey: "session.warmup",
                label: t("session.warmup"),
                item,
              })
            }
          />
        </QaGrid>
      </SmartBody>
    </SmartCard>
  );
}
