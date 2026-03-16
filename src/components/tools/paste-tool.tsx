"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardPaste,
  Copy,
  Check,
  Trash2,
  Loader2,
  LogIn,
  Plus,
  ExternalLink,
  Globe,
  Lock,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { SignInDialog } from "@/components/layout/sign-in-dialog";

type PasteFormat = "text" | "markdown" | "json" | "code";
type PasteVisibility = "public" | "unlisted";

interface Paste {
  id: string;
  title?: string;
  format: PasteFormat;
  content: string;
  visibility: PasteVisibility;
  size?: number;
  createdAt?: string;
  authorName?: string;
}

const FORMAT_OPTIONS: { value: PasteFormat; label: string; color: string }[] = [
  { value: "text", label: "Text", color: "bg-muted text-muted-foreground" },
  { value: "markdown", label: "Markdown", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { value: "json", label: "JSON", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400" },
  { value: "code", label: "Code", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400" },
];

function formatSize(bytes: number): string {
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  if (bytes >= 1e3) return `${(bytes / 1e3).toFixed(0)} KB`;
  return `${bytes} B`;
}

function FormatBadge({ format }: { format: PasteFormat }) {
  const opt = FORMAT_OPTIONS.find((f) => f.value === format) ?? FORMAT_OPTIONS[0];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${opt.color}`}>
      {opt.label}
    </span>
  );
}

function VisibilityBadge({ visibility }: { visibility: PasteVisibility }) {
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
      visibility === "public"
        ? "bg-green-500/10 text-green-700 dark:text-green-400"
        : "bg-muted text-muted-foreground"
    }`}>
      {visibility === "public" ? <Globe className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
      {visibility === "public" ? "Public" : "Unlisted"}
    </span>
  );
}

export function PasteTool() {
  const { data: session } = useSession();
  const [signInOpen, setSignInOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [format, setFormat] = useState<PasteFormat>("text");
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<PasteVisibility>("unlisted");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdPaste, setCreatedPaste] = useState<Paste | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // List state
  const [pastes, setPastes] = useState<Paste[]>([]);
  const [loadingPastes, setLoadingPastes] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchPastes = useCallback(async () => {
    if (!session) return;
    setLoadingPastes(true);
    try {
      const res = await fetch("/api/proxy/pastes", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setPastes(data.pastes ?? data ?? []);
      }
    } catch {
      // silently ignore
    } finally {
      setLoadingPastes(false);
    }
  }, [session]);

  useEffect(() => {
    fetchPastes();
  }, [fetchPastes]);

  const handleCreate = async () => {
    if (!content.trim()) return;
    setCreating(true);
    setCreateError(null);
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
      setCreatedPaste(paste);
      fetchPastes();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Failed to create paste");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await fetch(`/api/proxy/pastes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      setPastes((prev) => prev.filter((p) => p.id !== id));
      if (expandedId === id) setExpandedId(null);
    } catch {
      // silently ignore
    } finally {
      setDeletingId(null);
    }
  };

  const copyPasteUrl = async (id: string) => {
    await navigator.clipboard.writeText(`${window.location.origin}/p/${id}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyCreatedUrl = async () => {
    if (!createdPaste) return;
    await navigator.clipboard.writeText(`${window.location.origin}/p/${createdPaste.id}`);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 1500);
  };

  const resetForm = () => {
    setTitle("");
    setContent("");
    setFormat("text");
    setVisibility("unlisted");
    setCreatedPaste(null);
    setCreateError(null);
  };

  return (
    <div className="space-y-6">
      {/* Auth banner */}
      {!session && (
        <button
          onClick={() => setSignInOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-muted/50 hover:bg-accent/50 transition-colors text-left"
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 shrink-0">
            <LogIn className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Sign in to create pastes</p>
            <p className="text-xs text-muted-foreground">
              Create a free account to share text snippets with short links.
            </p>
          </div>
        </button>
      )}

      <SignInDialog open={signInOpen} onOpenChange={setSignInOpen} />

      {/* Create section */}
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          New Paste
        </h3>

        {createdPaste ? (
          /* Success state */
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-green-500/15 shrink-0 mt-0.5">
                <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">Paste created!</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your paste is live at the link below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
              <code className="flex-1 text-sm font-mono truncate text-foreground">
                {typeof window !== "undefined" ? window.location.origin : "https://1tt.dev"}/p/{createdPaste.id}
              </code>
              <button
                onClick={copyCreatedUrl}
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Copy URL"
              >
                {copiedUrl ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
              <a
                href={`/p/${createdPaste.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                title="Open paste"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            <button
              onClick={resetForm}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Create another paste
            </button>
          </div>
        ) : (
          /* Form */
          <div className="rounded-xl border bg-card p-4 space-y-4">
            {/* Title */}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled paste"
              disabled={!session}
              className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 disabled:opacity-40"
            />

            <div className="h-px bg-border" />

            {/* Format selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Format</span>
              <div className="flex gap-1 flex-wrap">
                {FORMAT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFormat(opt.value)}
                    disabled={!session}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                      format === opt.value
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Content textarea */}
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={
                format === "json"
                  ? '{\n  "key": "value"\n}'
                  : format === "markdown"
                  ? "# Title\n\nWrite your markdown here..."
                  : format === "code"
                  ? "// Paste your code here"
                  : "Paste your text here..."
              }
              disabled={!session}
              rows={12}
              className="w-full rounded-lg border bg-muted/30 px-3 py-2.5 text-sm font-mono leading-relaxed outline-none focus:ring-1 focus:ring-ring resize-none placeholder:text-muted-foreground/40 disabled:opacity-40"
            />

            {/* Visibility toggle */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0">Visibility</span>
              <div className="flex gap-1">
                {(["unlisted", "public"] as PasteVisibility[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => setVisibility(v)}
                    disabled={!session}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
                      visibility === v
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {v === "public" ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {v.charAt(0).toUpperCase() + v.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {createError && (
              <p className="text-xs text-destructive">{createError}</p>
            )}

            <button
              onClick={session ? handleCreate : () => setSignInOpen(true)}
              disabled={creating || (!!session && !content.trim())}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ClipboardPaste className="h-4 w-4" />
                  Create Paste
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Paste list */}
      {session && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Your Pastes
          </h3>

          {loadingPastes ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Loading pastes...
            </div>
          ) : pastes.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              No pastes yet. Create your first one above.
            </div>
          ) : (
            <div className="space-y-1">
              {pastes.map((paste) => (
                <div key={paste.id} className="rounded-lg border overflow-hidden">
                  {/* Row */}
                  <div
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                    onClick={() => setExpandedId(expandedId === paste.id ? null : paste.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {paste.title || <span className="text-muted-foreground italic">Untitled</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <FormatBadge format={paste.format} />
                        <VisibilityBadge visibility={paste.visibility} />
                        {paste.size !== undefined && (
                          <span className="text-[10px] text-muted-foreground">{formatSize(paste.size)}</span>
                        )}
                        {paste.createdAt && (
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(paste.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => { e.stopPropagation(); copyPasteUrl(paste.id); }}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Copy link"
                      >
                        {copiedId === paste.id ? (
                          <Check className="h-3.5 w-3.5 text-green-500" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <a
                        href={`/p/${paste.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1.5 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                        title="Open paste"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(paste.id); }}
                        disabled={deletingId === paste.id}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                        title="Delete paste"
                      >
                        {deletingId === paste.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedId === paste.id && (
                    <div className="border-t">
                      <pre className="px-4 py-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words text-muted-foreground max-h-64">
                        {paste.content}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
