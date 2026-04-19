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
import { useTranslation } from "react-i18next";
import { ListShell } from "@/components/list-shell";
import { useKim, useKimAutoContext, AskKimButton } from "@/components/kim";
import { cn } from "@/lib/utils";
import { getHealthProfile, type HealthProfile } from "@/lib/health";
import { routes } from "@/lib/routes";

// ─── Display-side label helpers (call inside components with t) ──────────────

function activityLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    sedentary: t("activity_sedentary"), light: t("activity_light"),
    moderate: t("activity_moderate"), active: t("activity_active"),
    very_active: t("activity_very_active"),
  };
  return map[key] ?? key;
}

function genderLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    male: t("gender_male"), female: t("gender_female"), other: t("gender_other"),
  };
  return map[key] ?? key;
}

function dietTypeLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    omnivore: t("diet_type_omnivore"), vegetarian: t("diet_type_vegetarian"),
    vegan: t("diet_type_vegan"), pescatarian: t("diet_type_pescatarian"),
    keto: t("diet_type_keto"), paleo: t("diet_type_paleo"),
    mediterranean: t("diet_type_mediterranean"),
  };
  return map[key] ?? key;
}

function dietGoalLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    lose: t("diet_goal_lose"), maintain: t("diet_goal_maintain"), gain: t("diet_goal_gain"),
  };
  return map[key] ?? key;
}

function fitnessLevelLabel(key: string, t: (k: string) => string): string {
  const map: Record<string, string> = {
    beginner: t("fitness_level_beginner"), intermediate: t("fitness_level_intermediate"),
    advanced: t("fitness_level_advanced"),
  };
  return map[key] ?? key;
}

