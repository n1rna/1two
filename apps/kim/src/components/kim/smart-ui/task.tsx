"use client";

import { useState } from "react";
import {
  AlarmClock,
  CalendarPlus,
  Check,
  ListTree,
  Share2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { completeGTask } from "@/lib/life";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { Stepper } from "./stepper";
import { useSmartActions } from "./actions";

/** Narrow shape for a Google Task snapshot. */
interface TaskSnapshot {
  id?: string;
  title?: string;
  notes?: string;
  status?: string;
  due?: string;
  /** Name of the containing task list, if known. */
  listName?: string;
  /** Task-list id required by the Google Tasks API. */
  listId?: string;
}

function fmtDue(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1)}…`;
}

export function TaskSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent, smartQuick } = useSmartActions();
  const task = (item.snapshot ?? {}) as TaskSnapshot;
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozeDays, setSnoozeDays] = useState(1);

  const canComplete = !!(task.id && task.listId);

  const dueLabel = fmtDue(task.due);
  const notesLabel = task.notes ? truncate(task.notes.trim(), 60) : undefined;
  const subParts = [dueLabel, notesLabel].filter(Boolean) as string[];
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Check className="h-3 w-3" />}
          kicker={task.listName?.toUpperCase()}
          title={task.title ?? item.label}
          sub={sub}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<Check className="h-3.5 w-3.5" />}
            label={t("task.complete")}
            disabled={!canComplete}
            onClick={() =>
              void smartQuick({
                label: t("task.complete"),
                item,
                successAck: t("ack.completed"),
                errorAck: t("ack.failed"),
                apiCall: async () => {
                  await completeGTask(task.listId!, task.id!);
                },
              })
            }
          />
          <QaBtn
            icon={<ListTree className="h-3.5 w-3.5" />}
            label={t("task.break_down")}
            onClick={() =>
              smartAgent({
                actionKey: "task.break_down",
                label: t("task.break_down"),
                item,
              })
            }
          />
          <QaBtn
            icon={<CalendarPlus className="h-3.5 w-3.5" />}
            label={t("task.schedule_block")}
            onClick={() =>
              smartAgent({
                actionKey: "task.schedule_block",
                label: t("task.schedule_block"),
                item,
              })
            }
          />
          <QaBtn
            icon={<AlarmClock className="h-3.5 w-3.5" />}
            label={t("task.snooze")}
            onClick={() => setSnoozeOpen((v) => !v)}
          />
          <QaBtn
            icon={<Share2 className="h-3.5 w-3.5" />}
            label={t("task.delegate")}
            onClick={() =>
              smartAgent({
                actionKey: "task.delegate",
                label: t("task.delegate"),
                item,
              })
            }
          />
        </QaGrid>

        {snoozeOpen && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">
              {t("common.days_suffix")}
            </span>
            <Stepper
              value={snoozeDays}
              min={1}
              max={30}
              step={1}
              onChange={setSnoozeDays}
              label="snooze days"
            />
            <button
              type="button"
              onClick={() => {
                smartAgent({
                  actionKey: "task.snooze",
                  label: `${t("task.snooze")} · ${snoozeDays} ${t("common.days_suffix")}`,
                  item,
                  systemContext: `Snooze this task by ${snoozeDays} day(s).`,
                });
                setSnoozeOpen(false);
              }}
              className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded border border-border hover:bg-muted"
            >
              {t("common.commit")}
            </button>
          </div>
        )}
      </SmartBody>
    </SmartCard>
  );
}
