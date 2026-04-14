"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Plus,
  RefreshCw,
  Store,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListShell, ListRows } from "@/components/list-shell";
import { ActiveToggle } from "@/components/active-toggle";
import { SelectCheckbox } from "@/components/kim";
import {
  listMealPlans,
  deleteMealPlan,
  updateMealPlan,
  type HealthMealPlan,
} from "@/lib/health";

const DIET_COLORS: Record<string, string> = {
  omnivore: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  vegetarian: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  vegan: "bg-green-500/15 text-green-600 dark:text-green-400",
  pescatarian: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
  keto: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  paleo: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
};

function dietColor(dietType?: string): string {
  return DIET_COLORS[dietType ?? ""] ?? "bg-muted text-muted-foreground";
}

export default function MealPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<HealthMealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPlans(await listMealPlans());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm("Delete this meal plan?")) return;
    await deleteMealPlan(id);
    setPlans((cur) => cur.filter((p) => p.id !== id));
  }

  async function setActive(id: string, active: boolean) {
    const updated = await updateMealPlan(id, { active });
    setPlans((cur) => cur.map((p) => (p.id === id ? updated : p)));
  }

  return (
    <ListShell
      title="Meal plans"
      subtitle={
        plans.length > 0
          ? `${plans.length} total`
          : "Ask Kim to generate new plans, or fork a community template"
      }
      toolbar={
        <>
          <button
            onClick={load}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <div className="flex-1" />
          <Link
            href="/marketplace?kind=meal_plan"
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            title="Browse meal plan templates"
          >
            <Store className="h-3.5 w-3.5" />
            Browse Templates
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => router.push("/health/meals/create")}
          >
            <Plus className="h-3.5 w-3.5" />
            New Plan
          </Button>
        </>
      }
    >
      <div>
        {error && (
          <div className="flex items-center gap-2 mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={load} className="ml-auto text-xs underline">
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="px-3 py-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && plans.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <UtensilsCrossed className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                No meal plans yet
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Create one from scratch, let Kim generate one, or fork a
                community template.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => router.push("/health/meals/create")}
              >
                <Plus className="h-3.5 w-3.5" />
                New Plan
              </Button>
              <Link
                href="/marketplace?kind=meal_plan"
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                Browse Templates
              </Link>
            </div>
          </div>
        )}

        {!loading && plans.length > 0 && (
          <ListRows>
            {plans.map((p) => (
              <MealPlanRow
                key={p.id}
                plan={p}
                onOpen={() => router.push(`/health/meals/${p.id}`)}
                onToggleActive={(next) => setActive(p.id, next)}
                onDelete={() => remove(p.id)}
              />
            ))}
          </ListRows>
        )}
      </div>
    </ListShell>
  );
}

function MealPlanRow({
  plan,
  onOpen,
  onToggleActive,
  onDelete,
}: {
  plan: HealthMealPlan;
  onOpen: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}) {
  const mealCount = plan.content?.meals?.length ?? 0;
  const color = dietColor(plan.dietType);
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
        !plan.active && "opacity-60",
      )}
      onClick={onOpen}
    >
      <SelectCheckbox
        kind="meal-plan"
        id={plan.id}
        label={plan.title}
        snapshot={{
          title: plan.title,
          planType: plan.planType,
          dietType: plan.dietType,
          targetCalories: plan.targetCalories,
          active: plan.active,
          mealCount,
        }}
      />

      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          color,
        )}
      >
        <UtensilsCrossed className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {plan.title}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {plan.planType || "plan"}
          {plan.dietType ? ` · ${plan.dietType}` : ""}
          {plan.targetCalories ? ` · ${plan.targetCalories} kcal` : ""}
          {` · ${mealCount} meal${mealCount === 1 ? "" : "s"}`}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ActiveToggle
          active={plan.active}
          onChange={onToggleActive}
          label={plan.active ? "Disable meal plan" : "Enable meal plan"}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
