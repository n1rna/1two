"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDashed,
  GitBranch,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { type LifeAgentRun } from "@/lib/life";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { useAgentRunsStream } from "./use-agent-runs-stream";

interface ActivitySectionProps {
  /** Drawer open state — polling ramps up when true, idles when false. */
  open: boolean;
  /**
   * "preview" shows the 2 most recent runs with a "View all" button; used
   * inline above the chat thread. "full" replaces the chat body with a
   * scrollable list of all runs plus a back button.
   */
  mode: "preview" | "full";
  /** Called when the user clicks "View all activity" in preview mode. */
  onViewAll?: () => void;
  /** Called when the user clicks the back arrow in full mode. */
  onBack?: () => void;
}

/**
 * ActivitySection renders recent background agent runs inside the Kim drawer.
 * It hydrates once from /life/agent-runs and then subscribes to
 * /life/agent-runs/stream (SSE) via useAgentRunsStream so updates arrive
 * live — no polling. The pulse dot on the drawer trigger is still driven
 * by useAgentRunsPulse, which uses the cheap pulse endpoint.
 *
 * Two modes:
 *   preview — shows runs.slice(0, 2) plus a "View all activity · N" button.
 *             Rendered above the chat thread. Returns null if no runs.
 *   full    — replaces the chat body; shows up to 50 runs in a scrollable
 *             list with a back button at the top.
 */
