import { notFound } from "next/navigation";
import { Copy, Globe, Lock, ArrowLeft, Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/api-fetch";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { PasteToolbar } from "./toolbar";

type PasteFormat = "text" | "markdown" | "json" | "code";
type PasteVisibility = "public" | "unlisted";

interface Paste {
  id: string;
  userId?: string;
  title?: string;
  format: PasteFormat;
  content: string;
  visibility: PasteVisibility;
  createdAt?: string;
  author?: { name: string; image: string };
  size?: number;
}

const FORMAT_COLORS: Record<PasteFormat, string> = {
  text: "bg-muted text-muted-foreground",
  markdown: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  json: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  code: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

async function fetchPaste(id: string): Promise<Paste | null> {
  try {
    const res = await apiFetch(`/api/v1/pastes/${id}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const paste = await fetchPaste(id);
  if (!paste) return { title: "Paste not found - 1two.dev" };
  const title = paste.title || "Untitled paste";
  const desc = paste.content.slice(0, 160).replace(/\n/g, " ");
  return {
    title: `${title} - 1two.dev`,
    description: desc,
    openGraph: { title, description: desc },
  };
}

export default async function PasteViewerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const paste = await fetchPaste(id);

  if (!paste) {
    notFound();
  }

  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    userId = session?.user?.id ?? null;
  } catch {}

  const isOwner = !!(userId && paste.userId && userId === paste.userId);
  const lineCount = paste.content.split("\n").length;

  return (
    <div className="flex-1 bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Link
              href="/tools/paste"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Paste Bin
            </Link>
            <a
              href="/"
              className="text-xs font-semibold text-foreground hover:opacity-70 transition-opacity"
            >
              1two.dev
            </a>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-semibold">
              {paste.title || <span className="text-muted-foreground">Untitled</span>}
            </h1>

            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wide ${
                  FORMAT_COLORS[paste.format]
                }`}
              >
                {paste.format}
              </span>

              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  paste.visibility === "public"
                    ? "bg-green-500/10 text-green-700 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {paste.visibility === "public" ? (
                  <Globe className="h-3 w-3" />
                ) : (
                  <Lock className="h-3 w-3" />
                )}
                {paste.visibility === "public" ? "Public" : "Unlisted"}
              </span>

              {paste.author?.name && (
                <span className="text-xs text-muted-foreground">
                  by{" "}
                  <span className="font-medium text-foreground">
                    {paste.author.name}
                  </span>
                </span>
              )}

              {paste.createdAt && (
                <span className="text-xs text-muted-foreground">
                  {formatDate(paste.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {lineCount} lines
            {paste.size !== undefined && ` · ${paste.size} bytes`}
          </span>
          <PasteToolbar
            pasteId={paste.id}
            content={paste.content}
            isOwner={isOwner}
            format={paste.format}
          />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <PasteContent paste={paste} />
      </div>
    </div>
  );
}

function PasteContent({ paste }: { paste: Paste }) {
  if (paste.format === "markdown") {
    const html = markdownToHtml(paste.content);
    return (
      <div
        className="prose prose-sm dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  return (
    <pre className="rounded-xl border bg-muted/30 px-5 py-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-words">
      {paste.content}
    </pre>
  );
}

/** Very minimal markdown-to-HTML converter (no external deps). */
function markdownToHtml(md: string): string {
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // Fenced code blocks
    .replace(/```[\w]*\n([\s\S]*?)```/g, (_, code) => `<pre class="rounded-lg bg-muted px-4 py-3 overflow-x-auto text-sm font-mono"><code>${code.trimEnd()}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-sm font-mono">$1</code>')
    // Headings
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold mt-5 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold mt-6 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Italic
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr class="border-border my-6" />')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic">$1</blockquote>')
    // Paragraphs
    .replace(/^(?!<[a-z]|\s*$)(.+)$/gm, "<p>$1</p>");

  // Wrap consecutive <li> in <ul>
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul class="list-disc list-inside space-y-1 my-3">${match}</ul>`);

  return html;
}
