"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Brain,
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  FileText,
  Info,
  LayoutDashboard,
  ListChecks,
  MapPinned,
  PanelLeft,
  PanelLeftClose,
  Route,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { useTripContext } from "@/hooks/use-trip-context";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: (path: string) => boolean;
}

const BASE_ITEMS: NavItem[] = [
  {
    href: routes.travel,
    labelKey: "nav_trips",
    icon: MapPinned,
    // Trips is active on the list and any trip-context page — but not on the
    // sibling leaf routes /travel/actionables and /travel/memories, which
    // own their own nav items.
    match: (p) =>
      p === routes.travel ||
      (p.startsWith("/travel/") &&
        p !== routes.travelActionables &&
        p !== routes.travelMemories &&
        !p.startsWith(routes.travelActionables + "/") &&
        !p.startsWith(routes.travelMemories + "/")),
  },
  { href: routes.travelActionables, labelKey: "nav_actionables", icon: CheckSquare },
  { href: routes.travelMemories, labelKey: "nav_memories", icon: Brain },
];

const TRIP_SECTIONS: {
  labelKey: string;
  items: {
    labelKey: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    route: (tripId: string) => string;
    match?: (p: string, tripId: string) => boolean;
  }[];
}[] = [
  {
    labelKey: "nav_section_plan",
    items: [
      {
        labelKey: "nav_overview",
        icon: LayoutDashboard,
        route: routes.trip,
        match: (p, id) => p === `/travel/${id}`,
      },
      { labelKey: "nav_day_by_day", icon: FileText, route: routes.tripDay },
      { labelKey: "nav_route", icon: Route, route: routes.tripRoute },
      { labelKey: "nav_calendar", icon: CalendarDays, route: routes.tripCalendar },
    ],
  },
  {
    labelKey: "nav_section_logistics",
    items: [
      { labelKey: "nav_reservations", icon: ListChecks, route: routes.tripReservations },
    ],
  },
  {
    labelKey: "nav_section_intel",
    items: [
      { labelKey: "nav_tips", icon: Info, route: routes.tripTips },
      { labelKey: "nav_budget", icon: Banknote, route: routes.tripBudget },
    ],
  },
];

type NavMode = "compact" | "extended";

function baseIsActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function TravelNav() {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const pathname = usePathname();
  const { tripId, trip } = useTripContext();

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

  const isExtended = mode === "extended";

  return (
    <nav
      className={cn(
        "shrink-0 border-r border-border bg-sidebar flex flex-col py-4 transition-[width] duration-200 overflow-y-auto",
        isExtended ? "w-52 items-stretch px-3" : "w-14 items-center",
      )}
    >
      <div
        className={cn(
          "mb-3 flex",
          isExtended ? "justify-end pr-1" : "justify-center",
        )}
      >
        <button
          onClick={toggleMode}
          title={isExtended ? tCommon("nav_collapse_sidebar") : tCommon("nav_expand_sidebar")}
          className="rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors h-7 w-7 flex items-center justify-center"
        >
          {isExtended ? <PanelLeftClose size={14} /> : <PanelLeft size={14} />}
        </button>
      </div>

      <div className={cn("flex flex-col gap-1", isExtended ? "items-stretch" : "items-center")}>
        {BASE_ITEMS.map((item) => (
          <NavButton
            key={item.href}
            href={item.href}
            label={t(item.labelKey)}
            icon={item.icon}
            active={baseIsActive(item, pathname)}
            extended={isExtended}
          />
        ))}
      </div>

      {tripId && (
        <div className="mt-4 flex flex-col gap-2">
          {isExtended && (
            <div className="px-1.5 mt-1 border-t border-border pt-3">
              <div className="travel-accent text-[9px] font-mono uppercase tracking-[0.18em]">
                ● {t("status_planning").toUpperCase()}
              </div>
              <div
                className="mt-1 text-[13px] font-medium truncate"
                title={trip?.title ?? ""}
              >
                {trip?.title ?? "…"}
              </div>
            </div>
          )}
          {!isExtended && (
            <div className="mx-auto h-px w-8 bg-border" aria-hidden />
          )}
          {TRIP_SECTIONS.map((section) => (
            <TripSection
              key={section.labelKey}
              labelKey={section.labelKey}
              items={section.items}
              tripId={tripId}
              pathname={pathname}
              extended={isExtended}
              t={t}
            />
          ))}
          {isExtended && (
            <Link
              href={routes.travel}
              className="mx-1.5 mt-1 inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft size={11} /> {t("back_to_trips")}
            </Link>
          )}
        </div>
      )}

      <div className="flex-1" />
    </nav>
  );
}

function TripSection({
  labelKey,
  items,
  tripId,
  pathname,
  extended,
  t,
}: {
  labelKey: string;
  items: {
    labelKey: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
    route: (tripId: string) => string;
    match?: (p: string, tripId: string) => boolean;
  }[];
  tripId: string;
  pathname: string;
  extended: boolean;
  t: (k: string) => string;
}) {
  return (
    <div className={cn("flex flex-col", extended ? "items-stretch" : "items-center")}>
      {extended && (
        <div className="px-1.5 pt-2 pb-1 text-[9px] font-mono uppercase tracking-[0.18em] text-muted-foreground/60">
          {t(labelKey)}
        </div>
      )}
      <div className={cn("flex flex-col gap-1", extended ? "items-stretch" : "items-center")}>
        {items.map((item) => {
          const href = item.route(tripId);
          const active = item.match
            ? item.match(pathname, tripId)
            : pathname === href || pathname.startsWith(href + "/");
          return (
            <NavButton
              key={href}
              href={href}
              label={t(item.labelKey)}
              icon={item.icon}
              active={active}
              extended={extended}
              travelAccent
            />
          );
        })}
      </div>
    </div>
  );
}

function NavButton({
  href,
  label,
  icon: Icon,
  active,
  extended,
  travelAccent,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  active: boolean;
  extended: boolean;
  travelAccent?: boolean;
}) {
  if (extended) {
    return (
      <Link
        href={href}
        className={cn(
          "group flex items-center gap-3 px-3 py-1.5 rounded-md text-[13px] transition-colors",
          active
            ? travelAccent
              ? "travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border"
              : "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <Icon size={14} />
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "group relative h-9 w-9 rounded-md flex items-center justify-center transition-colors",
        active
          ? travelAccent
            ? "travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border"
            : "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={16} />
    </Link>
  );
}
