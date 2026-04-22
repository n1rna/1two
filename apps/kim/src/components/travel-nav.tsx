"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPinned, PanelLeft, PanelLeftClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

interface NavItem {
  href: string;
  labelKey: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  match?: (path: string) => boolean;
}

const PRIMARY_ITEMS: NavItem[] = [
  {
    href: routes.travel,
    labelKey: "nav_trips",
    icon: MapPinned,
    match: (p) => p === routes.travel || /^\/travel\/[^/]+$/.test(p),
  },
];

type NavMode = "compact" | "extended";

function isActive(item: NavItem, pathname: string): boolean {
  if (item.match) return item.match(pathname);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

export function TravelNav() {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const pathname = usePathname();

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
        "shrink-0 border-r border-border bg-sidebar flex flex-col py-4 transition-[width] duration-200",
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
        {PRIMARY_ITEMS.map((item) => (
          <NavButton key={item.href} item={item} pathname={pathname} extended={isExtended} t={t} />
        ))}
      </div>

      <div className="flex-1" />
    </nav>
  );
}

function NavButton({
  item,
  pathname,
  extended,
  t,
}: {
  item: NavItem;
  pathname: string;
  extended: boolean;
  t: (k: string) => string;
}) {
  const Icon = item.icon;
  const label = t(item.labelKey);
  const active = isActive(item, pathname);

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
        <span className="truncate">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={item.href}
      title={label}
      className={cn(
        "group relative h-10 w-10 rounded-md flex items-center justify-center transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon size={18} />
    </Link>
  );
}
