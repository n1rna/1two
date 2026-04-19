"use client";

import { cn } from "@/lib/utils";

export interface SmartDividerProps {
  className?: string;
}

/**
 * Full-bleed 1px horizontal rule used inside a <SmartBody> to separate
 * groups of content. Uses negative horizontal margins to extend past the
 * body's padding so the line touches the card edges.
 */
export function SmartDivider({ className }: SmartDividerProps) {
  return (
    <hr
      className={cn("-mx-5 h-px border-0 bg-border", className)}
      aria-hidden
    />
  );
}
