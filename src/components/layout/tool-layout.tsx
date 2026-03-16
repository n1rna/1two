import { getToolBySlug } from "@/lib/tools/registry";
import * as icons from "lucide-react";
import { PromoBanner } from "./promo-banner";

interface ToolLayoutProps {
  slug: string;
  children: React.ReactNode;
  /** Sync toggle rendered next to the tool name (left side) */
  sync?: React.ReactNode;
  /** Extra elements rendered on the right side of the toolbar */
  toolbar?: React.ReactNode;
}

export function ToolLayout({ slug, children, sync, toolbar }: ToolLayoutProps) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;

  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[
    tool.icon
  ];

  return (
    <div>
      {/* Promo banner — only visible to non-logged-in users */}
      <PromoBanner currentSlug={slug} />
      {/* Toolbar */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{tool.name}</span>
          {sync && (
            <div className="flex items-center gap-1">{sync}</div>
          )}
          {toolbar && (
            <div className="flex items-center gap-1 ml-auto">{toolbar}</div>
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto w-full p-6">{children}</div>
    </div>
  );
}
