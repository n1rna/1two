"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { listLifeActionables } from "@/lib/life";
import {
  Brain,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  Heart,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  PanelLeftClose,
  Radio,
  Repeat,
  Settings,
  Store,
  Sun,
  Utensils,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: (path: string) => boolean;
  /** Optional badge key used to look up a numeric count from the nav state. */
  badgeKey?: "actionables";
}

const PRIMARY_ITEMS: NavItem[] = [
  {
    href: routes.today,
    label: "Today",
    icon: Sun,
    match: (p) => p === routes.today,
  },
  { href: routes.actionables, label: "Inbox", icon: CheckSquare, badgeKey: "actionables" },
];

const SECONDARY_ITEMS: NavItem[] = [
  { href: routes.calendar, label: "Calendar", icon: CalendarDays },
  {
    href: routes.health,
    label: "Health",
    icon: Heart,
    match: (p) =>
      p === routes.health ||
      p === routes.healthWeight ||
      p === routes.healthProfile,
  },
  { href: routes.routines, label: "Routines", icon: Repeat },
  { href: routes.meals, label: "Meals", icon: Utensils },
  { href: routes.sessions, label: "Gym", icon: Dumbbell },
  { href: routes.memories, label: "Memories", icon: Brain },
  { href: routes.channels, label: "Channels", icon: Radio },
];

const BOTTOM_ITEMS: NavItem[] = [
  { href: routes.marketplace(), label: "Market", icon: Store },
  { href: routes.settings, label: "Settings", icon: Settings },
  { href: routes.chat, label: "Conversations", icon: MessageSquare },
];

type NavMode = "compact" | "extended";

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function LifeNav() {
  const pathname = usePathname();

  // Pending actionable count for the Inbox badge. Refetched on pathname
  // change (so it updates after the user resolves/dismisses items) and on
  // a 60s interval as a fallback for Kim-generated actionables.
  const [pendingActionables, setPendingActionables] = useState(0);
  const refreshBadges = useCallback(async () => {
    try {
      const list = await listLifeActionables("pending");
      setPendingActionables(list.length);
    } catch {
      /* non-fatal — badge simply won't update */
    }
  }, []);
  useEffect(() => {
    void refreshBadges();
  }, [refreshBadges, pathname]);
  useEffect(() => {
    const id = setInterval(() => void refreshBadges(), 60_000);
    return () => clearInterval(id);
  }, [refreshBadges]);

  const badgeCounts = { actionables: pendingActionables } as const;

  const [mode, setMode] = useState<NavMode>("compact");
  useEffect(() => {
    const saved = localStorage.getItem("life-nav-mode");
    if (saved === "extended" || saved === "compact") setMode(saved);
  }, []);
  useEffect(() => {
    localStorage.setItem("life-nav-mode", mode);
  }, [mode]);
  const toggleMode = () =>
    setMode((m) => (m === "compact" ? "extended" : "compact"));

  const currentIsSecondary = SECONDARY_ITEMS.some((item) =>
    isActive(item, pathname),
  );
  const [expanded, setExpanded] = useState(currentIsSecondary);

  const isExtended = mode === "extended";

  // Hidden during first-run onboarding to keep the user focused on the flow.
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return null;
  }

  return (
    <nav
      className={cn(
        "shrink-0 border-r border-border bg-sidebar flex flex-col py-4 transition-[width] duration-200",
        isExtended ? "w-52 items-stretch px-3" : "w-14 items-center",
      )}
    >
      {/* Mode toggle */}
      <div
        className={cn(
          "mb-3 flex",
          isExtended ? "justify-end pr-1" : "justify-center",
        )}
      >
        <button
          onClick={toggleMode}
          title={isExtended ? "Collapse sidebar" : "Expand sidebar"}
          className="rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors h-7 w-7 flex items-center justify-center"
        >
          {isExtended ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
      </div>

      {/* Primary */}
      <div className={cn("flex flex-col gap-1", isExtended ? "items-stretch" : "items-center")}>
        {PRIMARY_ITEMS.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            pathname={pathname}
            extended={isExtended}
            badgeCounts={badgeCounts}
          />
        ))}
      </div>

      {/* More toggle */}
      <button
        onClick={() => setExpanded((e) => !e)}
        className={cn(
          "mt-1 rounded-md transition-colors text-muted-foreground hover:bg-muted hover:text-foreground",
          isExtended
            ? "w-full flex items-center gap-3 px-3 py-2 text-xs"
            : "h-10 w-10 flex items-center justify-center",
        )}
        title={expanded ? "Show less" : "Show more"}
        aria-expanded={expanded}
      >
        <MoreHorizontal size={isExtended ? 16 : 18} />
        {isExtended && (
          <span className="text-sm">{expanded ? "Less" : "More"}</span>
        )}
      </button>

      {/* Secondary */}
      {expanded && (
        <div
          className={cn(
            "flex flex-col gap-1 mt-1",
            isExtended ? "items-stretch" : "items-center",
          )}
        >
          {SECONDARY_ITEMS.map((item) => (
            <NavButton
              key={item.href}
              item={item}
              pathname={pathname}
              extended={isExtended}
              badgeCounts={badgeCounts}
            />
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* Bottom */}
      <div
        className={cn(
          "flex flex-col gap-1",
          isExtended ? "items-stretch" : "items-center",
        )}
      >
        {BOTTOM_ITEMS.map((item) => (
          <NavButton
            key={item.href}
            item={item}
            pathname={pathname}
            extended={isExtended}
            badgeCounts={badgeCounts}
          />
        ))}
      </div>
    </nav>
  );
}

function NavButton({
  item,
  pathname,
  extended,
  badgeCounts,
}: {
  item: NavItem;
  pathname: string;
  extended: boolean;
  badgeCounts: Record<"actionables", number>;
}) {
  const Icon = item.icon;
  const active = isActive(item, pathname);
  const badge = item.badgeKey ? badgeCounts[item.badgeKey] : 0;
  const showBadge = badge > 0;
  const badgeLabel = badge > 99 ? "99+" : String(badge);

  if (extended) {
    return (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon size={16} />
        <span className="truncate">{item.label}</span>
        {showBadge && (
          <span
            className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums"
            aria-label={`${badge} pending`}
          >
            {badgeLabel}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={showBadge ? `${item.label} (${badge})` : item.label}
      className={cn(
        "group relative h-10 w-10 rounded-md flex items-center justify-center transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={18} />
      {showBadge && (
        <span
          className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold tabular-nums ring-2 ring-sidebar"
          aria-label={`${badge} pending`}
        >
          {badgeLabel}
        </span>
      )}
    </Link>
  );
}
