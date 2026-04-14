import cronstrue from "cronstrue";
import { CronExpressionParser } from "cron-parser";

export interface CronField {
  label: string;
  value: string;
  allowed: string;
  description: string;
}

export interface CronParseResult {
  valid: boolean;
  description?: string;
  nextDates?: Date[];
  fields?: CronField[];
  error?: string;
}

const FIELD_DEFS = [
  { label: "Minute", allowed: "0–59", description: "Minute of the hour" },
  { label: "Hour", allowed: "0–23", description: "Hour of the day" },
  { label: "Day", allowed: "1–31", description: "Day of the month" },
  { label: "Month", allowed: "1–12", description: "Month of the year" },
  { label: "Weekday", allowed: "0–6", description: "Day of the week (0 = Sun)" },
];

export function parseCron(
  expression: string,
  options?: { tz?: string; count?: number }
): CronParseResult {
  const trimmed = expression.trim();
  if (!trimmed) {
    return { valid: false, error: "Empty expression" };
  }

  const parts = trimmed.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    return {
      valid: false,
      error: `Expected 5 fields (minute hour day month weekday), got ${parts.length}`,
    };
  }

  // If 6 fields, first is seconds - we only support 5-field cron
  const fiveParts = parts.length === 6 ? parts.slice(1) : parts;
  const expr = fiveParts.join(" ");

  try {
    const description = cronstrue.toString(expr, {
      use24HourTimeFormat: false,
    });

    const parserOpts: { tz?: string } = {};
    if (options?.tz) parserOpts.tz = options.tz;

    const interval = CronExpressionParser.parse(expr, parserOpts);
    const count = options?.count ?? 10;
    const nextDates: Date[] = [];
    for (let i = 0; i < count; i++) {
      if (!interval.hasNext()) break;
      nextDates.push(interval.next().toDate());
    }

    const fields: CronField[] = fiveParts.map((val, i) => ({
      ...FIELD_DEFS[i],
      value: val,
    }));

    return { valid: true, description, nextDates, fields };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid cron expression";
    return { valid: false, error: msg };
  }
}

export const PRESETS = [
  { label: "Every minute", value: "* * * * *" },
  { label: "Every 5 minutes", value: "*/5 * * * *" },
  { label: "Every 15 minutes", value: "*/15 * * * *" },
  { label: "Every hour", value: "0 * * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every day at midnight", value: "0 0 * * *" },
  { label: "Every day at 9am", value: "0 9 * * *" },
  { label: "Every Monday at 9am", value: "0 9 * * 1" },
  { label: "Weekdays at 9am", value: "0 9 * * 1-5" },
  { label: "1st of every month", value: "0 0 1 * *" },
  { label: "Every Sunday at noon", value: "0 12 * * 0" },
  { label: "Every 30 min (business hours)", value: "*/30 9-17 * * 1-5" },
];

export const CRON_SYNTAX_GUIDE = [
  { symbol: "*", meaning: "Any value" },
  { symbol: ",", meaning: "Value list (e.g. 1,3,5)" },
  { symbol: "-", meaning: "Range (e.g. 1-5)" },
  { symbol: "/", meaning: "Step (e.g. */15)" },
];
