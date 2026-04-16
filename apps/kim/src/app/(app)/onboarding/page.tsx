"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Sparkles } from "lucide-react";
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

const STEPS: { id: StepId; title: string; subtitle: string }[] = [
  { id: "welcome",  title: "Welcome",          subtitle: "Meet Kim" },
  { id: "basics",   title: "The basics",       subtitle: "Your timezone" },
  { id: "rhythm",   title: "Daily rhythm",     subtitle: "Wake and sleep" },
  { id: "meals",    title: "Meals",            subtitle: "When you eat" },
  { id: "work",     title: "Work & commute",   subtitle: "How your day flows" },
  { id: "health",   title: "Health profile",   subtitle: "Diet and goals" },
  { id: "memories", title: "Anything else",    subtitle: "What should Kim remember" },
  { id: "done",     title: "All set",          subtitle: "Kim is ready" },
];

function stepIndex(id: StepId | null | undefined): number {
  if (!id) return 0;
  const i = STEPS.findIndex((s) => s.id === id);
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

const DIET_TYPES = [
  { value: "balanced",      label: "Balanced" },
  { value: "mediterranean", label: "Mediterranean" },
  { value: "high_protein",  label: "High protein" },
  { value: "low_carb",      label: "Low carb" },
  { value: "keto",          label: "Keto" },
  { value: "paleo",         label: "Paleo" },
  { value: "vegan",         label: "Vegan" },
];

const DIET_GOALS = [
  { value: "lose",     label: "Lose weight" },
  { value: "maintain", label: "Maintain" },
  { value: "gain",     label: "Gain" },
];

const ACTIVITY_LEVELS = [
  { value: "sedentary",   label: "Sedentary" },
  { value: "light",       label: "Light" },
  { value: "moderate",    label: "Moderate" },
  { value: "active",      label: "Active" },
  { value: "very_active", label: "Very active" },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();
  const { setMode, askKim } = useKim();

  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [health, setHealth] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [current, setCurrent] = useState<StepId>("welcome");

  // Lock Kim to onboarding mode while this page is mounted.
  useEffect(() => {
    setMode("onboarding", true);
    return () => setMode("general", false);
  }, [setMode]);

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
  const saveProfile = useCallback(
    async (patch: Partial<LifeProfile>, nextStep?: StepId) => {
      const body: Partial<LifeProfile> = { ...patch };
      if (nextStep) body.onboardingStep = nextStep;
      const next = await updateLifeProfile(body);
      setProfile(next);
      window.dispatchEvent(
        new CustomEvent<LifeProfile>("life-profile-updated", { detail: next }),
      );
      if (nextStep) setCurrent(nextStep);
    },
    [],
  );

  const saveHealth = useCallback(
    async (patch: Partial<HealthProfile>, nextStep?: StepId) => {
      const next = await updateHealthProfile(patch);
      setHealth(next);
      if (nextStep) {
        await saveProfile({}, nextStep);
      }
    },
    [saveProfile],
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

  const idx = stepIndex(current);

  if (loading || !profile) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
        Loading onboarding…
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="shrink-0 border-b border-border px-8 py-5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          First-run setup · {Math.min(idx + 1, STEPS.length)} of {STEPS.length}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Let's get Kim set up for you
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Fill things in on the left, or just chat with Kim on the right — she'll
          fill the forms for you as you talk. Takes about two minutes.
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
  return (
    <div className="pt-3">
      <p className="text-sm text-muted-foreground">
        Kim is a personal agent that plans your days, nudges your habits, and
        helps you cook and train. The next few steps are just so Kim can be
        useful from day one — no long forms, no lectures. You can fill things
        in here or talk to Kim on the right.
      </p>
      <div className="mt-4">
        <PrimaryButton onClick={onNext}>Let's go</PrimaryButton>
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
      <Field label="Timezone">
        <select
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
        >
          {options.map((t) => (
            <option key={t} value={t}>
              {t}
              {t === detected ? " (detected)" : ""}
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
          {saving ? "Saving…" : "Save & continue"}
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
  const [wake, setWake] = useState(profile.wakeTime ?? "07:00");
  const [sleep, setSleep] = useState(profile.sleepTime ?? "23:00");
  const [saving, setSaving] = useState(false);

  return (
    <div className="pt-3 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Wake time">
          <input
            type="time"
            value={wake}
            onChange={(e) => setWake(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Bedtime">
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
          {saving ? "Saving…" : "Save & continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function MealsStep({ onNext }: { onNext: () => void }) {
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
        Rough times are fine — Kim just needs a sense of your day. Leave any
        field blank if it doesn't apply.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Breakfast">
          <input
            type="time"
            value={breakfast}
            onChange={(e) => setBreakfast(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Lunch">
          <input
            type="time"
            value={lunch}
            onChange={(e) => setLunch(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Dinner">
          <input
            type="time"
            value={dinner}
            onChange={(e) => setDinner(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <Field label="Main meal of the day">
        <select
          value={main}
          onChange={(e) => setMain(e.target.value as typeof main)}
          className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="">— pick one —</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
      </Field>
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save & continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function WorkStep({ onNext }: { onNext: () => void }) {
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
        <Field label="What you do">
          <input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Software engineer"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Where">
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value as typeof location)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            <option value="">— pick one —</option>
            <option value="remote">Remote</option>
            <option value="hybrid">Hybrid</option>
            <option value="onsite">Onsite</option>
          </select>
        </Field>
        <Field label="Typical hours">
          <input
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="e.g. 9–18"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
        <Field label="Commute (if any)">
          <input
            value={commute}
            onChange={(e) => setCommute(e.target.value)}
            placeholder="e.g. 30 min each way"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save & continue"}
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
        <Field label="Diet type">
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {DIET_TYPES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Goal">
          <select
            value={dietGoal}
            onChange={(e) => setDietGoal(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {DIET_GOALS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Activity level">
          <select
            value={activityLevel}
            onChange={(e) => setActivityLevel(e.target.value)}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          >
            {ACTIVITY_LEVELS.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Allergies / restrictions">
          <input
            value={restrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            placeholder="e.g. peanuts, lactose"
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm"
          />
        </Field>
      </div>
      <div className="flex justify-end">
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save & continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function MemoriesStep({ onNext }: { onNext: () => void }) {
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
        Hobbies, family, constraints, things that matter to you — anything you'd
        want Kim to remember. You can also just tell Kim in the chat.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="I have two kids, I rock climb on weekends, I'm learning Spanish…"
        className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm resize-none"
      />
      <div className="flex justify-between items-center">
        <SkipButton onSkip={onNext} disabled={saving} />
        <PrimaryButton disabled={saving} onClick={submit}>
          {saving ? "Saving…" : "Save & continue"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function DoneStep({ onFinish }: { onFinish: () => Promise<void> }) {
  const [finishing, setFinishing] = useState(false);
  return (
    <div className="pt-3 space-y-3">
      <p className="text-sm text-muted-foreground">
        That's everything Kim needs. You can always refine later from the
        health page, or just tell Kim.
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
          {finishing ? "Finishing…" : "Enter Kim"}
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
  return (
    <button
      type="button"
      onClick={onSkip}
      disabled={disabled}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
    >
      Skip this step
    </button>
  );
}
