"use client";

import { useMemo, useState } from "react";
import {
  BookOpen,
  Dumbbell,
  Hash,
  Layers,
  PlayCircle,
  Shuffle,
  SkipForward,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { Stepper } from "./stepper";
import { useSmartActions } from "./actions";

interface ExerciseSnapshot {
  id?: string;
  sessionId?: string;
  exerciseName?: string;
  sets?: number;
  reps?: string | number;
  weight?: string;
  restSeconds?: number;
  notes?: string;
  supersetGroup?: string | null;
  /** Optional muscle group — populated when snapshot comes from session. */
  muscleGroup?: string;
  equipment?: string;
}

async function putExerciseField(
  sessionId: string,
  exerciseId: string,
  body: Record<string, unknown>,
): Promise<void> {
  const res = await fetch(
    `/api/proxy/health/sessions/${encodeURIComponent(
      sessionId,
    )}/exercises/${encodeURIComponent(exerciseId)}`,
    {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) throw new Error(`Update failed (${res.status})`);
}

function parseReps(raw: ExerciseSnapshot["reps"]): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 10;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export function ExerciseSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent, smartQuick } = useSmartActions();
  const ex = (item.snapshot ?? {}) as ExerciseSnapshot;

  const canMutate = !!(ex.sessionId && ex.id);
  const [repsOpen, setRepsOpen] = useState(false);
  const [setsOpen, setSetsOpen] = useState(false);
  const [reps, setReps] = useState(() => parseReps(ex.reps));
  const [sets, setSets] = useState(ex.sets ?? 3);

  const sub = useMemo(() => {
    const parts = [ex.muscleGroup, ex.equipment].filter(Boolean) as string[];
    return parts.length > 0 ? parts.join(" · ") : undefined;
  }, [ex.muscleGroup, ex.equipment]);

  const meta =
    ex.sets != null || ex.reps != null ? (
      <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
        {ex.sets ?? "?"}×{ex.reps ?? "?"}
      </span>
    ) : null;

  const name = ex.exerciseName ?? item.label;
  const ytUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${name} exercise form`,
  )}`;

  const commitReps = () => {
    if (!canMutate) return;
    void smartQuick({
      label: `${t("exercise.change_reps")} → ${reps}`,
      item,
      successAck: t("ack.reps_updated"),
      errorAck: t("ack.failed"),
      apiCall: () =>
        putExerciseField(ex.sessionId!, ex.id!, { reps: String(reps) }),
    });
    setRepsOpen(false);
  };

  const commitSets = () => {
    if (!canMutate) return;
    void smartQuick({
      label: `${t("exercise.change_sets")} → ${sets}`,
      item,
      successAck: t("ack.sets_updated"),
      errorAck: t("ack.failed"),
      apiCall: () =>
        putExerciseField(ex.sessionId!, ex.id!, { sets }),
    });
    setSetsOpen(false);
  };

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Dumbbell className="h-3 w-3" />}
          kicker={ex.supersetGroup ? `GROUP ${ex.supersetGroup}` : undefined}
          title={name}
          sub={sub}
          meta={meta}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<Shuffle className="h-3.5 w-3.5" />}
            label={t("exercise.alternatives")}
            onClick={() =>
              smartAgent({
                actionKey: "exercise.alternatives",
                label: t("exercise.alternatives"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Hash className="h-3.5 w-3.5" />}
            label={t("exercise.change_reps")}
            onClick={() => setRepsOpen((v) => !v)}
            disabled={!canMutate}
          />
          <QaBtn
            icon={<Layers className="h-3.5 w-3.5" />}
            label={t("exercise.change_sets")}
            onClick={() => setSetsOpen((v) => !v)}
            disabled={!canMutate}
          />
          <QaBtn
            icon={<SkipForward className="h-3.5 w-3.5" />}
            label={t("exercise.mark_skipped")}
            variant="destructive"
            onClick={() =>
              // No skipped field on HealthSessionExercise — route through
              // the agent so it can note the skip in memory / history.
              smartAgent({
                actionKey: "exercise.mark_skipped",
                label: t("exercise.mark_skipped"),
                item,
              })
            }
          />
          <QaBtn
            icon={<PlayCircle className="h-3.5 w-3.5" />}
            label={t("common.video_demo")}
            onClick={() => window.open(ytUrl, "_blank", "noopener,noreferrer")}
          />
          <QaBtn
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label={t("exercise.explain")}
            onClick={() =>
              smartAgent({
                actionKey: "exercise.explain",
                label: t("exercise.explain"),
                item,
              })
            }
          />
        </QaGrid>

        {repsOpen && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">reps</span>
            <Stepper
              value={reps}
              min={1}
              max={50}
              step={1}
              onChange={setReps}
              label="reps"
            />
            <button
              type="button"
              onClick={commitReps}
              className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded border border-border hover:bg-muted"
            >
              {t("common.commit")}
            </button>
          </div>
        )}

        {setsOpen && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">sets</span>
            <Stepper
              value={sets}
              min={1}
              max={10}
              step={1}
              onChange={setSets}
              label="sets"
            />
            <button
              type="button"
              onClick={commitSets}
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
