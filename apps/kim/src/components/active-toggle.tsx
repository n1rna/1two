"use client";

import { cn } from "@/lib/utils";

interface Props {
  active: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  /** Accessible label — also used for the title tooltip. */
  label?: string;
  /** Prevents parent onClick handlers (e.g. row navigation) from firing. */
  stopPropagation?: boolean;
  className?: string;
}

/**
 * Pill toggle used across routines, meal plans, and gym sessions to
 * enable/disable a resource. Matches the existing routines pattern.
 */
export function ActiveToggle({
  active,
  onChange,
  disabled,
  label,
  stopPropagation = true,
  className,
}: Props) {
  const title = label ?? (active ? "Disable" : "Enable");
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      aria-label={title}
      title={title}
      disabled={disabled}
      onClick={(e) => {
        if (stopPropagation) e.stopPropagation();
        if (disabled) return;
        onChange(!active);
      }}
      className={cn(
        "relative shrink-0 disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      )}
    >
      <div
        className={cn(
          "h-5 w-9 rounded-full transition-colors",
          active ? "bg-primary" : "bg-muted-foreground/25",
        )}
      />
      <div
        className={cn(
          "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
          active ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}
