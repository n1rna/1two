"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  getLifeProfile,
  updateLifeProfile,
  markOnboarded,
  createLifeMemory,
  type LifeProfile,
} from "@/lib/life";
import {
  getHealthProfile,
  updateHealthProfile,
  type HealthProfile,
} from "@/lib/health";
import { useKim, useKimEffect } from "@/components/kim";
import { routes } from "@/lib/routes";

// ─── Step metadata ────────────────────────────────────────────────────────────

type StepId =
  | "welcome"
  | "basics"
  | "rhythm"
  | "meals"
  | "work"
  | "health"
  | "memories"
  | "done";

function getSteps(t: (k: string) => string): { id: StepId; title: string; subtitle: string }[] {
  return [
    { id: "welcome",  title: t("step_welcome_title"),  subtitle: t("step_welcome_subtitle") },
    { id: "basics",   title: t("step_basics_title"),    subtitle: t("step_basics_subtitle") },
    { id: "rhythm",   title: t("step_rhythm_title"),    subtitle: t("step_rhythm_subtitle") },
    { id: "meals",    title: t("step_meals_title"),     subtitle: t("step_meals_subtitle") },
    { id: "work",     title: t("step_work_title"),      subtitle: t("step_work_subtitle") },
    { id: "health",   title: t("step_health_title"),    subtitle: t("step_health_subtitle") },
    { id: "memories", title: t("step_memories_title"),   subtitle: t("step_memories_subtitle") },
    { id: "done",     title: t("step_done_title"),      subtitle: t("step_done_subtitle") },
  ];
}

const STEP_IDS: StepId[] = ["welcome", "basics", "rhythm", "meals", "work", "health", "memories", "done"];
function stepIndex(id: StepId | null | undefined): number {
  if (!id) return 0;
  const i = STEP_IDS.indexOf(id);
  return i < 0 ? 0 : i;
}

const COMMON_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Istanbul",
  "Africa/Cairo",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
];

function getDietTypes(t: (k: string) => string) {
  return [
    { value: "balanced",      label: t("health_diet_balanced") },
    { value: "mediterranean", label: t("health_diet_mediterranean") },
    { value: "high_protein",  label: t("health_diet_high_protein") },
    { value: "low_carb",      label: t("health_diet_low_carb") },
    { value: "keto",          label: t("health_diet_keto") },
    { value: "paleo",         label: t("health_diet_paleo") },
    { value: "vegan",         label: t("health_diet_vegan") },
  ];
}

function getDietGoals(t: (k: string) => string) {
  return [
    { value: "lose",     label: t("health_goal_lose") },
    { value: "maintain", label: t("health_goal_maintain") },
    { value: "gain",     label: t("health_goal_gain") },
  ];
}

