"use client";

import Link from "next/link";
import { GitFork, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MarketplaceItem } from "@/lib/marketplace";
import { KIND_LABELS, KIND_COLORS } from "@/lib/marketplace";

export function MarketplaceCard({ item }: { item: MarketplaceItem }) {
  return (
    <Link
      href={`/m/${item.slug}`}
      className="group flex flex-col gap-3 rounded-xl border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0",
            KIND_COLORS[item.kind]
          )}
        >
          {KIND_LABELS[item.kind]}
        </span>
        <div className="flex items-center gap-2.5 text-muted-foreground shrink-0">
          <span className="flex items-center gap-1 text-xs">
            <GitFork className="h-3 w-3" />
            {item.fork_count}
          </span>
          {item.view_count > 0 && (
            <span className="flex items-center gap-1 text-xs">
              <Eye className="h-3 w-3" />
              {item.view_count}
            </span>
          )}
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="text-sm font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-1">
          {item.title}
        </h3>
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
          {item.description}
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 mt-auto">
        <span className="text-[11px] text-muted-foreground/70 truncate">
          {item.author.name}
        </span>
        {item.tags.length > 0 && (
          <div className="flex items-center gap-1 shrink-0 flex-wrap justify-end">
            {item.tags.slice(0, 3).map((tag) => (
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
    </Link>
  );
}
