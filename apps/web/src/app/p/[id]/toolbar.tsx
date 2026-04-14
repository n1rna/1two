"use client";

import { useState } from "react";
import { Copy, Check, Pencil, ExternalLink } from "lucide-react";
import Link from "next/link";

export function PasteToolbar({
  pasteId,
  content,
  isOwner,
  format,
}: {
  pasteId: string;
  content: string;
  isOwner: boolean;
  format: string;
}) {
  const [copied, setCopied] = useState(false);

  const copyContent = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex items-center gap-2">
      {isOwner && (
        <Link
          href={format === "markdown" ? `/tools/markdown/${pasteId}` : `/tools/paste`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <Pencil className="h-3 w-3" />
          Edit
        </Link>
      )}
      <a
        href={`/api/proxy/pastes/${pasteId}/raw`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Raw
      </a>
      <button
        onClick={copyContent}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
