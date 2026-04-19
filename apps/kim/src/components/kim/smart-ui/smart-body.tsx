"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SmartBodyProps {
  children?: ReactNode;
  className?: string;
  /** Tailwind gap class. Default `gap-3`. */
  gap?: string;
}

/**
 * Padded body region for a <SmartCard>. Renders a vertical flex container
 * with a sensible default gap between children so consumers don't need
 * to handle spacing themselves.
 */
export function SmartBody({ children, className, gap = "gap-3" }: SmartBodyProps) {
  return (
    <div className={cn("flex flex-col px-5 py-4", gap, className)}>
      {children}
    </div>
  );
}
