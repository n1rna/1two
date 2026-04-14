"use client";

import { useImperativeHandle, useState, forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LifeRoutine } from "@/lib/life";
import { RoutineConfigForm } from "./routine-config-form";
import {
  defaultSchema,
  isRoutineConfigSchema,
  type RoutineConfigSchema,
  type RoutineConfigValues,
} from "./routine-schema";

const DAYS_OF_WEEK = [
  { value: "monday", short: "Mon" },
  { value: "tuesday", short: "Tue" },
  { value: "wednesday", short: "Wed" },
  { value: "thursday", short: "Thu" },
  { value: "friday", short: "Fri" },
  { value: "saturday", short: "Sat" },
  { value: "sunday", short: "Sun" },
];

export interface RoutineFormState {
  name: string;
  description: string;
  frequency: string;
  interval: string;
  days: string[];
  time: string;
  configSchema: RoutineConfigSchema;
  configValues: RoutineConfigValues;
}

export const emptyRoutineForm = (): RoutineFormState => ({
  name: "",
  description: "",
  frequency: "weekly",
  interval: "1",
  days: [],
  time: "09:00",
  configSchema: defaultSchema(),
  configValues: {},
});

export function routineFormFromRoutine(r: LifeRoutine): RoutineFormState {
  const s = (r.schedule as Record<string, unknown>) ?? {};
  const schema = isRoutineConfigSchema(r.configSchema)
    ? r.configSchema
    : defaultSchema();
  const values =
    r.config && typeof r.config === "object" && !Array.isArray(r.config)
      ? (r.config as RoutineConfigValues)
      : {};
  return {
    name: r.name,
    description: r.description,
    frequency: (s.frequency as string) ?? "weekly",
    interval: String(s.interval ?? "1"),
    days: (s.days as string[]) ?? [],
    time: (s.time as string) ?? "09:00",
    configSchema: schema,
    configValues: values,
  };
}

export function routineFormToPayload(form: RoutineFormState): Partial<LifeRoutine> {
  const schedule: Record<string, unknown> = { frequency: form.frequency };
  if (form.frequency === "weekly") schedule.days = form.days;
  if (form.frequency === "custom") schedule.interval = parseInt(form.interval) || 1;
  if (form.time) schedule.time = form.time;
  return {
    name: form.name.trim(),
    description: form.description.trim(),
    schedule,
    config: form.configValues,
    configSchema: form.configSchema,
  };
}

/** Merge agent-drafted values into the current form state. */
export function applyRoutineDraft(
  current: RoutineFormState,
  draft: Record<string, unknown>,
): RoutineFormState {
  const next = { ...current };
  if (typeof draft.name === "string") next.name = draft.name;
  if (typeof draft.description === "string") next.description = draft.description;
  if (typeof draft.frequency === "string") next.frequency = draft.frequency;
  if (typeof draft.interval === "number" || typeof draft.interval === "string") {
    next.interval = String(draft.interval);
  }
  if (Array.isArray(draft.days)) next.days = draft.days.map(String);
  if (typeof draft.time === "string") next.time = draft.time;
  if (isRoutineConfigSchema(draft.configSchema)) {
    next.configSchema = draft.configSchema;
  }
  if (
    draft.config &&
    typeof draft.config === "object" &&
    !Array.isArray(draft.config)
  ) {
    next.configValues = {
      ...next.configValues,
      ...(draft.config as RoutineConfigValues),
    };
  }
  return next;
}

interface Props {
  value: RoutineFormState;
  onChange: (next: RoutineFormState) => void;
  onSubmit: () => void;
  onCancel: () => void;
  saving: boolean;
  submitLabel: string;
}

export interface RoutineFormHandle {
  flash: () => void;
}

export const RoutineForm = forwardRef<RoutineFormHandle, Props>(function RoutineForm(
  { value, onChange, onSubmit, onCancel, saving, submitLabel },
  ref,
) {
  const [flashing, setFlashing] = useState(false);
  useImperativeHandle(ref, () => ({
    flash: () => {
      setFlashing(true);
      window.setTimeout(() => setFlashing(false), 800);
    },
  }));

  const set = <K extends keyof RoutineFormState>(k: K, v: RoutineFormState[K]) =>
    onChange({ ...value, [k]: v });

  const toggleDay = (day: string) => {
    onChange({
      ...value,
      days: value.days.includes(day)
        ? value.days.filter((d) => d !== day)
        : [...value.days, day],
    });
  };

  return (
    <div
      className={cn(
        "space-y-6 rounded-xl border bg-card p-6 transition-shadow",
        flashing && "ring-2 ring-primary shadow-lg",
      )}
    >
      {/* Name */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Name
        </label>
        <input
          type="text"
          value={value.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Routine name…"
          className="w-full rounded-md border bg-background px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Description
        </label>
        <textarea
          value={value.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="What is this routine about?"
          rows={3}
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50"
        />
      </div>

      {/* Schedule */}
      <div className="space-y-3">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Schedule
        </label>

        <div className="flex gap-1.5">
          {[
            { value: "daily", label: "Daily" },
            { value: "weekly", label: "Weekly" },
            { value: "custom", label: "Every N days" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => set("frequency", opt.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                value.frequency === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border hover:bg-muted/30",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {value.frequency === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground text-xs">Every</span>
            <input
              type="number"
              min="1"
              value={value.interval}
              onChange={(e) => set("interval", e.target.value)}
              className="w-16 rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
            <span className="text-muted-foreground text-xs">days</span>
          </div>
        )}

        {value.frequency === "weekly" && (
          <div className="flex flex-wrap gap-1">
            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d.value}
                onClick={() => toggleDay(d.value)}
                className={cn(
                  "h-8 w-12 rounded-md text-xs font-medium transition-colors border",
                  value.days.includes(d.value)
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-muted-foreground border-border hover:bg-muted/30",
                )}
              >
                {d.short}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Time</label>
          <input
            type="time"
            value={value.time}
            onChange={(e) => set("time", e.target.value)}
            className="rounded-md border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* Config — schema-driven */}
      <div className="space-y-2">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Configuration
        </label>
        <RoutineConfigForm
          schema={value.configSchema}
          values={value.configValues}
          onChange={(next) => set("configValues", next)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={onSubmit} disabled={!value.name.trim() || saving}>
          {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
});
