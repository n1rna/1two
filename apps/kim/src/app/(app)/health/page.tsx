"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Beef,
  Dumbbell,
  Flame,
  Heart,
  Pencil,
  PieChart,
  Scale,
  Sparkles,
  User as UserIcon,
  UtensilsCrossed,
} from "lucide-react";
import { ListShell } from "@/components/list-shell";
import { useKimAutoContext } from "@/components/kim";
import { cn } from "@/lib/utils";
import {
  getHealthProfile,
  updateHealthProfile,
  type HealthProfile,
} from "@/lib/health";

const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedentary" },
  { value: "light", label: "Light" },
  { value: "moderate", label: "Moderate" },
  { value: "active", label: "Active" },
  { value: "very_active", label: "Very active" },
];

const DIET_TYPE_OPTIONS = [
  { value: "omnivore", label: "Omnivore" },
  { value: "vegetarian", label: "Vegetarian" },
  { value: "vegan", label: "Vegan" },
  { value: "pescatarian", label: "Pescatarian" },
  { value: "keto", label: "Keto" },
  { value: "paleo", label: "Paleo" },
  { value: "mediterranean", label: "Mediterranean" },
];

const DIET_GOAL_OPTIONS = [
  { value: "lose", label: "Lose weight" },
  { value: "maintain", label: "Maintain" },
  { value: "gain", label: "Gain weight" },
];

const GENDER_OPTIONS = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Underweight", color: "text-sky-600 dark:text-sky-400" };
  if (bmi < 25) return { label: "Healthy", color: "text-emerald-600 dark:text-emerald-400" };
  if (bmi < 30) return { label: "Overweight", color: "text-teal-600 dark:text-teal-400" };
  return { label: "Obese", color: "text-rose-600 dark:text-rose-400" };
}

export default function HealthDashboard() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingField, setSavingField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await getHealthProfile());
    } catch {
      // profile may not exist yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-add the full profile into Kim's context so the agent can reference
  // it when the user asks to update anything.
  useKimAutoContext(
    profile
      ? {
          kind: "memory",
          id: "health-profile",
          label: "Health profile",
          snapshot: profile as unknown as Record<string, unknown>,
        }
      : null,
  );

  const save = useCallback(
    async (fieldName: string, patch: Partial<HealthProfile>) => {
      if (!profile) return;
      setSavingField(fieldName);
      setError(null);
      try {
        const updated = await updateHealthProfile({ ...profile, ...patch });
        setProfile(updated);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save");
      } finally {
        setSavingField(null);
      }
    },
    [profile],
  );

  const totalMacroKcal = useMemo(() => {
    if (!profile) return 0;
    const p = (profile.proteinG ?? 0) * 4;
    const c = (profile.carbsG ?? 0) * 4;
    const f = (profile.fatG ?? 0) * 9;
    return p + c + f;
  }, [profile]);

  return (
    <ListShell
      title="Health"
      subtitle="Nutrition targets, body stats, and fitness preferences"
      toolbar={
        <>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            ask kim to update any of these
          </span>
          <div className="flex-1" />
          <Link
            href="/health/weight"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            Weight log
          </Link>
        </>
      }
    >
      <div className="px-6 py-5 max-w-5xl mx-auto space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : !profile ? (
          <div className="py-16 text-center">
            <p className="text-sm text-muted-foreground">No profile yet.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Ask Kim to set it up — she'll ask a few quick questions.
            </p>
          </div>
        ) : (
          <>
            {/* Goal banner */}
            <GoalBanner profile={profile} />

            {/* Body + Nutrition */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <BodySection
                profile={profile}
                savingField={savingField}
                onSave={save}
              />
              <NutritionSection
                profile={profile}
                savingField={savingField}
                onSave={save}
                totalMacroKcal={totalMacroKcal}
              />
            </div>

            {/* Fitness preferences */}
            <FitnessSection
              profile={profile}
              savingField={savingField}
              onSave={save}
            />
          </>
        )}
      </div>
    </ListShell>
  );
}

