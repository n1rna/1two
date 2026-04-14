"use client";

import { useEffect, useState } from "react";
import { PageShell, Card } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  getHealthProfile,
  updateHealthProfile,
  type HealthProfile,
} from "@/lib/health";

export default function HealthProfilePage() {
  const [profile, setProfile] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setProfile(await getHealthProfile());
      } catch {
        /* no profile yet */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      setProfile(await updateHealthProfile(profile));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof HealthProfile>(k: K, v: HealthProfile[K]) {
    setProfile((p) => (p ? { ...p, [k]: v } : p));
  }

  if (loading) {
    return (
      <PageShell title="Profile" backHref="/health">
        <div className="h-64 rounded-lg bg-muted animate-pulse" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Profile"
      subtitle="Used by Kim to tailor meals and workouts"
      backHref="/health"
      actions={
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "saving…" : "save"}
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        <Card>
          <SectionTitle>body</SectionTitle>
          <Field label="weight (kg)">
            <input
              type="number"
              value={profile?.weightKg ?? ""}
              onChange={(e) =>
                update("weightKg", e.target.value ? Number(e.target.value) : null)
              }
              className={inputCls}
            />
          </Field>
          <Field label="height (cm)">
            <input
              type="number"
              value={profile?.heightCm ?? ""}
              onChange={(e) =>
                update("heightCm", e.target.value ? Number(e.target.value) : null)
              }
              className={inputCls}
            />
          </Field>
          <Field label="age">
            <input
              type="number"
              value={profile?.age ?? ""}
              onChange={(e) =>
                update("age", e.target.value ? Number(e.target.value) : null)
              }
              className={inputCls}
            />
          </Field>
          <Field label="gender">
            <select
              value={profile?.gender ?? ""}
              onChange={(e) => update("gender", e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              <option value="male">male</option>
              <option value="female">female</option>
              <option value="other">other</option>
            </select>
          </Field>
        </Card>

        <Card>
          <SectionTitle>diet</SectionTitle>
          <Field label="activity level">
            <select
              value={profile?.activityLevel ?? "sedentary"}
              onChange={(e) => update("activityLevel", e.target.value)}
              className={inputCls}
            >
              <option value="sedentary">sedentary</option>
              <option value="light">light</option>
              <option value="moderate">moderate</option>
              <option value="active">active</option>
              <option value="very_active">very active</option>
            </select>
          </Field>
          <Field label="diet type">
            <input
              value={profile?.dietType ?? ""}
              onChange={(e) => update("dietType", e.target.value)}
              className={inputCls}
              placeholder="omnivore, vegetarian, …"
            />
          </Field>
          <Field label="goal">
            <select
              value={profile?.dietGoal ?? "maintain"}
              onChange={(e) => update("dietGoal", e.target.value)}
              className={inputCls}
            >
              <option value="lose">lose</option>
              <option value="maintain">maintain</option>
              <option value="gain">gain</option>
            </select>
          </Field>
          <Field label="goal weight (kg)">
            <input
              type="number"
              value={profile?.goalWeightKg ?? ""}
              onChange={(e) =>
                update(
                  "goalWeightKg",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className={inputCls}
            />
          </Field>
        </Card>

        <Card className="md:col-span-2">
          <SectionTitle>gym</SectionTitle>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="fitness level">
              <input
                value={profile?.fitnessLevel ?? ""}
                onChange={(e) => update("fitnessLevel", e.target.value)}
                className={inputCls}
                placeholder="beginner / intermediate / advanced"
              />
            </Field>
            <Field label="fitness goal">
              <input
                value={profile?.fitnessGoal ?? ""}
                onChange={(e) => update("fitnessGoal", e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="days/week">
              <input
                type="number"
                value={profile?.daysPerWeek ?? 0}
                onChange={(e) =>
                  update("daysPerWeek", Number(e.target.value) || 0)
                }
                className={inputCls}
              />
            </Field>
            <Field label="preferred duration (min)">
              <input
                type="number"
                value={profile?.preferredDurationMin ?? 0}
                onChange={(e) =>
                  update(
                    "preferredDurationMin",
                    Number(e.target.value) || 0,
                  )
                }
                className={inputCls}
              />
            </Field>
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            Tip: ask Kim in health mode (⌘K) to refine equipment, limitations,
            and workout preferences — easier than typing them here.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}

const inputCls =
  "w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:border-primary";

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-3">
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block mb-3">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
