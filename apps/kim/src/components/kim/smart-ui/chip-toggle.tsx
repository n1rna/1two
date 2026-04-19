"use client";

import { cn } from "@/lib/utils";

export interface ChipToggleProps {
  label: string;
  on: boolean;
  onChange: (next: boolean) => void;
  /** `accent` swaps the "on" tint for the accent colour instead of primary. */
  kind?: "default" | "accent";
  disabled?: boolean;
  className?: string;
}

/**
 * Stateless pill toggle. Controlled — parent owns `on`. Styled as a small
 * mono-uppercase chip that tints when active. Useful inside Smart-UI cards
 * for boolean modifiers (e.g. "include warm-up", "vegan only").
 */
export function ChipToggle({
  label,
  on,
  onChange,
  kind = "default",
  disabled,
  className,
}: ChipToggleProps) {
  const accent = kind === "accent";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-[5px] font-mono text-[10px] uppercase tracking-[0.12em] transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        on
          ? accent
            ? "bg-accent/20 border-accent/50 text-accent-foreground"
            : "bg-primary/10 border-primary/50 text-primary"
          : "bg-background border-border text-muted-foreground hover:text-foreground hover:border-foreground/40",
        className,
      )}
    >
      {label}
    </button>
  );
}