// ─── Goal banner ──────────────────────────────────────────────────────────────

function GoalBanner({ profile }: { profile: HealthProfile }) {
  const current = profile.weightKg ?? 0;
  const goal = profile.goalWeightKg ?? 0;
  const diff = goal - current;
  const hasGoal = goal > 0 && current > 0;
  const direction =
    profile.dietGoal === "lose"
      ? "lose"
      : profile.dietGoal === "gain"
        ? "gain"
        : "maintain";
  const directionColor =
    direction === "lose"
      ? "text-sky-600 dark:text-sky-400"
      : direction === "gain"
        ? "text-teal-600 dark:text-teal-400"
        : "text-emerald-600 dark:text-emerald-400";

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
        <Heart className="h-3 w-3" />
        diet goal
      </div>
      <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
        <span className={cn("text-xl font-semibold tracking-tight", directionColor)}>
          {direction === "maintain"
            ? "maintain current weight"
            : direction === "lose"
              ? "lose weight"
              : "gain weight"}
        </span>
        {hasGoal && (
          <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <span className="font-mono">{current.toFixed(1)} kg</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-mono">{goal.toFixed(1)} kg</span>
            {Math.abs(diff) > 0.05 && (
              <span className={cn("text-xs", directionColor)}>
                ({diff > 0 ? "+" : ""}
                {diff.toFixed(1)} kg)
              </span>
            )}
          </span>
        )}
      </div>
      {profile.dietType && (
        <div className="mt-2 text-xs text-muted-foreground">
          on a <span className="text-foreground font-medium">{profile.dietType}</span> diet
          {profile.dietaryRestrictions?.length > 0 && (
            <>
              {" "}· restrictions:{" "}
              <span className="text-foreground">
                {profile.dietaryRestrictions.join(", ")}
              </span>
            </>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Body section ─────────────────────────────────────────────────────────────

function BodySection({
  profile,
  savingField,
  onSave,
}: {
  profile: HealthProfile;
  savingField: string | null;
  onSave: (field: string, patch: Partial<HealthProfile>) => void;
}) {
  const cat = profile.bmi ? bmiCategory(profile.bmi) : null;
  return (
    <section className="rounded-xl border border-border bg-card">
      <SectionHeader icon={<UserIcon className="h-3.5 w-3.5" />}>body</SectionHeader>
      <div className="px-5 py-3 space-y-0">
        <InlineNumber
          label="Weight"
          unit="kg"
          value={profile.weightKg}
          saving={savingField === "weightKg"}
          onSave={(v) => onSave("weightKg", { weightKg: v })}
        />
        <InlineNumber
          label="Goal weight"
          unit="kg"
          value={profile.goalWeightKg}
          saving={savingField === "goalWeightKg"}
          onSave={(v) => onSave("goalWeightKg", { goalWeightKg: v })}
        />
        <InlineNumber
          label="Height"
          unit="cm"
          value={profile.heightCm}
          saving={savingField === "heightCm"}
          onSave={(v) => onSave("heightCm", { heightCm: v })}
        />
        <InlineNumber
          label="Age"
          value={profile.age}
          saving={savingField === "age"}
          onSave={(v) => onSave("age", { age: v == null ? null : Math.round(v) })}
        />
        <InlineSelect
          label="Gender"
          value={profile.gender ?? ""}
          options={GENDER_OPTIONS}
          saving={savingField === "gender"}
          onSave={(v) => onSave("gender", { gender: v })}
        />
        <InlineSelect
          label="Activity level"
          value={profile.activityLevel ?? ""}
          options={ACTIVITY_OPTIONS}
          saving={savingField === "activityLevel"}
          onSave={(v) => onSave("activityLevel", { activityLevel: v })}
        />
      </div>

      {/* Derived stats */}
      {(profile.bmi || profile.bmr || profile.tdee) && (
        <div className="border-t px-5 py-3">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            computed
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Stat
              label="BMI"
              value={profile.bmi ? profile.bmi.toFixed(1) : "—"}
              subtext={cat?.label}
              subtextColor={cat?.color}
            />
            <Stat
              label="BMR"
              value={profile.bmr ? Math.round(profile.bmr).toString() : "—"}
              subtext="kcal/day"
            />
            <Stat
              label="TDEE"
              value={profile.tdee ? Math.round(profile.tdee).toString() : "—"}
              subtext="kcal/day"
            />
          </div>
        </div>
      )}
    </section>
  );
}

// ─── Nutrition section ────────────────────────────────────────────────────────

function NutritionSection({
  profile,
  savingField,
  onSave,
  totalMacroKcal,
}: {
  profile: HealthProfile;
  savingField: string | null;
  onSave: (field: string, patch: Partial<HealthProfile>) => void;
  totalMacroKcal: number;
}) {
  const p = profile.proteinG ?? 0;
  const c = profile.carbsG ?? 0;
  const f = profile.fatG ?? 0;
  const pKcal = p * 4;
  const cKcal = c * 4;
  const fKcal = f * 9;
  const total = totalMacroKcal || 1;
  const pPct = Math.round((pKcal / total) * 100);
  const cPct = Math.round((cKcal / total) * 100);
  const fPct = 100 - pPct - cPct;

  return (
    <section className="rounded-xl border border-border bg-card">
      <SectionHeader icon={<UtensilsCrossed className="h-3.5 w-3.5" />}>
        nutrition
      </SectionHeader>
      <div className="px-5 py-3 space-y-0">
        <InlineSelect
          label="Diet type"
          value={profile.dietType ?? ""}
          options={DIET_TYPE_OPTIONS}
          saving={savingField === "dietType"}
          onSave={(v) => onSave("dietType", { dietType: v })}
        />
        <InlineSelect
          label="Goal"
          value={profile.dietGoal ?? "maintain"}
          options={DIET_GOAL_OPTIONS}
          saving={savingField === "dietGoal"}
          onSave={(v) => onSave("dietGoal", { dietGoal: v })}
        />
        <InlineNumber
          label="Target calories"
          unit="kcal"
          value={profile.targetCalories}
          saving={savingField === "targetCalories"}
          onSave={(v) =>
            onSave("targetCalories", {
              targetCalories: v == null ? null : Math.round(v),
            })
          }
        />
        <InlineTags
          label="Restrictions"
          value={profile.dietaryRestrictions ?? []}
          placeholder="e.g. dairy-free, gluten-free"
          saving={savingField === "dietaryRestrictions"}
          onSave={(tags) => onSave("dietaryRestrictions", { dietaryRestrictions: tags })}
        />
      </div>

      {/* Macros with visual bar */}
      <div className="border-t px-5 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1">
            <PieChart className="h-3 w-3" /> macros
          </div>
          <div className="text-[10px] text-muted-foreground font-mono">
            {totalMacroKcal} kcal total
          </div>
        </div>

        {totalMacroKcal > 0 ? (
          <div className="h-2 rounded-full overflow-hidden flex mb-3 bg-muted">
            <div
              className="bg-rose-500/80"
              style={{ width: `${pPct}%` }}
              title={`Protein ${pPct}%`}
            />
            <div
              className="bg-teal-500/80"
              style={{ width: `${cPct}%` }}
              title={`Carbs ${cPct}%`}
            />
            <div
              className="bg-sky-500/80"
              style={{ width: `${Math.max(fPct, 0)}%` }}
              title={`Fat ${fPct}%`}
            />
          </div>
        ) : (
          <div className="h-2 rounded-full bg-muted mb-3" />
        )}

        <div className="grid grid-cols-3 gap-2">
          <MacroField
            label="Protein"
            value={p}
            unit="g"
            pct={pPct}
            color="bg-rose-500/80"
            saving={savingField === "proteinG"}
            onSave={(v) => onSave("proteinG", { proteinG: v == null ? null : Math.round(v) })}
          />
          <MacroField
            label="Carbs"
            value={c}
            unit="g"
            pct={cPct}
            color="bg-teal-500/80"
            saving={savingField === "carbsG"}
            onSave={(v) => onSave("carbsG", { carbsG: v == null ? null : Math.round(v) })}
          />
          <MacroField
            label="Fat"
            value={f}
            unit="g"
            pct={Math.max(fPct, 0)}
            color="bg-sky-500/80"
            saving={savingField === "fatG"}
            onSave={(v) => onSave("fatG", { fatG: v == null ? null : Math.round(v) })}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Fitness section ──────────────────────────────────────────────────────────

function FitnessSection({
  profile,
  savingField,
  onSave,
}: {
  profile: HealthProfile;
  savingField: string | null;
  onSave: (field: string, patch: Partial<HealthProfile>) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <SectionHeader icon={<Dumbbell className="h-3.5 w-3.5" />}>
        fitness
      </SectionHeader>
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="px-5 py-3">
          <InlineText
            label="Fitness level"
            value={profile.fitnessLevel ?? ""}
            placeholder="beginner / intermediate / advanced"
            saving={savingField === "fitnessLevel"}
            onSave={(v) => onSave("fitnessLevel", { fitnessLevel: v })}
          />
          <InlineText
            label="Goal"
            value={profile.fitnessGoal ?? ""}
            placeholder="e.g. strength, hypertrophy, endurance"
            saving={savingField === "fitnessGoal"}
            onSave={(v) => onSave("fitnessGoal", { fitnessGoal: v })}
          />
          <InlineNumber
            label="Days/week"
            value={profile.daysPerWeek}
            saving={savingField === "daysPerWeek"}
            onSave={(v) =>
              onSave("daysPerWeek", { daysPerWeek: v == null ? 0 : Math.round(v) })
            }
          />
          <InlineNumber
            label="Session length"
            unit="min"
            value={profile.preferredDurationMin}
            saving={savingField === "preferredDurationMin"}
            onSave={(v) =>
              onSave("preferredDurationMin", {
                preferredDurationMin: v == null ? 0 : Math.round(v),
              })
            }
          />
        </div>
        <div className="px-5 py-3 md:border-l border-t md:border-t-0">
          <InlineTags
            label="Equipment"
            value={profile.availableEquipment ?? []}
            placeholder="e.g. dumbbells, barbell, bench"
            saving={savingField === "availableEquipment"}
            onSave={(tags) => onSave("availableEquipment", { availableEquipment: tags })}
          />
          <InlineTags
            label="Limitations"
            value={profile.physicalLimitations ?? []}
            placeholder="injuries, joint issues, etc."
            saving={savingField === "physicalLimitations"}
            onSave={(tags) => onSave("physicalLimitations", { physicalLimitations: tags })}
          />
          <InlineTags
            label="Likes"
            value={profile.workoutLikes ?? []}
            placeholder="exercises you enjoy"
            saving={savingField === "workoutLikes"}
            onSave={(tags) => onSave("workoutLikes", { workoutLikes: tags })}
          />
          <InlineTags
            label="Dislikes"
            value={profile.workoutDislikes ?? []}
            placeholder="exercises to avoid"
            saving={savingField === "workoutDislikes"}
            onSave={(tags) => onSave("workoutDislikes", { workoutDislikes: tags })}
          />
        </div>
      </div>
    </section>
  );
}

// ─── Reusable section chrome ──────────────────────────────────────────────────

function SectionHeader({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 px-5 py-3 border-b">
      <span className="text-primary">{icon}</span>
      <h2 className="text-base font-semibold leading-tight tracking-tight">
        {children}
      </h2>
    </div>
  );
}

function Stat({
  label,
  value,
  subtext,
  subtextColor,
}: {
  label: string;
  value: string;
  subtext?: string;
  subtextColor?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-lg mt-0.5">{value}</div>
      {subtext && (
        <div className={cn("text-[10px]", subtextColor ?? "text-muted-foreground")}>
          {subtext}
        </div>
      )}
    </div>
  );
}

// ─── Inline editable fields ───────────────────────────────────────────────────

function FieldRow({
  label,
  saving,
  children,
}: {
  label: string;
  saving: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground w-32 shrink-0">
        {label}
      </span>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-2">
        {children}
        {saving && (
          <span className="text-[10px] text-muted-foreground italic">
            saving…
          </span>
        )}
      </div>
    </div>
  );
}

function InlineNumber({
  label,
  unit,
  value,
  saving,
  onSave,
}: {
  label: string;
  unit?: string;
  value: number | null | undefined;
  saving: boolean;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value == null ? "" : String(value));

  useEffect(() => {
    if (!editing) setDraft(value == null ? "" : String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = draft === "" ? null : Number(draft);
    if (n !== value) onSave(n);
  };

  return (
    <FieldRow label={label} saving={saving}>
      {editing ? (
        <input
          type="number"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-24 text-right font-mono text-sm bg-transparent border-b border-primary focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group inline-flex items-center gap-1 text-right"
        >
          <span className="font-mono text-sm">
            {value != null && value !== 0 ? value : "—"}
          </span>
          {unit && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {unit}
            </span>
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </button>
      )}
    </FieldRow>
  );
}

function InlineText({
  label,
  value,
  placeholder,
  saving,
  onSave,
}: {
  label: string;
  value: string;
  placeholder?: string;
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  return (
    <FieldRow label={label} saving={saving}>
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 text-right text-sm bg-transparent border-b border-primary focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group inline-flex items-center gap-1 text-right"
        >
          <span className="text-sm">
            {value || <span className="text-muted-foreground italic">not set</span>}
          </span>
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </button>
      )}
    </FieldRow>
  );
}

function InlineSelect({
  label,
  value,
  options,
  saving,
  onSave,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  saving: boolean;
  onSave: (v: string) => void;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <FieldRow label={label} saving={saving}>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="text-right text-sm bg-transparent focus:outline-none cursor-pointer hover:text-primary transition-colors"
      >
        {!current && <option value="">— select —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </FieldRow>
  );
}

function InlineTags({
  label,
  value,
  placeholder,
  saving,
  onSave,
}: {
  label: string;
  value: string[];
  placeholder?: string;
  saving: boolean;
  onSave: (v: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.join(", "));

  useEffect(() => {
    if (!editing) setDraft(value.join(", "));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const tags = draft
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (JSON.stringify(tags) !== JSON.stringify(value)) onSave(tags);
  };

  return (
    <FieldRow label={label} saving={saving}>
      {editing ? (
        <input
          type="text"
          value={draft}
          autoFocus
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="flex-1 text-right text-sm bg-transparent border-b border-primary focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex flex-wrap gap-1 justify-end items-center"
        >
          {value.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">none</span>
          ) : (
            value.map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                {tag}
              </span>
            ))
          )}
          <Pencil className="h-2.5 w-2.5 text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
        </button>
      )}
    </FieldRow>
  );
}

function MacroField({
  label,
  value,
  unit,
  pct,
  color,
  saving,
  onSave,
}: {
  label: string;
  value: number;
  unit: string;
  pct: number;
  color: string;
  saving: boolean;
  onSave: (v: number | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (!editing) setDraft(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const n = draft === "" ? null : Number(draft);
    if (n !== value) onSave(n);
  };

  return (
    <div className="rounded-lg border border-border/60 px-3 py-2 bg-background/40">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {editing ? (
        <input
          type="number"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-full font-mono text-lg bg-transparent border-b border-primary focus:outline-none"
        />
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="group flex items-baseline gap-1 w-full text-left"
        >
          <span className="font-mono text-lg">{value}</span>
          <span className="text-[10px] text-muted-foreground">{unit}</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {pct}%
          </span>
        </button>
      )}
      {saving && (
        <div className="text-[9px] text-muted-foreground italic mt-0.5">saving…</div>
      )}
    </div>
  );
}
