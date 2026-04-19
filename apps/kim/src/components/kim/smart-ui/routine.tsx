"use client";

import {
  Archive,
  BookOpen,
  CalendarClock,
  Link as LinkIcon,
  Pause,
  Play,
  Repeat,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { useSmartActions } from "./actions";

/**
 * Narrow shape read from a `LifeRoutine` snapshot. Schedule is pre-formatted
 * in some attach sites and raw in others; we detect the common shape-fields
 * and build a concise sub-line either way.
 */
interface RoutineSnapshot {
  name?: string;
  description?: string;
  active?: boolean;
  schedule?: unknown;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatSchedule(schedule: unknown): string | undefined {
  if (!schedule || typeof schedule !== "object") return undefined;
  const s = schedule as Record<string, unknown>;
  const freq = s.frequency as string | undefined;
  const days = s.days as (number | string)[] | undefined;
  const time = s.time as string | undefined;
  const interval = s.interval as number | undefined;
  if (freq === "daily") return time ? `daily · ${time}` : "daily";
  if (freq === "weekly" && days?.length) {
    const dayNames = days
      .map((d) =>
        typeof d === "number"
          ? DAY_NAMES[d] ?? String(d)
          : String(d).charAt(0).toUpperCase() + String(d).slice(1, 3),
      )
      .join(", ");
    return time ? `${dayNames} · ${time}` : dayNames;
  }
  if ((freq === "every_n_days" || freq === "custom") && interval) {
    return time ? `every ${interval}d · ${time}` : `every ${interval}d`;
  }
  if (freq) return freq;
  return undefined;
}

export function RoutineSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const r = (item.snapshot ?? {}) as RoutineSnapshot;

  const scheduleLabel = formatSchedule(r.schedule);
  const sub = r.description || scheduleLabel;
  const kicker = scheduleLabel && r.description ? scheduleLabel : undefined;
  const paused = r.active === false;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Repeat className="h-3 w-3" />}
          kicker={kicker?.toUpperCase()}
          title={r.name ?? item.label}
          sub={sub}
          meta={
            paused ? (
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                paused
              </span>
            ) : null
          }
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label={t("routine.edit_schedule")}
            onClick={() =>
              smartAgent({
                actionKey: "routine.edit_schedule",
                label: t("routine.edit_schedule"),
                item,
              })
            }
          />
          {paused ? (
            <QaBtn
              icon={<Play className="h-3.5 w-3.5" />}
              label={t("routine.resume")}
              onClick={() =>
                smartAgent({
                  actionKey: "routine.resume",
                  label: t("routine.resume"),
                  item,
                })
              }
            />
          ) : (
            <QaBtn
              icon={<Pause className="h-3.5 w-3.5" />}
              label={t("routine.pause")}
              onClick={() =>
                smartAgent({
                  actionKey: "routine.pause",
                  label: t("routine.pause"),
                  item,
                })
              }
            />
          )}
          <QaBtn
            icon={<LinkIcon className="h-3.5 w-3.5" />}
            label={t("routine.link_calendar")}
            onClick={() =>
              smartAgent({
                actionKey: "routine.link_calendar",
                label: t("routine.link_calendar"),
                item,
              })
            }
          />
          <QaBtn
            icon={<BookOpen className="h-3.5 w-3.5" />}
            label={t("routine.explain")}
            onClick={() =>
              smartAgent({
                actionKey: "routine.explain",
                label: t("routine.explain"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Archive className="h-3.5 w-3.5" />}
            label={t("routine.archive")}
            variant="destructive"
            onClick={() =>
              smartAgent({
                actionKey: "routine.archive",
                label: t("routine.archive"),
                item,
              })
            }
          />
        </QaGrid>
      </SmartBody>
    </SmartCard>
  );
}
