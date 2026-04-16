"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
  GitFork,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  KIND_LABELS,
  unpublishMarketplaceItem,
  type MarketplaceItem,
  type MarketplaceKind,
} from "@/lib/marketplace";
import { PublishDialog } from "./PublishDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MarketplaceItem;
  /** The local source that drives this published item (routine/session/meal plan id). */
  sourceId: string;
  kind: MarketplaceKind;
  /** Called after a successful "publish new version". */
  onRepublished?: (updated: MarketplaceItem | null) => void;
  /** Called after a successful unpublish. */
  onUnpublished?: () => void;
}

export function PublishedStatsDialog({
  open,
  onOpenChange,
  item,
  sourceId,
  kind,
  onRepublished,
  onUnpublished,
}: Props) {
  const [republishOpen, setRepublishOpen] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmUnpublish, setConfirmUnpublish] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/m/${item.slug}`
      : `https://1tt.dev/m/${item.slug}`;

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const handleUnpublish = async () => {
    setUnpublishing(true);
    setError(null);
    try {
      await unpublishMarketplaceItem(item.id);
      onUnpublished?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to unpublish.");
    } finally {
      setUnpublishing(false);
    }
  };

  const versions = item.versions ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Published {KIND_LABELS[kind]}
            </DialogTitle>
            <DialogDescription>
              Currently live as <span className="font-mono">v{item.current_version}</span>.
              Manage the marketplace listing for this item.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              <StatCell
                icon={<Eye className="h-3.5 w-3.5" />}
                label="Views"
                value={item.view_count}
              />
              <StatCell
                icon={<GitFork className="h-3.5 w-3.5" />}
                label="Forks"
                value={item.fork_count}
              />
              <StatCell
                icon={<Upload className="h-3.5 w-3.5" />}
                label="Version"
                value={`v${item.current_version}`}
              />
            </div>

            {/* Public URL */}
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-muted-foreground">
                Public link
              </div>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <code className="flex-1 text-xs font-mono truncate">{publicUrl}</code>
                <button
                  type="button"
                  onClick={copyUrl}
                  className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                  title="Copy link"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <Link
                  href={publicUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
            </div>

            {/* Version history */}
            {versions.length > 0 && (
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-muted-foreground">
                  Version history
                </div>
                <div className="rounded-lg border bg-muted/10 divide-y max-h-40 overflow-y-auto">
                  {versions.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-start gap-3 px-3 py-2 text-xs"
                    >
                      <span
                        className={
                          "font-mono tabular-nums shrink-0 " +
                          (v.version === item.current_version
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground")
                        }
                      >
                        v{v.version}
                      </span>
                      <div className="min-w-0 flex-1">
                        {v.changelog ? (
                          <p className="leading-snug">{v.changelog}</p>
                        ) : (
                          <p className="leading-snug text-muted-foreground/60 italic">
                            No changelog
                          </p>
                        )}
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {error && <p className="text-xs text-destructive">{error}</p>}

            {/* Actions */}
            <div className="flex items-center justify-between gap-2 pt-1">
              {confirmUnpublish ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Sure?</span>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={handleUnpublish}
                    disabled={unpublishing}
                  >
                    {unpublishing ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Unpublish"
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setConfirmUnpublish(false)}
                    disabled={unpublishing}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => setConfirmUnpublish(true)}
                >
                  <Trash2 className="h-3 w-3" />
                  Unpublish
                </Button>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  onOpenChange(false);
                  setRepublishOpen(true);
                }}
              >
                <Upload className="h-3 w-3" />
                Publish new version
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PublishDialog
        open={republishOpen}
        onOpenChange={setRepublishOpen}
        kind={kind}
        sourceId={sourceId}
        existingItemId={item.id}
        onSuccess={() => onRepublished?.(null)}
      />
    </>
  );
}

function StatCell({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}
