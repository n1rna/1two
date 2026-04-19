"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import type { ChatEffect, LifeActionable } from "@/lib/life";
import { InlineChatActionable } from "./inline-actionable";
import { toolMeta, READ_ONLY_TOOLS } from "./tool-labels";
import { useTranslation } from "react-i18next";

// ─── Per-effect rendering (actionables, etc) ─────────────────────────────────

export function ToolCallDisplay({
  effect,
  msgId,
  onActionableRespond,
  onActionableStatusChange,
}: {
  effect: ChatEffect;
  msgId: string;
  onActionableRespond: (id: string, action: string, data?: unknown) => Promise<void>;
  onActionableStatusChange?: (msgId: string, actionableId: string, status: string) => void;
}) {
  // Interactive actionables are special — they render an inline form rather
  // than a one-line trace row.
  if (effect.tool === "create_actionable" && effect.actionable) {
    const a = effect.actionable as LifeActionable;
    const resolved = a.status !== "pending";
    if (resolved) {
      return (
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 text-xs" style={{ color: "var(--kim-ink-dim)" }}>
            <Check className="size-3.5" />
            <span>{a.title}</span>
            <span className="opacity-50">· {a.status}</span>
          </div>
        </div>
      );
    }
    return (
      <div className="mt-2 max-w-[90%]">
        <InlineChatActionable
          actionable={a}
          onRespond={async (action, data) => {
            await onActionableRespond(effect.id, action, data);
            onActionableStatusChange?.(
              msgId,
              effect.id,
              action === "dismiss" ? "dismissed" : "confirmed",
            );
          }}
        />
      </div>
    );
  }

  // Read-only lookups are hidden from the visible trace.
  if (READ_ONLY_TOOLS.has(effect.tool)) return null;

  return <TraceRow effect={effect} state="done" />;
}

// ─── Trace block ──────────────────────────────────────────────────────────────

type TraceState = "queued" | "active" | "done";

interface TraceEntry {
  key: string;
  effect?: ChatEffect;
  toolName: string;
  state: TraceState;
}

export interface ToolTraceBlockProps {
  /** One entry per tool call. Order top→bottom mirrors invocation order. */
  entries: TraceEntry[];
  /** True while the agent is still streaming. */
  streaming: boolean;
  className?: string;
}

/**
 * Container for a single assistant turn's tool activity. Renders a
 * rounded muted panel with a mono head ("WORKING · 4s" / "Done · 3 steps")
 * and per-call rows, each with a state-coloured 8px bullet.
 */
