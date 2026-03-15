import { ReactNode } from "react";
import Link from "next/link";
import * as icons from "lucide-react";
import { getToolBySlug } from "@/lib/tools/registry";

/**
 * GuideContent — helper components for writing guide content.
 *
 * Usage:
 * ```tsx
 * <Guide.H2>Section title</Guide.H2>
 * <Guide.P>Paragraph text with <Guide.Code>inline code</Guide.Code>.</Guide.P>
 * <Guide.UL>
 *   <li>Item one</li>
 *   <li>Item two</li>
 * </Guide.UL>
 * <Guide.Step n={1}>Do this thing</Guide.Step>
 * <Guide.Callout>Important note here.</Guide.Callout>
 * ```
 */

function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold text-foreground pt-4">{children}</h2>;
}

function H3({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-foreground pt-2">{children}</h3>;
}

function P({ children }: { children: ReactNode }) {
  return <p>{children}</p>;
}

function UL({ children }: { children: ReactNode }) {
  return <ul className="list-disc list-inside space-y-1.5">{children}</ul>;
}

function OL({ children }: { children: ReactNode }) {
  return <ol className="list-decimal list-inside space-y-1.5">{children}</ol>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="text-foreground bg-muted px-1 py-0.5 rounded text-xs">
      {children}
    </code>
  );
}

function Strong({ children }: { children: ReactNode }) {
  return <strong className="text-foreground">{children}</strong>;
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
        {n}
      </span>
      <div className="flex-1 pt-0.5">{children}</div>
    </div>
  );
}

function Callout({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-muted/30 px-4 py-3 text-sm">
      {children}
    </div>
  );
}

function ToolCard({ slug }: { slug: string }) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;
  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[tool.icon];
  return (
    <Link
      href={`/tools/${tool.slug}`}
      className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/50 transition-colors not-prose"
    >
      {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
        <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
      </div>
    </Link>
  );
}

export const Guide = {
  H2,
  H3,
  P,
  UL,
  OL,
  Code,
  Strong,
  Step,
  Callout,
  ToolCard,
};
