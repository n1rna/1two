"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Plus,
  X,
  ClipboardPaste,
  Copy,
  Check,
  GitCompareArrows,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import { computeDiff, getDiffStats } from "@/lib/tools/diff";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Pane {
  id: string;
  label: string;
  text: string;
  compareToId: string | null;
}

function createPane(label: string): Pane {
  return { id: crypto.randomUUID(), label, text: "", compareToId: null };
}

export function DiffViewer() {
  const [panes, setPanes] = useState<Pane[]>(() => {
    const a = createPane("A");
    const b = createPane("B");
    b.compareToId = a.id;
    return [a, b];
  });
  const [widths, setWidths] = useState<number[]>([]);

  // Keep widths in sync with pane count
  useEffect(() => {
    setWidths((prev) => {
      if (prev.length === panes.length) return prev;
      const equal = 100 / panes.length;
      return panes.map(() => equal);
    });
  }, [panes.length]);

  const updatePane = useCallback((id: string, updates: Partial<Pane>) => {
    setPanes((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }, []);

  const addPane = useCallback(() => {
    setPanes((prev) => {
      const label = String.fromCharCode(65 + prev.length);
      const newPane = createPane(label);
      newPane.compareToId = prev[0]?.id ?? null;
      return [...prev, newPane];
    });
  }, []);

  const removePane = useCallback((id: string) => {
    setPanes((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      return filtered.map((p) =>
        p.compareToId === id ? { ...p, compareToId: null } : p
      );
    });
  }, []);

  const handleResize = useCallback(
    (index: number, delta: number, containerWidth: number) => {
      setWidths((prev) => {
        const next = [...prev];
        const deltaPct = (delta / containerWidth) * 100;
        const newLeft = next[index] + deltaPct;
        const newRight = next[index + 1] - deltaPct;
        if (newLeft < 10 || newRight < 10) return prev;
        next[index] = newLeft;
        next[index + 1] = newRight;
        return next;
      });
    },
    []
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <GitCompareArrows className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Diff</span>
        <Button size="sm" variant="outline" onClick={addPane} className="ml-4">
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add pane
        </Button>
      </div>

      {/* Panes */}
      <div className="flex flex-1 min-h-0">
        {panes.map((pane, i) => (
          <div key={pane.id} className="flex min-w-0" style={{ width: `${widths[i] ?? 100 / panes.length}%` }}>
            {i > 0 && (
              <ResizeHandle
                index={i - 1}
                onResize={handleResize}
              />
            )}
            <DiffPane
              pane={pane}
              allPanes={panes}
              onUpdate={updatePane}
              onRemove={panes.length > 2 ? removePane : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Resize Handle ───────────────────────────────────────────────────────────

function ResizeHandle({
  index,
  onResize,
}: {
  index: number;
  onResize: (index: number, delta: number, containerWidth: number) => void;
}) {
  const handleRef = useRef<HTMLDivElement>(null);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      let lastX = e.clientX;
      const container = handleRef.current?.parentElement?.parentElement;
      if (!container) return;
      const containerWidth = container.getBoundingClientRect().width;

      const onMouseMove = (e: MouseEvent) => {
        const delta = e.clientX - lastX;
        lastX = e.clientX;
        onResize(index, delta, containerWidth);
      };
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [index, onResize]
  );

  return (
    <div
      ref={handleRef}
      onMouseDown={onMouseDown}
      className="w-1 shrink-0 cursor-col-resize bg-border hover:bg-ring transition-colors"
    />
  );
}

// ── Diff Pane ───────────────────────────────────────────────────────────────

interface DiffPaneProps {
  pane: Pane;
  allPanes: Pane[];
  onUpdate: (id: string, updates: Partial<Pane>) => void;
  onRemove?: (id: string) => void;
}

function DiffPane({ pane, allPanes, onUpdate, onRemove }: DiffPaneProps) {
  const [copied, setCopied] = useState(false);
  const [currentDiffIdx, setCurrentDiffIdx] = useState(-1);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const compareTarget = useMemo(
    () => allPanes.find((p) => p.id === pane.compareToId),
    [allPanes, pane.compareToId]
  );

  const diff = useMemo(() => {
    if (!compareTarget) return null;
    if (!pane.text && !compareTarget.text) return null;
    return computeDiff(compareTarget.text, pane.text);
  }, [pane.text, compareTarget]);

  const stats = useMemo(() => (diff ? getDiffStats(diff) : null), [diff]);

  // Build a map: line number in "right" (this pane) -> line type
  const lineHighlights = useMemo(() => {
    if (!diff) return null;
    const map = new Map<number, "added" | "removed" | "equal">();
    for (const line of diff) {
      if (line.type === "added" && line.lineNumRight !== undefined) {
        map.set(line.lineNumRight, "added");
      }
    }
    for (const line of diff) {
      if (line.type === "equal" && line.lineNumRight !== undefined) {
        map.set(line.lineNumRight, "equal");
      }
    }
    return map;
  }, [diff]);

  // Sorted list of diff (added) line numbers for navigation
  const diffLineNumbers = useMemo(() => {
    if (!lineHighlights) return [];
    const result: number[] = [];
    lineHighlights.forEach((type, lineNum) => {
      if (type === "added") result.push(lineNum);
    });
    return result.sort((a, b) => a - b);
  }, [lineHighlights]);

  // Reset navigation index when diff changes
  useEffect(() => {
    setCurrentDiffIdx(-1);
  }, [diffLineNumbers]);

  const lines = pane.text.split("\n");
  const otherPanes = allPanes.filter((p) => p.id !== pane.id);

  const scrollToLine = useCallback((lineNum: number) => {
    if (!scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const lineTop = (lineNum - 1) * 24;
    const containerHeight = container.clientHeight;
    container.scrollTop = lineTop - containerHeight / 2 + 12;

    // Move textarea cursor to the start of the diff line
    const ta = textareaRef.current;
    if (ta) {
      const lines = ta.value.split("\n");
      let pos = 0;
      for (let i = 0; i < lineNum - 1 && i < lines.length; i++) {
        pos += lines[i].length + 1;
      }
      pos += (lines[lineNum - 1] ?? "").length;
      ta.setSelectionRange(pos, pos);
      ta.focus();
    }
  }, []);

  const goToNextDiff = useCallback(() => {
    if (diffLineNumbers.length === 0) return;
    const next = currentDiffIdx + 1 >= diffLineNumbers.length ? 0 : currentDiffIdx + 1;
    setCurrentDiffIdx(next);
    scrollToLine(diffLineNumbers[next]);
  }, [diffLineNumbers, currentDiffIdx, scrollToLine]);

  const goToPrevDiff = useCallback(() => {
    if (diffLineNumbers.length === 0) return;
    const prev = currentDiffIdx - 1 < 0 ? diffLineNumbers.length - 1 : currentDiffIdx - 1;
    setCurrentDiffIdx(prev);
    scrollToLine(diffLineNumbers[prev]);
  }, [diffLineNumbers, currentDiffIdx, scrollToLine]);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    onUpdate(pane.id, { text });
  }, [pane.id, onUpdate]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(pane.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [pane.text]);

  return (
    <div className="flex flex-col flex-1 min-w-0">
      {/* Pane header */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/30 shrink-0">
        <input
          type="text"
          value={pane.label}
          onChange={(e) => onUpdate(pane.id, { label: e.target.value })}
          className="w-12 bg-transparent text-xs font-semibold outline-none border-b border-transparent focus:border-ring"
        />

        <Select
          value={pane.compareToId ?? "none"}
          onValueChange={(val) =>
            onUpdate(pane.id, { compareToId: val === "none" ? null : val })
          }
        >
          <SelectTrigger size="sm" className="h-6 text-xs gap-1 px-1.5">
            <SelectValue>
              {compareTarget ? `${compareTarget.label}` : "No diff"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="none">No diff</SelectItem>
            {otherPanes.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {stats && (
          <div className="flex items-center gap-1.5 text-xs ml-1">
            <span className="text-green-500">+{stats.added}</span>
            <span className="text-red-500">-{stats.removed}</span>
          </div>
        )}

        {diffLineNumbers.length > 0 && (
          <div className="flex items-center gap-0.5 ml-1">
            <Button variant="ghost" size="sm" onClick={goToPrevDiff} onMouseDown={(e) => e.preventDefault()} className="h-6 w-6 p-0" title="Previous change">
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums min-w-[3ch] text-center">
              {currentDiffIdx >= 0 ? currentDiffIdx + 1 : "–"}/{diffLineNumbers.length}
            </span>
            <Button variant="ghost" size="sm" onClick={goToNextDiff} onMouseDown={(e) => e.preventDefault()} className="h-6 w-6 p-0" title="Next change">
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <div className="flex items-center gap-0.5 ml-auto">
          {!pane.text && (
            <Button variant="ghost" size="sm" onClick={handlePaste} className="h-6 px-1.5 text-xs">
              <ClipboardPaste className="h-3 w-3 mr-1" />
              Paste
            </Button>
          )}
          {pane.text && (
            <>
              <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-1.5 text-xs">
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUpdate(pane.id, { text: "" })}
                className="h-6 px-1.5 text-xs"
              >
                <X className="h-3 w-3" />
              </Button>
            </>
          )}
          {onRemove && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(pane.id)}
              className="h-6 px-1.5 text-xs text-destructive hover:text-destructive"
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Editor with line highlights + scrollbar minimap */}
      <div className="flex flex-1 min-h-0">
        <div className="relative flex-1 min-w-0 overflow-auto hide-scrollbar" ref={scrollContainerRef}>
          <div className="relative min-h-full" style={{ height: `${lines.length * 24}px` }}>
            {/* Line highlight background — full width rows */}
            <div aria-hidden className="absolute inset-0 pointer-events-none">
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const type = lineHighlights?.get(lineNum);
                let bg = "";
                if (type === "added") bg = "bg-green-500/10";
                return (
                  <div key={i} className={`h-6 ${bg}`} />
                );
              })}
            </div>

            {/* Line numbers gutter */}
            <div
              aria-hidden
              className="absolute left-0 top-0 bottom-0 w-10 border-r border-border/50 pointer-events-none z-10"
            >
              {lines.map((_, i) => {
                const lineNum = i + 1;
                const type = lineHighlights?.get(lineNum);
                return (
                  <div
                    key={i}
                    className={`h-6 leading-6 text-right pr-2 text-xs select-none ${
                      type === "added"
                        ? "text-green-500 bg-green-500/10"
                        : "text-muted-foreground/40"
                    }`}
                  >
                    {lineNum}
                  </div>
                );
              })}
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={pane.text}
              onChange={(e) => onUpdate(pane.id, { text: e.target.value })}
              placeholder="Paste or type text here..."
              className="absolute inset-0 w-full h-full resize-none bg-transparent pl-12 pr-3 py-0 m-0 border-0 font-mono text-sm leading-6 outline-none overflow-hidden placeholder:text-muted-foreground caret-foreground"
              wrap="off"
              spellCheck={false}
              style={{ tabSize: 4 }}
            />
          </div>
        </div>

        {/* Scrollbar minimap with diff markers */}
        <DiffScrollbar
          totalLines={lines.length}
          diffLines={diffLineNumbers}
          currentDiffIdx={currentDiffIdx}
          scrollContainerRef={scrollContainerRef}
        />
      </div>
    </div>
  );
}

// ── Diff Scrollbar Minimap ──────────────────────────────────────────────────

function DiffScrollbar({
  totalLines,
  diffLines,
  currentDiffIdx,
  scrollContainerRef,
}: {
  totalLines: number;
  diffLines: number[];
  currentDiffIdx: number;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);

  // Update viewport indicator via direct DOM — no React re-renders
  useEffect(() => {
    const container = scrollContainerRef.current;
    const viewport = viewportRef.current;
    if (!container || !viewport) return;

    const update = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight <= 0) return;
      const top = (scrollTop / scrollHeight) * 100;
      const height = Math.max((clientHeight / scrollHeight) * 100, 2);
      viewport.style.top = `${top}%`;
      viewport.style.height = `${height}%`;
    };

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(update);
    };

    update();
    container.addEventListener("scroll", onScroll, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(container);
    return () => {
      cancelAnimationFrame(rafRef.current);
      container.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, [scrollContainerRef]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const track = trackRef.current;
      const container = scrollContainerRef.current;
      if (!track || !container) return;
      const rect = track.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      container.scrollTop = ratio * container.scrollHeight - container.clientHeight / 2;
    },
    [scrollContainerRef]
  );

  // Support drag on the scrollbar track
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const track = trackRef.current;
      const container = scrollContainerRef.current;
      if (!track || !container) return;

      const rect = track.getBoundingClientRect();
      const setScroll = (clientY: number) => {
        const ratio = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
        container.scrollTop = ratio * container.scrollHeight - container.clientHeight / 2;
      };
      setScroll(e.clientY);

      const onMouseMove = (e: MouseEvent) => setScroll(e.clientY);
      const onMouseUp = () => {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "pointer";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [scrollContainerRef]
  );

  return (
    <div
      ref={trackRef}
      onMouseDown={handleMouseDown}
      className="relative w-3 shrink-0 border-l border-border/50 bg-muted/20 cursor-pointer"
    >
      {/* Viewport indicator — updated via ref, not state */}
      <div
        ref={viewportRef}
        className="absolute left-0 right-0 bg-foreground/8 border-y border-foreground/10"
      />
      {/* Diff markers — consecutive lines merged into ranges */}
      {(() => {
        const ranges: { start: number; end: number; activeInRange: boolean }[] = [];
        for (let i = 0; i < diffLines.length; i++) {
          const prev = ranges[ranges.length - 1];
          const isActive = i === currentDiffIdx;
          if (prev && diffLines[i] === prev.end + 1) {
            prev.end = diffLines[i];
            if (isActive) prev.activeInRange = true;
          } else {
            ranges.push({ start: diffLines[i], end: diffLines[i], activeInRange: isActive });
          }
        }
        const denom = Math.max(totalLines - 1, 1);
        return ranges.map((range) => {
          const topPct = ((range.start - 1) / denom) * 100;
          const bottomPct = ((range.end - 1) / denom) * 100;
          const heightPct = bottomPct - topPct;
          return (
            <div
              key={range.start}
              className={`absolute left-0.5 right-0.5 rounded-sm ${
                range.activeInRange ? "bg-green-500" : "bg-green-500/60"
              }`}
              style={{
                top: `${topPct}%`,
                height: `max(2px, ${heightPct}%)`,
              }}
            />
          );
        });
      })()}
    </div>
  );
}
