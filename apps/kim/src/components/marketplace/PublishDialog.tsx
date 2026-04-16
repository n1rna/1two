"use client";

import { useState, useEffect } from "react";
import { Loader2, Copy, Check, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  publishToMarketplace,
  publishNewVersion,
  type MarketplaceKind,
  KIND_LABELS,
} from "@/lib/marketplace";

export interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: MarketplaceKind;
  sourceId: string;
  defaultTitle?: string;
  /** If set, shows republish mode (publish new version) */
  existingItemId?: string;
  onSuccess?: () => void;
}

export function PublishDialog({
  open,
  onOpenChange,
  kind,
  sourceId,
  defaultTitle = "",
  existingItemId,
  onSuccess,
}: PublishDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [changelog, setChangelog] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isRepublish = !!existingItemId;

  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setTitle(defaultTitle);
        setDescription("");
        setTagsRaw("");
        setChangelog("");
        setError(null);
        setPublishedSlug(null);
        setCopied(false);
      }, 200);
    }
  }, [open, defaultTitle]);

  const handleSubmit = async () => {
    if (!isRepublish && (!title.trim() || !description.trim())) return;
    setSaving(true);
    setError(null);
    try {
      if (isRepublish) {
        await publishNewVersion(existingItemId!, changelog || undefined);
        onSuccess?.();
        onOpenChange(false);
      } else {
        const tags = tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean);
        const item = await publishToMarketplace({
          kind,
          source_id: sourceId,
          title: title.trim(),
          description: description.trim(),
          tags,
          changelog: changelog || undefined,
        });
        setPublishedSlug(item.slug);
        onSuccess?.();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish.");
    } finally {
      setSaving(false);
    }
  };

  const publicUrl =
    publishedSlug
      ? (typeof window !== "undefined"
          ? `${window.location.origin}/m/${publishedSlug}`
          : `https://1tt.dev/m/${publishedSlug}`)
      : "";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isRepublish
              ? "Publish New Version"
              : `Publish ${KIND_LABELS[kind]} to Marketplace`}
          </DialogTitle>
          <DialogDescription>
            {isRepublish
              ? "Snapshot the current state as a new version."
              : "Share this template publicly with a link."}
          </DialogDescription>
        </DialogHeader>

        {publishedSlug ? (
          <div className="space-y-4 pt-1">
            <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-500/15 shrink-0 mt-0.5">
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Published!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your template is now live on the marketplace.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <code className="flex-1 text-xs font-mono truncate">{publicUrl}</code>
              <button
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
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {!isRepublish && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Title <span className="font-normal opacity-60">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Morning Power Routine"
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Description <span className="font-normal opacity-60">*</span>
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this template does and who it's for..."
                    rows={3}
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50 resize-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    Tags{" "}
                    <span className="font-normal opacity-60">(comma-separated)</span>
                  </label>
                  <input
                    type="text"
                    value={tagsRaw}
                    onChange={(e) => setTagsRaw(e.target.value)}
                    placeholder="strength, beginner, 5-day"
                    className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Changelog{" "}
                <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input
                type="text"
                value={changelog}
                onChange={(e) => setChangelog(e.target.value)}
                placeholder="What changed in this version?"
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <DialogFooter className="pt-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSubmit}
                disabled={
                  saving ||
                  (!isRepublish && (!title.trim() || !description.trim()))
                }
              >
                {saving ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Publishing...
                  </>
                ) : isRepublish ? (
                  "Publish Version"
                ) : (
                  "Publish"
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
