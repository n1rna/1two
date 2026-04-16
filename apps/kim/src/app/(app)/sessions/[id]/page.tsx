"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Trash2, Plus, Clock, Dumbbell, Activity } from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ActiveToggle } from "@/components/active-toggle";
import { PublishControl } from "@/components/marketplace/PublishControl";
import { Selectable, useKimAutoContext } from "@/components/kim";
import {
  getHealthSession,
  deleteHealthSession,
  addHealthSessionExercise,
  deleteHealthSessionExercise,
  updateHealthSession,
  type HealthSession,
  type HealthSessionExercise,
} from "@/lib/health";
import { routes } from "@/lib/routes";

const DIFFICULTY_META: Record<string, { label: string; dots: number }> = {
  beginner:     { label: "Beginner",     dots: 1 },
  intermediate: { label: "Intermediate", dots: 2 },
  advanced:     { label: "Advanced",     dots: 3 },
  elite:        { label: "Elite",        dots: 4 },
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<HealthSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setSession(await getHealthSession(id));
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [id]);

  useKimAutoContext(
    session
      ? {
          kind: "session",
          id: session.id,
          label: session.title,
          snapshot: {
            title: session.title,
            active: session.active,
            difficulty: session.difficultyLevel,
            duration: session.estimatedDuration,
            muscleGroups: session.targetMuscleGroups,
            description: session.description,
            exercises: session.exercises ?? [],
          },
        }
      : null,
  );

  async function addExercise() {
    if (!session || !newName.trim()) return;
    const ex = await addHealthSessionExercise(session.id, {
      exerciseName: newName,
      sets: 3,
      reps: "10",
      weight: "",
      restSeconds: 60,
      notes: "",
      sortOrder: (session.exercises?.length ?? 0) + 1,
    });
    setSession({ ...session, exercises: [...(session.exercises ?? []), ex] });
    setNewName("");
  }

  async function removeExercise(exId: string) {
    if (!session) return;
    await deleteHealthSessionExercise(session.id, exId);
    setSession({
      ...session,
      exercises: session.exercises?.filter((e) => e.id !== exId),
    });
  }

  async function toggleActive(next: boolean) {
    if (!session) return;
    const updated = await updateHealthSession(session.id, { active: next });
    setSession(updated);
  }
  async function remove() {
    if (!session) return;
    if (!confirm("Delete this session?")) return;
    await deleteHealthSession(session.id);
    router.push(routes.sessions);
  }

  const stats = useMemo(() => computeStats(session?.exercises ?? []), [session?.exercises]);

  if (err) {
    return (
      <PageShell title="Session" backHref={routes.sessions} backLabel="All gym sessions">
        <EmptyState title={err} />
      </PageShell>
    );
  }
  if (!session) {
    return (
      <PageShell title="Loading…" backHref={routes.sessions} backLabel="All gym sessions">
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </PageShell>
    );
  }

  const diffMeta = DIFFICULTY_META[session.difficultyLevel] ?? null;
  const supersetGroups = groupBySuperset(session.exercises ?? []);

  return (
    <PageShell
      title={session.title}
      subtitle={session.description || undefined}
      backHref={routes.sessions}
      backLabel="All gym sessions"
      actions={
        <>
          <div className="flex items-center gap-2 pr-1">
            <span className="text-xs text-muted-foreground">
              {session.active ? "Active" : "Inactive"}
            </span>
            <ActiveToggle
              active={session.active}
              onChange={toggleActive}
              stopPropagation={false}
              label={session.active ? "Disable session" : "Enable session"}
            />
          </div>
          <PublishControl
            kind="gym_session"
            sourceId={session.id}
            defaultTitle={session.title}
          />
          <Button variant="outline" size="sm" onClick={remove}>
            <Trash2 size={13} className="mr-1.5" /> Delete
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5 max-w-5xl">
        {/* Meta row: difficulty, muscle groups */}
        <div className="flex flex-wrap items-center gap-2">
          {diffMeta && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
              {diffMeta.label}
              <span className="flex gap-0.5">
                {Array.from({ length: 4 }).map((_, i) => (
                  <span
                    key={i}
                    className={`inline-block h-1 w-1 rounded-full ${
                      i < diffMeta.dots ? "bg-foreground" : "bg-border"
                    }`}
                  />
                ))}
              </span>
            </span>
          )}
          {session.targetMuscleGroups?.map((g) => (
            <span
              key={g}
              className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground capitalize"
            >
              {g}
            </span>
          ))}
        </div>

        {/* Stats card */}
        <Card>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatBlock
              icon={<Clock size={14} />}
              label="Duration"
              value={session.estimatedDuration ? `${session.estimatedDuration}` : "—"}
              suffix={session.estimatedDuration ? "min" : undefined}
            />
            <StatBlock
              icon={<Dumbbell size={14} />}
              label="Exercises"
              value={`${stats.exerciseCount}`}
            />
            <StatBlock
              icon={<Activity size={14} />}
              label="Total sets"
              value={`${stats.totalSets}`}
            />
            <StatBlock
              label="Est. reps"
              value={`${stats.totalReps}`}
            />
          </div>
        </Card>

        {/* Exercises */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Exercises</h2>
            <span className="text-xs text-muted-foreground">
              {stats.exerciseCount} {stats.exerciseCount === 1 ? "exercise" : "exercises"} · {stats.totalSets} sets
            </span>
          </div>

          {(!session.exercises || session.exercises.length === 0) && (
            <div className="py-16">
              <EmptyState
                title="No exercises yet"
                hint="Add one below or ask Kim to fill it in"
              />
            </div>
          )}

          {session.exercises && session.exercises.length > 0 && (
            <ol className="divide-y divide-border">
              {supersetGroups.map((group, groupIdx) => {
                if (group.type === "single") {
                  const ex = group.items[0];
                  return (
                    <ExerciseRow
                      key={ex.id}
                      ex={ex}
                      index={group.startIndex}
                      onRemove={() => removeExercise(ex.id)}
                    />
                  );
                }
                return (
                  <li key={`ss-${groupIdx}`} className="relative bg-muted/20">
                    <div className="px-5 pt-3 pb-1 text-xs font-medium text-muted-foreground">
                      Superset · {group.label}
                    </div>
                    <div className="divide-y divide-border">
                      {group.items.map((ex, j) => (
                        <ExerciseRow
                          key={ex.id}
                          ex={ex}
                          index={group.startIndex + j}
                          nested
                          onRemove={() => removeExercise(ex.id)}
                        />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="px-5 py-4 border-t border-border bg-muted/20">
            <div className="flex gap-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExercise()}
                placeholder="Add exercise…"
                className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
              />
              <Button size="sm" onClick={addExercise}>
                <Plus size={13} className="mr-1" /> Add
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Tip — open Kim (⌘K), select this session, and ask for a full program.
            </p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

function StatBlock({
  icon,
  label,
  value,
  suffix,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function ExerciseRow({
  ex,
  index,
  onRemove,
  nested = false,
}: {
  ex: HealthSessionExercise;
  index: number;
  onRemove: () => void;
  nested?: boolean;
}) {
  return (
    <li>
      <Selectable
        kind="exercise"
        id={ex.id}
        label={ex.exerciseName}
        snapshot={ex as unknown as Record<string, unknown>}
        className="block hover:bg-accent/40 data-[selected=true]:bg-accent"
      >
        <div
          className={`group flex items-start gap-4 ${
            nested ? "px-5 py-3" : "px-5 py-3.5"
          }`}
        >
          <div className="shrink-0 w-6 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">
            {index + 1}.
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug">{ex.exerciseName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums">
                <span className="font-medium text-foreground">{ex.sets}</span>
                {" × "}
                <span className="font-medium text-foreground">{ex.reps || "—"}</span>
                {" reps"}
              </span>
              {ex.weight && (
                <span className="tabular-nums">
                  <span className="font-medium text-foreground">{ex.weight}</span>
                </span>
              )}
              {ex.restSeconds ? (
                <span className="tabular-nums">{ex.restSeconds}s rest</span>
              ) : null}
            </div>
            {ex.notes && (
              <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{ex.notes}</div>
            )}
          </div>

          <button
            onClick={onRemove}
            aria-label="Remove exercise"
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </Selectable>
    </li>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SessionStats {
  exerciseCount: number;
  totalSets: number;
  totalReps: number;
}

function computeStats(exercises: HealthSessionExercise[]): SessionStats {
  let totalSets = 0;
  let totalReps = 0;
  for (const ex of exercises) {
    const sets = ex.sets || 0;
    totalSets += sets;
    const repsNum = parseInt(ex.reps, 10);
    if (!isNaN(repsNum)) totalReps += sets * repsNum;
  }
  return {
    exerciseCount: exercises.length,
    totalSets,
    totalReps,
  };
}

type SupersetGroup =
  | { type: "single"; items: [HealthSessionExercise]; startIndex: number }
  | { type: "superset"; label: string; items: HealthSessionExercise[]; startIndex: number };

function groupBySuperset(exercises: HealthSessionExercise[]): SupersetGroup[] {
  const groups: SupersetGroup[] = [];
  let i = 0;
  while (i < exercises.length) {
    const ex = exercises[i];
    const ss = ex.supersetGroup;
    if (!ss) {
      groups.push({ type: "single", items: [ex], startIndex: i });
      i += 1;
      continue;
    }
    const start = i;
    const items: HealthSessionExercise[] = [];
    while (i < exercises.length && exercises[i].supersetGroup === ss) {
      items.push(exercises[i]);
      i += 1;
    }
    groups.push({ type: "superset", label: ss, items, startIndex: start });
  }
  return groups;
}
