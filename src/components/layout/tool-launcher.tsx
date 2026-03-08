"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as Icons from "lucide-react";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { tools, categoryLabels } from "@/lib/tools/registry";
import { getToolsByCategory } from "@/lib/tools/registry";
import { ToolCategory } from "@/lib/tools/types";

function getIcon(name: string) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  return Icon || Icons.Wrench;
}

export function ToolLauncher() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "p") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    function onOpen() {
      setOpen(true);
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("open-tool-launcher", onOpen);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("open-tool-launcher", onOpen);
    };
  }, []);

  const grouped = getToolsByCategory();

  function selectTool(slug: string) {
    setOpen(false);
    router.push(`/tools/${slug}`);
  }

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      title="Tool Launcher"
      description="Search for a tool..."
    >
      <CommandInput placeholder="Search tools..." />
      <CommandList>
        <CommandEmpty>No tools found.</CommandEmpty>
        {(Object.entries(grouped) as [ToolCategory, typeof tools][]).map(
          ([category, categoryTools]) => (
            <CommandGroup key={category} heading={categoryLabels[category]}>
              {categoryTools.map((tool) => {
                const Icon = getIcon(tool.icon);
                return (
                  <CommandItem
                    key={tool.slug}
                    value={`${tool.name} ${tool.keywords.join(" ")}`}
                    onSelect={() => selectTool(tool.slug)}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tool.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground hidden sm:inline">
                      {tool.description}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )
        )}
      </CommandList>
    </CommandDialog>
  );
}
