"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GitFork, Loader2, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSession, signIn } from "@/lib/auth-client";
import {
  forkMarketplaceItem,
  type MarketplaceItem,
  KIND_LABELS,
  KIND_COLORS,
  kindRoute,
} from "@/lib/marketplace";
import { PublicItemView } from "./PublicItemView";
import { SignInDialog } from "@/components/layout/sign-in-dialog";

export function PublicMarketplacePage({ item }: { item: MarketplaceItem }) {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  // Auto-fork after sign-in redirect with ?fork=1
  useEffect(() => {
    if (session && !isPending && searchParams.get("fork") === "1") {
      handleFork();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isPending]);

  const handleFork = async () => {
    if (!session) {
      const next = encodeURIComponent(`/m/${item.slug}?fork=1`);
      router.push(`/login?redirect=${next}`);
      return;
    }
    setForking(true);
    setForkError(null);
    try {
      const result = await forkMarketplaceItem(item.id);
      router.push(kindRoute(result.kind, result.source_id));
    } catch (e) {
      setForkError(e instanceof Error ? e.message : "Fork failed.");
    } finally {
      setForking(false);
    }
  };

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  KIND_COLORS[item.kind]
                )}
              >
                {KIND_LABELS[item.kind]}
              </span>
              <span className="text-xs text-muted-foreground">
                by {item.author.name}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
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

          <div className="flex flex-col gap-2 shrink-0 sm:items-end">
            <Button
              size="default"
              className="gap-2"
              onClick={handleFork}
              disabled={forking || isPending}
            >
              {forking || isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GitFork className="h-4 w-4" />
              )}
              {session ? "Add to my Life" : "Sign in to fork"}
            </Button>

            <div className="flex items-center gap-3 text-xs text-muted-foreground">
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

            {forkError && (
              <p className="text-xs text-destructive">{forkError}</p>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground border-b pb-4">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Published{" "}
            {new Date(item.published_at).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </span>
          <span>v{item.current_version}</span>
          <Link
            href="/marketplace"
            className="ml-auto hover:text-foreground transition-colors"
          >
            Browse marketplace
          </Link>
        </div>

        {/* Content */}
        <div className="rounded-xl border p-5">
          <PublicItemView item={item} />
        </div>

        {/* Bottom CTA */}
        <div className="rounded-xl border bg-muted/20 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">Want to use this template?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Fork it to your Life tool and customise it.
            </p>
          </div>
          <Button
            className="gap-2 shrink-0"
            onClick={handleFork}
            disabled={forking || isPending}
          >
            {forking || isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitFork className="h-4 w-4" />
            )}
            {session ? "Add to my Life" : "Sign in to fork"}
          </Button>
        </div>
      </div>

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />
    </>
  );
}
