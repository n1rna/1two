"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Eye,
  GitFork,
  Loader2,
  LogIn,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";
import {
  forkMarketplaceItem,
  type MarketplaceItem,
  KIND_LABELS,
  KIND_COLORS,
} from "@/lib/marketplace";
import { marketplaceForkDestination, routes } from "@/lib/routes";
import { PublicItemView } from "./PublicItemView";

export function PublicMarketplacePage({ item }: { item: MarketplaceItem }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(
    undefined,
  );
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const versions = item.versions ?? [];
  const loggedIn = !!session;

  // Auto-fork after sign-in redirect with ?fork=1
  useEffect(() => {
    if (loggedIn && !isPending && searchParams.get("fork") === "1") {
      handleFork();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, isPending]);

  const handleFork = async () => {
    if (!loggedIn) {
      router.push(routes.login({ redirect: `${routes.marketplaceItem(item.slug)}?fork=1` }));
      return;
    }
    setForking(true);
    setForkError(null);
    try {
      const result = await forkMarketplaceItem(item.id, selectedVersion);
      router.push(marketplaceForkDestination(result.kind, result.source_id));
    } catch (e) {
      setForkError(e instanceof Error ? e.message : "Fork failed.");
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-5 sm:px-8 py-10">
      <div className="mb-6">
        <Link
          href={routes.marketplace()}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to marketplace
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  KIND_COLORS[item.kind],
                )}
              >
                {KIND_LABELS[item.kind]}
              </span>
              <span className="text-xs text-muted-foreground">
                by {item.author.name}
              </span>
            </div>
            <h1
              className="text-3xl md:text-4xl italic leading-tight tracking-tight"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              {item.title}
            </h1>
            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                {item.description}
              </p>
            )}
            {item.tags.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border/80 bg-card/40 p-5">
            <PublicItemView item={item} />
          </div>

          {/* Mobile fork CTA (sidebar is hidden on small screens) */}
          <div className="lg:hidden rounded-xl border border-border/80 bg-muted/20 p-5 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium">
                {loggedIn ? "Add this to your life" : "Fork this template"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {loggedIn
                  ? "Kim will create your own editable copy."
                  : "Sign in and kim will create your own editable copy."}
              </p>
            </div>
            <Button
              className="w-full gap-2"
              onClick={handleFork}
              disabled={forking || isPending}
            >
              {forking || isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : loggedIn ? (
                <GitFork className="h-4 w-4" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {loggedIn ? "Add to my Life" : "Sign in to fork"}
            </Button>
            {forkError && (
              <p className="text-xs text-destructive">{forkError}</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-72 shrink-0 hidden lg:block">
          <div className="sticky top-20 rounded-xl border border-border/80 bg-card/40 p-5 space-y-5">
            {/* Author */}
            <div className="space-y-0.5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-mono">
                Author
              </p>
              <p className="text-sm font-medium">{item.author.name}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                {item.fork_count} forks
              </span>
              {item.view_count > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {item.view_count}
                </span>
              )}
            </div>

            {/* Dates */}
            <div className="space-y-1 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3 w-3" />
                <span>
                  Published{" "}
                  {new Date(item.published_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
              {item.updated_at !== item.published_at && (
                <div className="flex items-center gap-1.5 pl-[18px]">
                  <span>
                    Updated{" "}
                    {new Date(item.updated_at).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 pl-[18px]">
                <span>v{item.current_version}</span>
              </div>
            </div>

            {/* Version picker (logged-in only — fork uses it) */}
            {loggedIn && versions.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-[10px] text-muted-foreground uppercase tracking-[0.16em] font-mono block">
                  Fork version
                </label>
                <select
                  value={selectedVersion ?? item.current_version}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                  className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  {versions.map((v) => (
                    <option key={v.id} value={v.version}>
                      v{v.version}
                      {v.changelog ? ` — ${v.changelog}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fork CTA */}
            <Button
              className="w-full gap-2"
              onClick={handleFork}
              disabled={forking || isPending}
            >
              {forking || isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : loggedIn ? (
                <GitFork className="h-3.5 w-3.5" />
              ) : (
                <LogIn className="h-3.5 w-3.5" />
              )}
              {loggedIn ? "Add to my Life" : "Sign in to fork"}
            </Button>

            {forkError && (
              <p className="text-xs text-destructive">{forkError}</p>
            )}

            {!loggedIn && (
              <p className="text-[11px] text-muted-foreground/80 leading-relaxed">
                Reading is free. Sign in to fork a template into your own
                kim-managed life.
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
