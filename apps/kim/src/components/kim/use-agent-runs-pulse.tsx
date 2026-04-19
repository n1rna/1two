"use client";

import { useEffect, useRef, useState } from "react";

import { getLifeAgentRunsPulse } from "@/lib/life";

/**
 * useAgentRunsPulse polls /life/agent-runs/pulse so the Kim drawer can show
 * a small amber dot whenever the user has any background agent work in
 * flight (journey runs, actionable follow-ups, scheduler cycles). Polls
 * every 5s while `active` is true and the drawer is open, otherwise every
 * 30s. Errors are swallowed — the pulse is a cue, not a hard dependency.
 */
export function useAgentRunsPulse(opts?: { open?: boolean }) {
  const { open = true } = opts ?? {};
  const [running, setRunning] = useState(false);
  const [count, setCount] = useState(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await getLifeAgentRunsPulse();
        if (cancelled || !mounted.current) return;
        setRunning(res.running);
        setCount(res.count);
      } catch {
        // best-effort; keep last known value.
      }
    };
    void tick();
    const interval = running && open ? 5000 : 30000;
    const h = setInterval(() => void tick(), interval);
    return () => {
      cancelled = true;
      clearInterval(h);
    };
  }, [open, running]);

  return { running, count };
}
