"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Dumbbell,
  PieChart,
  Scale,
  Sparkles,
  User as UserIcon,
  UtensilsCrossed,
} from "lucide-react";
import { ListShell } from "@/components/list-shell";
import { useKim, useKimAutoContext } from "@/components/kim";
import { cn } from "@/lib/utils";
import { getHealthProfile, type HealthProfile } from "@/lib/health";
import { routes } from "@/lib/routes";

// ─── Display-side labels ──────────────────────────────────────────────────────

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentary",
  light: "Lightly active",
  moderate: "Moderately active",
  active: "Active",
  very_active: "Very active",
};

const GENDER_LABELS: Record<string, string> = {
  male: "Male",
  female: "Female",
  other: "Other",
};

const DIET_TYPE_LABELS: Record<string, string> = {
  omnivore: "Omnivore",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  pescatarian: "Pescatarian",
  keto: "Keto",
  paleo: "Paleo",
  mediterranean: "Mediterranean",
};

const DIET_GOAL_LABELS: Record<string, string> = {
  lose: "Lose weight",
  maintain: "Maintain",
  gain: "Gain weight",
};

const FITNESS_LEVEL_LABELS: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

function bmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5)
    return { label: "Underweight", color: "text-sky-600 dark:text-sky-400" };
  if (bmi < 25)
    return { label: "Healthy", color: "text-emerald-600 dark:text-emerald-400" };
  if (bmi < 30)
    return { label: "Overweight", color: "text-amber-600 dark:text-amber-400" };
  return { label: "Obese", color: "text-rose-600 dark:text-rose-400" };
}

// ─── Completeness heuristics ─────────────────────────────────────────────────
// Each section is "set up" when the essential fields are filled.

function bodyComplete(p: HealthProfile | null): boolean {
  if (!p) return false;
  return (
    p.weightKg != null &&
    p.heightCm != null &&
    p.age != null &&
    !!p.gender &&
    !!p.activityLevel
  );
}

function fitnessComplete(p: HealthProfile | null): boolean {
  if (!p) return false;
  return !!p.fitnessLevel && !!p.fitnessGoal && p.daysPerWeek > 0;
}

function dietComplete(p: HealthProfile | null): boolean {
  if (!p) return false;
  return !!p.dietGoal && !!p.dietType && p.targetCalories != null;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HealthDashboard() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { askKim } = useKim();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await getHealthProfile());
    } catch {
      // no profile yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Surface the full profile to Kim so any agent question has it in context.
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

  return (
    <ListShell
      title="Health"
      subtitle="Body, fitness, and how you eat"
      toolbar={
        <>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            ask kim to update any of these
          </span>
          <div className="flex-1" />
          <Link
            href={routes.healthWeight}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            Weight log
          </Link>
        </>
      }
    >
      <div className="px-8 py-6 space-y-5">
        {loading ? (
          <LoadingGrid />
        ) : !profile ? (
          <EmptyProfile askKim={askKim} />
        ) : (
          <>
            <GoalBanner profile={profile} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <BodyCard profile={profile} askKim={askKim} />
              <FitnessCard profile={profile} askKim={askKim} />
            </div>
            <DietCard profile={profile} askKim={askKim} />
          </>
        )}
      </div>
    </ListShell>
  );
}

// ─── Loading + empty ─────────────────────────────────────────────────────────

function LoadingGrid() {
  return (
    <div className="space-y-5">
      <div className="h-24 rounded-xl border bg-card animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-64 rounded-xl border bg-card animate-pulse" />
        <div className="h-64 rounded-xl border bg-card animate-pulse" />
      </div>
      <div className="h-56 rounded-xl border bg-card animate-pulse" />
    </div>
  );
}

