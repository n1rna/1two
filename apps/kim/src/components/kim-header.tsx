"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

/**
 * Minimal header for the Kim subdomain. Replaces the main 1tt.dev header
 * when rendered on `kim.1tt.dev`. Just the wordmark, a subtle back-link,
 * and the theme toggle — nothing that competes with the Kim agent or the
 * life nav rail below it.
 */
export function KimHeader() {
  return (
    <header
      className="shrink-0 h-12 border-b border-border bg-background/80 backdrop-blur z-30"
    >
      <div className="h-full px-4 flex items-center gap-4">
        <Link
          href="/today"
          className="flex items-baseline gap-1.5 group"
          aria-label="Kim home"
        >
          <span
            className="italic text-2xl leading-none text-[color:var(--primary)] group-hover:opacity-80 transition-opacity"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            kim
          </span>
          <span className="text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
            agent
          </span>
        </Link>

        <div className="flex-1" />

        <a
          href="https://1tt.dev"
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          target="_blank"
          rel="noreferrer"
        >
          1tt.dev
          <ArrowUpRight className="h-3 w-3" />
        </a>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
