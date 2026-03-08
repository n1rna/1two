export interface TimestampResult {
  unix: number;
  unixMs: number;
  iso8601: string;
  rfc2822: string;
  rfc3339: string;
  utc: string;
  local: string;
  relative: string;
  components: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    millisecond: number;
    dayOfWeek: string;
    timezone: string;
  };
}

export function parseInput(input: string, timezone: string): Date | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Try unix timestamp (seconds or milliseconds)
  if (/^-?\d{1,13}$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    // If <= 10 digits, treat as seconds; otherwise milliseconds
    if (trimmed.replace(/^-/, "").length <= 10) {
      return new Date(num * 1000);
    }
    return new Date(num);
  }

  // Try parsing as date string (ISO 8601, RFC 2822, etc.)
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

export function formatTimezone(date: Date, timezone: string): string {
  try {
    return date.toLocaleString("en-US", { timeZone: timezone, timeZoneName: "longOffset" });
  } catch {
    return date.toLocaleString("en-US", { timeZoneName: "longOffset" });
  }
}

function getTimezoneOffset(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "longOffset",
    });
    const parts = fmt.formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart) {
      // Extract offset like "GMT+05:30" -> "+05:30", "GMT" -> "+00:00"
      const match = tzPart.value.match(/GMT([+-]\d{2}:\d{2})/);
      if (match) return match[1];
      if (tzPart.value === "GMT") return "+00:00";
    }
  } catch {}
  return "+00:00";
}

function formatRfc3339(date: Date, timezone: string): string {
  const offset = getTimezoneOffset(date, timezone);
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  const suffix = offset === "+00:00" ? "Z" : offset;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}${suffix}`;
}

function formatRfc2822(date: Date, timezone: string): string {
  const offset = getTimezoneOffset(date, timezone).replace(":", "");
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("weekday")}, ${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}:${get("second")} ${offset}`;
}

function getRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? "ago" : "from now";

  if (abs < 1000) return "just now";
  if (abs < 60_000) return `${Math.floor(abs / 1000)}s ${suffix}`;
  if (abs < 3_600_000) return `${Math.floor(abs / 60_000)}m ${suffix}`;
  if (abs < 86_400_000) return `${Math.floor(abs / 3_600_000)}h ${suffix}`;
  if (abs < 2_592_000_000) return `${Math.floor(abs / 86_400_000)}d ${suffix}`;
  if (abs < 31_536_000_000) return `${Math.floor(abs / 2_592_000_000)}mo ${suffix}`;
  return `${Math.floor(abs / 31_536_000_000)}y ${suffix}`;
}

export function buildResult(date: Date, timezone: string): TimestampResult {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    fractionalSecondDigits: 3,
    hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return {
    unix: Math.floor(date.getTime() / 1000),
    unixMs: date.getTime(),
    iso8601: date.toISOString(),
    rfc3339: formatRfc3339(date, timezone),
    rfc2822: formatRfc2822(date, timezone),
    utc: date.toUTCString(),
    local: date.toLocaleString("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "long" }),
    relative: getRelativeTime(date),
    components: {
      year: parseInt(get("year")),
      month: parseInt(get("month")),
      day: parseInt(get("day")),
      hour: parseInt(get("hour")),
      minute: parseInt(get("minute")),
      second: parseInt(get("second")),
      millisecond: parseInt(get("fractionalSecond") || "0"),
      dayOfWeek: get("weekday"),
      timezone,
    },
  };
}

export const COMMON_TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Vancouver",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "Europe/Moscow",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Singapore",
  "Australia/Sydney",
  "Pacific/Auckland",
];