function EmptyProfile({ askKim }: { askKim: (m: string) => void }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center space-y-4">
      <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        nothing set up yet
      </div>
      <h2
        className="text-3xl italic leading-tight"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        let&apos;s get kim up to speed.
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Kim will ask a few quick questions about your body, your training, and
        how you like to eat. Everything lives on one page after that.
      </p>
      <button
        onClick={() =>
          askKim(
            "Help me set up my health profile. Walk me through my body info, fitness preferences, and diet in that order.",
          )
        }
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        Start with kim
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Goal banner ─────────────────────────────────────────────────────────────

function GoalBanner({ profile }: { profile: HealthProfile }) {
  const current = profile.weightKg ?? 0;
  const goal = profile.goalWeightKg ?? 0;
  const diff = goal - current;
  const hasGoal = goal > 0 && current > 0;
  const direction: "lose" | "maintain" | "gain" =
    profile.dietGoal === "lose"
      ? "lose"
      : profile.dietGoal === "gain"
        ? "gain"
        : "maintain";
  const directionLabel =
    direction === "maintain"
      ? "maintain current weight"
      : direction === "lose"
        ? "lose weight"
        : "gain weight";

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
        <Sparkles className="h-3 w-3 text-primary" />
        your goal right now
      </div>
      <div className="flex items-baseline flex-wrap gap-x-4 gap-y-1">
        <span className="text-xl font-semibold tracking-tight text-primary">
          {directionLabel}
        </span>
        {hasGoal && (
          <span className="text-sm text-muted-foreground inline-flex items-center gap-1.5">
            <span className="font-mono">{current.toFixed(1)} kg</span>
            <ArrowRight className="h-3 w-3" />
            <span className="font-mono">{goal.toFixed(1)} kg</span>
            {Math.abs(diff) > 0.05 && (
              <span className="text-xs">
                ({diff > 0 ? "+" : ""}
                {diff.toFixed(1)} kg)
              </span>
            )}
          </span>
        )}
      </div>
    </section>
  );
}

// ─── Card chrome ─────────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  complete: boolean;
  onEdit: () => void;
  children: ReactNode;
}

function SectionCard({
  icon,
  title,
  subtitle,
  complete,
  onEdit,
  children,
}: SectionCardProps) {
  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <header className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
        <div className="min-w-0 flex items-start gap-3">
          <div className="mt-0.5 h-8 w-8 shrink-0 rounded-md bg-muted text-primary flex items-center justify-center">
            {icon}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold tracking-tight">
                {title}
              </h2>
              {!complete && (
                <span className="text-[9px] uppercase tracking-[0.18em] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  incomplete
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        <button
          onClick={onEdit}
          className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
        >
          <Sparkles className="h-3 w-3" />
          ask kim
        </button>
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

function MissingCta({
  message,
  onEdit,
}: {
  message: string;
  onEdit: () => void;
}) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      <button
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
      >
        <Sparkles className="h-3 w-3" />
        ask kim to set it up
        <ArrowRight className="h-3 w-3" />
      </button>
    </div>
  );
}

function DataRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  const empty =
    value == null || value === "" || (Array.isArray(value) && value.length === 0);
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-border/40 last:border-0">
      <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "text-sm text-right",
          mono && "font-mono",
          empty && "text-muted-foreground/50 italic",
        )}
      >
        {empty ? "not set" : value}
      </span>
    </div>
  );
}

