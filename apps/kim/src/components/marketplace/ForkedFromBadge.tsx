"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GitFork } from "lucide-react";
import { getMarketplaceItem } from "@/lib/marketplace";
import { routes } from "@/lib/routes";

export function ForkedFromBadge({ mpId }: { mpId: string }) {
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);

  useEffect(() => {
    getMarketplaceItem(mpId)
      .then((item) => {
        setSlug(item.slug);
        setTitle(item.title);
        setAuthor(item.author.name);
      })
      .catch(() => {});
  }, [mpId]);

  if (!slug) return null;

  return (
    <Link
      href={routes.marketplaceItem(slug)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
    >
      <GitFork className="h-3 w-3" />
      Forked from{" "}
      <span className="font-medium">{author}</span>
      {title && <span className="opacity-60">/ {title}</span>}
    </Link>
  );
}