function getActivityLevels(t: (k: string) => string) {
  return [
    { value: "sedentary",   label: t("health_activity_sedentary") },
    { value: "light",       label: t("health_activity_light") },
    { value: "moderate",    label: t("health_activity_moderate") },
    { value: "active",      label: t("health_activity_active") },
    { value: "very_active", label: t("health_activity_very_active") },
  ];
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { t } = useTranslation("onboarding");
  const router = useRouter();
  const { setMode, askKim, setOnboardingContext } = useKim();

  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<StepId>("welcome");

  // Lock Kim to onboarding mode while this page is mounted.
  useEffect(() => {
    setMode("onboarding", true);
    return () => setMode("general", false);
  }, [setMode]);

  // Push latest snapshot into Kim's system context whenever state changes,
  // and clear it on unmount so other pages don't inherit stale onboarding data.
  useEffect(() => {
    if (!profile) return;
    setOnboardingContext({
      step: current,
      profile: profile as unknown as Record<string, unknown>,
      health: (health ?? null) as unknown as Record<string, unknown> | null,
    });
  }, [profile, health, current, setOnboardingContext]);
  useEffect(() => () => setOnboardingContext(null), [setOnboardingContext]);

  // Initial load of both profiles.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [p, h] = await Promise.all([
          getLifeProfile(),
          getHealthProfile().catch(() => null),
        ]);
        if (cancelled) return;
        setProfile(p);
        setHealth(h);
        if (p.onboardingStep) {
          setCurrent(p.onboardingStep as StepId);
        } else {
          // Seed the column so Kim sees where we are.
          void updateLifeProfile({ onboardingStep: "welcome" }).then((next) => {
            if (!cancelled) setProfile(next);
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Helper: save and advance. Accepts any partial profile write plus the next step id.
  // When the step advances, nudge Kim with a short message so she takes the lead on
  // the new step instead of silently falling behind the UI.
  const saveProfile = useCallback(
    async (patch: Partial<LifeProfile>, nextStep?: StepId) => {
      const prevStep = current;
      const body: Partial<LifeProfile> = { ...patch };
      if (nextStep) body.onboardingStep = nextStep;
      const next = await updateLifeProfile(body);
      setProfile(next);
      window.dispatchEvent(
        new CustomEvent<LifeProfile>("life-profile-updated", { detail: next }),
      );
      if (nextStep && nextStep !== prevStep) {
        setCurrent(nextStep);
        // Sync the ref-backed context synchronously so the askKim stream sees
        // the new step without waiting for the watching useEffect to fire.
        setOnboardingContext({
          step: nextStep,
          profile: next as unknown as Record<string, unknown>,
          health: (health ?? null) as unknown as Record<string, unknown> | null,
        });
        if (nextStep !== "done") {
          askKim(
            `I just finished the "${prevStep}" step via the UI. I'm now on the "${nextStep}" step — please guide me through it.`,
          );
        }
      }
    },
    [current, askKim, setOnboardingContext, health],
  );

  const saveHealth = useCallback(
    async (patch: Partial<HealthProfile>, nextStep?: StepId) => {
      const next = await updateHealthProfile(patch);
      setHealth(next);
      // Make sure the onboarding context reflects the fresh health snapshot
      // before saveProfile fires askKim below.
      if (profile) {
        setOnboardingContext({
          step: nextStep ?? current,
          profile: profile as unknown as Record<string, unknown>,
          health: next as unknown as Record<string, unknown>,
        });
      }
      if (nextStep) {
        await saveProfile({}, nextStep);
      }
    },
    [saveProfile, profile, current, setOnboardingContext],
  );

  const advance = useCallback(
    async (nextStep: StepId) => {
      await saveProfile({}, nextStep);
    },
    [saveProfile],
  );

  const finish = useCallback(async () => {
    await markOnboarded();
    const refreshed = await getLifeProfile();
    window.dispatchEvent(
      new CustomEvent<LifeProfile>("life-profile-updated", { detail: refreshed }),
    );
    router.replace(routes.home);
  }, [router]);

  // ── Sync with Kim tool calls ──────────────────────────────────────────────
  // When Kim calls update_life_profile from the chat side, refresh our local
  // copy so the stepper moves in lockstep.
  useKimEffect("update_life_profile", async () => {
    try {
      const p = await getLifeProfile();
      setProfile(p);
      if (p.onboardingStep) setCurrent(p.onboardingStep as StepId);
    } catch {}
  });
  useKimEffect("update_health_profile", async () => {
    try {
      const h = await getHealthProfile();
      setHealth(h);
    } catch {}
  });
  useKimEffect("complete_life_onboarding", async () => {
    await finish();
  });

  // ── Initial greeting ──────────────────────────────────────────────────────
  // Kick off Kim with a short hello the first time the page loads, so the
  // drawer isn't empty. We only do this once per mount.
  const [greeted, setGreeted] = useState(false);
  useEffect(() => {
    if (loading || greeted || !profile) return;
    if (profile.onboarded) return;
    setGreeted(true);
    // Don't auto-send if the user already has conversation history mid-flow —
    // only auto-greet from the welcome step.
    if ((profile.onboardingStep ?? "welcome") !== "welcome") return;
    askKim(
      "I'm new here. Walk me through onboarding step by step — start with a hello and then the basics.",
    );
  }, [loading, greeted, profile, askKim]);

  const STEPS = getSteps(t);
  const idx = stepIndex(current);

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        {t("loading")}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          {t("header_eyebrow", { current: Math.min(idx + 1, STEPS.length), total: STEPS.length })}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {t("header_title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          {t("header_body")}
        </p>
      </header>

      <div className="flex-1 overflow-y-auto px-8 py-6">
        <ol className="flex flex-col gap-3 max-w-2xl">
          {STEPS.map((step, i) => {
            const state: "done" | "current" | "upcoming" =
              i < idx ? "done" : i === idx ? "current" : "upcoming";
            return (
              <li key={step.id}>
                <StepCard
                  step={step}
                  number={i + 1}
                  state={state}
                  onClick={() => {
                    if (state !== "upcoming") setCurrent(step.id);
                  }}
                >
                  {state === "current" && (
                    <StepBody
                      step={step.id}
                      profile={profile}
                      health={health}
                      onSaveProfile={saveProfile}
                      onSaveHealth={saveHealth}
                      onAdvance={advance}
                      onFinish={finish}
                    />
                  )}
                </StepCard>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

// ─── Step card shell ─────────────────────────────────────────────────────────

function StepCard({
  step,
  number,
  state,
  onClick,
  children,
}: {
  step: { id: StepId; title: string; subtitle: string };
  number: number;
  state: "done" | "current" | "upcoming";
  onClick: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-colors",
        state === "current" && "border-primary/40 shadow-sm",
        state === "done" && "border-border opacity-80",
        state === "upcoming" && "border-border opacity-60",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <div
          className={cn(
            "shrink-0 h-7 w-7 rounded-full border flex items-center justify-center text-xs font-medium tabular-nums",
            state === "done" && "bg-primary text-primary-foreground border-primary",
            state === "current" && "border-primary text-primary",
            state === "upcoming" && "border-border text-muted-foreground",
          )}
        >
          {state === "done" ? <Check className="h-3.5 w-3.5" /> : number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium">{step.title}</div>
          <div className="text-xs text-muted-foreground">{step.subtitle}</div>
        </div>
      </button>
      {children && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60">{children}</div>
      )}
    </div>
  );
}

// ─── Per-step forms ───────────────────────────────────────────────────────────

function StepBody({
  step,
  profile,
  health,
  onSaveProfile,
  onSaveHealth,
  onAdvance,
  onFinish,
}: {
  step: StepId;
  profile: LifeProfile;
  health: HealthProfile | null;
  onSaveProfile: (patch: Partial<LifeProfile>, nextStep?: StepId) => Promise<void>;
  onSaveHealth: (patch: Partial<HealthProfile>, nextStep?: StepId) => Promise<void>;
  onAdvance: (nextStep: StepId) => Promise<void>;
  onFinish: () => Promise<void>;
}) {
  switch (step) {
    case "welcome":
      return <WelcomeStep onNext={() => onAdvance("basics")} />;
    case "basics":
      return (
        <BasicsStep profile={profile} onSave={(tz) => onSaveProfile({ timezone: tz }, "rhythm")} />
      );
    case "rhythm":
      return (
        <RhythmStep
          profile={profile}
          onSave={(w, s) => onSaveProfile({ wakeTime: w, sleepTime: s }, "meals")}
        />
      );
    case "meals":
      return <MealsStep onNext={() => onAdvance("work")} />;
    case "work":
      return <WorkStep onNext={() => onAdvance("health")} />;
    case "health":
      return (
        <HealthStep
          health={health}
          onSave={(patch) => onSaveHealth(patch, "memories")}
        />
      );
    case "memories":
      return <MemoriesStep onNext={() => onAdvance("done")} />;
    case "done":
      return <DoneStep onFinish={onFinish} />;
  }
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("onboarding");
  return (
    <div className="pt-3">
      <p className="text-sm text-muted-foreground">
        {t("welcome_body")}
      </p>
      <div className="mt-4">
        <PrimaryButton onClick={onNext}>{t("welcome_cta")}</PrimaryButton>
      </div>
    </div>
  );
}

function BasicsStep({
  profile,
  onSave,
}: {
  profile: LifeProfile;
  onSave: (tz: string) => Promise<void>;
}) {
  const { t } = useTranslation("onboarding");
  const detected = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "UTC";
    }
  }, []);
  const [tz, setTz] = useState(profile.timezone || detected);
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const set = new Set<string>([tz, detected, ...COMMON_TIMEZONES]);
    return Array.from(set);
  }, [tz, detected]);

  return (
    <div className="pt-3 space-y-3">
      <Field label={t("basics_timezone_label")}>
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
        >
          {options.map((tzOpt) => (
            <option key={tzOpt} value={tzOpt}>
              {tzOpt}
              {tzOpt === detected ? t("basics_detected_suffix") : ""}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(tz);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function RhythmStep({
  profile,
  onSave,
}: {
  profile: LifeProfile;
  onSave: (wake: string, sleep: string) => Promise<void>;
}) {
  const { t } = useTranslation("onboarding");
  const [wake, setWake] = useState(profile.wakeTime ?? "07:00");
  const [sleep, setSleep] = useState(profile.sleepTime ?? "23:00");
  const [saving, setSaving] = useState(false);

  return (
    <div className="pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("rhythm_wake_time_label")}>
          <input
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t("rhythm_bedtime_label")}>
          <input
            type="time"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await onSave(wake, sleep);
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function MealsStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("onboarding");
  const [breakfast, setBreakfast] = useState("");
  const [lunch, setLunch] = useState("");
  const [dinner, setDinner] = useState("");
  const [main, setMain] = useState<"breakfast" | "lunch" | "dinner" | "">("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const lines: string[] = [];
      if (breakfast) lines.push(`Usually has breakfast around ${breakfast}`);
      if (lunch) lines.push(`Usually has lunch around ${lunch}`);
      if (dinner) lines.push(`Usually has dinner around ${dinner}`);
      if (main) lines.push(`${main[0].toUpperCase() + main.slice(1)} is their main meal of the day`);
      for (const content of lines) {
        await createLifeMemory(content, "habit");
      }
      await onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("meals_hint")}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label={t("meals_breakfast_label")}>
          <input
            type="time"
            value={breakfast}
            onChange={(e) => setBreakfast(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t("meals_lunch_label")}>
          <input
            type="time"
            value={lunch}
            onChange={(e) => setLunch(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t("meals_dinner_label")}>
          <input
            type="time"
            value={dinner}
            onChange={(e) => setDinner(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label={t("meals_main_meal_label")}>
        <select
          value={main}
          onChange={(e) => setMain(e.target.value as typeof main)}
          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">{t("meals_pick_one")}</option>
          <option value="breakfast">{t("meals_breakfast_label")}</option>
          <option value="lunch">{t("meals_lunch_label")}</option>
          <option value="dinner">{t("meals_dinner_label")}</option>
        </select>
      </Field>
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function WorkStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("onboarding");
  const [role, setRole] = useState("");
  const [location, setLocation] = useState<"remote" | "hybrid" | "onsite" | "">("");
  const [commute, setCommute] = useState("");
  const [hours, setHours] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const lines: string[] = [];
      if (role) lines.push(`Works as a ${role}`);
      if (location) lines.push(`Works ${location}`);
      if (hours) lines.push(`Typical work hours: ${hours}`);
      if (commute) lines.push(`Commute is about ${commute}`);
      for (const content of lines) {
        await createLifeMemory(content, "fact");
      }
      await onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("work_what_you_do_label")}>
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t("work_what_you_do_placeholder")}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t("work_where_label")}>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value as typeof location)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">{t("meals_pick_one")}</option>
            <option value="remote">{t("work_remote")}</option>
            <option value="hybrid">{t("work_hybrid")}</option>
            <option value="onsite">{t("work_onsite")}</option>
          </select>
        </Field>
        <Field label={t("work_typical_hours_label")}>
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder={t("work_typical_hours_placeholder")}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label={t("work_commute_label")}>
          <input
            value={commute}
            onChange={(e) => setCommute(e.target.value)}
            placeholder={t("work_commute_placeholder")}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function HealthStep({
  health,
  onSave,
}: {
  health: HealthProfile | null;
  onSave: (patch: Partial<HealthProfile>) => Promise<void>;
}) {
  const { t } = useTranslation("onboarding");
  const [dietType, setDietType] = useState(health?.dietType || "balanced");
  const [dietGoal, setDietGoal] = useState(health?.dietGoal || "maintain");
  const [activityLevel, setActivityLevel] = useState(
    health?.activityLevel || "moderate",
  );
  const [restrictions, setRestrictions] = useState(
    (health?.dietaryRestrictions ?? []).join(", "),
  );
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    try {
      const parsed = restrictions
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      await onSave({
        dietType,
        dietGoal,
        activityLevel,
        dietaryRestrictions: parsed,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("health_diet_type_label")}>
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {getDietTypes(t).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("health_goal_label")}>
          <select
            value={dietGoal}
            onChange={(e) => setDietGoal(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {getDietGoals(t).map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("health_activity_label")}>
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {getActivityLevels(t).map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("health_restrictions_label")}>
          <input
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder={t("health_restrictions_placeholder")}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function MemoriesStep({ onNext }: { onNext: () => void }) {
  const { t } = useTranslation("onboarding");
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    setSaving(true);
    try {
      const trimmed = text.trim();
      if (trimmed) {
        await createLifeMemory(trimmed, "fact");
      }
      await onNext();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="pt-3 space-y-3">
      <p className="text-xs text-muted-foreground">
        {t("memories_hint")}
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={t("memories_placeholder")}
        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none"
      />
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? t("saving", { ns: "common" }) : t("save_and_continue")}
        </PrimaryButton>
      </div>
    </div>
  );
}

function DoneStep({ onFinish }: { onFinish: () => Promise<void> }) {
  const { t } = useTranslation("onboarding");
  const [finishing, setFinishing] = useState(false);
  return (
    <div className="pt-3 space-y-3">
      <p className="text-sm text-muted-foreground">
        {t("done_body")}
      </p>
      <div className="flex justify-end">
        <PrimaryButton
          disabled={finishing}
          onClick={async () => {
            setFinishing(true);
            try {
              await onFinish();
            } finally {
              setFinishing(false);
            }
          }}
        >
          {finishing ? t("finishing", { ns: "common" }) : t("done_cta")}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ─── Small building blocks ────────────────────────────────────────────────────

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function PrimaryButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:brightness-110 transition-all",
        "disabled:opacity-60 disabled:cursor-not-allowed",
      )}
    >
      {children}
    </button>
  );
}

function SkipButton({
  onSkip,
  disabled,
}: {
  onSkip: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation("onboarding");
  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={disabled}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      {t("skip_this_step")}
    </button>
  );
}
