"use client";

import { AlertCircle, Check, ExternalLink } from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { ChatEffect, LifeActionable } from "@/lib/life";
import { InlineChatActionable } from "./inline-actionable";
import { toolMeta, READ_ONLY_TOOLS } from "./tool-labels";

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
  const meta = toolMeta(effect.tool);

  // ── Actionable (interactive) ──
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

  // ── Read-only lookup tools — hidden ──
  if (READ_ONLY_TOOLS.has(effect.tool)) return null;

  // ── Generic tool result row ──
  const data = effect.data;
  const pick = (v: unknown): string | null =>
    typeof v === "string" && v.length > 0 ? v : null;

  // draft_form: show which form was updated and which fields
  let detail: string | null = null;
  if (effect.tool === "draft_form" && data) {
    const form = pick(data.form);
    const values = data.values as Record<string, unknown> | undefined;
    const fields = values ? Object.keys(values).slice(0, 4).join(", ") : "";
    detail = form ? (fields ? `${form}: ${fields}` : form) : null;
  } else {
    detail =
      pick(data?.content) ??
      pick(data?.name) ??
      pick(data?.title) ??
      pick(data?.summary) ??
      (data?.deleted ? "Deleted" : null) ??
      (data?.forgotten ? "Removed" : null);
  }

  const routineId =
    (effect.tool === "create_routine" || effect.tool === "update_routine") && data?.routine_id != null
      ? String(data.routine_id)
      : null;
  const calendarLink = effect.tool === "create_calendar_event" && data?.htmlLink != null ? String(data.htmlLink) : null;
  const memoryLink = effect.tool === "remember" && data ? true : false;

  const linkEl = routineId ? (
    <Link href={`/routines/${routineId}`} className="opacity-60 hover:opacity-100" style={{ color: "var(--kim-amber)" }}>
      <ExternalLink className="size-3" />
    </Link>
  ) : memoryLink ? (
    <Link href="/memories" className="opacity-60 hover:opacity-100" style={{ color: "var(--kim-amber)" }}>
      <ExternalLink className="size-3" />
    </Link>
  ) : calendarLink ? (
    <a href={calendarLink} target="_blank" rel="noopener noreferrer" className="opacity-60 hover:opacity-100" style={{ color: "var(--kim-amber)" }}>
      <ExternalLink className="size-3" />
    </a>
  ) : null;

  const failed = effect.success === false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn("mt-1.5 flex items-center gap-2 text-xs")}
      style={{ color: failed ? "var(--kim-rose)" : "var(--kim-ink-dim)" }}
    >
      <div
        className="flex items-center justify-center size-4 rounded-full shrink-0"
        style={{
          background: failed ? "rgb(232 120 130 / 0.12)" : "var(--kim-amber-soft)",
          color: failed ? "var(--kim-rose)" : "var(--kim-amber)",
        }}
      >
        {failed ? <AlertCircle className="size-2.5" /> : meta.icon}
      </div>
      <span>{failed ? "Failed" : meta.label}</span>
      {failed && effect.error && <span className="opacity-60 truncate max-w-[200px]">· {effect.error}</span>}
      {!failed && detail && <span className="opacity-60 truncate max-w-[200px]">· {detail}</span>}
      {!failed && linkEl}
    </motion.div>
  );
}
