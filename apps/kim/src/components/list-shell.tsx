"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation("common");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="shrink-0 sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border max-h-[40vh] overflow-y-auto">
        <div className="px-4 pt-3 pb-3 sm:px-8 sm:pt-5 sm:pb-4 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {backHref && (
              <Link
                href={backHref}
                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1.5"
              >
                <ChevronLeft size={12} /> {t("back")}
              </Link>
            )}
            <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {toolbar && (
          <div className="flex items-center gap-2 px-4 py-2 sm:px-8 sm:py-2.5 border-t border-border flex-wrap">
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
