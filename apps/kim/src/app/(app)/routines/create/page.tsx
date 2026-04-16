"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  Dumbbell,
  Phone,
  Sun,
  Target,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import {
  useKim,
  useKimForm,
  AskKimButton,
  AskKimEyebrow,
  KimPromptChip,
} from "@/components/kim";
import {
  RoutineForm,
  type RoutineFormHandle,
  type RoutineFormState,
  applyRoutineDraft,
  emptyRoutineForm,
  routineFormToPayload,
} from "@/components/routines/routine-form";
import { createLifeRoutine } from "@/lib/life";
import { useTranslation } from "react-i18next";

const EXAMPLE_PROMPTS: { icon: React.ReactNode; label: string; prompt: string }[] = [
  {
    icon: <Dumbbell className="h-3.5 w-3.5" />,
    label: "Morning gym 4× a week",
    prompt:
      "Draft a routine for morning gym four days a week (Mon/Tue/Thu/Fri) at 7am. Upper/lower split.",
  },
  {
    icon: <Phone className="h-3.5 w-3.5" />,
    label: "Call family every Sunday",
    prompt:
      "Draft a routine to call my parents every Sunday evening around 6pm.",
  },
  {
    icon: <BookOpen className="h-3.5 w-3.5" />,
    label: "Daily 30-min reading",
    prompt:
      "Draft a daily reading routine at 9pm, 30 minutes before bed. Start with a queued reading list.",
  },
  {
    icon: <Sun className="h-3.5 w-3.5" />,
    label: "Morning routine",
    prompt:
      "Draft a morning routine starting at 6:30am every weekday: stretching, journaling, and a short walk.",
  },
  {
    icon: <Target className="h-3.5 w-3.5" />,
    label: "Weekly review",
    prompt:
      "Draft a weekly review routine every Sunday at 8pm to reflect on goals and plan the week ahead.",
  },
];

export default function RoutineCreatePage() {
  const { t } = useTranslation("routines");
  const router = useRouter();
  const { askKim, setOpen } = useKim();
  const [form, setForm] = useState<RoutineFormState>(emptyRoutineForm);
  const [saving, setSaving] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const formRef = useRef<RoutineFormHandle>(null);
  const manualRef = useRef<HTMLDivElement>(null);

  const handleDraft = useCallback((draft: Record<string, unknown>) => {
    setForm((cur) => applyRoutineDraft(cur, draft));
    setManualOpen(true);
    formRef.current?.flash();
    // Scroll to the form after it flashes so the user can review.
    requestAnimationFrame(() => {
      manualRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  useKimForm(
    "routine",
    "New routine (draft)",
    form as unknown as Record<string, unknown>,
    handleDraft,
  );

  const submit = async () => {
    setSaving(true);
    try {
      const created = await createLifeRoutine(routineFormToPayload(form));
      router.push(routes.routine(created.id));
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <PageShell
      title={t("create_title")}
      subtitle={t("create_subtitle")}
      backHref={routes.routines}
    >
      <div className="max-w-2xl space-y-6">
        {/* Hero — agent-first */}
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
            <AskKimButton onClick={() => setOpen(true)} />
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
          <span>{t("or_fill_yourself", { ns: "common" })}</span>
          <div className="flex-1 border-t border-border/60" />
        </div>

        {/* Manual form — collapsed by default */}
        <div ref={manualRef}>
          <button
            onClick={() => setManualOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <div className="text-left">
              <div className="text-sm font-medium">{t("create_manual_form")}</div>
              <div className="text-xs text-muted-foreground">
                {manualOpen
                  ? t("create_manual_open_hint")
                  : t("create_manual_closed_hint")}
              </div>
            </div>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${manualOpen ? "rotate-180" : ""}`}
            />
          </button>

          {manualOpen && (
            <div className="mt-4">
              <RoutineForm
                ref={formRef}
                value={form}
                onChange={setForm}
                onSubmit={submit}
                onCancel={() => router.push(routes.routines)}
                saving={saving}
                submitLabel={t("create_submit_label")}
              />
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
