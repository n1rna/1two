"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SmartHeadProps {
  /** Small uppercase kicker above the title. */
  kicker?: ReactNode;
  /** Primary title — displayed in the app's display style. */
  title: ReactNode;
  /** Optional secondary line under the title. */
  sub?: ReactNode;
  /** Right-aligned meta slot (e.g. a status chip, counter, or button). */
  meta?: ReactNode;
  /** Optional icon rendered as a 14x14 tile on the left. */
  icon?: ReactNode;
  className?: string;
}

/**
 * Head row for a <SmartCard>. Layout:
 *
 *   [icon]  kicker
 *           title (display font, wraps on long text)
 *           sub                                       meta
 */
export function SmartHead({
  kicker,
  title,
  sub,
  meta,
  icon,
  className,
}: SmartHeadProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-5 py-4 border-b border-border",
        className,
      )}
    >
      {icon && (
        <div
          className="mt-0.5 shrink-0 h-[14px] w-[14px] rounded-[4px] bg-accent/30 text-accent-foreground flex items-center justify-center"
          aria-hidden
        >
          {icon}
        </div>
      )}

      <div className="flex-1 min-w-0" style={{ wordBreak: "break-word" }}>
        {kicker && (
          <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-muted-foreground mb-0.5">
            {kicker}
          </div>
        )}
        <div
          className="text-base font-semibold tracking-tight text-foreground"
          style={{ fontFamily: "var(--font-display), Georgia, serif" }}
        >
          {title}
        </div>
        {sub && (
          <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
        )}
      </div>

      {meta && <div className="shrink-0 ml-auto text-right">{meta}</div>}
    </div>
  );
}
