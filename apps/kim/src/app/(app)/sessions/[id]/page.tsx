"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Trash2,
  Plus,
  Clock,
  Dumbbell,
  Activity,
  Edit2,
  Check,
  X,
  Power,
  Upload,
} from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import type { PageMenuAction } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { ActiveToggle } from "@/components/active-toggle";
import { PublishControl, type PublishControlHandle } from "@/components/marketplace/PublishControl";
import { Selectable, useKimAutoContext, AskKimButton } from "@/components/kim";
import {
  getHealthSession,
  deleteHealthSession,
  addHealthSessionExercise,
  deleteHealthSessionExercise,
  updateHealthSessionExercise,
  updateHealthSession,
  type HealthSession,
  type HealthSessionExercise,
} from "@/lib/health";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const DIFFICULTY_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
  { value: "elite", label: "Elite" },
];

const DIFFICULTY_META: Record<string, { label: string; dots: number }> = {
  beginner: { label: "Beginner", dots: 1 },
  intermediate: { label: "Intermediate", dots: 2 },
  advanced: { label: "Advanced", dots: 3 },
  elite: { label: "Elite", dots: 4 },
};

const COMMON_MUSCLE_GROUPS = [
  "chest", "back", "shoulders", "arms", "legs", "core", "glutes",
  "hamstrings", "quads", "calves", "biceps", "triceps", "traps",
];

