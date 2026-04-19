"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  className?: string;
  /** Optional aria label for the group. */
  label?: string;
}

/**
 * Compact numeric stepper used to tune agent parameters (reps, minutes,
 * portions, etc.) inside Smart-UI cards. Clicking −/+ nudges the value
 * by `step` while clamping to [min, max].
 */
export function Stepper({
  value,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  onChange,
  className,
  label,
}: StepperProps) {
  const dec = () => {
    const next = Math.max(min, value - step);
    if (next !== value) onChange(next);
  };
  const inc = () => {
    const next = Math.min(max, value + step);
    if (next !== value) onChange(next);
  };
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex items-stretch border border-border rounded-md bg-card overflow-hidden",
        className,
      )}
    >
      <button
        type="button"
        onClick={dec}
        disabled={value <= min}
        aria-label="Decrement"
        className="h-[26px] w-[26px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Minus className="h-3 w-3" strokeWidth={1.75} />
      </button>
      <span
        className="min-w-[32px] px-2 flex items-center justify-center font-mono text-[12px] text-foreground border-x border-border tabular-nums"
        aria-live="polite"
      >
        {value}
      </span>
      <button
        type="button"
        onClick={inc}
        disabled={value >= max}
        aria-label="Increment"
        className="h-[26px] w-[26px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Plus className="h-3 w-3" strokeWidth={1.75} />
      </button>
    </div>
  );
}
