// Per-domain preview helpers for ActionableCard. Pure, side-effect free
// formatters that read optional fields off LifeActionable.actionPayload.data.
//
// Shared types (ActionableData) intentionally omit domain-specific fields like
// macros / muscle_group / location / priority since those are free-form today
// (QBL-175). We locally widen the payload shape here so the card can render
// richer per-domain preview bodies when the backend happens to attach them,
// without mutating the shared @1tt/api-client types.

import { format, parseISO } from "date-fns"

import type { LifeActionable } from "@1tt/api-client/life"

/** Narrow local extension — every field optional. Read, never write. */
export interface DomainPreviewData {
  // meal
  diet_type?: string
  calorie_target?: number
  target_calories?: number
  meal_count?: number
  meals_per_day?: number
  // routine
  schedule?: string
  scheduled_time?: string
  frequency?: string
  muscle_group?: string
  muscle_groups?: string[]
  target_muscle_groups?: string[]
  // calendar
  start?: string
  start_time?: string
  end?: string
  end_time?: string
  duration?: string
  duration_minutes?: number
  location?: string
  // task
  priority?: string | number
  due?: string
  // memory
  content?: string
  fact?: string
  preview?: string
  memory?: string
  // misc passthrough
  [key: string]: unknown
}

function readData(a: LifeActionable): DomainPreviewData {
  const d = a.actionPayload?.data as DomainPreviewData | undefined
  return d ?? {}
}

// ─── relative time (shared util, duplicated from the card for cohesion) ─────
export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins > -1 && mins < 1) return "just now"
  if (Math.abs(mins) < 60) {
    return mins >= 0 ? `${mins}m ago` : `in ${-mins}m`
  }
  const hours = Math.floor(mins / 60)
  if (Math.abs(hours) < 24) {
    return hours >= 0 ? `${hours}h ago` : `in ${-hours}h`
  }
  const days = Math.floor(hours / 24)
  if (Math.abs(days) < 7) {
    return days >= 0 ? `${days}d ago` : `in ${-days}d`
  }
  return new Date(iso).toLocaleDateString()
}

function tryFormat(iso: string, pattern: string): string | null {
  try {
    return format(parseISO(iso), pattern)
  } catch {
    return null
  }
}

// ─── meal ────────────────────────────────────────────────────────────────────
export interface MealPreview {
  dietType?: string
  calorieTarget?: number
  mealCount?: number
}

export function mealPreview(a: LifeActionable): MealPreview | null {
  const d = readData(a)
  const dietType = typeof d.diet_type === "string" ? d.diet_type : undefined
  const calorieTarget =
    typeof d.calorie_target === "number"
      ? d.calorie_target
      : typeof d.target_calories === "number"
        ? d.target_calories
        : undefined
  const mealCount =
    typeof d.meal_count === "number"
      ? d.meal_count
      : typeof d.meals_per_day === "number"
        ? d.meals_per_day
        : undefined
  if (!dietType && calorieTarget == null && mealCount == null) return null
  return { dietType, calorieTarget, mealCount }
}

// ─── routine ─────────────────────────────────────────────────────────────────
export interface RoutinePreview {
  schedule?: string
  muscleGroup?: string
}

export function routinePreview(a: LifeActionable): RoutinePreview | null {
  const d = readData(a)
  const schedule =
    (typeof d.schedule === "string" && d.schedule) ||
    (typeof d.scheduled_time === "string" && d.scheduled_time) ||
    (typeof d.frequency === "string" && d.frequency) ||
    undefined
  const groups =
    (Array.isArray(d.target_muscle_groups) && d.target_muscle_groups) ||
    (Array.isArray(d.muscle_groups) && d.muscle_groups) ||
    undefined
  const muscleGroup =
    (typeof d.muscle_group === "string" && d.muscle_group) ||
    (groups && groups.length > 0 ? groups.join(", ") : undefined)
  if (!schedule && !muscleGroup) return null
  return { schedule, muscleGroup }
}

// ─── calendar ────────────────────────────────────────────────────────────────
export interface CalendarPreview {
  timeLabel?: string
  location?: string
}

/**
 * Prefer explicit start/end fields in payload.data; fall back to actionable.dueAt
 * for the start timestamp, which is how schedule_pick / reminder templates
 * surface "when" today.
 */
export function calendarPreview(a: LifeActionable): CalendarPreview | null {
  const d = readData(a)
  const startIso =
    (typeof d.start === "string" && d.start) ||
    (typeof d.start_time === "string" && d.start_time) ||
    a.dueAt ||
    undefined
  const endIso =
    (typeof d.end === "string" && d.end) ||
    (typeof d.end_time === "string" && d.end_time) ||
    undefined

  let timeLabel: string | undefined
  if (startIso) {
    const startFmt =
      tryFormat(startIso, "MMM d, p") ?? (typeof d.start_time === "string" ? d.start_time : undefined)
    if (endIso) {
      const endFmt = tryFormat(endIso, "p")
      timeLabel = endFmt && startFmt ? `${startFmt} – ${endFmt}` : startFmt
    } else if (typeof d.duration === "string") {
      timeLabel = startFmt ? `${startFmt} · ${d.duration}` : d.duration
    } else if (typeof d.duration_minutes === "number") {
      timeLabel = startFmt ? `${startFmt} · ${d.duration_minutes}m` : `${d.duration_minutes}m`
    } else {
      timeLabel = startFmt
    }
  } else if (typeof d.duration === "string") {
    timeLabel = d.duration
  }

  const location = typeof d.location === "string" ? d.location : undefined
  if (!timeLabel && !location) return null
  return { timeLabel, location }
}

// ─── task ────────────────────────────────────────────────────────────────────
export interface TaskPreview {
  priorityLabel?: string
  dueLabel?: string
}

function priorityLabelFrom(value: string | number | undefined): string | undefined {
  if (value == null) return undefined
  if (typeof value === "number") {
    if (value >= 3) return "High"
    if (value === 2) return "Medium"
    if (value <= 1) return "Low"
    return undefined
  }
  const v = value.toLowerCase()
  if (v.startsWith("hi") || v === "p1" || v === "urgent") return "High"
  if (v.startsWith("me") || v === "p2" || v === "normal") return "Medium"
  if (v.startsWith("lo") || v === "p3" || v === "p4") return "Low"
  return value
}

export function taskPreview(a: LifeActionable): TaskPreview | null {
  const d = readData(a)
  const priorityLabel = priorityLabelFrom(d.priority as string | number | undefined)
  const dueIso = a.dueAt ?? (typeof d.due === "string" ? d.due : undefined)
  const dueLabel = dueIso ? relativeTime(dueIso) : undefined
  if (!priorityLabel && !dueLabel) return null
  return { priorityLabel, dueLabel }
}

// ─── memory ──────────────────────────────────────────────────────────────────
export function memoryPreview(a: LifeActionable, maxChars = 140): string | null {
  const d = readData(a)
  const raw =
    (typeof d.memory === "string" && d.memory) ||
    (typeof d.fact === "string" && d.fact) ||
    (typeof d.preview === "string" && d.preview) ||
    (typeof d.content === "string" && d.content) ||
    // preference template reuses `question` as the prompt body
    (typeof d.question === "string" && d.question) ||
    undefined
  if (!raw) return null
  const trimmed = raw.trim()
  if (trimmed.length <= maxChars) return trimmed
  return `${trimmed.slice(0, maxChars - 1).trimEnd()}…`
}
