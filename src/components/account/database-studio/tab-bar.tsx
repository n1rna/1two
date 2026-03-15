"use client";

import { Table2, Terminal, X, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Tab } from "./types";

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewSqlTab: () => void;
}

function tabLabel(tab: Tab): string {
  if (tab.type === "table") return tab.table;
  return tab.title;
}

export function TabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewSqlTab,
}: TabBarProps) {
  return (
    <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
      <div className="flex items-end min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none",
                "border-r border-border/50 shrink-0 max-w-[160px] group transition-colors",
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              onClick={() => onSwitch(tab.id)}
            >
              {tab.type === "table" ? (
                <Table2 className="h-3 w-3 shrink-0" />
              ) : (
                <Terminal className="h-3 w-3 shrink-0" />
              )}
              <span className="truncate font-medium">{tabLabel(tab)}</span>
              <button
                className={cn(
                  "shrink-0 rounded hover:bg-muted transition-colors p-0.5 -mr-0.5",
                  isActive
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                aria-label={`Close ${tabLabel(tab)}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>

      {/* New SQL tab button */}
      <button
        className="flex items-center justify-center h-8 w-8 shrink-0 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
        onClick={onNewSqlTab}
        aria-label="New SQL tab"
        title="New SQL Query"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {/* Filler to push tabs left */}
      <div className="flex-1" />
    </div>
  );
}
