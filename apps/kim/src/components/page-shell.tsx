"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useContainerWidth } from "@/hooks/use-container-width";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export interface PageMenuAction {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  variant?: "default" | "destructive";
  /** Renders a separator line before this item. */
  separator?: boolean;
}

interface Props {
  title: string;
  subtitle?: string;
  /** Inline action buttons shown when there is enough horizontal space. */
  actions?: ReactNode;
  /**
   * Overflow menu items — shown inside a three-dot dropdown when the header
   * is too narrow to display `actions` inline. When omitted the inline
   * actions wrap normally instead of collapsing.
   */
  menuActions?: PageMenuAction[];
  backHref?: string;
  /** Label shown next to the back chevron. Defaults to "Back". */
  backLabel?: string;
  children: ReactNode;
}

/** Width threshold below which inline actions collapse into the overflow menu. */
const COLLAPSE_WIDTH = 540;

export function PageShell({
  title,
  subtitle,
  actions,
  menuActions,
  backHref,
  backLabel,
  children,
}: Props) {
  const { t } = useTranslation("common");
  const resolvedBackLabel = backLabel ?? t("back");
  const { ref: headerRef, width: headerWidth } = useContainerWidth<HTMLElement>();
  const collapsed = menuActions && menuActions.length > 0 && headerWidth < COLLAPSE_WIDTH;

  return (
    <div className="flex flex-col h-full">
      <header
        ref={headerRef}
        className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border px-4 py-3 sm:px-8 sm:py-5 flex items-end justify-between gap-x-4 gap-y-2 max-h-[40vh] overflow-y-auto"
      >
        <div className="min-w-0 flex-1">
          {backHref && (
            <Link
              href={backHref}
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-1.5"
            >
              <ChevronLeft size={12} /> {resolvedBackLabel}
            </Link>
          )}
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-1 truncate">{subtitle}</p>
          )}
        </div>

        {/* Inline actions — visually hidden (but still mounted for portaled dialogs) when collapsed */}
        {actions && (
          <div className={collapsed ? "hidden" : "flex items-center gap-2 flex-wrap shrink-0"}>{actions}</div>
        )}

        {/* Overflow three-dot menu — visible when collapsed */}
        {collapsed && <OverflowMenu items={menuActions} />}
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6">{children}</div>
    </div>
  );
}

function OverflowMenu({ items }: { items: PageMenuAction[] }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="shrink-0 h-8 w-8 rounded-md flex items-center justify-center border border-border bg-background hover:bg-muted transition-colors"
          aria-label="More actions"
        >
          <MoreHorizontal size={16} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        {items.map((item, i) => (
          <span key={i}>
            {item.separator && i > 0 && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onClick={item.onClick}
              className={item.variant === "destructive" ? "text-destructive focus:text-destructive" : undefined}
            >
              {item.icon && <span className="shrink-0">{item.icon}</span>}
              {item.label}
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
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
