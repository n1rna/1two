"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Loader2,
  Trash2,
  RefreshCw,
  GitFork,
  ExternalLink,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  listMyMarketplaceItems,
  unpublishMarketplaceItem,
  publishNewVersion,
  type MarketplaceItem,
  KIND_LABELS,
  KIND_COLORS,
} from "@/lib/marketplace";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

export function MyMarketplaceItems() {
  const { t } = useTranslation("marketplace");
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [republishId, setRepublishId] = useState<string | null>(null);
  const [changelog, setChangelog] = useState("");
  const [republishing, setRepublishing] = useState(false);
  const [republishError, setRepublishError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMyMarketplaceItems();
      setItems(res.items ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await unpublishMarketplaceItem(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unpublish.");
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  const handleRepublish = async () => {
    if (!republishId) return;
    setRepublishing(true);
    setRepublishError(null);
    try {
      await publishNewVersion(republishId, changelog || undefined);
      setRepublishId(null);
      setChangelog("");
      load();
    } catch (e) {
      setRepublishError(e instanceof Error ? e.message : "Failed.");
    } finally {
      setRepublishing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
        <button onClick={load} className="ml-2 underline text-xs">
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
        <p className="text-sm font-medium text-muted-foreground">
          {t("mine_title")}
        </p>
        <p className="text-xs text-muted-foreground/60">
          <span dangerouslySetInnerHTML={{ __html: t("mine_hint") }} />
        </p>
        <Link href={routes.marketplace()}>
          <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1">
            {t("mine_browse")}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground">
          {t("mine_published_count", { count: items.length })}
        </span>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-xl border bg-card p-4 flex items-start justify-between gap-4"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    KIND_COLORS[item.kind]
                  )}
                >
                  {KIND_LABELS[item.kind]}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  v{item.current_version}
                </span>
              </div>
              <Link
                href={routes.marketplaceItem(item.slug)}
                className="text-sm font-semibold hover:text-primary transition-colors block truncate"
              >
                {item.title}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <GitFork className="h-3 w-3" />
                  {item.fork_count} forks
                </span>
                <a
                  href={routes.marketplaceItem(item.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  /m/{item.slug}
                </a>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  setRepublishId(item.id);
                  setChangelog("");
                  setRepublishError(null);
                }}
              >
                <Plus className="h-3 w-3" />
                {t("new_version", { ns: "common" })}
              </Button>
              <button
                onClick={() => setConfirmDeleteId(item.id)}
                disabled={deletingId === item.id}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                title="Unpublish"
              >
                {deletingId === item.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm unpublish */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("unpublish_dialog_title")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("unpublish_dialog_body")}
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
              disabled={!!deletingId}
            >
              {deletingId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                "Unpublish"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New version dialog */}
      <Dialog
        open={!!republishId}
        onOpenChange={() => {
          setRepublishId(null);
          setChangelog("");
          setRepublishError(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("new_version_dialog_title")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                {t("new_version_changelog_label")}{" "}
                <span className="font-normal opacity-60">{t("new_version_changelog_optional")}</span>
              </label>
              <input
                type="text"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder={t("new_version_changelog_placeholder")}
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>
            {republishError && (
              <p className="text-xs text-destructive">{republishError}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRepublishId(null)}
              disabled={republishing}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRepublish}
              disabled={republishing}
            >
              {republishing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                t("new_version_submit")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
