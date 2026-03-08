"use client";

import Link from "next/link";
import * as Icons from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { tools, categoryLabels } from "@/lib/tools/registry";

function getIcon(name: string) {
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name];
  return Icon || Icons.Wrench;
}

export function ToolGrid() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {tools.map((tool) => {
        const Icon = getIcon(tool.icon);
        return (
          <Link key={tool.slug} href={`/tools/${tool.slug}`}>
            <Card className="h-full hover:bg-accent/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 rounded-md bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {categoryLabels[tool.category]}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{tool.name}</CardTitle>
                <CardDescription>{tool.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
