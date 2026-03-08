import { getToolBySlug } from "@/lib/tools/registry";
import * as icons from "lucide-react";

interface ToolLayoutProps {
  slug: string;
  children: React.ReactNode;
  /** Extra elements to render on the right side of the toolbar */
  toolbar?: React.ReactNode;
}

export function ToolLayout({ slug, children, toolbar }: ToolLayoutProps) {
  const tool = getToolBySlug(slug);
  if (!tool) return null;

  const Icon = (icons as unknown as Record<string, icons.LucideIcon>)[
    tool.icon
  ];

  return (
    <div>
      {/* Toolbar */}
      <div className="border-b">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <span className="text-sm font-semibold">{tool.name}</span>
          {toolbar && (
            <div className="flex items-center gap-1 ml-auto">{toolbar}</div>
          )}
        </div>
      </div>
      <div className="max-w-6xl mx-auto w-full p-6">{children}</div>
    </div>
  );
}
