"use client";

import { useState } from "react";
import { Copy, Check, Loader2, Globe, Lock, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type PasteVisibility = "public" | "unlisted";

export interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  format: "text" | "markdown" | "json" | "code";
  defaultTitle?: string;
}

const PREVIEW_LINES = 6;

export function PublishDialog({
  open,
  onOpenChange,
  content,
  format,
  defaultTitle = "",
}: PublishDialogProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [visibility, setVisibility] = useState<PasteVisibility>("unlisted");
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const previewLines = content.split("\n").slice(0, PREVIEW_LINES);
  const hasMore = content.split("\n").length > PREVIEW_LINES;

  const handlePublish = async () => {
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/pastes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: title.trim() || undefined,
          format,
          content,
          visibility,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const paste = await res.json();
      setPublishedId(paste.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  const publishedUrl =
    typeof window !== "undefined" && publishedId
      ? `${window.location.origin}/p/${publishedId}`
      : publishedId
      ? `https://1two.dev/p/${publishedId}`
      : "";

  const copyUrl = async () => {
    await navigator.clipboard.writeText(publishedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleClose = () => {
    onOpenChange(false);
    // Reset after close animation
    setTimeout(() => {
      setTitle(defaultTitle);
      setVisibility("unlisted");
      setError(null);
      setPublishedId(null);
      setCopied(false);
    }, 200);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Publish as Paste</DialogTitle>
          <DialogDescription>
            Share this content as a paste with a short link.
          </DialogDescription>
        </DialogHeader>

        {publishedId ? (
          /* Success state */
          <div className="space-y-4 pt-2">
            <div className="flex items-start gap-3 rounded-lg border border-green-500/30 bg-green-500/5 p-4">
              <div className="flex items-center justify-center h-7 w-7 rounded-full bg-green-500/15 shrink-0 mt-0.5">
                <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Published!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your paste is live and shareable.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
              <code className="flex-1 text-xs font-mono truncate">{publishedUrl}</code>
              <button
                onClick={copyUrl}
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Copy URL"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
              <a
                href={publishedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Open paste"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <button
              onClick={handleClose}
              className="w-full px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Form state */
          <div className="space-y-4 pt-2">
            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Title{" "}
                <span className="font-normal opacity-60">(optional)</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled paste"
                className="w-full rounded-lg border bg-transparent px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
              />
            </div>

            {/* Visibility */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Visibility
              </label>
              <div className="flex gap-2">
                {(["unlisted", "public"] as PasteVisibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      visibility === v
                        ? "bg-foreground text-background border-transparent"
                        : "border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    {v === "public" ? (
                      <Globe className="h-3 w-3" />
                    ) : (
                      <Lock className="h-3 w-3" />
                    )}
                    {v === "public" ? "Public" : "Unlisted"}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground/70">
                {visibility === "public"
                  ? "Anyone can discover and view this paste."
                  : "Only people with the link can view this paste."}
              </p>
            </div>

            {/* Content preview */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Content preview
              </label>
              <pre className="rounded-lg border bg-muted/30 px-3 py-2.5 text-[11px] font-mono leading-relaxed overflow-hidden max-h-32 text-muted-foreground">
                {previewLines.join("\n")}
                {hasMore && "\n…"}
              </pre>
            </div>

            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 rounded-lg border text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handlePublish}
                disabled={publishing || !content.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {publishing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  "Publish"
                )}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
