"use client";

import { useCallback, type ReactNode } from "react";
import { useKim } from "./kim-provider";
import type { KimSelection, SelectableKind } from "./types";

interface SelectableProps {
  kind: SelectableKind;
  id: string;
  label: string;
  snapshot?: Record<string, unknown>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

/**
 * Wraps an item so that ⌘/Ctrl/Shift-click adds it to Kim's context.
 * Plain click passes through to whatever the child does (link navigation,
 * etc.) — use `<SelectCheckbox>` for an explicit visible toggle.
 */
export function Selectable({
  kind,
  id,
  label,
  snapshot,
  children,
  className,
  disabled,
}: SelectableProps) {
  const { isSelected, toggleSelection, addSelection, setOpen } = useKim();
  const selected = isSelected(kind, id);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      if (!(e.metaKey || e.ctrlKey || e.shiftKey)) return;
      e.preventDefault();
      e.stopPropagation();
      const sel: KimSelection = { kind, id, label, snapshot };
      if (selected) {
        toggleSelection(sel);
      } else {
        addSelection(sel);
        setOpen(true);
      }
    },
    [disabled, kind, id, label, snapshot, selected, toggleSelection, addSelection, setOpen],
  );

  return (
    <div
      data-selectable
      data-selected={selected ? "true" : "false"}
      data-kind={kind}
      data-id={id}
      onClickCapture={onClick}
      className={className}
    >
      {children}
    </div>
  );
}
