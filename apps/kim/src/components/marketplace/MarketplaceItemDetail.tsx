"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, GitFork, Loader2, ExternalLink, Clock, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  forkMarketplaceItem,
  type MarketplaceItem,
  KIND_LABELS,
  KIND_COLORS,
  kindRoute,
} from "@/lib/marketplace";
import { PublicItemView } from "./PublicItemView";

export function MarketplaceItemDetail({ item }: { item: MarketplaceItem }) {
  const router = useRouter();
  const [selectedVersion, setSelectedVersion] = useState<number | undefined>(undefined);
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);

  const versions = item.versions ?? [];

  const handleFork = async () => {
    setForking(true);
    setForkError(null);
    try {
      const result = await forkMarketplaceItem(item.id, selectedVersion);
      router.push(kindRoute(result.kind, result.source_id));
    } catch (e) {
      setForkError(e instanceof Error ? e.message : "Fork failed.");
    } finally {
      setForking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Marketplace
        </Link>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main content */}
        <div className="flex-1 min-w-0 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  KIND_COLORS[item.kind]
                )}
              >
                {KIND_LABELS[item.kind]}
              </span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            {item.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
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

          <div className="rounded-xl border p-5 space-y-4">
            <PublicItemView item={item} />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="lg:w-72 shrink-0 space-y-4">
          <div className="rounded-xl border p-4 space-y-4">
            {/* Author */}
            <div className="space-y-0.5">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                Author
              </p>
              <p className="text-sm font-medium">{item.author.name}</p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitFork className="h-3 w-3" />
                {item.fork_count} forks
              </span>
              {item.view_count > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {item.view_count} views
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
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 opacity-0" />
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
            </div>

            {/* Version picker */}
            {versions.length > 1 && (
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">
                  Version
                </label>
                <select
                  value={selectedVersion ?? item.current_version}
                  onChange={(e) => setSelectedVersion(Number(e.target.value))}
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
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
              disabled={forking}
            >
              {forking ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitFork className="h-3.5 w-3.5" />
              )}
              Fork to my Life
            </Button>

            {forkError && (
              <p className="text-xs text-destructive">{forkError}</p>
            )}

            {/* Public link */}
            <a
              href={`/m/${item.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              View public page
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
