import Image from "next/image";
import Link from "next/link";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PublicUserMenu } from "@/components/layout/public-user-menu";
import { routes } from "@/lib/routes";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 flex items-center justify-between px-5 sm:px-8 h-14 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <Link
          href={routes.home}
          className="flex items-center gap-2.5 group"
          aria-label="kim home"
        >
          <Image
            src="/logo.svg"
            alt="kim"
            width={32}
            height={32}
            priority
            className="rounded-full group-hover:opacity-85 transition-opacity"
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground group-hover:text-foreground/80 transition-colors">
            marketplace
          </span>
        </Link>
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
            <Link href={routes.home} className="hover:text-foreground transition-colors">
              home
            </Link>
            <Link
              href={routes.marketplace()}
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
