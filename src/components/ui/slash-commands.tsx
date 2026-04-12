"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

export interface SlashCommand {
  name: string;         // e.g. "today"
  label: string;        // e.g. "Plan my day"
  description: string;  // e.g. "Get a summary and plan for today"
  prompt: string;       // The actual message sent to the agent
  icon?: React.ReactNode;
}

interface SlashCommandMenuProps {
  commands: SlashCommand[];
  input: string;
  onSelect: (command: SlashCommand) => void;
  onClose: () => void;
  visible: boolean;
}

export function SlashCommandMenu({ commands, input, onSelect, onClose, visible }: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Filter commands based on what's typed after /
  const query = input.startsWith("/") ? input.slice(1).toLowerCase() : "";
  const filtered = query
    ? commands.filter((c) => c.name.toLowerCase().includes(query) || c.label.toLowerCase().includes(query))
    : commands;

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected item into view
  useEffect(() => {
    if (!menuRef.current) return;
    const item = menuRef.current.children[selectedIndex] as HTMLElement | undefined;
    if (item) item.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      onSelect(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    if (visible) {
      document.addEventListener("keydown", handleKeyDown, true);
      return () => document.removeEventListener("keydown", handleKeyDown, true);
    }
  }, [visible, handleKeyDown]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 right-0 mb-1 mx-2 max-h-64 overflow-y-auto rounded-xl border bg-popover shadow-lg z-50"
    >
      {filtered.map((cmd, i) => (
        <button
          key={cmd.name}
          onClick={() => onSelect(cmd)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
            i === selectedIndex ? "bg-muted" : "hover:bg-muted/50"
          )}
        >
          {cmd.icon && <span className="shrink-0 text-muted-foreground">{cmd.icon}</span>}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-primary">/{cmd.name}</span>
              <span className="text-sm font-medium text-foreground">{cmd.label}</span>
            </div>
            <p className="text-xs text-muted-foreground truncate">{cmd.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

/**
 * Hook to manage slash command state for a chat input.
 */
export function useSlashCommands(commands: SlashCommand[]) {
  const [menuVisible, setMenuVisible] = useState(false);

  const checkInput = useCallback((value: string) => {
    // Show menu when input starts with / and has no spaces yet (still typing command)
    if (value.startsWith("/") && !value.includes(" ")) {
      setMenuVisible(true);
    } else {
      setMenuVisible(false);
    }
  }, []);

  const close = useCallback(() => setMenuVisible(false), []);

  return { menuVisible, checkInput, close, commands };
}
