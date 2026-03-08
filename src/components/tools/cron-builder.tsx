"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Clock,
  Copy,
  Check,
  ChevronDown,
  CalendarDays,
  Globe,
  Info,
} from "lucide-react";
import {
  parseCron,
  PRESETS,
  CRON_SYNTAX_GUIDE,
  type CronParseResult,
} from "@/lib/tools/cron";

export function CronBuilder() {
  const [expression, setExpression] = useState("*/5 * * * *");
  const [timezone, setTimezone] = useState("");
  const [showTz, setShowTz] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const result = useMemo<CronParseResult>(
    () => parseCron(expression, { tz: timezone || undefined, count: 10 }),
    [expression, timezone]
  );

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(expression.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [expression]);

  const selectPreset = useCallback((value: string) => {
    setExpression(value);
    setPresetsOpen(false);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!timezone) {
      setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    }
  }, [timezone]);

  const parts = expression.trim().split(/\s+/);
  const nextDate = result.valid && result.nextDates?.[0];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">Cron</span>

        {result.valid && (
          <div className="flex items-center gap-1 text-xs text-green-500 ml-2">
            <Check className="h-3.5 w-3.5" />
            Valid
          </div>
        )}
        {!result.valid && expression.trim() && (
          <div className="flex items-center gap-1 text-xs text-destructive ml-2">
            <Info className="h-3.5 w-3.5" />
            Invalid
          </div>
        )}

        <div className="flex items-center gap-1 ml-auto">
          {/* Presets dropdown */}
          <div className="relative">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setPresetsOpen((v) => !v)}
              className="h-6 px-2 text-xs"
            >
              Presets
              <ChevronDown className="h-3 w-3 ml-1" />
            </Button>
            {presetsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setPresetsOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-popover border rounded shadow-lg py-1 max-h-80 overflow-auto">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      onClick={() => selectPreset(p.value)}
                      className={`w-full text-left px-3 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2 ${
                        expression.trim() === p.value
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="font-mono text-[10px] text-foreground/70 w-28 shrink-0">
                        {p.value}
                      </span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTz((v) => !v)}
            className="h-6 px-2 text-xs"
          >
            <Globe className="h-3 w-3 mr-1" />
            {showTz ? "Hide TZ" : "Timezone"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="h-6 px-2 text-xs"
          >
            {copied ? (
              <Check className="h-3 w-3" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </Button>
        </div>
        </div>
      </div>

      {/* Main content — centered, scrollable */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-2xl mx-auto px-6 py-8 space-y-8">
          {/* Expression input */}
          <div className="space-y-3">
            <input
              ref={inputRef}
              value={expression}
              onChange={(e) => setExpression(e.target.value)}
              placeholder="* * * * *"
              className="w-full text-center font-mono text-3xl bg-transparent outline-none placeholder:text-muted-foreground/30 tracking-[0.3em]"
              spellCheck={false}
              autoFocus
            />

            {/* Human-readable description */}
            <div className="text-center text-sm">
              {result.valid ? (
                <span className="text-foreground">
                  &quot;{result.description}&quot;
                </span>
              ) : expression.trim() ? (
                <span className="text-destructive">{result.error}</span>
              ) : (
                <span className="text-muted-foreground">
                  Enter a cron expression above
                </span>
              )}
            </div>

            {/* Field breakdown */}
            {parts.length >= 5 && (
              <div className="flex justify-center gap-1">
                {["Minute", "Hour", "Day", "Month", "Weekday"]
                  .slice(0, parts.length)
                  .map((label, i) => (
                    <div key={label} className="text-center min-w-[4rem]">
                      <div className="font-mono text-sm bg-muted rounded px-2 py-1 text-foreground">
                        {parts[i] ?? "*"}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {label}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Timezone selector */}
            {showTz && (
              <div className="flex items-center justify-center gap-2">
                <Globe className="h-3 w-3 text-muted-foreground" />
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="text-xs bg-transparent border border-input rounded px-2 py-1 outline-none focus:border-ring"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Next execution */}
          {result.valid && nextDate && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Next Execution
                </span>
                <span className="text-xs text-muted-foreground/50 ml-auto">
                  {showTz ? timezone : "Local time"}
                </span>
              </div>

              <div className="bg-muted/40 rounded-lg px-4 py-3">
                <ExecutionRow date={nextDate} index={0} highlight />
              </div>

              {/* Show more toggle */}
              {result.nextDates && result.nextDates.length > 1 && (
                <>
                  <button
                    onClick={() => setShowAllDates((v) => !v)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                  >
                    <ChevronDown
                      className={`h-3 w-3 transition-transform ${
                        showAllDates ? "rotate-180" : ""
                      }`}
                    />
                    {showAllDates
                      ? "Hide upcoming"
                      : `Show ${result.nextDates.length - 1} more`}
                  </button>
                  {showAllDates && (
                    <div className="border rounded-lg divide-y divide-border/50">
                      {result.nextDates.slice(1).map((date, i) => (
                        <div key={i} className="px-4 py-2">
                          <ExecutionRow date={date} index={i + 1} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Syntax guide */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Syntax Guide
            </div>

            {/* Field ranges */}
            <div className="grid grid-cols-5 gap-1 text-center">
              {(
                [
                  ["Minute", "0–59"],
                  ["Hour", "0–23"],
                  ["Day", "1–31"],
                  ["Month", "1–12"],
                  ["Weekday", "0–6"],
                ] as const
              ).map(([field, range]) => (
                <div key={field} className="bg-muted/40 rounded px-2 py-2">
                  <div className="text-xs font-medium text-foreground">
                    {field}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground mt-0.5">
                    {range}
                  </div>
                </div>
              ))}
            </div>

            {/* Special characters */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {CRON_SYNTAX_GUIDE.map((s) => (
                <div key={s.symbol} className="flex items-center gap-3 py-1">
                  <span className="font-mono text-sm text-foreground bg-muted rounded w-8 h-6 flex items-center justify-center shrink-0">
                    {s.symbol}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {s.meaning}
                  </span>
                </div>
              ))}
            </div>

            {/* Examples inline */}
            <div className="text-xs text-muted-foreground/60 space-y-0.5">
              <div>
                <span className="font-mono text-foreground/50">*/15</span>{" "}
                — every 15 units
              </div>
              <div>
                <span className="font-mono text-foreground/50">1,15</span>{" "}
                — at 1 and 15
              </div>
              <div>
                <span className="font-mono text-foreground/50">1-5</span>{" "}
                — from 1 through 5
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExecutionRow({
  date,
  index,
  highlight,
}: {
  date: Date;
  index: number;
  highlight?: boolean;
}) {
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const relative = formatRelative(diff);

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted-foreground/50 w-5 text-right tabular-nums shrink-0">
        {index + 1}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`font-mono ${highlight ? "text-base" : "text-sm"}`}>
          {date.toLocaleDateString(undefined, {
            weekday: "short",
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
          <span className="text-muted-foreground ml-2">
            {date.toLocaleTimeString(undefined, {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
        </div>
      </div>
      <span
        className={`text-xs shrink-0 ${
          highlight ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {diff > 0 ? `in ${relative}` : "past"}
      </span>
    </div>
  );
}

function formatRelative(ms: number): string {
  if (ms < 0) return "past";
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ${hours % 24}h`;
  const months = Math.floor(days / 30);
  return `${months}mo ${days % 30}d`;
}

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Stockholm",
  "Europe/Helsinki",
  "Europe/Moscow",
  "Europe/Istanbul",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Australia/Sydney",
  "Australia/Melbourne",
  "Pacific/Auckland",
];
