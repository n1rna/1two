"use client";

import { useEffect, useMemo } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKim } from "./kim-provider";
import type { KimSelection, SelectableKind } from "./types";

/**
 * Adds an item to Kim's selection on mount and removes it on unmount.
 * Use on detail pages so the viewed item is always in the agent's context.
 *
 * The snapshot is stable-memoized by JSON identity — pass a fresh object
 * each render only if the underlying fields actually changed.
 */
export function useKimAutoContext(
  selection: KimSelection | null | undefined,
) {
  const { addSelection, removeSelection } = useKim();
  // Stringify the snapshot so the effect only re-fires when data actually
  // changes, not on every parent re-render.
  const key = selection
    ? `${selection.kind}:${selection.id}:${selection.label}:${JSON.stringify(selection.snapshot ?? {})}`
    : null;

  useEffect(() => {
    if (!selection) return;
    addSelection(selection);
    return () => removeSelection(selection.kind, selection.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

interface SelectCheckboxProps {
  kind: SelectableKind;
  id: string;
  label: string;
  snapshot?: Record<string, unknown>;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Visible checkbox button that toggles whether an item is in Kim's context.
 * Overlay it on a card — it calls stopPropagation so the card's link still
 * works for navigation.
 */
export function SelectCheckbox({
  kind,
  id,
  label,
  snapshot,
  className,
  size = "md",
}: SelectCheckboxProps) {
  const { isSelected, toggleSelection, setOpen } = useKim();
  const selected = isSelected(kind, id);
  const dims = size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]";

  const sel = useMemo<KimSelection>(
    () => ({ kind, id, label, snapshot }),
    [kind, id, label, snapshot],
  );

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSelection(sel);
        if (!selected) setOpen(true);
      }}
      title={selected ? "Remove from Kim context" : "Add to Kim context"}
      className={cn(
        "inline-flex items-center justify-center rounded-[4px] border transition-all",
        dims,
        selected
          ? "bg-[color:rgb(232_176_92_/_0.9)] border-[color:rgb(232_176_92)] text-black shadow-sm"
          : "bg-background/80 border-border text-transparent hover:border-[color:rgb(232_176_92_/_0.6)] hover:text-[color:rgb(232_176_92_/_0.4)]",
        className,
      )}
      aria-pressed={selected}
      aria-label={selected ? "Remove from Kim context" : "Add to Kim context"}
    >
      <Check className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={3} />
    </button>
  );
}
