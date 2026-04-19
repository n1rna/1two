"use client";

import { Calendar, CalendarClock, ExternalLink, MapPin, MessageSquare, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { useSmartActions } from "./actions";

/** Narrow shape we actually read from an event snapshot. */
interface EventSnapshot {
  summary?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  location?: string;
  attendees?: { email?: string; displayName?: string }[];
  htmlLink?: string;
  routineName?: string;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function fmtTimeRange(snap: EventSnapshot): string | undefined {
  if (!snap.start) return undefined;
  const start = new Date(snap.start);
  if (Number.isNaN(start.getTime())) return undefined;
  const dayLabel = DAYS[start.getDay()];
  if (snap.allDay) return `${dayLabel} · all day`;
  const pad = (n: number) => String(n).padStart(2, "0");
  const sHH = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  if (!snap.end) return `${dayLabel} · ${sHH}`;
  const end = new Date(snap.end);
  if (Number.isNaN(end.getTime())) return `${dayLabel} · ${sHH}`;
  const eHH = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  return `${dayLabel} · ${sHH}-${eHH}`;
}

function fmtAttendees(
  attendees: EventSnapshot["attendees"] | undefined,
): string | undefined {
  if (!attendees || attendees.length === 0) return undefined;
  const names = attendees
    .map((a) => a.displayName || a.email)
    .filter(Boolean) as string[];
  if (names.length === 0) return undefined;
  if (names.length === 1) return `with ${names[0]}`;
  if (names.length === 2) return `with ${names[0]} & ${names[1]}`;
  return `with ${names[0]} +${names.length - 1}`;
}

export function EventSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const ev = (item.snapshot ?? {}) as EventSnapshot;

  const kicker = fmtTimeRange(ev);
  const attendeesLabel = fmtAttendees(ev.attendees);
  const subParts = [ev.location, attendeesLabel].filter(Boolean) as string[];
  const sub = subParts.length > 0 ? subParts.join(" · ") : undefined;

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Calendar className="h-3 w-3" />}
          kicker={kicker}
          title={ev.summary || item.label}
          sub={sub}
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<CalendarClock className="h-3.5 w-3.5" />}
            label={t("event.reschedule")}
            onClick={() =>
              smartAgent({
                actionKey: "event.reschedule",
                label: t("event.reschedule"),
                item,
              })
            }
          />
          <QaBtn
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label={t("event.draft_message")}
            onClick={() =>
              smartAgent({
                actionKey: "event.draft_message",
                label: t("event.draft_message"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Trash2 className="h-3.5 w-3.5" />}
            label={t("event.cancel_with_note")}
            variant="destructive"
            onClick={() =>
              smartAgent({
                actionKey: "event.cancel_with_note",
                label: t("event.cancel_with_note"),
                item,
              })
            }
          />
          <QaBtn
            icon={<MapPin className="h-3.5 w-3.5" />}
            label={t("event.find_commute")}
            onClick={() =>
              smartAgent({
                actionKey: "event.find_commute",
                label: t("event.find_commute"),
                item,
              })
            }
          />
          {ev.htmlLink && (
            <a
              href={ev.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="group col-span-2 flex items-center gap-2.5 text-left rounded-md border border-border bg-card px-[11px] py-[9px] transition-colors hover:bg-muted hover:border-primary/40"
            >
              <span className="shrink-0 flex items-center justify-center h-6 w-6 rounded-[5px] bg-muted text-primary group-hover:bg-primary/10">
                <ExternalLink className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0 flex-1 block text-[12.5px] font-medium text-foreground leading-tight">
                {t("common.open_in_gcal")}
              </span>
            </a>
          )}
        </QaGrid>
      </SmartBody>
    </SmartCard>
  );
}
