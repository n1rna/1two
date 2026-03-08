"use client";

import { useState, useRef, useCallback, useEffect, useMemo, Fragment } from "react";
import { Button } from "@/components/ui/button";
import {
  Copy,
  Check,
  X,
  ClipboardPaste,
  ChevronsDownUp,
  ChevronsUpDown,
  Search,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Maximize2,
  Minimize2,
  Braces,
} from "lucide-react";
import { smartParseJson, minifyJson, type JsonParseResult } from "@/lib/tools/json";
import { JsonTree } from "./json-tree";
import { EditorScrollbar } from "./editor-scrollbar";

export function JsonBeautifier() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<JsonParseResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [treeSearchInput, setTreeSearchInput] = useState("");
  const [treeSearch, setTreeSearch] = useState("");
  const [allExpanded, setAllExpanded] = useState(true);
  const [expandGen, setExpandGen] = useState(0);
  const [widths, setWidths] = useState([50, 50]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previewScrollRef = useRef<HTMLDivElement>(null);
  const parseTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const lines = useMemo(() => input.split("\n"), [input]);
  const lineCount = lines.length;

  // Debounced parsing
  useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      return;
    }
    const delay = input.length > 100_000 ? 400 : input.length > 10_000 ? 200 : 50;
    if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    parseTimerRef.current = setTimeout(() => {
      const r = smartParseJson(input);
      setResult(r);
    }, delay);
    return () => {
      if (parseTimerRef.current) clearTimeout(parseTimerRef.current);
    };
  }, [input]);

  // Error line for highlighting
  const errorLine = result && !result.valid ? result.error?.line : null;

  const handleCopy = useCallback(async () => {
    if (!result?.formatted) return;
    await navigator.clipboard.writeText(result.formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [result]);

  const handleClear = useCallback(() => {
    setInput("");
    setResult(null);
    setTreeSearchInput("");
    setTreeSearch("");
    textareaRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setInput(text);
  }, []);

  const handleApplyFormatted = useCallback(() => {
    if (result?.formatted) {
      setInput(result.formatted);
    }
  }, [result]);

  const toggleExpandAll = useCallback(() => {
    setAllExpanded((prev) => !prev);
    setExpandGen((g) => g + 1);
  }, []);

  const handleBeautify = useCallback(() => {
    if (result?.formatted) {
      setInput(result.formatted);
    }
  }, [result]);

  const handleMinify = useCallback(() => {
    if (result?.valid && result.value !== undefined) {
      setInput(minifyJson(JSON.stringify(result.value)));
    }
  }, [result]);

  const handleResize = useCallback(
    (index: number, delta: number, containerWidth: number) => {
      setWidths((prev) => {
        const next = [...prev];
        const deltaPct = (delta / containerWidth) * 100;
        const newLeft = next[index] + deltaPct;
        const newRight = next[index + 1] - deltaPct;
        if (newLeft < 15 || newRight < 15) return prev;
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
        <Braces className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">JSON</span>

        {/* Status indicator */}
        {result && result.valid && !result.corrected && (
          <div className="flex items-center gap-1 text-xs text-green-500 ml-2">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Valid
          </div>
        )}
        {result && result.valid && result.corrected && (
          <div className="flex items-center gap-1 text-xs text-yellow-500 ml-2">
            <Sparkles className="h-3.5 w-3.5" />
            Auto-corrected
          </div>
        )}
        {result && !result.valid && (
          <div className="flex items-center gap-1 text-xs text-destructive ml-2">
            <AlertTriangle className="h-3.5 w-3.5" />
            {result.error?.line ? `Error at line ${result.error.line}` : "Invalid"}
          </div>
        )}

        {/* Actions */}
        {result?.valid && (
          <div className="flex items-center gap-1 ml-2">
            <Button size="sm" variant="outline" onClick={handleBeautify} className="h-6 text-xs px-2">
              <Maximize2 className="h-3 w-3 mr-1" />
              Beautify
            </Button>
            <Button size="sm" variant="outline" onClick={handleMinify} className="h-6 text-xs px-2">
              <Minimize2 className="h-3 w-3 mr-1" />
              Minify
            </Button>
          </div>
        )}
        {result?.corrected && result?.formatted && (
          <Button size="sm" variant="outline" onClick={handleApplyFormatted} className="h-6 text-xs px-2">
            <Sparkles className="h-3 w-3 mr-1" />
            Apply fix
          </Button>
        )}

        {lineCount > 1 && (
          <span className="text-xs text-muted-foreground ml-auto tabular-nums">
            {lineCount.toLocaleString()} lines
          </span>
        )}
      </div>

      {/* Split panes */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Editor pane */}
        <div className="flex flex-col min-w-0" style={{ width: `${widths[0]}%` }}>
          <div className="flex items-center px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Editor</span>
            {result?.corrections && result.corrections.length > 0 && result.valid && (
              <span className="text-xs text-yellow-500/70 ml-2 truncate">
                {result.corrections.join(", ")}
              </span>
            )}
            <div className="flex items-center gap-0.5 ml-auto">
              {!input && (
                <Button variant="ghost" size="sm" onClick={handlePaste} className="h-6 px-1.5 text-xs">
                  <ClipboardPaste className="h-3 w-3 mr-1" />
                  Paste
                </Button>
              )}
              {input && (
                <>
                  {result?.formatted && (
                    <Button variant="ghost" size="sm" onClick={handleCopy} className="h-6 px-1.5 text-xs">
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={handleClear} className="h-6 px-1.5 text-xs">
                    <X className="h-3 w-3" />
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="relative flex-1 min-w-0 overflow-auto hide-scrollbar" ref={scrollContainerRef}>
              <div className="relative min-h-full">
                {/* Grid mirror: determines line heights for wrapped text */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: "2.5rem 1fr" }}
                  aria-hidden
                >
                  {lines.map((line, i) => {
                    const lineNum = i + 1;
                    const isError = errorLine === lineNum;
                    return (
                      <Fragment key={i}>
                        <div
                          className={`text-right pr-2 text-xs leading-6 select-none border-r border-border/50 sticky left-0 bg-background z-10 ${
                            isError
                              ? "text-red-500 bg-red-500/10"
                              : "text-muted-foreground/40"
                          }`}
                        >
                          {lineNum}
                        </div>
                        <div
                          className={`pl-2 pr-3 font-mono text-sm leading-6 whitespace-pre-wrap break-words text-transparent min-w-0 ${
                            isError ? "bg-red-500/10" : ""
                          }`}
                          style={{ tabSize: 2 }}
                        >
                          {line || "\u200b"}
                        </div>
                      </Fragment>
                    );
                  })}
                </div>

                {/* Textarea overlay */}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Paste or type JSON here..."
                  className="absolute inset-0 w-full h-full resize-none bg-transparent pl-12 pr-3 py-0 m-0 border-0 font-mono text-sm leading-6 outline-none overflow-hidden placeholder:text-muted-foreground caret-foreground whitespace-pre-wrap break-words"
                  spellCheck={false}
                  style={{ tabSize: 2 }}
                />
              </div>
            </div>
            <EditorScrollbar
              scrollContainerRef={scrollContainerRef}
              totalLines={lineCount}
              markers={errorLine ? [{ line: errorLine, color: "oklch(0.55 0.2 27)" }] : undefined}
            />
          </div>
        </div>

        {/* Resize handle */}
        <ResizeHandle index={0} onResize={handleResize} />

        {/* Right: Tree view pane */}
        <div className="flex flex-col min-w-0" style={{ width: `${widths[1]}%` }}>
          <div className="flex items-center gap-2 px-3 h-8 border-b bg-muted/30 shrink-0">
            <span className="text-xs font-semibold text-muted-foreground">Preview</span>
            {result?.valid && result.value !== undefined && (
              <>
                <form
                  className="relative flex-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setTreeSearch(treeSearchInput);
                  }}
                >
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                  <input
                    placeholder="Search keys… (Enter)"
                    value={treeSearchInput}
                    onChange={(e) => setTreeSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        setTreeSearchInput("");
                        setTreeSearch("");
                      }
                    }}
                    className="h-6 w-full rounded border border-input bg-transparent pl-6 pr-2 text-xs outline-none focus:border-ring"
                  />
                </form>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleExpandAll}
                  onMouseDown={(e) => e.preventDefault()}
                  className="h-6 px-1.5 text-xs shrink-0"
                >
                  {allExpanded ? (
                    <ChevronsDownUp className="h-3 w-3" />
                  ) : (
                    <ChevronsUpDown className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}
          </div>
          <div className="flex flex-1 min-h-0">
            <div className="flex-1 min-w-0 overflow-auto hide-scrollbar p-4" ref={previewScrollRef}>
              {result?.valid && result.value !== undefined ? (
                <JsonTree
                  data={result.value}
                  searchQuery={treeSearch}
                  defaultExpanded={allExpanded}
                  expandGeneration={expandGen}
                />
              ) : !input ? (
                <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                  Paste JSON on the left to validate and explore it.
                </div>
              ) : result && !result.valid ? (
                <div className="space-y-2 p-2">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">Invalid JSON</p>
                      <p className="mt-1 text-xs font-mono text-muted-foreground">
                        {result.error?.message}
                      </p>
                      {result.error?.line && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Line {result.error.line}
                          {result.error.column && `, Column ${result.error.column}`}
                        </p>
                      )}
                      {result.corrections && result.corrections.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground italic">
                          Attempted fixes: {result.corrections.join(", ")} — but the input still has errors.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
            <EditorScrollbar scrollContainerRef={previewScrollRef} />
          </div>
        </div>
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
      const container = handleRef.current?.parentElement;
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
