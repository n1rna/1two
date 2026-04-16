"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Beef,
  ChevronDown,
  Leaf,
  Scale,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import { PageShell } from "@/components/page-shell";
import {
  useKim,
  useKimEffect,
  AskKimButton,
  AskKimEyebrow,
  KimPromptChip,
} from "@/components/kim";
import { Button } from "@/components/ui/button";
import { createMealPlan } from "@/lib/health";
import { routes } from "@/lib/routes";

const EXAMPLE_PROMPTS: { icon: React.ReactNode; label: string; prompt: string }[] = [
  {
    icon: <Beef className="h-3.5 w-3.5" />,
    label: "High-protein cut, 2000 kcal",
    prompt:
      "Generate a daily meal plan targeting 2000 kcal with high protein (180g) for a cut. Four meals: breakfast, lunch, snack, dinner.",
  },
  {
    icon: <Leaf className="h-3.5 w-3.5" />,
    label: "Vegetarian weekly plan",
    prompt:
      "Generate a weekly vegetarian meal plan (7 days) with breakfast, lunch, and dinner each day, matching my calorie target.",
  },
  {
    icon: <Zap className="h-3.5 w-3.5" />,
    label: "Quick 15-min meals",
    prompt:
      "Generate a daily meal plan where every meal can be prepared in under 15 minutes. Keep it simple and hitting my macros.",
  },
  {
    icon: <Scale className="h-3.5 w-3.5" />,
    label: "Cutting week (weekly)",
    prompt:
      "Generate a weekly meal plan for a cutting phase — high protein, moderate carbs, low fat — across 7 days.",
  },
  {
    icon: <UtensilsCrossed className="h-3.5 w-3.5" />,
    label: "Mediterranean maintenance",
    prompt:
      "Generate a weekly Mediterranean meal plan for maintenance with fish 3x a week and plenty of vegetables.",
  },
];

export default function MealPlanCreatePage() {
  const router = useRouter();
  const { askKim, setOpen } = useKim();
  const [manualOpen, setManualOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [planType, setPlanType] = useState("daily");
  const [saving, setSaving] = useState(false);

  // Kim calls generate_meal_plan → we navigate to the new plan.
  const onCreated = useCallback(
    (data: Record<string, unknown>) => {
      const id = typeof data.id === "string" ? data.id : null;
      if (id) router.push(routes.meal(id));
    },
    [router],
  );
  useKimEffect("generate_meal_plan", onCreated);

  const submitManual = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const plan = await createMealPlan({ title: title.trim(), planType });
      router.push(routes.meal(plan.id));
    } catch (e) {
      console.error(e);
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="New meal plan"
      subtitle="Describe what you want — Kim will generate a full plan from your profile"
      backHref={routes.meals}
    >
      <div className="max-w-2xl space-y-6">
        {/* Hero */}
        <section className="rounded-xl border border-border bg-card px-7 py-8 shadow-xs">
          <AskKimEyebrow />
          <h2
            className="text-3xl leading-[1.1] italic max-w-xl"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            Tell Kim your goal — she'll build the meal plan.
          </h2>
          <p className="text-sm text-muted-foreground mt-3 max-w-lg leading-relaxed">
            Kim reads your calorie target, macros, diet type, and
            restrictions, then generates a full plan you can tweak.
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
              or press ⌘K
            </span>
          </div>
        </section>

        {/* Divider */}
        <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <div className="flex-1 border-t border-border/60" />
          <span>or start from an empty plan</span>
          <div className="flex-1 border-t border-border/60" />
        </div>

        {/* Manual empty-plan creation */}
        <div>
          <button
            onClick={() => setManualOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <div className="text-left">
              <div className="text-sm font-medium">Empty meal plan</div>
              <div className="text-xs text-muted-foreground">
                Create a blank plan with a title, then populate it yourself or
                with Kim later
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
                  Title
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Weekly cut — week 1"
                  className="w-full rounded-md border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Plan type
                </label>
                <div className="flex gap-1.5">
                  {["daily", "weekly"].map((t) => (
                    <button
                      key={t}
                      onClick={() => setPlanType(t)}
                      className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors border ${planType === t ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-border hover:bg-muted/30"}`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push(routes.meals)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={submitManual}
                  disabled={!title.trim() || saving}
                >
                  {saving ? "Creating…" : "Create empty plan"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
