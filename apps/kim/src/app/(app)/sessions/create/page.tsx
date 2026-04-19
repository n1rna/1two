"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Dumbbell,
  Flame,
  Heart,
  Target,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  useKim,
  useKimEffect,
  AskKimHeroButton,
  AskKimEyebrow,
  KimPromptChip,
} from "@/components/kim";
import { Button } from "@/components/ui/button";
import { createHealthSession } from "@/lib/health";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

const EXAMPLE_PROMPTS: { icon: React.ReactNode; label: string; prompt: string }[] = [
  {
    icon: <Dumbbell className="h-3.5 w-3.5" />,
    label: "Upper body strength",
    prompt:
      "Create an upper-body strength workout session: chest, back, shoulders. 6–8 compound exercises, ~60 minutes, intermediate level.",
  },
  {
    icon: <Target className="h-3.5 w-3.5" />,
    label: "Leg day",
    prompt:
      "Create a leg day session with squats, deadlifts, lunges and accessories. ~75 minutes, intermediate.",
  },
  {
    icon: <Heart className="h-3.5 w-3.5" />,
    label: "Full body HIIT",
    prompt:
      "Create a 45-minute full-body HIIT session for fat loss. Bodyweight + light dumbbells, 8 circuits.",
  },
  {
    icon: <Flame className="h-3.5 w-3.5" />,
    label: "Push / Pull split",
    prompt:
      "Create a push day session (chest, shoulders, triceps) with 8 exercises, ~70 minutes, advanced.",
  },
  {
    icon: <Zap className="h-3.5 w-3.5" />,
    label: "Quick core finisher",
    prompt:
      "Create a short 20-minute core session — 6 exercises, bodyweight only, beginner-friendly.",
  },
];

export default function SessionCreatePage() {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const { askKim, setOpen } = useKim();
  const [manualOpen, setManualOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState("intermediate");
  const [duration, setDuration] = useState("60");
  const [saving, setSaving] = useState(false);

  // Kim calls create_session → navigate to the new session.
  const onCreated = useCallback(
    (data: Record<string, unknown>) => {
      const id = typeof data.id === "string" ? data.id : null;
      if (id) router.push(routes.session(id));
    },
    [router],
  );
  useKimEffect("create_session", onCreated);

  const submitManual = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const session = await createHealthSession({
        title: title.trim(),
        difficultyLevel: difficulty,
        estimatedDuration: duration ? Number(duration) : null,
      });
      router.push(routes.session(session.id));
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <PageShell
      title={t("create_title")}
      subtitle={t("create_subtitle")}
      backHref={routes.sessions}
    >
      <div className="max-w-2xl space-y-6">
        {/* Hero */}
        <section className="rounded-xl border border-border bg-card px-7 py-8 shadow-xs">
          <AskKimEyebrow />
          <h2
            className="text-3xl leading-[1.1] italic max-w-xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {t("create_hero_heading")}
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-lg leading-relaxed">
            {t("create_hero_body")}
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((ex) => (
              <KimPromptChip
                key={ex.label}
                icon={ex.icon}
                label={ex.label}
                onClick={() => askKim(ex.prompt)}
              />
            ))}
          </div>

          <div className="mt-6 flex items-center gap-3">
            <AskKimHeroButton onClick={() => setOpen(true)} />
            <span
              className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground"
              style={{ fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
            >
              {t("or_press_cmd_k", { ns: "common" })}
            </span>
          </div>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex-1 border-t border-border/60" />
          <span>{t("create_divider_or")}</span>
          <div className="flex-1 border-t border-border/60" />
        </div>

        {/* Manual empty-session creation */}
        <div>
          <button
            onClick={() => setManualOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <div className="text-left">
              <div className="text-sm font-medium">{t("create_empty_session_title")}</div>
              <div className="text-xs text-muted-foreground">
                {t("create_empty_session_hint")}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`}
            />
          </button>

          {manualOpen && (
            <div className="mt-4 rounded-xl border bg-card p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t("create_field_title")}
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={t("create_title_placeholder")}
                  className="w-full rounded-md border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("create_field_difficulty")}
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="beginner">beginner</option>
                    <option value="intermediate">intermediate</option>
                    <option value="advanced">advanced</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                    {t("create_field_duration")}
                  </label>
                  <input
                    type="number"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(routes.sessions)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitManual}
                  disabled={!title.trim() || saving}
                >
                  {saving ? t("creating", { ns: "common" }) : t("create_submit")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
