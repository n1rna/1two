"use client";

import { usePathname } from "next/navigation";
import { LifeNav } from "@/components/life-nav";
import { TravelNav } from "@/components/travel-nav";

/**
 * Resolves the active "mode" (life vs travel) from the current route and
 * renders the matching nav rail. The header, kim drawer, and auth wrappers
 * live in the parent layout — this component only owns the sidebar swap.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isTravel = pathname === "/travel" || pathname.startsWith("/travel/");
  return (
    <>
      {isTravel ? <TravelNav /> : <LifeNav />}
      <main className="flex-1 min-w-0 overflow-y-auto relative">{children}</main>
    </>
  );
}

export function currentMode(pathname: string): "life" | "travel" {
  return pathname === "/travel" || pathname.startsWith("/travel/")
    ? "travel"
    : "life";
}
