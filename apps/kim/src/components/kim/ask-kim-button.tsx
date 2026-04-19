"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { useKim } from "./kim-provider";
import type { SelectableKind } from "./types";

export type KimSelectionKind = SelectableKind;

export interface AskKimButtonProps {
  /** Kind of item being attached to Kim's context. */
  kind: KimSelectionKind;
  /** Stable identifier for this item (used to de-dupe selections). */
  id: string;
  /** Human-readable title shown in the context chip. */
  title: string;
  /** Optional secondary label (currently unused for context chips but kept
   *  for future metadata). */
  subtitle?: string;
  /** Full item snapshot — surfaced to the agent as JSON context. */
  snapshot: unknown;
  /** Render style: text pill ("button") or circular icon-only ("icon-button"). */
  variant?: "button" | "icon-button";
  /** Additional class names. */
  className?: string;
  /** Optional title attribute override. */
  title_?: string;
}

/**
 * "Ask Kim" CTA for item surfaces (meal rows, routine cards, actionables,
 * health metrics, etc.). On click, attaches the item as context to Kim's
 * selection state and opens the drawer so the user can immediately ask a
 * follow-up question about that exact item.
 *
 * Two variants:
 *   - `button`      : small text pill, inline with a row's trailing actions
 *   - `icon-button` : 28px circle with just the sparkles icon
 */
export function AskKimButton({
  kind,
  id,
  title,
  subtitle,
  snapshot,
  variant = "button",
  className,
  title_,
}: AskKimButtonProps) {
  const { t } = useTranslation("common");
  const { addSelection, setOpen } = useKim();
  const label = t("ask_kim");

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addSelection({
      kind,
      id,
      label: title,
      snapshot:
        snapshot && typeof snapshot === "object"
          ? (snapshot as Record<string, unknown>)
          : ({ value: snapshot, subtitle } as Record<string, unknown>),
    });
    setOpen(true);
  };

  if (variant === "icon-button") {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title_ ?? label}
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center h-7 w-7 rounded-full",
          "bg-background text-muted-foreground border border-border",
          "hover:text-primary hover:border-primary/40 hover:bg-primary/5",
          "transition-colors",
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={title_ ?? label}
      className={cn(
        "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md",
        "border border-border bg-background text-xs text-muted-foreground",
        "hover:text-primary hover:border-primary/40 hover:bg-primary/5",
        "transition-colors",
        className,
      )}
    >
      <Sparkles className="h-3 w-3" strokeWidth={1.75} />
      <span>{label}</span>
    </button>
  );
}
