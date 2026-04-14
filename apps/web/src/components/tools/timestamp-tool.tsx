"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check, X, ClipboardPaste, RefreshCw } from "lucide-react";
import {
  parseInput,
  buildResult,
  COMMON_TIMEZONES,
  type TimestampResult,
} from "@/lib/tools/timestamp";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 w-6 p-0 shrink-0"
      onMouseDown={(e) => e.preventDefault()}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

function ResultRow({ label, value, badge }: { label: string; value: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm py-1.5">
      <span className="text-muted-foreground w-24 shrink-0 text-xs font-medium">{label}</span>
      {badge && (
        <Badge variant="outline" className="text-[10px] shrink-0">
          {badge}
        </Badge>
      )}
      <span className="font-mono text-xs flex-1 min-w-0 truncate">{value}</span>
      <CopyButton text={value} />
    </div>
  );
}

function LiveClock({ timezone }: { timezone: string }) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const result = buildResult(now, timezone);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          Current Time
          <Badge variant="secondary" className="text-[10px] font-mono tabular-nums">
            {result.unix}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-0.5">
          <ResultRow label="Unix (s)" value={String(result.unix)} />
          <ResultRow label="Unix (ms)" value={String(result.unixMs)} />
          <ResultRow label="ISO 8601" value={result.iso8601} />
          <ResultRow label="RFC 3339" value={result.rfc3339} badge="RFC 3339" />
          <ResultRow label="RFC 2822" value={result.rfc2822} badge="RFC 2822" />
          <ResultRow label="Formatted" value={result.local} />
        </div>
      </CardContent>
    </Card>
  );
}

export function TimestampTool() {
  const [input, setInput] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [result, setResult] = useState<TimestampResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!input.trim()) {
      setResult(null);
      setError(null);
      return;
    }

    const date = parseInput(input, timezone);
    if (!date || isNaN(date.getTime())) {
      setResult(null);
      setError("Could not parse input. Try a Unix timestamp, ISO 8601 string, or date string.");
      return;
    }

    setError(null);
    setResult(buildResult(date, timezone));
  }, [input, timezone]);

  const handleClear = useCallback(() => {
    setInput("");
    setResult(null);
    setError(null);
    inputRef.current?.focus();
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setInput(text.trim());
  }, []);

  const handleNow = useCallback(() => {
    setInput(String(Math.floor(Date.now() / 1000)));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Parse Timestamp</label>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleNow}
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Now
              </Button>
              {!input && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePaste}
                  className="h-7 px-2 text-xs"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
                  Paste
                </Button>
              )}
              {input && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-7 px-2 text-xs"
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 1700000000, 2024-01-15T14:30:00Z, Jan 15 2024"
            className="font-mono"
            spellCheck={false}
          />
          <p className="text-[11px] text-muted-foreground">
            Accepts Unix timestamps (seconds or milliseconds), ISO 8601, RFC 2822, or natural date strings.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Timezone</label>
          <Select value={timezone} onValueChange={(v) => v && setTimezone(v)}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <LiveClock timezone={timezone} />
      </div>

      <div className="space-y-4">
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive text-sm">{error}</p>
            </CardContent>
          </Card>
        )}

        {result && (
          <>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Parsed Result</CardTitle>
              </CardHeader>
              <CardContent className="space-y-0.5">
                <ResultRow label="Unix (s)" value={String(result.unix)} />
                <ResultRow label="Unix (ms)" value={String(result.unixMs)} />
                <Separator className="my-2" />
                <ResultRow label="ISO 8601" value={result.iso8601} />
                <ResultRow
                  label="RFC 3339"
                  value={result.rfc3339}
                  badge="RFC 3339"
                />
                <ResultRow
                  label="RFC 2822"
                  value={result.rfc2822}
                  badge="RFC 2822"
                />
                <Separator className="my-2" />
                <ResultRow label="UTC" value={result.utc} />
                <ResultRow label="Local" value={result.local} />
                <ResultRow label="Relative" value={result.relative} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Date Components</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Year", value: result.components.year },
                    { label: "Month", value: result.components.month },
                    { label: "Day", value: result.components.day },
                    { label: "Weekday", value: result.components.dayOfWeek },
                    { label: "Hour", value: result.components.hour },
                    { label: "Minute", value: result.components.minute },
                    { label: "Second", value: result.components.second },
                    { label: "Millisecond", value: result.components.millisecond },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="rounded-md border bg-muted/30 p-2 text-center"
                    >
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className="font-mono text-sm font-medium">{value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  Timezone: {result.components.timezone}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Format Reference</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">RFC 3339</Badge>
                    <span className="text-muted-foreground">Internet Date/Time Format</span>
                  </div>
                  <code className="block bg-muted p-2 rounded font-mono text-[11px] break-all">
                    YYYY-MM-DDThh:mm:ssZ
                  </code>
                  <p className="text-muted-foreground mt-1">
                    Profile of ISO 8601 for internet protocols. Uses "T" separator and "Z" for UTC or numeric offset (+HH:MM).
                  </p>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">RFC 2822</Badge>
                    <span className="text-muted-foreground">Email / HTTP Date Format</span>
                  </div>
                  <code className="block bg-muted p-2 rounded font-mono text-[11px] break-all">
                    ddd, DD MMM YYYY HH:mm:ss +HHMM
                  </code>
                  <p className="text-muted-foreground mt-1">
                    Used in email headers (Date field) and HTTP headers. Includes abbreviated weekday and month names.
                  </p>
                </div>
                <Separator />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline" className="text-[10px]">ISO 8601</Badge>
                    <span className="text-muted-foreground">International Standard</span>
                  </div>
                  <code className="block bg-muted p-2 rounded font-mono text-[11px] break-all">
                    YYYY-MM-DDThh:mm:ss.sssZ
                  </code>
                  <p className="text-muted-foreground mt-1">
                    Full ISO 8601 includes fractional seconds. RFC 3339 is a strict profile of this standard for use in internet protocols.
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {!result && !error && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">
                Enter a timestamp or date string on the left to see it parsed into multiple formats. Change the timezone to see conversions across time zones.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
