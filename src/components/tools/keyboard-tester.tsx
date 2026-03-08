"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Keyboard, RotateCcw, Check, ScanSearch, X } from "lucide-react";
import {
  getKeyboardRows,
  applyLayout,
  applySplit,
  collectVisibleCodes,
  getKeyLabel,
  detectLayout,
  DETECT_KEYS,
  SIZE_LABELS,
  LAYOUT_LABELS,
  type KeyboardSize,
  type KeyboardLayout,
  type HighlightMode,
  type DetectResult,
  type KeyDef,
  type KeyRow,
} from "@/lib/tools/keyboard";

interface KeyEvent {
  code: string;
  key: string;
  timestamp: number;
}

export function KeyboardTester() {
  const [size, setSize] = useState<KeyboardSize>("tkl");
  const [layout, setLayout] = useState<KeyboardLayout>("qwerty");
  const [split, setSplit] = useState(false);
  const [mode, setMode] = useState<HighlightMode>("all");
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const [lastEvent, setLastEvent] = useState<KeyEvent | null>(null);
  const [keyCount, setKeyCount] = useState(0);
  const [allPressedCodes, setAllPressedCodes] = useState<Set<string>>(new Set());
  const [detecting, setDetecting] = useState(false);
  const [detectStep, setDetectStep] = useState(0);
  const [detectSamples, setDetectSamples] = useState<Record<string, string>>({});
  const [detectResults, setDetectResults] = useState<DetectResult[] | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      e.preventDefault();
      const code = e.code;

      // Detection mode: capture the key for the current step
      if (detecting && detectStep < DETECT_KEYS.length) {
        const expected = DETECT_KEYS[detectStep];
        if (code === expected.code) {
          const newSamples = { ...detectSamples, [code]: e.key };
          setDetectSamples(newSamples);
          const nextStep = detectStep + 1;
          setDetectStep(nextStep);
          if (nextStep >= DETECT_KEYS.length) {
            // Done — compute results
            setDetectResults(detectLayout(newSamples));
          }
        }
        return;
      }

      setActiveKeys((prev) => new Set(prev).add(code));
      setAllPressedCodes((prev) => new Set(prev).add(code));
      setLastEvent({ code, key: e.key, timestamp: Date.now() });
      setKeyCount((c) => c + 1);

      if (mode === "all") {
        setHighlighted((prev) => new Set(prev).add(code));
      } else {
        setHighlighted(new Set([code]));
      }
    },
    [mode, detecting, detectStep, detectSamples]
  );

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    e.preventDefault();
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(e.code);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  const clearHighlights = useCallback(() => {
    setHighlighted(new Set());
    setActiveKeys(new Set());
    setAllPressedCodes(new Set());
    setLastEvent(null);
    setKeyCount(0);
  }, []);

  const kbRows = getKeyboardRows(size);
  const { rows, navCluster, arrowCluster, numpad } = kbRows;
  const layoutRows = applyLayout(rows, layout);
  const finalRows = split ? applySplit(layoutRows) : layoutRows;

  // Visible key codes in current layout
  const visibleCodes = collectVisibleCodes(kbRows);
  const totalKeys = visibleCodes.size;
  const testedKeys = [...visibleCodes].filter((k) => highlighted.has(k)).length;

  // Extra keys: pressed but not in the visual layout
  const extraCodes = [...allPressedCodes].filter((c) => !visibleCodes.has(c));

  return (
    <div
      className="flex flex-col h-full overflow-hidden"
      ref={containerRef}
      tabIndex={0}
    >
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Keyboard className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Keyboard Tester</span>

          <span className="text-xs text-muted-foreground ml-2">
            {testedKeys}/{totalKeys} keys tested
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <Select
              value={size}
              onValueChange={(v) => v && setSize(v as KeyboardSize)}
            >
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(SIZE_LABELS) as [KeyboardSize, string][]).map(
                  ([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>

            <Select
              value={layout}
              onValueChange={(v) => v && setLayout(v as KeyboardLayout)}
            >
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(LAYOUT_LABELS) as [KeyboardLayout, string][]
                ).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={split}
                onChange={(e) => setSplit(e.target.checked)}
                className="rounded border-input"
              />
              Split
            </label>

            <Select
              value={mode}
              onValueChange={(v) => v && setMode(v as HighlightMode)}
            >
              <SelectTrigger size="sm" className="text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Keep all</SelectItem>
                <SelectItem value="last">Last key only</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => {
                setDetecting(true);
                setDetectStep(0);
                setDetectSamples({});
                setDetectResults(null);
              }}
            >
              <ScanSearch className="h-3.5 w-3.5" />
              Detect Layout
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={clearHighlights}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Keyboard visual */}
      <div className="flex-1 min-h-0 overflow-auto flex flex-col items-center justify-center p-6 gap-6">
        {/* Key info bar — always takes space to prevent layout shift */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground h-5">
          {lastEvent && (
            <>
              <div>
                <span className="text-muted-foreground/60">Key: </span>
                <span className="font-mono text-foreground">
                  {lastEvent.key === " " ? "Space" : lastEvent.key}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60">Code: </span>
                <span className="font-mono text-foreground">
                  {lastEvent.code}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground/60">Presses: </span>
                <span className="font-mono text-foreground">{keyCount}</span>
              </div>
            </>
          )}
        </div>

        {/* Keyboard */}
        <div className="flex gap-3 select-none">
          {/* Main section */}
          <div className="flex flex-col gap-[3px]">
            {finalRows.map((row, ri) => (
              <div key={ri} className="flex gap-[3px]">
                {row.map((keyDef) => (
                  <KeyCap
                    key={keyDef.code}
                    keyDef={keyDef}
                    active={activeKeys.has(keyDef.code)}
                    highlighted={highlighted.has(keyDef.code)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Nav + Arrows cluster (TKL / Full) */}
          {(navCluster || arrowCluster) && (
            <div className="flex flex-col gap-[3px]">
              {/* Skip function row height if present */}
              {(size === "tkl" || size === "full") && (
                <div style={{ height: "calc(2.25rem + 3px)" }} />
              )}
              {navCluster &&
                navCluster.map((row, ri) => (
                  <div key={`nav-${ri}`} className="flex gap-[3px]">
                    {row.map((keyDef) => (
                      <KeyCap
                        key={keyDef.code}
                        keyDef={keyDef}
                        active={activeKeys.has(keyDef.code)}
                        highlighted={highlighted.has(keyDef.code)}
                      />
                    ))}
                  </div>
                ))}
              {/* Gap before arrows */}
              <div style={{ height: "calc(2.25rem + 3px)" }} />
              {arrowCluster &&
                arrowCluster.map((row, ri) => (
                  <div
                    key={`arrow-${ri}`}
                    className="flex gap-[3px]"
                    style={
                      row.length === 1
                        ? { paddingLeft: "calc(2.25rem + 3px)" }
                        : undefined
                    }
                  >
                    {row.map((keyDef) => (
                      <KeyCap
                        key={keyDef.code}
                        keyDef={keyDef}
                        active={activeKeys.has(keyDef.code)}
                        highlighted={highlighted.has(keyDef.code)}
                      />
                    ))}
                  </div>
                ))}
            </div>
          )}

          {/* Numpad (Full only) */}
          {numpad && (
            <div className="flex flex-col gap-[3px]">
              {/* Skip function row height */}
              <div style={{ height: "calc(2.25rem + 3px)" }} />
              {numpad.map((row, ri) => (
                <div key={`num-${ri}`} className="flex gap-[3px]">
                  {row.map((keyDef) => (
                    <KeyCap
                      key={keyDef.code}
                      keyDef={keyDef}
                      active={activeKeys.has(keyDef.code)}
                      highlighted={highlighted.has(keyDef.code)}
                      tall={
                        keyDef.code === "NumpadAdd" ||
                        keyDef.code === "NumpadEnter"
                      }
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Extra keys not in current layout */}
        {extraCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 max-w-2xl">
            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wide mr-1">
              Other keys
            </span>
            {extraCodes.map((code) => (
              <div
                key={code}
                className={`border rounded-md px-2 py-1 text-[10px] font-medium shrink-0 transition-colors duration-75 ${
                  activeKeys.has(code)
                    ? "bg-blue-500 text-white border-blue-600"
                    : highlighted.has(code)
                      ? "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40"
                      : "bg-muted/60 text-foreground/70 border-border/50"
                }`}
              >
                {getKeyLabel(code)}
              </div>
            ))}
          </div>
        )}

        <div className="text-sm text-muted-foreground/50 h-5">
          {!lastEvent && !detecting && "Press any key to start testing"}
        </div>
      </div>

      {/* Detection overlay */}
      {detecting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background border rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
            {detectResults ? (
              // Results
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-green-500" />
                  <span className="font-semibold text-sm">Layout Detected</span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {detectResults.map((r) => (
                    <div
                      key={r.layout}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="font-medium">
                        {LAYOUT_LABELS[r.layout]}
                      </span>
                      <span className="text-muted-foreground text-xs">
                        {Math.round(r.confidence * 100)}% match
                      </span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  {detectResults.length > 0 && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => {
                        setLayout(detectResults[0].layout);
                        setDetecting(false);
                      }}
                    >
                      Apply {LAYOUT_LABELS[detectResults[0].layout]}
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setDetecting(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
            ) : (
              // Step prompt
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">Detect Layout</span>
                  <button
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setDetecting(false)}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="text-xs text-muted-foreground">
                  Step {detectStep + 1} of {DETECT_KEYS.length}
                </div>
                <div className="w-full bg-muted rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${(detectStep / DETECT_KEYS.length) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-sm text-center py-2">
                  Press{" "}
                  <span className="font-semibold">
                    {DETECT_KEYS[detectStep].prompt}
                  </span>
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const KEY_SIZE = 2.25; // rem

function KeyCap({
  keyDef,
  active,
  highlighted,
  tall,
}: {
  keyDef: KeyDef;
  active: boolean;
  highlighted: boolean;
  tall?: boolean;
}) {
  const width = `calc(${keyDef.width * KEY_SIZE}rem + ${(keyDef.width - 1) * 3}px)`;
  const marginLeft = keyDef.gap ? `calc(${keyDef.gap * KEY_SIZE}rem + ${keyDef.gap * 3}px)` : undefined;
  const height = tall ? `calc(${2 * KEY_SIZE}rem + 3px)` : `${KEY_SIZE}rem`;

  let bg = "bg-muted/60";
  let text = "text-foreground/70";
  let border = "border-border/50";

  if (active) {
    bg = "bg-blue-500";
    text = "text-white";
    border = "border-blue-600";
  } else if (highlighted) {
    bg = "bg-green-500/20";
    text = "text-green-600 dark:text-green-400";
    border = "border-green-500/40";
  }

  return (
    <div
      className={`${bg} ${text} ${border} border rounded-md flex items-center justify-center text-[10px] font-medium shrink-0 transition-colors duration-75`}
      style={{ width, height, marginLeft }}
    >
      {keyDef.label}
    </div>
  );
}