const COMMON_EQUIPMENT = [
  "bodyweight", "dumbbells", "barbell", "cables", "machines",
  "kettlebell", "resistance bands", "pull-up bar", "bench",
  "smith machine", "EZ bar", "medicine ball",
];

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<HealthSession | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(false);

  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftDuration, setDraftDuration] = useState("");
  const [draftDifficulty, setDraftDifficulty] = useState("intermediate");
  const [draftMuscleGroups, setDraftMuscleGroups] = useState<string[]>([]);
  const [draftEquipment, setDraftEquipment] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const publishRef = useRef<PublishControlHandle>(null);

  const seedDraft = useCallback((s: HealthSession) => {
    setDraftTitle(s.title);
    setDraftDescription(s.description);
    setDraftDuration(s.estimatedDuration ? String(s.estimatedDuration) : "");
    setDraftDifficulty(s.difficultyLevel || "intermediate");
    setDraftMuscleGroups(s.targetMuscleGroups ?? []);
    setDraftEquipment(s.equipment ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const s = await getHealthSession(id);
        setSession(s);
        seedDraft(s);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
  }, [id, seedDraft]);

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
            equipment: session.equipment,
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

  async function saveExercise(exId: string, patch: Partial<HealthSessionExercise>) {
    if (!session) return;
    const updated = await updateHealthSessionExercise(session.id, exId, patch);
    setSession({
      ...session,
      exercises: session.exercises?.map((e) => (e.id === exId ? updated : e)),
    });
  }

  async function toggleActive(next: boolean) {
    if (!session) return;
    const updated = await updateHealthSession(session.id, { active: next });
    setSession(updated);
  }

  async function saveMetadata() {
    if (!session) return;
    setSaving(true);
    try {
      const updated = await updateHealthSession(session.id, {
        title: draftTitle.trim() || session.title,
        description: draftDescription,
        difficultyLevel: draftDifficulty,
        estimatedDuration: draftDuration ? Number(draftDuration) : null,
        targetMuscleGroups: draftMuscleGroups,
        equipment: draftEquipment,
      });
      setSession(updated);
      seedDraft(updated);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!session) return;
    if (!confirm("Delete this session?")) return;
    await deleteHealthSession(session.id);
    router.push(routes.sessions);
  }

  const stats = useMemo(
    () => computeStats(session?.exercises ?? []),
    [session?.exercises],
  );

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

  const sessionMenuActions: PageMenuAction[] = editing
    ? [
        { label: "Save", onClick: saveMetadata, icon: <Check size={14} /> },
        { label: "Cancel", onClick: () => { setEditing(false); seedDraft(session); }, icon: <X size={14} /> },
      ]
    : [
        {
          label: session.active ? "Deactivate" : "Activate",
          icon: <Power size={14} />,
          onClick: () => toggleActive(!session.active),
        },
        { label: "Edit", icon: <Edit2 size={14} />, onClick: () => setEditing(true) },
        { label: "Publish", icon: <Upload size={14} />, onClick: () => publishRef.current?.open(), separator: true },
        { label: "Delete", icon: <Trash2 size={14} />, onClick: remove, variant: "destructive" as const, separator: true },
      ];

  return (
    <PageShell
      title={editing ? draftTitle : session.title}
      subtitle={editing ? undefined : session.description || undefined}
      backHref={routes.sessions}
      backLabel="All gym sessions"
      menuActions={sessionMenuActions}
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
            />
          </div>
          {editing ? (
            <>
              <Button size="sm" onClick={saveMetadata} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setEditing(false); seedDraft(session); }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                <Edit2 className="h-3 w-3" /> Edit
              </Button>
              <PublishControl kind="gym_session" sourceId={session.id} defaultTitle={session.title} triggerRef={publishRef} />
              <Button variant="outline" size="sm" onClick={remove}>
                <Trash2 size={13} className="mr-1.5" /> Delete
              </Button>
            </>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5 max-w-5xl">
        {editing && (
          <Card>
            <div className="space-y-4">
              <Field label="Title">
                <input value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" />
              </Field>
              <Field label="Description">
                <textarea value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} rows={2} className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm resize-none" />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Duration (min)">
                  <input type="number" value={draftDuration} onChange={(e) => setDraftDuration(e.target.value)} placeholder="e.g. 60" className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" />
                </Field>
                <Field label="Difficulty">
                  <select value={draftDifficulty} onChange={(e) => setDraftDifficulty(e.target.value)} className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm">
                    {DIFFICULTY_OPTIONS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </Field>
              </div>
              <TagField label="Muscle groups" tags={draftMuscleGroups} onChange={setDraftMuscleGroups} suggestions={COMMON_MUSCLE_GROUPS} placeholder="Add muscle group…" />
              <TagField label="Equipment" tags={draftEquipment} onChange={setDraftEquipment} suggestions={COMMON_EQUIPMENT} placeholder="Add equipment…" />
            </div>
          </Card>
        )}

        {!editing && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {diffMeta && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground">
                  {diffMeta.label}
                  <span className="flex gap-0.5">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <span key={i} className={`inline-block h-1 w-1 rounded-full ${i < diffMeta.dots ? "bg-foreground" : "bg-border"}`} />
                    ))}
                  </span>
                </span>
              )}
              {session.targetMuscleGroups?.map((g) => (
                <span key={g} className="inline-flex items-center rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground capitalize">{g}</span>
              ))}
              {session.equipment?.map((e) => (
                <span key={e} className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-xs text-sky-700 dark:text-sky-400 capitalize">{e}</span>
              ))}
            </div>

            <Card>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatBlock icon={<Clock size={14} />} label="Duration" value={session.estimatedDuration ? `${session.estimatedDuration}` : "—"} suffix={session.estimatedDuration ? "min" : undefined} />
                <StatBlock icon={<Dumbbell size={14} />} label="Exercises" value={`${stats.exerciseCount}`} />
                <StatBlock icon={<Activity size={14} />} label="Total sets" value={`${stats.totalSets}`} />
                <StatBlock label="Est. reps" value={`${stats.totalReps}`} />
              </div>
            </Card>
          </>
        )}

        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold">Exercises</h2>
            <span className="text-xs text-muted-foreground">{stats.exerciseCount} {stats.exerciseCount === 1 ? "exercise" : "exercises"} · {stats.totalSets} sets</span>
          </div>

          {(!session.exercises || session.exercises.length === 0) && (
            <div className="py-16"><EmptyState title="No exercises yet" hint="Add one below or ask Kim to fill it in" /></div>
          )}

          {session.exercises && session.exercises.length > 0 && (
            <ol className="divide-y divide-border">
              {supersetGroups.map((group, groupIdx) => {
                if (group.type === "single") {
                  return <ExerciseRow key={group.items[0].id} ex={group.items[0]} index={group.startIndex} onRemove={() => removeExercise(group.items[0].id)} onSave={(patch) => saveExercise(group.items[0].id, patch)} />;
                }
                return (
                  <li key={`ss-${groupIdx}`} className="relative bg-muted/20">
                    <div className="px-5 pt-3 pb-1 text-xs font-medium text-muted-foreground">Superset · {group.label}</div>
                    <div className="divide-y divide-border">
                      {group.items.map((ex, j) => (
                        <ExerciseRow key={ex.id} ex={ex} index={group.startIndex + j} nested onRemove={() => removeExercise(ex.id)} onSave={(patch) => saveExercise(ex.id, patch)} />
                      ))}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          <div className="px-5 py-4 border-t border-border bg-muted/20">
            <div className="flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addExercise()} placeholder="Add exercise…" className="flex-1 bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10" />
              <Button size="sm" onClick={addExercise}><Plus size={13} className="mr-1" /> Add</Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Tip — open Kim (⌘K), select this session, and ask for a full program.</p>
          </div>
        </Card>
      </div>
    </PageShell>
  );
}

// ─── Small building blocks ─────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}

function TagField({ label, tags, onChange, suggestions, placeholder }: {
  label: string; tags: string[]; onChange: (next: string[]) => void; suggestions: string[]; placeholder?: string;
}) {
  const [input, setInput] = useState("");
  const available = suggestions.filter((s) => !tags.includes(s) && s.includes(input.toLowerCase()));

  const add = (tag: string) => {
    const t = tag.trim().toLowerCase();
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput("");
  };

  return (
    <div>
      <span className="block text-xs font-medium text-muted-foreground mb-1">{label}</span>
      <div className="flex flex-wrap gap-1 mb-2">
        {tags.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full border bg-muted/50 px-2 py-0.5 text-xs capitalize">
            {t}
            <button type="button" onClick={() => onChange(tags.filter((x) => x !== t))} className="text-muted-foreground hover:text-destructive"><X size={10} /></button>
          </span>
        ))}
      </div>
      <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(input); } }} placeholder={placeholder} className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm" />
      {input && available.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {available.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-dashed border-border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted capitalize">+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBlock({ icon, label, value, suffix }: { icon?: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Exercise row with inline editing ─────────────────────────────────────

function ExerciseRow({ ex, index, onRemove, onSave, nested = false }: {
  ex: HealthSessionExercise; index: number; onRemove: () => void;
  onSave: (patch: Partial<HealthSessionExercise>) => Promise<void>; nested?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [sets, setSets] = useState(String(ex.sets));
  const [reps, setReps] = useState(ex.reps);
  const [weight, setWeight] = useState(ex.weight);
  const [rest, setRest] = useState(String(ex.restSeconds || ""));
  const [notes, setNotes] = useState(ex.notes);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setSets(String(ex.sets)); setReps(ex.reps); setWeight(ex.weight);
    setRest(String(ex.restSeconds || "")); setNotes(ex.notes); setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ sets: Number(sets) || ex.sets, reps: reps || ex.reps, weight, restSeconds: Number(rest) || 0, notes });
      setEditing(false);
    } finally { setSaving(false); }
  };

  if (editing) {
    return (
      <li className={cn("px-5 py-3", nested && "pl-9")}>
        <div className="text-sm font-medium mb-2">{ex.exerciseName}</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <label className="block"><span className="text-[10px] text-muted-foreground">Sets</span>
            <input type="number" value={sets} onChange={(e) => setSets(e.target.value)} className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm" /></label>
          <label className="block"><span className="text-[10px] text-muted-foreground">Reps</span>
            <input value={reps} onChange={(e) => setReps(e.target.value)} placeholder="e.g. 8-12" className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm" /></label>
          <label className="block"><span className="text-[10px] text-muted-foreground">Weight</span>
            <input value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="e.g. 60kg" className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm" /></label>
          <label className="block"><span className="text-[10px] text-muted-foreground">Rest (sec)</span>
            <input type="number" value={rest} onChange={(e) => setRest(e.target.value)} placeholder="60" className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm" /></label>
        </div>
        <label className="block mt-2"><span className="text-[10px] text-muted-foreground">Notes</span>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Form cues, tempo, etc." className="w-full bg-background border border-border rounded-md px-2 py-1 text-sm" /></label>
        <div className="flex items-center gap-2 mt-2">
          <Button size="sm" onClick={save} disabled={saving}><Check size={12} className="mr-1" /> {saving ? "Saving…" : "Save"}</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
        </div>
      </li>
    );
  }

  return (
    <li>
      <Selectable kind="exercise" id={ex.id} label={ex.exerciseName} snapshot={ex as unknown as Record<string, unknown>} className="block hover:bg-accent/40 data-[selected=true]:bg-accent">
        <div className={`group flex items-start gap-4 ${nested ? "px-5 py-3" : "px-5 py-3.5"}`}>
          <div className="shrink-0 w-6 pt-0.5 text-xs font-medium text-muted-foreground tabular-nums">{index + 1}.</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium leading-snug">{ex.exerciseName}</div>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="tabular-nums"><span className="font-medium text-foreground">{ex.sets}</span>{" × "}<span className="font-medium text-foreground">{ex.reps || "—"}</span>{" reps"}</span>
              {ex.weight && <span className="tabular-nums"><span className="font-medium text-foreground">{ex.weight}</span></span>}
              {ex.restSeconds ? <span className="tabular-nums">{ex.restSeconds}s rest</span> : null}
            </div>
            {ex.notes && <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{ex.notes}</div>}
          </div>
          <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <AskKimButton
              kind="exercise"
              id={ex.id}
              title={ex.exerciseName}
              snapshot={ex as unknown as Record<string, unknown>}
              variant="icon-button"
              className="h-6 w-6"
            />
            <button onClick={startEdit} aria-label="Edit exercise" className="mt-0.5 text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>
            <button onClick={onRemove} aria-label="Remove exercise" className="mt-0.5 text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
          </div>
        </div>
      </Selectable>
    </li>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface SessionStats { exerciseCount: number; totalSets: number; totalReps: number }

function computeStats(exercises: HealthSessionExercise[]): SessionStats {
  let totalSets = 0, totalReps = 0;
  for (const ex of exercises) {
    const sets = ex.sets || 0;
    totalSets += sets;
    const repsNum = parseInt(ex.reps, 10);
    if (!isNaN(repsNum)) totalReps += sets * repsNum;
  }
  return { exerciseCount: exercises.length, totalSets, totalReps };
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
    if (!ss) { groups.push({ type: "single", items: [ex], startIndex: i }); i += 1; continue; }
    const start = i;
    const items: HealthSessionExercise[] = [];
    while (i < exercises.length && exercises[i].supersetGroup === ss) { items.push(exercises[i]); i += 1; }
    groups.push({ type: "superset", label: ss, items, startIndex: start });
  }
  return groups;
}
