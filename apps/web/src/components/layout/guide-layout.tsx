import { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import * as icons from "lucide-react";
import { getGuideBySlug } from "@/lib/guides/registry";
import { getToolBySlug } from "@/lib/tools/registry";

interface GuideLayoutProps {
  slug: string;
  children: ReactNode;
}

export function GuideLayout({ slug, children }: GuideLayoutProps) {
  const guide = getGuideBySlug(slug);
  if (!guide) return null;

  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[guide.icon];

  const relatedTools = guide.relatedTools
    .map((s) => getToolBySlug(s))
    .filter(Boolean);

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      {/* Back link */}
      <Link
        href="/guides"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-3 w-3" />
        All guides
      </Link>

      {/* Header */}
      <header className="mb-10">
        <div className="flex items-center gap-3 mb-4">
          {Icon && (
            <div className="rounded-lg bg-muted p-2.5">
              <Icon className="h-5 w-5 text-foreground" />
            </div>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{guide.title}</h1>
        </div>
        <p className="text-base text-muted-foreground leading-relaxed">
          {guide.description}
        </p>
      </header>

      {/* Content */}
      <article className="prose-guide space-y-6 text-sm text-muted-foreground leading-relaxed">
        {children}
      </article>

      {/* Related tools */}
      {relatedTools.length > 0 && (
        <footer className="mt-14 pt-8 border-t">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-4">
            Related tools
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {relatedTools.map((tool) => {
              if (!tool) return null;
              const ToolIcon = (icons as unknown as Record<string, icons.LucideIcon>)[tool.icon];
              return (
                <Link
                  key={tool.slug}
                  href={`/tools/${tool.slug}`}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                >
                  {ToolIcon && <ToolIcon className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </footer>
      )}
    </div>
  );
}
