"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { MealItem } from "@/lib/health";

/** Single change proposed by Kim's `propose_meal_edits` tool. */
export interface MealEditProposal {
  selectionId: string;
  /** Resolved meal from the current plan (the "before" side). */
  before: MealItem;
  /** Partial patch Kim wants to apply. */
  patch: Partial<MealItem>;
  /** Optional human-readable reason for this change. */
  reason?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary?: string;
  proposals: MealEditProposal[];
  onApply: (accepted: MealEditProposal[]) => Promise<void>;
}

/**
 * Preview of Kim's proposed meal edits. The user can tick/untick individual
 * changes, then apply only the accepted ones.
 */
export function MealEditsPreviewDialog({
  open,
  onOpenChange,
  summary,
  proposals,
  onApply,
}: Props) {
  const [accepted, setAccepted] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(proposals.map((p) => [p.selectionId, true])),
  );
  const [applying, setApplying] = useState(false);

  // Re-seed acceptance when proposals change (new batch from Kim).
  useMemo(() => {
    setAccepted(
      Object.fromEntries(proposals.map((p) => [p.selectionId, true])),
    );
  }, [proposals]);

  const acceptedCount = Object.values(accepted).filter(Boolean).length;

  const apply = async () => {
    const list = proposals.filter((p) => accepted[p.selectionId]);
    if (list.length === 0) return;
    setApplying(true);
    try {
      await onApply(list);
      onOpenChange(false);
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Kim proposes {proposals.length} change
            {proposals.length === 1 ? "" : "s"}
          </DialogTitle>
          {summary && <DialogDescription>{summary}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3">
          {proposals.map((p) => {
            const after = { ...p.before, ...p.patch };
            const isAccepted = !!accepted[p.selectionId];
            return (
              <div
                key={p.selectionId}
                className={
                  "rounded-lg border px-3 py-3 transition-colors " +
                  (isAccepted
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-muted/10 opacity-60")
                }
              >
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAccepted}
                    onChange={(e) =>
                      setAccepted((cur) => ({
                        ...cur,
                        [p.selectionId]: e.target.checked,
                      }))
                    }
                    className="mt-1 h-3.5 w-3.5 shrink-0 accent-primary"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    {p.reason && (
                      <p className="text-xs text-muted-foreground">
                        {p.reason}
                      </p>
                    )}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 text-sm">
                      <MealSnapshot meal={p.before} muted />
                      <ArrowRight className="h-4 w-4 text-muted-foreground mt-6" />
                      <MealSnapshot meal={after} patch={p.patch} />
                    </div>
                  </div>
                </label>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-xs text-muted-foreground">
            {acceptedCount} of {proposals.length} accepted
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={applying}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={apply}
              disabled={applying || acceptedCount === 0}
              className="gap-1.5"
            >
              {applying && <Loader2 className="h-3 w-3 animate-spin" />}
              {applying ? "Applying…" : `Apply ${acceptedCount}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MealSnapshot({
  meal,
  muted,
  patch,
}: {
  meal: MealItem;
  muted?: boolean;
  patch?: Partial<MealItem>;
}) {
  const changed = (k: keyof MealItem) =>
    patch !== undefined && Object.prototype.hasOwnProperty.call(patch, k);
  return (
    <div
      className={
        "min-w-0 rounded-md border bg-background px-2.5 py-2 " +
        (muted ? "border-border/40" : "border-border")
      }
    >
      <div
        className={
          "text-sm font-medium leading-snug line-clamp-2 " +
          (changed("name") ? "text-foreground" : "")
        }
      >
        {meal.name}
      </div>
      {meal.description && (
        <div className="mt-0.5 text-[11px] text-muted-foreground line-clamp-2 leading-snug">
          {meal.description}
        </div>
      )}
      <div className="mt-1.5 flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground tabular-nums">
        <Stat label="kcal" value={meal.calories} highlight={changed("calories")} />
        <Stat label="P" value={meal.protein_g ?? 0} highlight={changed("protein_g")} />
        <Stat label="C" value={meal.carbs_g ?? 0} highlight={changed("carbs_g")} />
        <Stat label="F" value={meal.fat_g ?? 0} highlight={changed("fat_g")} />
        {meal.fiber_g != null && (
          <Stat label="fib" value={meal.fiber_g} highlight={changed("fiber_g")} />
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <span
      className={
        "inline-flex items-baseline gap-0.5 " +
        (highlight ? "text-primary font-semibold" : "")
      }
    >
      <span>{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}
