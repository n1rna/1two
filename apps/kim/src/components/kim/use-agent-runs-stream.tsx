"use client";

import { useEffect, useRef, useState } from "react";

import {
  listLifeAgentRuns,
  type LifeAgentRun,
} from "@/lib/life";

/**
 * useAgentRunsStream keeps a live list of background agent runs for the
 * Kim drawer's Activity section. It seeds the list with a single REST call
 * against /life/agent-runs, then subscribes to
 * /life/agent-runs/stream (SSE) to receive per-run upserts as they happen.
 *
 * We hit the stream endpoint via the same /api/proxy/life route used by
 * listLifeAgentRuns, which forwards the session cookie as
 * X-Session-Token to the API. This is why we use fetch+ReadableStream
 * instead of the native EventSource: EventSource cannot attach custom
 * headers or credentials reliably across our proxy.
 *
 * Reconnects use exponential backoff (1s → 2s → 4s … capped at 30s). The
 * stream is closed on unmount and whenever `open` flips to false — keeping
 * a long-lived HTTP connection idle in a hidden drawer is wasteful, and
 * the pulse hook still drives the dot so users know when to re-open.
 */
export function useAgentRunsStream({ open }: { open: boolean }) {
  const [runs, setRuns] = useState<LifeAgentRun[]>([]);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Derived each render — cheap and keeps the two pieces of state in sync.
  const hasActive = runs.some((r) => r.status === "running");

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let abort: AbortController | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;

    const mergeRun = (incoming: LifeAgentRun) => {
      setRuns((prev) => {
        const next = [...prev];
        const idx = next.findIndex((r) => r.id === incoming.id);
        if (idx >= 0) next[idx] = incoming;
        else next.unshift(incoming);
        // Running first, then by startedAt desc.
        next.sort((a, b) => {
          if (a.status === "running" && b.status !== "running") return -1;
          if (a.status !== "running" && b.status === "running") return 1;
          return b.startedAt.localeCompare(a.startedAt);
        });
        // Cap at 50 to match the list endpoint default.
        return next.slice(0, 50);
      });
    };

    const hydrate = async () => {
      try {
        const res = await listLifeAgentRuns({ status: "all", limit: 20 });
        if (cancelled || !mounted.current) return;
        setRuns(res.runs);
      } catch {
        // best-effort; the stream will still deliver new events.
      }
    };

    const connect = async () => {
      abort = new AbortController();
      try {
        const res = await fetch("/api/proxy/life/agent-runs/stream", {
          credentials: "include",
          headers: { Accept: "text/event-stream" },
          signal: abort.signal,
        });
        if (!res.ok || !res.body) {
          throw new Error(`stream failed (${res.status})`);
        }

        // On successful connect reset the backoff.
        attempt = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // SSE frames are separated by a blank line.
          let sep = buffer.indexOf("\n\n");
          while (sep >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            sep = buffer.indexOf("\n\n");

            let event = "message";
            const dataLines: string[] = [];
            for (const line of frame.split("\n")) {
              if (line.startsWith("event:")) {
                event = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
            }
            if (event === "run" && dataLines.length > 0) {
              try {
                const run = JSON.parse(dataLines.join("\n")) as LifeAgentRun;
                if (!mounted.current) return;
                mergeRun(run);
              } catch {
                // skip malformed frames
              }
            }
            // `ready` and `ping` events are intentionally ignored — they
            // exist only to keep the connection alive.
          }
        }
      } catch {
        // Swallow — scheduleReconnect below handles retries.
      } finally {
        if (!cancelled && mounted.current) {
          scheduleReconnect();
        }
      }
    };

    const scheduleReconnect = () => {
      if (cancelled) return;
      const delay = Math.min(30_000, 1000 * Math.pow(2, attempt));
      attempt += 1;
      retryTimer = setTimeout(() => {
        if (!cancelled) void connect();
      }, delay);
    };

    void hydrate().then(() => {
      if (!cancelled) void connect();
    });

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      abort?.abort();
    };
  }, [open]);

  return { runs, hasActive };
}
