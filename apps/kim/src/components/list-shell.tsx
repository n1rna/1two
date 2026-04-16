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
      <header className="shrink-0 sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-8 pt-5 pb-4 flex items-start justify-between gap-4">
          <div className="min-w-0">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1.5"
              >
                <ChevronLeft size={12} /> back
              </Link>
            )}
            <h1 className="text-2xl font-semibold leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>
            )}
          </div>
        </div>
        {toolbar && (
          <div className="flex items-center gap-2 px-8 py-2.5 border-t border-border">
            {toolbar}
          </div>
        )}
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/**
 * Dense list container. Rows go flush edge-to-edge (no horizontal gutter)
 * so the list reads like a Gmail/Mailbox-style feed, while content-heavy
 * pages (health, channels, today) keep their own px-8 gutter.
 */
export function ListRows({ children }: { children: ReactNode }) {
  return <div className="px-3 py-2">{children}</div>;
}
