"use client";

import { Sparkles, Utensils, Clock, Tag } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MealItem } from "@/lib/health";
import { useKim } from "@/components/kim";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meal: MealItem | null;
  /** Label shown on the left of the header (e.g. "Monday · Breakfast"). */
  context?: string;
  /** Stable id used when adding this meal to Kim's selection (plan:day:slot:index). */
  selectionId?: string;
}

export function MealDetailDialog({
  open,
  onOpenChange,
  meal,
  context,
  selectionId,
}: Props) {
  const { addSelection, setOpen: setKimOpen, setMode } = useKim();

  if (!meal) return null;

  const totalMacros =
    (meal.protein_g ?? 0) + (meal.carbs_g ?? 0) + (meal.fat_g ?? 0);
  const pPct = totalMacros > 0 ? ((meal.protein_g ?? 0) / totalMacros) * 100 : 0;
  const cPct = totalMacros > 0 ? ((meal.carbs_g ?? 0) / totalMacros) * 100 : 0;
  const fPct = totalMacros > 0 ? ((meal.fat_g ?? 0) / totalMacros) * 100 : 0;

  const askKimToEdit = () => {
    if (selectionId) {
      addSelection({
        kind: "meal-item",
        id: selectionId,
        label: meal.name,
        snapshot: meal as unknown as Record<string, unknown>,
      });
    }
    setMode("meals", true);
    setKimOpen(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          {context && (
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {context}
            </div>
          )}
          <DialogTitle className="text-lg">{meal.name}</DialogTitle>
          {meal.description && (
            <DialogDescription>{meal.description}</DialogDescription>
          )}
        </DialogHeader>

        {meal.photo_url && (
          <div className="-mx-6 -mt-2 mb-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={meal.photo_url}
              alt={meal.name}
              className="w-full max-h-48 object-cover"
            />
          </div>
        )}

        {/* Tags */}
        {meal.tags && meal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {meal.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground capitalize"
              >
                <Tag className="h-2.5 w-2.5" /> {t}
              </span>
            ))}
          </div>
        )}

        {/* Macro block */}
        <section className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <Stat label="Calories" value={meal.calories} suffix="kcal" emphasis />
            <Stat label="Protein" value={meal.protein_g ?? 0} suffix="g" color="text-sky-600 dark:text-sky-400" />
            <Stat label="Carbs" value={meal.carbs_g ?? 0} suffix="g" color="text-teal-600 dark:text-teal-400" />
            <Stat label="Fat" value={meal.fat_g ?? 0} suffix="g" color="text-rose-600 dark:text-rose-400" />
            <Stat label="Fiber" value={meal.fiber_g ?? 0} suffix="g" />
          </div>
          {totalMacros > 0 && (
            <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden flex">
              <div className="bg-sky-500" style={{ width: `${pPct}%` }} />
              <div className="bg-teal-500" style={{ width: `${cPct}%` }} />
              <div className="bg-rose-500" style={{ width: `${fPct}%` }} />
            </div>
          )}
        </section>

        {/* Ingredients */}
        <section>
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
            <Utensils className="h-3 w-3" /> Ingredients
          </div>
          {meal.ingredients && meal.ingredients.length > 0 ? (
            <ul className="divide-y divide-border rounded-md border bg-background">
              {meal.ingredients.map((ing, i) => (
                <li
                  key={`${ing.name}-${i}`}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                >
                  <span>{ing.name}</span>
                  {ing.quantity && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {ing.quantity}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              No ingredient list yet. Ask Kim to fill this in.
            </p>
          )}
        </section>

        {/* Prep notes */}
        {meal.prep_notes && (
          <section>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
              <Clock className="h-3 w-3" /> Preparation
            </div>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {meal.prep_notes}
            </p>
          </section>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button size="sm" className="gap-1.5" onClick={askKimToEdit}>
            <Sparkles className="h-3 w-3" /> Edit with Kim
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label,
  value,
  suffix,
  color,
  emphasis,
}: {
  label: string;
  value: number;
  suffix?: string;
  color?: string;
  emphasis?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        <span
          className={`tabular-nums ${
            emphasis ? "text-xl font-semibold" : "text-sm font-medium"
          } ${color ?? ""}`}
        >
          {value}
        </span>
        {suffix && (
          <span className="text-[10px] text-muted-foreground">{suffix}</span>
        )}
      </div>
    </div>
  );
}
