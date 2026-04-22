"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plane, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

/**
 * Two-way pill switcher that toggles the shell between the Life and Travel
 * modes. The active mode is inferred from the pathname; the other mode's
 * link jumps to its default landing page.
 */
export function ModeSwitcher() {
  const { t } = useTranslation("common");
  const pathname = usePathname();
  const isTravel = pathname === "/travel" || pathname.startsWith("/travel/");

  return (
    <div
      role="tablist"
      aria-label={t("mode_switcher_aria")}
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-muted/50 p-0.5"
    >
      <Tab href={routes.today} active={!isTravel} icon={<Sun size={13} />} label={t("mode_life")} />
      <Tab href={routes.travel} active={isTravel} icon={<Plane size={13} />} label={t("mode_travel")} />
    </div>
  );
}

function Tab({
  href,
  active,
  icon,
  label,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      role="tab"
      aria-selected={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}
