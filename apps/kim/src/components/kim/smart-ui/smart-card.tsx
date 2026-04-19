"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SmartCardProps {
  /** Rendered at the top of the card (typically a <SmartHead>). */
  head?: ReactNode;
  /** Body content — typically wrapped in <SmartBody>. */
  children?: ReactNode;
  className?: string;
}

/**
 * Top-level chrome for a Smart-UI surface: card background, border,
 * rounded corners, subtle shadow, clipped overflow. Composes with
 * <SmartHead> and <SmartBody> via the `head` prop + children.
 */
export function SmartCard({ head, children, className }: SmartCardProps) {
  return (
    <div
      className={cn(
        "bg-card text-card-foreground border border-border rounded-xl shadow-sm overflow-hidden",
        className,
      )}
    >
      {head}
      {children}
    </div>
  );
}