function Tags({ values }: { values: string[] }) {
  if (!values?.length) return null;
  return (
    <div className="flex flex-wrap gap-1 justify-end">
      {values.map((t) => (
        <span
          key={t}
          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-foreground/80"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  subColor,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
}) {
  return (
    <div className="rounded-md bg-muted/40 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-base mt-0.5">{value}</div>
      {sub && (
        <div className={cn("text-[10px] mt-0.5", subColor ?? "text-muted-foreground")}>
          {sub}
        </div>
      )}
    </div>
  );
}

// ─── Body card ───────────────────────────────────────────────────────────────

function BodyCard({
  profile,
  askKim,
}: {
  profile: HealthProfile;
  askKim: (m: string) => void;
}) {
  const complete = bodyComplete(profile);
  const cat = profile.bmi ? bmiCategory(profile.bmi) : null;

  const edit = () =>
    askKim(
      "I want to update my body info — things like weight, goal weight, height, age, gender, or activity level. Ask me whichever of these need changing.",
    );

  return (
    <SectionCard
      icon={<UserIcon className="h-4 w-4" />}
      title="Body"
      subtitle="Who you are, physically"
      complete={complete}
      onEdit={edit}
    >
      {!complete && !profile.weightKg && !profile.heightCm ? (
        <MissingCta
          message="Kim needs your body basics before she can tailor calories and training."
          onEdit={edit}
        />
      ) : (
        <div className="space-y-0">
          <DataRow
            label="Weight"
            value={
              profile.weightKg != null
                ? `${profile.weightKg.toFixed(1)} kg`
                : null
            }
            mono
          />
          <DataRow
            label="Goal weight"
            value={
              profile.goalWeightKg != null && profile.goalWeightKg > 0
                ? `${profile.goalWeightKg.toFixed(1)} kg`
                : null
            }
            mono
          />
          <DataRow
            label="Height"
            value={
              profile.heightCm != null ? `${profile.heightCm.toFixed(0)} cm` : null
            }
            mono
          />
          <DataRow label="Age" value={profile.age ?? null} mono />
          <DataRow
            label="Gender"
            value={profile.gender ? GENDER_LABELS[profile.gender] ?? profile.gender : null}
          />
          <DataRow
            label="Activity level"
            value={
              profile.activityLevel
                ? ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel
                : null
            }
          />
        </div>
      )}

      {(profile.bmi || profile.bmr || profile.tdee) && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            computed
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="BMI"
              value={profile.bmi ? profile.bmi.toFixed(1) : "—"}
              sub={cat?.label}
              subColor={cat?.color}
            />
            <Stat
              label="BMR"
              value={profile.bmr ? Math.round(profile.bmr).toString() : "—"}
              sub="kcal/day"
            />
            <Stat
              label="TDEE"
              value={profile.tdee ? Math.round(profile.tdee).toString() : "—"}
              sub="kcal/day"
            />
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ─── Fitness card ────────────────────────────────────────────────────────────

function FitnessCard({
  profile,
  askKim,
}: {
  profile: HealthProfile;
  askKim: (m: string) => void;
}) {
  const complete = fitnessComplete(profile);
  const hasAnyFitness =
    !!profile.fitnessLevel ||
    !!profile.fitnessGoal ||
    profile.daysPerWeek > 0 ||
    (profile.availableEquipment ?? []).length > 0;

  const edit = () =>
    askKim(
      "I want to update my fitness preferences — things like training level, goal, how many days a week I train, session length, available equipment, or any limitations. Ask me whichever of these need changing.",
    );

  return (
    <SectionCard
      icon={<Dumbbell className="h-4 w-4" />}
      title="Fitness"
      subtitle="How you like to train"
      complete={complete}
      onEdit={edit}
    >
      {!hasAnyFitness ? (
        <MissingCta
          message="Tell kim how you train so she can plan sensible sessions."
          onEdit={edit}
        />
      ) : (
        <>
          <div className="space-y-0">
            <DataRow
              label="Level"
              value={
                profile.fitnessLevel
                  ? FITNESS_LEVEL_LABELS[profile.fitnessLevel] ??
                    profile.fitnessLevel
                  : null
              }
            />
            <DataRow
              label="Goal"
              value={profile.fitnessGoal || null}
            />
            <DataRow
              label="Days / week"
              value={profile.daysPerWeek > 0 ? profile.daysPerWeek : null}
              mono
            />
            <DataRow
              label="Session length"
              value={
                profile.preferredDurationMin > 0
                  ? `${profile.preferredDurationMin} min`
                  : null
              }
              mono
            />
          </div>
          <div className="space-y-0">
            <DataRow
              label="Equipment"
              value={<Tags values={profile.availableEquipment ?? []} />}
            />
            <DataRow
              label="Limitations"
              value={<Tags values={profile.physicalLimitations ?? []} />}
            />
            <DataRow
              label="Likes"
              value={<Tags values={profile.workoutLikes ?? []} />}
            />
            <DataRow
              label="Dislikes"
              value={<Tags values={profile.workoutDislikes ?? []} />}
            />
          </div>
        </>
      )}
    </SectionCard>
  );
}

// ─── Diet & Nutrition card ───────────────────────────────────────────────────

function DietCard({
  profile,
  askKim,
}: {
  profile: HealthProfile;
  askKim: (m: string) => void;
}) {
  const complete = dietComplete(profile);
  const p = profile.proteinG ?? 0;
  const c = profile.carbsG ?? 0;
  const f = profile.fatG ?? 0;
  const totalMacroKcal = useMemo(() => p * 4 + c * 4 + f * 9, [p, c, f]);
  const pKcal = p * 4;
  const cKcal = c * 4;
  const fKcal = f * 9;
  const total = totalMacroKcal || 1;
  const pPct = Math.round((pKcal / total) * 100);
  const cPct = Math.round((cKcal / total) * 100);
  const fPct = Math.max(0, 100 - pPct - cPct);
  const hasMacros = totalMacroKcal > 0;
  const hasRestrictions = (profile.dietaryRestrictions ?? []).length > 0;

  const edit = () =>
    askKim(
      "I want to update how I eat — diet type, goal, target calories, macros, restrictions, allergies, or preferences. Ask me whichever of these need changing.",
    );

  const anyDietField =
    !!profile.dietType ||
    !!profile.dietGoal ||
    profile.targetCalories != null ||
    hasMacros ||
    hasRestrictions;

  return (
    <SectionCard
      icon={<UtensilsCrossed className="h-4 w-4" />}
      title="Diet & Nutrition"
      subtitle="How you eat, what you avoid, the macros"
      complete={complete}
      onEdit={edit}
    >
      {!anyDietField ? (
        <MissingCta
          message="Kim can build meal plans around your diet type, calorie target, and any foods you want to avoid."
          onEdit={edit}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column — preferences */}
          <div className="space-y-0">
            <DataRow
              label="Diet type"
              value={
                profile.dietType
                  ? DIET_TYPE_LABELS[profile.dietType] ?? profile.dietType
                  : null
              }
            />
            <DataRow
              label="Goal"
              value={
                profile.dietGoal
                  ? DIET_GOAL_LABELS[profile.dietGoal] ?? profile.dietGoal
                  : null
              }
            />
            <DataRow
              label="Target calories"
              value={
                profile.targetCalories != null
                  ? `${profile.targetCalories.toLocaleString()} kcal`
                  : null
              }
              mono
            />
            <DataRow
              label="Restrictions"
              value={<Tags values={profile.dietaryRestrictions ?? []} />}
            />
          </div>

          {/* Right column — macro breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <PieChart className="h-3 w-3 text-primary" /> macros
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {hasMacros ? `${totalMacroKcal} kcal total` : "not set"}
              </div>
            </div>

            <div
              className={cn(
                "h-2 rounded-full overflow-hidden flex mb-3",
                hasMacros ? "" : "bg-muted",
              )}
            >
              {hasMacros && (
                <>
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
                    style={{ width: `${fPct}%` }}
                    title={`Fat ${fPct}%`}
                  />
                </>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2">
              <MacroReadout
                label="Protein"
                value={p}
                pct={pPct}
                color="bg-rose-500/80"
              />
              <MacroReadout
                label="Carbs"
                value={c}
                pct={cPct}
                color="bg-teal-500/80"
              />
              <MacroReadout
                label="Fat"
                value={f}
                pct={fPct}
                color="bg-sky-500/80"
              />
            </div>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

function MacroReadout({
  label,
  value,
  pct,
  color,
}: {
  label: string;
  value: number;
  pct: number;
  color: string;
}) {
  const empty = value <= 0;
  return (
    <div className="rounded-md border border-border/60 px-3 py-2 bg-background/40">
      <div className="flex items-center gap-1.5 mb-1">
        <span className={cn("h-2 w-2 rounded-full", color)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      {empty ? (
        <div className="text-sm text-muted-foreground/50 italic">—</div>
      ) : (
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-base">{value}</span>
          <span className="text-[10px] text-muted-foreground">g</span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {pct}%
          </span>
        </div>
      )}
    </div>
  );
}

