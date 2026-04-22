"use client";

import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";
import { ModeSwitcher } from "@/components/mode-switcher";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

/**
 * Minimal header for the authenticated kim shell. Logo on the left,
 * theme toggle + user menu on the right. Nothing else — the life nav rail
 * sits directly underneath and the kim drawer lives on the right edge.
 */
export function KimHeader() {
  const { t } = useTranslation("common");
  return (
    <header className="shrink-0 h-12 border-b border-border bg-background/80 backdrop-blur z-30">
      <div className="h-full px-4 flex items-center gap-4">
        <Link
          href={routes.today}
          className="flex items-center gap-2.5 group"
          aria-label={t("kim_home_aria")}
        >
          <Image
            src="/logo.svg"
            alt={t("kim_alt")}
            width={28}
            height={28}
            priority
            className="rounded-full group-hover:opacity-85 transition-opacity"
          />
        </Link>

        <ModeSwitcher />

        <div className="flex-1" />

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
