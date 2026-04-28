"use client";

import { Bed, CalendarDays, TrainFront, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type DayLens = "all" | "transport" | "stay" | "food";

export const DAY_LENSES: readonly DayLens[] = ["all", "transport", "stay", "food"] as const;

export function isDayLens(value: string | null | undefined): value is DayLens {
  return value === "all" || value === "transport" || value === "stay" || value === "food";
}

const LENS_ICON: Record<DayLens, React.ElementType> = {
  all: CalendarDays,
  transport: TrainFront,
  stay: Bed,
  food: Utensils,
};

// Per-lens accent applied only to the icon (the active wrapper stays neutral).
// The tint shows on every tab — active or not — so the lens row reads as a
// colorful index of trip aspects at a glance.
const LENS_ICON_COLOR: Record<DayLens, string | undefined> = {
  all: undefined,
  transport: "rgb(var(--rust))",
  stay: "#7dd3c0",
  food: "#d8a86a",
};

export interface LensCounts {
  all: number;
  transport: number;
  stay: number;
  food: number;
}

export function TripDayLensTabs({
  lens,
  onLensChange,
  counts,
}: {
  lens: DayLens;
  onLensChange: (next: DayLens) => void;
  counts: LensCounts;
}) {
  const { t } = useTranslation("travel");
  return (
    <div
      role="tablist"
      aria-label={t("day_lens_aria")}
      className="inline-flex items-center gap-1 rounded-[10px] border border-border bg-muted/30 p-1.5"
    >
      {DAY_LENSES.map((id) => {
        const Icon = LENS_ICON[id];
        const active = lens === id;
        const iconColor = LENS_ICON_COLOR[id];
        return (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onLensChange(id)}
            className={cn(
              "inline-flex items-center gap-2 rounded-[7px] px-3.5 py-2 text-[13px] text-muted-foreground transition-colors",
              "hover:text-foreground",
              active &&
                "bg-background text-foreground shadow-[inset_0_0_0_1px_var(--border)]",
            )}
          >
            <Icon size={14} style={iconColor ? { color: iconColor } : undefined} />
            <span>{t(`day_lens_${id}`)}</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-px text-[10px] font-mono tabular-nums",
                active ? "bg-muted text-foreground" : "bg-muted/60 text-muted-foreground",
              )}
            >
              {counts[id]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
