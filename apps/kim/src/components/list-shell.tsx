"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  backHref?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

/**
 * Shared shell for list pages (routines, meal plans, gym sessions).
 * Slim header + compact toolbar + scrollable content. Designed so all three
 * list pages share identical structure and feel.
 */
export function ListShell({ title, subtitle, backHref, toolbar, children }: Props) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="shrink-0 border-b">
        <div className="px-4 pt-4 pb-2 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground mb-1"
              >
                <ChevronLeft size={11} /> back
              </Link>
            )}
            <h1 className="text-xl font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </div>
        </div>
        {toolbar && (
          <div className="flex items-center gap-2 px-4 py-2 border-t">
            {toolbar}
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/**
 * Dense list container — matches routines row spacing.
 */
export function ListRows({ children }: { children: ReactNode }) {
  return <div className="px-2 py-1.5">{children}</div>;
}
