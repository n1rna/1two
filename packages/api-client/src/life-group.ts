// Shared grouping + filtering helpers for Life actionables. Pure functions —
// safe to import from both web (apps/kim) and mobile (apps/kim-mobile).

import type { LifeActionable } from "./life";

export type ActionableDomain =
  | "calendar"
  | "task"
  | "routine"
  | "meal"
  | "memory"
  | "suggestion"
  | "other";

export type TimeBucket = "tomorrow" | "today" | "yesterday" | "older";

export const DOMAIN_ORDER: ActionableDomain[] = [
  "calendar",
  "task",
  "routine",
  "meal",
  "memory",
  "suggestion",
  "other",
];

export const BUCKET_ORDER: TimeBucket[] = [
  "tomorrow",
  "today",
  "yesterday",
  "older",
];

export function domainOf(a: LifeActionable): ActionableDomain {
  const tpl = a.actionPayload?.template;
  const at = a.actionType;
  if (at === "create_calendar_event" || at === "delete_calendar_event")
    return "calendar";
  if (at === "create_task") return "task";
  if (at === "create_routine") return "routine";
  if (at === "create_memory") return "memory";
  if (tpl === "meal_choice") return "meal";
  if (tpl === "schedule_pick" || tpl === "reminder") return "calendar";
  if (tpl === "routine_check") return "routine";
  if (tpl === "preference") return "memory";
  if (tpl === "suggestion") return "suggestion";
  return "other";
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Reference timestamp used for day-bucketing. We prefer `dueAt` when set so
 * planned items land in their scheduled day (e.g. a reminder due tomorrow
 * goes to "Tomorrow" even if it was created today). Otherwise fall back to
 * `createdAt` — the day Kim surfaced it.
 */
function referenceTime(a: LifeActionable): number {
  const ref = a.dueAt ?? a.createdAt;
  return new Date(ref).getTime();
}

export function bucketOf(a: LifeActionable, now: Date = new Date()): TimeBucket {
  const ref = referenceTime(a);
  const startToday = startOfLocalDay(now).getTime();
  const startTomorrow = startToday + 24 * 60 * 60 * 1000;
  const startYesterday = startToday - 24 * 60 * 60 * 1000;
  if (ref >= startTomorrow) return "tomorrow";
  if (ref >= startToday) return "today";
  if (ref >= startYesterday) return "yesterday";
  return "older";
}

export function matchesSearch(a: LifeActionable, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  if (a.title.toLowerCase().includes(needle)) return true;
  if (a.description?.toLowerCase().includes(needle)) return true;
  const src = a.source?.entity_title?.toLowerCase();
  if (src && src.includes(needle)) return true;
  return false;
}

export interface BucketGroup {
  bucket: TimeBucket;
  items: LifeActionable[];
}

export function groupByBucket(items: LifeActionable[]): BucketGroup[] {
  const map = new Map<TimeBucket, LifeActionable[]>();
  for (const a of items) {
    const b = bucketOf(a);
    const cur = map.get(b);
    if (cur) cur.push(a);
    else map.set(b, [a]);
  }
  const out: BucketGroup[] = [];
  for (const b of BUCKET_ORDER) {
    const v = map.get(b);
    if (v && v.length > 0) out.push({ bucket: b, items: v });
  }
  return out;
}
