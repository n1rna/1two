/**
 * Schedule formatting + relative-time helpers shared by Routines screens.
 *
 * The `schedule` field on LifeRoutine is typed as `unknown` server-side —
 * it's a free-form bag of {frequency, interval?, days?, time?, flexible?}
 * depending on how the user set it up. We read keys defensively and fall
 * back to human-readable labels instead of JSON.
 */

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export interface ScheduleShape {
  frequency?: string
  interval?: number
  days?: Array<number | string>
  time?: string
  flexible?: boolean
}

function readSchedule(raw: unknown): ScheduleShape | null {
  if (!raw || typeof raw !== "object") return null
  const s = raw as Record<string, unknown>
  return {
    frequency: typeof s.frequency === "string" ? s.frequency : undefined,
    interval: typeof s.interval === "number" ? s.interval : undefined,
    days: Array.isArray(s.days) ? (s.days as Array<number | string>) : undefined,
    time: typeof s.time === "string" ? s.time : undefined,
    flexible: typeof s.flexible === "boolean" ? s.flexible : undefined,
  }
}

function formatDayList(days: Array<number | string>): string {
  return days
    .map((d) => {
      if (typeof d === "number") return DAY_NAMES[d] ?? String(d)
      const str = String(d)
      return str.charAt(0).toUpperCase() + str.slice(1, 3)
    })
    .join(", ")
}

export function formatSchedule(raw: unknown): string {
  const s = readSchedule(raw)
  if (!s) return "No schedule set"
  const { frequency, interval, days, time } = s

  if (frequency === "daily") {
    return time ? `Every day at ${time}` : "Every day"
  }
  if (frequency === "weekly" && days && days.length > 0) {
    const dayStr = formatDayList(days)
    return time ? `${dayStr} at ${time}` : dayStr
  }
  if ((frequency === "every_n_days" || frequency === "custom") && interval) {
    return time ? `Every ${interval} days at ${time}` : `Every ${interval} days`
  }
  return frequency ?? "Custom schedule"
}

export function relativeTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const diff = Date.now() - t
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return "just now"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}

export function shortDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}