function bmiCategory(bmi: number, t: (k: string) => string): { label: string; color: string } {
  if (bmi < 18.5)
    return { label: t("bmi_underweight"), color: "text-sky-600 dark:text-sky-400" };
  if (bmi < 25)
    return { label: t("bmi_healthy"), color: "text-emerald-600 dark:text-emerald-400" };
  if (bmi < 30)
    return { label: t("bmi_overweight"), color: "text-amber-600 dark:text-amber-400" };
  return { label: t("bmi_obese"), color: "text-rose-600 dark:text-rose-400" };
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
  const { t } = useTranslation("health");
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
      title={t("page_title")}
      subtitle={t("page_subtitle")}
      toolbar={
        <>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            {t("ask_kim_to_update")}
          </span>
          <div className="flex-1" />
          <Link
            href={routes.healthWeight}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            {t("weight_log_btn")}
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
  const { t } = useTranslation("health");
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/40 px-8 py-16 text-center space-y-4">
      <div className="inline-flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        {t("empty_profile_eyebrow")}
      </div>
      <h2
        className="text-3xl italic leading-tight"
        style={{ fontFamily: "var(--font-display), Georgia, serif" }}
      >
        {t("empty_profile_title")}
      </h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        {t("empty_profile_body")}
      </p>
      <button
        onClick={() =>
          askKim(
            "Help me set up my health profile. Walk me through my body info, fitness preferences, and diet in that order.",
          )
        }
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-[13px] font-medium text-primary-foreground hover:opacity-90 transition-opacity"
      >
        {t("empty_profile_cta")}
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ─── Goal banner ─────────────────────────────────────────────────────────────

function GoalBanner({ profile }: { profile: HealthProfile }) {
  const { t } = useTranslation("health");
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
      ? t("goal_maintain")
      : direction === "lose"
        ? t("goal_lose_weight")
        : t("goal_gain_weight");

  return (
    <section className="rounded-xl border border-border bg-card px-6 py-5">
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
        <Sparkles className="h-3 w-3 text-primary" />
        {t("goal_banner_heading")}
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
  /** Fallback free-form "ask kim to update" handler. Used when `editSlot` isn't provided. */
  onEdit?: () => void;
  /** Optional header-right slot, e.g. a kind-specific <AskKimButton>. When set, takes precedence over onEdit. */
  editSlot?: ReactNode;
  children: ReactNode;
}

function SectionCard({
  icon,
  title,
  subtitle,
  complete,
  onEdit,
  editSlot,
  children,
}: SectionCardProps) {
  const { t } = useTranslation("health");
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
                  {t("incomplete", { ns: "common" })}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>
        {editSlot ?? (
          <button
            onClick={onEdit}
            className="shrink-0 inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border text-[11px] text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-colors"
          >
            <Sparkles className="h-3 w-3" />
            {t("ask_kim")}
          </button>
        )}
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
  const { t } = useTranslation("health");
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/30 p-4 text-center">
      <p className="text-sm text-muted-foreground mb-3">{message}</p>
      <button
        onClick={onEdit}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
      >
        <Sparkles className="h-3 w-3" />
        {t("ask_kim_to_set_up")}
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
  const { t } = useTranslation("common");
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
        {empty ? t("not_set", { ns: "common" }) : value}
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
  metricId,
  snapshot,
}: {
  label: string;
  value: string;
  sub?: string;
  subColor?: string;
  metricId?: string;
  snapshot?: Record<string, unknown>;
}) {
  return (
    <div className="relative rounded-md bg-muted/40 px-3 py-2 group">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      <div className="font-mono text-base mt-0.5">{value}</div>
      {sub && (
        <div className={cn("text-[10px] mt-0.5", subColor ?? "text-muted-foreground")}>
          {sub}
        </div>
      )}
      {metricId && snapshot && (
        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <AskKimButton
            kind="metric"
            id={metricId}
            title={`${label}: ${value}`}
            snapshot={snapshot}
            variant="icon-button"
            className="h-5 w-5"
          />
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
  const { t } = useTranslation("health");
  const complete = bodyComplete(profile);
  const cat = profile.bmi ? bmiCategory(profile.bmi, t) : null;

  const edit = () =>
    askKim(
      "I want to update my body info — things like weight, goal weight, height, age, gender, or activity level. Ask me whichever of these need changing.",
    );

  const bodySnapshot = {
    weightKg: profile.weightKg,
    heightCm: profile.heightCm,
    age: profile.age,
    gender: profile.gender,
    activityLevel: profile.activityLevel,
    goalWeightKg: profile.goalWeightKg,
    bmi: profile.bmi,
    bmr: profile.bmr,
    tdee: profile.tdee,
  };

  return (
    <SectionCard
      icon={<UserIcon className="h-4 w-4" />}
      title={t("section_body_title")}
      subtitle={t("section_body_subtitle")}
      complete={complete}
      onEdit={edit}
      editSlot={
        <AskKimButton
          kind="diet-profile"
          id="health-profile-body"
          title={t("section_body_title")}
          snapshot={bodySnapshot}
          className="h-7"
          title_={t("ask_kim")}
        />
      }
    >
      {!complete && !profile.weightKg && !profile.heightCm ? (
        <MissingCta
          message={t("body_missing_cta")}
          onEdit={edit}
        />
      ) : (
        <div className="space-y-0">
          <DataRow
            label={t("label_weight")}
            value={
              profile.weightKg != null
                ? `${profile.weightKg.toFixed(1)} kg`
                : null
            }
            mono
          />
          <DataRow
            label={t("label_goal_weight")}
            value={
              profile.goalWeightKg != null && profile.goalWeightKg > 0
                ? `${profile.goalWeightKg.toFixed(1)} kg`
                : null
            }
            mono
          />
          <DataRow
            label={t("label_height")}
            value={
              profile.heightCm != null ? `${profile.heightCm.toFixed(0)} cm` : null
            }
            mono
          />
          <DataRow label={t("label_age")} value={profile.age ?? null} mono />
          <DataRow
            label={t("label_gender")}
            value={profile.gender ? genderLabel(profile.gender, t) : null}
          />
          <DataRow
            label={t("label_activity_level")}
            value={
              profile.activityLevel
                ? activityLabel(profile.activityLevel, t)
                : null
            }
          />
        </div>
      )}

      {(profile.bmi || profile.bmr || profile.tdee) && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-2">
            {t("label_computed")}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Stat
              label="BMI"
              value={profile.bmi ? profile.bmi.toFixed(1) : "—"}
              sub={cat?.label}
              subColor={cat?.color}
              metricId="bmi"
              snapshot={{
                metric: "bmi",
                value: profile.bmi,
                category: cat?.label,
                weightKg: profile.weightKg,
                heightCm: profile.heightCm,
              }}
            />
            <Stat
              label="BMR"
              value={profile.bmr ? Math.round(profile.bmr).toString() : "—"}
              sub="kcal/day"
              metricId="bmr"
              snapshot={{
                metric: "bmr",
                value: profile.bmr,
                unit: "kcal/day",
                weightKg: profile.weightKg,
                heightCm: profile.heightCm,
                age: profile.age,
                gender: profile.gender,
              }}
            />
            <Stat
              label="TDEE"
              value={profile.tdee ? Math.round(profile.tdee).toString() : "—"}
              sub="kcal/day"
              metricId="tdee"
              snapshot={{
                metric: "tdee",
                value: profile.tdee,
                unit: "kcal/day",
                activityLevel: profile.activityLevel,
                bmr: profile.bmr,
              }}
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
  const { t } = useTranslation("health");
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

  const gymSnapshot = {
    fitnessLevel: profile.fitnessLevel,
    fitnessGoal: profile.fitnessGoal,
    daysPerWeek: profile.daysPerWeek,
    preferredDurationMin: profile.preferredDurationMin,
    availableEquipment: profile.availableEquipment,
    physicalLimitations: profile.physicalLimitations,
    workoutLikes: profile.workoutLikes,
    workoutDislikes: profile.workoutDislikes,
  };

  return (
    <SectionCard
      icon={<Dumbbell className="h-4 w-4" />}
      title={t("section_fitness_title")}
      subtitle={t("section_fitness_subtitle")}
      complete={complete}
      onEdit={edit}
      editSlot={
        <AskKimButton
          kind="gym-profile"
          id="health-profile-gym"
          title={t("section_fitness_title")}
          snapshot={gymSnapshot}
          className="h-7"
          title_={t("ask_kim")}
        />
      }
    >
      {!hasAnyFitness ? (
        <MissingCta
          message={t("fitness_missing_cta")}
          onEdit={edit}
        />
      ) : (
        <>
          <div className="space-y-0">
            <DataRow
              label={t("label_level")}
              value={
                profile.fitnessLevel
                  ? fitnessLevelLabel(profile.fitnessLevel, t)
                  : null
              }
            />
            <DataRow
              label={t("label_goal")}
              value={profile.fitnessGoal || null}
            />
            <DataRow
              label={t("label_days_per_week")}
              value={profile.daysPerWeek > 0 ? profile.daysPerWeek : null}
              mono
            />
            <DataRow
              label={t("label_session_length")}
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
              label={t("label_equipment")}
              value={<Tags values={profile.availableEquipment ?? []} />}
            />
            <DataRow
              label={t("label_limitations")}
              value={<Tags values={profile.physicalLimitations ?? []} />}
            />
            <DataRow
              label={t("label_likes")}
              value={<Tags values={profile.workoutLikes ?? []} />}
            />
            <DataRow
              label={t("label_dislikes")}
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
  const { t } = useTranslation("health");
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

  const dietSnapshot = {
    dietType: profile.dietType,
    dietGoal: profile.dietGoal,
    dietaryRestrictions: profile.dietaryRestrictions,
    targetCalories: profile.targetCalories,
    proteinG: profile.proteinG,
    carbsG: profile.carbsG,
    fatG: profile.fatG,
    goalWeightKg: profile.goalWeightKg,
    weightKg: profile.weightKg,
    activityLevel: profile.activityLevel,
  };

  return (
    <SectionCard
      icon={<UtensilsCrossed className="h-4 w-4" />}
      title={t("section_diet_title")}
      subtitle={t("section_diet_subtitle")}
      complete={complete}
      onEdit={edit}
      editSlot={
        <AskKimButton
          kind="diet-profile"
          id="health-profile-diet"
          title={t("section_diet_title")}
          snapshot={dietSnapshot}
          className="h-7"
          title_={t("ask_kim")}
        />
      }
    >
      {!anyDietField ? (
        <MissingCta
          message={t("diet_missing_cta")}
          onEdit={edit}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column — preferences */}
          <div className="space-y-0">
            <DataRow
              label={t("label_diet_type")}
              value={
                profile.dietType
                  ? dietTypeLabel(profile.dietType, t)
                  : null
              }
            />
            <DataRow
              label={t("label_goal")}
              value={
                profile.dietGoal
                  ? dietGoalLabel(profile.dietGoal, t)
                  : null
              }
            />
            <DataRow
              label={t("label_target_calories")}
              value={
                profile.targetCalories != null
                  ? `${profile.targetCalories.toLocaleString()} kcal`
                  : null
              }
              mono
            />
            <DataRow
              label={t("label_restrictions")}
              value={<Tags values={profile.dietaryRestrictions ?? []} />}
            />
          </div>

          {/* Right column — macro breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5">
                <PieChart className="h-3 w-3 text-primary" /> {t("label_macros")}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {hasMacros ? t("kcal_total", { value: totalMacroKcal }) : t("not_set", { ns: "common" })}
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

