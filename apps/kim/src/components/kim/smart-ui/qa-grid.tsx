"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface QaGridProps {
  children?: ReactNode;
  className?: string;
}

/**
 * Two-column quick-action grid used inside Smart-UI cards to offer a
 * bounded menu of agent follow-ups. Uses a 6px gap (tailwind `gap-1.5`).
 */
export function QaGrid({ children, className }: QaGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-1.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface QaBtnProps {
  label: string;
  sub?: string;
  icon: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  /**
   * Visual variant. `destructive` uses a subtle rose tint so delete-style
   * actions read as slightly dangerous without screaming.
   */
  variant?: "default" | "destructive";
  className?: string;
}

/**
 * Single cell in a <QaGrid>. Card-coloured button with an icon tile, a
 * label, and an optional `sub` caption. Hovering tints the background and
 * pulls in a primary-coloured border.
 */
export function QaBtn({
  label,
  sub,
  icon,
  onClick,
  disabled,
  variant = "default",
  className,
}: QaBtnProps) {
  const destructive = variant === "destructive";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex items-start gap-2.5 text-left rounded-md border bg-card px-[11px] py-[9px]",
        "transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        destructive
          ? "border-border hover:bg-destructive/5 hover:border-destructive/40"
          : "border-border hover:bg-muted hover:border-primary/40",
        className,
      )}
    >
      <span
        className={cn(
          "shrink-0 flex items-center justify-center h-6 w-6 rounded-[5px]",
          destructive
            ? "bg-destructive/10 text-destructive"
            : "bg-muted text-primary group-hover:bg-primary/10",
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-medium text-foreground leading-tight">
          {label}
        </span>
        {sub && (
          <span className="block text-[11px] text-muted-foreground mt-0.5 leading-tight">
            {sub}
          </span>
        )}
      </span>
    </button>
  );
}
