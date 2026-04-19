"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KimSelection, SelectableKind } from "./types";

export interface CtxChipProps {
  selection: KimSelection;
  onRemove?: () => void;
  /**
   * Optional click handler for the chip body (the × button is excluded via
   * stopPropagation). When provided, the chip body becomes a <button> with a
   * subtle hover affordance. Used by the composer ctx-chip row so clicking a
   * supporting chip promotes it to primary. (QBL-114)
   */
  onClick?: () => void;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Kind → colour mapping for the leading dot. Reuses existing kim theme
 * tokens so no new palette entries are introduced.
 *
 * meal → green, exercise → orange, event → blue, task → purple,
 * metric → cyan, actionable → amber, routine → pink, memory → gray.
 */
const KIND_COLORS: Record<SelectableKind, string> = {
  "meal-plan": "rgb(124 196 150)",   // green
  "meal-item": "rgb(124 196 150)",   // green
  exercise: "rgb(232 152 92)",       // orange
  event: "rgb(120 172 232)",         // blue
  task: "rgb(176 140 220)",          // purple
  metric: "rgb(124 196 212)",        // cyan
  actionable: "var(--kim-amber)",    // amber (existing token)
  routine: "rgb(232 152 188)",       // pink
  memory: "rgb(168 168 168)",        // gray
  session: "rgb(232 152 92)",        // orange (sessions group with exercise)
  "diet-profile": "rgb(124 196 150)",// green (diet groups with meals)
  "gym-profile": "rgb(232 152 92)",  // orange (gym groups with exercise)
};

/**
 * Compact context chip rendered above the kim composer. Shows a kind-coloured
 * dot + `{kind} · {label}` pill with optional × remove. Truncation handled
 * via `min-width: 0` + `text-overflow: ellipsis` on the inner label span.
 */
export function CtxChip({
  selection,
  onRemove,
  onClick,
  size = "sm",
  className,
}: CtxChipProps) {
  const color = KIND_COLORS[selection.kind];
  const padY = size === "md" ? "py-1" : "py-[3px]";
  const textSize = size === "md" ? "text-[11px]" : "text-[10px]";

  const inner = (
    <>
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
        style={{ background: color }}
      />
      <span
        className="kim-mono uppercase tracking-[0.14em] shrink-0"
        style={{ color: "var(--kim-ink-faint)" }}
      >
        {selection.kind}
      </span>
      <span
        className="opacity-50 shrink-0"
        style={{ color: "var(--kim-ink-faint)" }}
      >
        ·
      </span>
      <span
        className="truncate min-w-0"
        style={{
          color: "var(--kim-ink)",
          textOverflow: "ellipsis",
        }}
      >
        {selection.label}
      </span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="shrink-0 -mr-0.5 ml-0.5 opacity-50 hover:opacity-100 transition-opacity"
          aria-label="Remove"
        >
          <X size={10} />
        </button>
      )}
    </>
  );

  const baseClass = cn(
    "inline-flex items-center gap-1.5 px-2 rounded-full max-w-full",
    "whitespace-nowrap",
    padY,
    textSize,
    onClick && "cursor-pointer hover:bg-[var(--kim-teal-soft)] transition-colors",
    className,
  );

  const baseStyle: React.CSSProperties = {
    background: "var(--kim-bg-sunken)",
    border: "1px solid var(--kim-border)",
    color: "var(--kim-ink-dim)",
  };

  if (onClick) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
        className={baseClass}
        style={baseStyle}
        title={`${selection.kind} · ${selection.label}`}
      >
        {inner}
      </div>
    );
  }

  return (
    <span
      className={baseClass}
      style={baseStyle}
      title={`${selection.kind} · ${selection.label}`}
    >
      {inner}
    </span>
  );
}
