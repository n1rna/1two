"use client";

import { useState } from "react";
import { Send, X, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  count: number;
  /** Day labels ("monday".."sunday" | "any") available to the "Select all for day" shortcut. */
  days: string[];
  /** Called with a day key to select every meal in that day. */
  onSelectDay: (day: string) => void;
  /** Clear the current selection + exit bulk edit mode. */
  onCancel: () => void;
  /** Send the user's prompt to Kim (selection is already pinned via context). */
  onSend: (prompt: string) => Promise<void> | void;
  /** True while we're waiting on Kim's `propose_meal_edits` response. */
  pending?: boolean;
}

/**
 * Floating bar anchored to the bottom of the viewport, shown while the user is
 * in bulk edit mode. Surfaces the selection count, day-selection shortcuts, and
 * a prompt input that sends to Kim.
 */
export function BulkEditBar({
  count,
  days,
  onSelectDay,
  onCancel,
  onSend,
  pending,
}: Props) {
  const [prompt, setPrompt] = useState("");

  const submit = async () => {
    const p = prompt.trim();
    if (!p || count === 0 || pending) return;
    await onSend(p);
    setPrompt("");
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[min(720px,calc(100vw-2rem))]">
      <div className="rounded-xl border border-primary/30 bg-popover/95 backdrop-blur shadow-2xl">
        {/* Top row: count + day shortcuts + cancel */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/60 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold tabular-nums">
              {count}
            </span>
            <span className="text-xs font-medium">
              {count === 1 ? "meal selected" : "meals selected"}
            </span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-1 flex-wrap">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onSelectDay(d)}
                className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted rounded-full px-2 py-0.5 border border-border/60"
                title={`Select all meals on ${d}`}
              >
                All {d === "any" ? "meals" : d.slice(0, 3)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancel bulk edit"
            className="shrink-0 h-6 w-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Prompt row */}
        <div className="flex items-center gap-2 px-3 py-2">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder="What should Kim change? (e.g. higher protein, swap to vegetarian, -20% calories)"
            disabled={pending}
            className="flex-1 bg-transparent border-none outline-none text-sm placeholder:text-muted-foreground/60 disabled:opacity-60"
          />
          <Button
            size="sm"
            onClick={submit}
            disabled={!prompt.trim() || count === 0 || pending}
            className="h-7 gap-1.5"
          >
            {pending ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {pending ? "Thinking…" : "Ask Kim"}
          </Button>
        </div>
      </div>
    </div>
  );
}