export function ActivitySection({
  open,
  mode,
  onViewAll,
  onBack,
}: ActivitySectionProps) {
  const { t } = useTranslation("kim");
  const { runs, hasActive } = useAgentRunsStream({ open });
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const previewRuns = useMemo(() => runs.slice(0, 2), [runs]);
  const fullRuns = useMemo(() => runs.slice(0, 50), [runs]);

  if (mode === "preview") {
    if (previewRuns.length === 0) return null;
    return (
      <div
        className="relative border-b"
        style={{ borderColor: "var(--kim-border)" }}
      >
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-[var(--kim-teal-soft)]/60"
        >
          {collapsed ? (
            <ChevronRight size={11} style={{ color: "var(--kim-amber)" }} />
          ) : (
            <ChevronDown size={11} style={{ color: "var(--kim-amber)" }} />
          )}
          <Sparkles size={11} style={{ color: "var(--kim-amber)" }} />
          <span
            className="kim-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--kim-ink-dim)" }}
          >
            {t("activity_title")}
          </span>
          <span
            className="kim-mono text-[10px] tracking-[0.14em]"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            · {runs.length}
          </span>
          {hasActive && (
            <span
              className="ml-auto kim-mono text-[9.5px] uppercase tracking-[0.16em]"
              style={{ color: "var(--kim-amber)" }}
            >
              {t("activity_running")}
            </span>
          )}
        </button>
        {!collapsed && (
          <>
            <div className="px-3 pb-2 space-y-1">
              {previewRuns.map((run) => (
                <ActivityRunRow
                  key={run.id}
                  run={run}
                  expanded={expandedRunId === run.id}
                  onToggleExpanded={() =>
                    setExpandedRunId((cur) => (cur === run.id ? null : run.id))
                  }
                />
              ))}
            </div>
            {onViewAll && (
              <button
                onClick={onViewAll}
                className="w-full flex items-center justify-between px-5 py-2 border-t hover:bg-[var(--kim-teal-soft)]/60 kim-mono text-[10px] uppercase tracking-[0.16em]"
                style={{
                  borderColor: "var(--kim-border)",
                  color: "var(--kim-amber)",
                }}
              >
                <span>{t("activity_view_all", { count: runs.length })}</span>
                <ChevronRight size={11} />
              </button>
            )}
          </>
        )}
      </div>
    );
  }

  // Full mode — fills the drawer body.
  return (
    <div className="relative flex-1 min-h-0 flex flex-col">
      <div
        className="flex items-center gap-2 px-5 py-2.5 border-b"
        style={{ borderColor: "var(--kim-border)" }}
      >
        {onBack && (
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 kim-mono text-[10px] uppercase tracking-[0.16em] hover:opacity-100"
            style={{ color: "var(--kim-amber)" }}
            title={t("activity_back_to_chat")}
          >
            <ArrowLeft size={11} />
            {t("activity_back_to_chat")}
          </button>
        )}
        <Sparkles
          size={11}
          className="ml-3"
          style={{ color: "var(--kim-amber)" }}
        />
        <span
          className="kim-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: "var(--kim-ink-dim)" }}
        >
          {t("activity_title")}
        </span>
        <span
          className="kim-mono text-[10px] tracking-[0.14em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          · {fullRuns.length}
        </span>
        {hasActive && (
          <span
            className="ml-auto kim-mono text-[9.5px] uppercase tracking-[0.16em]"
            style={{ color: "var(--kim-amber)" }}
          >
            {t("activity_running")}
          </span>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1">
        {fullRuns.length === 0 ? (
          <div
            className="px-2 py-6 text-xs italic text-center"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            {t("activity_empty")}
          </div>
        ) : (
          fullRuns.map((run) => (
            <ActivityRunRow
              key={run.id}
              run={run}
              expanded={expandedRunId === run.id}
              onToggleExpanded={() =>
                setExpandedRunId((cur) => (cur === run.id ? null : run.id))
              }
            />
          ))
        )}
      </div>
    </div>
  );
}

function ActivityRunRow({
  run,
  expanded,
  onToggleExpanded,
}: {
  run: LifeAgentRun;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const { t } = useTranslation("kim");
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (run.status !== "running") return;
    const h = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(h);
  }, [run.status]);

  const KindIcon = run.kind === "journey" ? GitBranch : CircleDashed;
  const startedMs = new Date(run.startedAt).getTime();
  const elapsedSec =
    run.status === "running"
      ? Math.max(0, Math.round((now - startedMs) / 1000))
      : run.durationMs != null
      ? Math.round(run.durationMs / 1000)
      : null;
  const producedCount = run.producedActionableIds.length;

  return (
    <div
      className="rounded-sm"
      style={{
        background: "var(--kim-bg-sunken)",
        border: "1px solid var(--kim-border)",
      }}
    >
      <button
        onClick={onToggleExpanded}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:brightness-110"
      >
        <KindIcon
          size={12}
          className="mt-0.5 shrink-0"
          style={{ color: "var(--kim-amber)" }}
        />
        <div className="flex-1 min-w-0">
          <div
            className="text-xs truncate"
            style={{ color: "var(--kim-ink)" }}
          >
            {run.title || run.kind}
          </div>
          {run.subtitle && (
            <div
              className="text-[11px] truncate kim-mono"
              style={{ color: "var(--kim-ink-faint)" }}
            >
              {run.subtitle}
            </div>
          )}
        </div>
        <ActivityStatusPill run={run} elapsedSec={elapsedSec} />
      </button>
      {expanded && (
        <div
          className="px-3 pb-2.5 text-[11px] space-y-1.5 border-t"
          style={{ borderColor: "var(--kim-border)", color: "var(--kim-ink-dim)" }}
        >
          {run.resultSummary && (
            <div className="pt-2">{run.resultSummary}</div>
          )}
          {run.error && (
            <div
              className="pt-2 flex items-start gap-1.5"
              style={{ color: "var(--kim-rose)" }}
            >
              <AlertTriangle size={11} className="mt-0.5 shrink-0" />
              <span className="break-words">{truncate(run.error, 240)}</span>
            </div>
          )}
          {run.toolCalls.length > 0 && (
            <ul className="pt-1 space-y-0.5">
              {run.toolCalls.slice(0, 8).map((tc, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-1.5 kim-mono text-[10.5px]"
                  style={{ color: "var(--kim-ink-faint)" }}
                >
                  <span style={{ color: "var(--kim-amber)" }}>·</span>
                  <span className="truncate">{tc.tool}</span>
                  {tc.error && (
                    <span style={{ color: "var(--kim-rose)" }}>
                      · {t("tool_failed")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {producedCount > 0 && (
            <Link
              href={`${routes.actionables}?run=${run.id}`}
              className="mt-1 inline-flex items-center gap-1 kim-mono text-[10.5px] uppercase tracking-[0.14em]"
              style={{ color: "var(--kim-amber)" }}
            >
              {t("activity_view_actionables", { count: producedCount })}
              <ChevronRight size={10} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function ActivityStatusPill({
  run,
  elapsedSec,
}: {
  run: LifeAgentRun;
  elapsedSec: number | null;
}) {
  const { t } = useTranslation("kim");

  if (run.status === "running") {
    return (
      <span
        className={cn(
          "kim-mono text-[9.5px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1 shrink-0",
        )}
        style={{
          color: "var(--kim-amber)",
          border: "1px solid rgb(232 176 92 / 0.4)",
        }}
      >
        <Loader2 size={9} className="animate-spin" />
        {elapsedSec != null ? `${elapsedSec}s` : t("activity_running")}
      </span>
    );
  }

  if (run.status === "completed") {
    return (
      <span
        className="kim-mono text-[9.5px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1 shrink-0"
        style={{
          color: "var(--kim-ink-faint)",
          border: "1px solid var(--kim-border)",
        }}
      >
        <Check size={9} />
        {elapsedSec != null ? `${elapsedSec}s` : t("activity_completed")}
      </span>
    );
  }

  return (
    <span
      className="kim-mono text-[9.5px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1 shrink-0"
      style={{
        color: "var(--kim-rose)",
        border: "1px solid rgb(232 120 130 / 0.4)",
      }}
    >
      <AlertTriangle size={9} />
      {t("activity_failed")}
    </span>
  );
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}
