import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PublicUserMenu } from "@/components/layout/public-user-menu";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="flex items-baseline gap-2 leading-none group"
            aria-label="kim home"
          >
            <span
              className="italic text-2xl text-foreground"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              kim
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground/80 transition-colors">
              marketplace
            </span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            <Link
              href="/marketplace"
              className="hover:text-foreground transition-colors"
            >
              Browse
            </Link>
            <a
              href="https://1tt.dev"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
            >
              1tt.dev
              <ArrowUpRight className="h-3 w-3" />
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <PublicUserMenu />
        </div>
      </header>

      <main className="flex-1 min-w-0">{children}</main>

      <footer className="mt-16 border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground">
          <span>© kim1.ai · a 1tt.dev project</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">
              home
            </Link>
            <Link
              href="/marketplace"
              className="hover:text-foreground transition-colors"
            >
              marketplace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
