"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  backHref?: string;
  /** Label shown next to the back chevron. Defaults to "Back". */
  backLabel?: string;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  actions,
  backHref,
  backLabel = "Back",
  children,
}: Props) {
  return (
    <div className="flex flex-col h-full">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border px-8 py-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1.5"
            >
              <ChevronLeft size={12} /> {backLabel}
            </Link>
          )}
          <h1 className="text-2xl font-semibold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="py-16 text-center">
      <div className="text-base font-medium text-muted-foreground">{title}</div>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border bg-card p-5 shadow-xs ${className}`}
    >
      {children}
    </div>
  );
}