export function ToolTraceBlock({ entries, streaming, className }: ToolTraceBlockProps) {
  const { t } = useTranslation("kim");
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Track elapsed wall time while streaming so the head reads "WORKING · Ns".
  useEffect(() => {
    if (!streaming) return;
    if (startRef.current == null) startRef.current = Date.now();
    const id = setInterval(() => {
      if (startRef.current != null) {
        setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
      }
    }, 250);
    return () => clearInterval(id);
  }, [streaming]);

  // Reset once the turn finishes so the next one starts clean.
  useEffect(() => {
    if (!streaming) {
      startRef.current = null;
      setElapsed(0);
    }
  }, [streaming]);

  if (entries.length === 0) return null;

  const steps = entries.length;
  const headText = streaming
    ? t("trace_working", { seconds: elapsed, defaultValue: "Working · {{seconds}}s" })
    : t("trace_done", { count: steps, defaultValue: "Done · {{count}} steps" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "mt-2 max-w-[92%] rounded-md border",
        className,
      )}
      style={{
        background: "var(--kim-bg-raised, var(--muted))",
        borderColor: "var(--kim-border, var(--border))",
      }}
    >
      <div
        className="kim-mono text-[10px] uppercase tracking-[0.18em] px-3 py-1.5 border-b"
        style={{
          color: streaming ? "var(--kim-amber, var(--primary))" : "var(--kim-ink-faint, var(--muted-foreground))",
          borderColor: "var(--kim-border, var(--border))",
        }}
      >
        {headText}
      </div>
      <div className="px-3 py-1.5 space-y-0.5">
        {entries.map((entry) => (
          <TraceRow
            key={entry.key}
            effect={entry.effect}
            toolName={entry.toolName}
            state={entry.state}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Single trace row ─────────────────────────────────────────────────────────

function TraceRow({
  effect,
  toolName,
  state,
}: {
  effect?: ChatEffect;
  toolName?: string;
  state: TraceState;
}) {
  const tool = effect?.tool ?? toolName ?? "";
  const meta = toolMeta(tool);
  const data = effect?.data;
  const failed = effect?.success === false;

  const pick = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  let detail: string | null = null;
  if (effect?.tool === "draft_form" && data) {
    const form = pick(data.form);
    const values = data.values as Record<string, unknown> | undefined;
    const fields = values ? Object.keys(values).slice(0, 4).join(", ") : "";
    detail = form ? (fields ? `${form}: ${fields}` : form) : null;
  } else if (data) {
    detail =
      pick(data.content) ??
      pick(data.name) ??
      pick(data.title) ??
      pick(data.summary) ??
      (data.deleted ? "Deleted" : null) ??
      (data.forgotten ? "Removed" : null);
  }

  const routineId =
    (effect?.tool === "create_routine" || effect?.tool === "update_routine") &&
    data?.routine_id != null
      ? String(data.routine_id)
      : null;
  const calendarLink =
    effect?.tool === "create_calendar_event" && data?.htmlLink != null
      ? String(data.htmlLink)
      : null;
  const memoryLink = effect?.tool === "remember" && data ? true : false;

  const linkEl = routineId ? (
    <Link
      href={routes.routine(routineId)}
      className="opacity-60 hover:opacity-100"
      style={{ color: "var(--kim-amber, var(--primary))" }}
    >
      <ExternalLink className="size-3" />
    </Link>
  ) : memoryLink ? (
    <Link
      href={routes.memories}
      className="opacity-60 hover:opacity-100"
      style={{ color: "var(--kim-amber, var(--primary))" }}
    >
      <ExternalLink className="size-3" />
    </Link>
  ) : calendarLink ? (
    <a
      href={calendarLink}
      target="_blank"
      rel="noopener noreferrer"
      className="opacity-60 hover:opacity-100"
      style={{ color: "var(--kim-amber, var(--primary))" }}
    >
      <ExternalLink className="size-3" />
    </a>
  ) : null;

  return (
    <div
      className={cn("flex items-center gap-2 text-xs py-0.5")}
      style={{
        color: failed
          ? "var(--kim-rose, var(--destructive))"
          : "var(--kim-ink-dim, var(--foreground))",
      }}
    >
      <TraceBullet state={failed ? "done" : state} failed={failed} />
      <span className="shrink-0 flex items-center gap-1.5">
        {failed ? (
          <AlertCircle className="size-3" />
        ) : (
          <span style={{ color: "var(--kim-amber, var(--primary))" }} aria-hidden>
            {meta.icon}
          </span>
        )}
        <span>
          {failed
            ? "Failed"
            : state === "active"
              ? meta.activeLabel + "…"
              : meta.label}
        </span>
      </span>
      {failed && effect?.error && (
        <span className="opacity-70 truncate max-w-[220px] font-mono text-[11px]">
          {effect.error}
        </span>
      )}
      {!failed && detail && (
        <span className="ml-auto opacity-60 truncate max-w-[240px] font-mono text-[11px] text-right">
          {detail}
        </span>
      )}
      {!failed && linkEl && <span className="ml-1">{linkEl}</span>}
    </div>
  );
}

function TraceBullet({ state, failed }: { state: TraceState; failed?: boolean }) {
  // 8px circle. queued = muted border-only; active = primary fill + pulse;
  // done = teal/amber fill.
  if (failed) {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{ background: "var(--kim-rose, var(--destructive))" }}
      />
    );
  }
  if (state === "queued") {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full shrink-0 border"
        style={{ borderColor: "var(--kim-ink-faint, var(--muted-foreground))" }}
      />
    );
  }
  if (state === "active") {
    return (
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full shrink-0"
        style={{
          background: "var(--kim-amber, var(--primary))",
          animation: "kim-pulse-dot 1.4s ease-in-out infinite",
        }}
      />
    );
  }
  // done
  return (
    <span
      aria-hidden
      className="inline-block h-2 w-2 rounded-full shrink-0"
      style={{ background: "var(--kim-teal, var(--accent))" }}
    />
  );
}
