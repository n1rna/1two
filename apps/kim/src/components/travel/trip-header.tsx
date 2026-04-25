"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  deleteTrip,
  updateTrip,
  type Trip,
  type TripStatus,
} from "@1tt/api-client/travel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";

const STATUS_ORDER: TripStatus[] = [
  "planning",
  "booked",
  "ongoing",
  "completed",
  "cancelled",
];

/**
 * Large trip header used as the top of every trip-context page. Editable
 * title + status + dates + currency + owner-only delete. Pages control
 * whether the header is the hero variant (overview, 42px serif-ish title)
 * or the compact variant (subpages, small title, trip name subtitle).
 */
export function TripHeader({
  trip,
  onTripChange,
  variant = "compact",
  pageTitle,
  pageSubtitle,
  backHref,
}: {
  trip: Trip;
  onTripChange: (trip: Trip) => void;
  variant?: "hero" | "compact";
  pageTitle?: string;
  pageSubtitle?: string;
  backHref?: string;
}) {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const canEdit = trip.role === "owner" || trip.role === "editor";
  const dateLabel = formatDateRange(trip, t);

  async function changeStatus(status: TripStatus) {
    if (trip.status === status) return;
    const updated = await updateTrip(trip.id, { status }).catch(() => null);
    if (updated) onTripChange(updated);
  }

  async function handleDelete() {
    const ok =
      typeof window !== "undefined"
        ? window.confirm(t("confirm_delete"))
        : true;
    if (!ok) return;
    try {
      await deleteTrip(trip.id);
      router.push(routes.travel);
    } catch {
      /* swallow — caller state untouched */
    }
  }

  if (variant === "compact") {
    return (
      <header className="shrink-0 sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 sm:px-8 sm:pt-5 sm:pb-4">
          <Link
            href={backHref ?? routes.trip(trip.id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft size={12} /> {trip.title}
          </Link>
          <h1 className="text-xl sm:text-2xl font-semibold leading-tight tracking-tight truncate">
            {pageTitle ?? trip.title}
          </h1>
          {pageSubtitle && (
            <p className="mt-1 text-sm text-muted-foreground truncate">
              {pageSubtitle}
            </p>
          )}
        </div>
      </header>
    );
  }

  return (
    <header className="shrink-0 sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
      <div className="px-4 pt-4 pb-4 sm:px-8 sm:pt-6 sm:pb-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="travel-accent text-[10px] font-mono uppercase tracking-[0.18em] mb-1.5">
              ● {t(`status_${trip.status}`).toUpperCase()}
            </div>
            <InlineTitle trip={trip} onTripChange={onTripChange} canEdit={canEdit} t={t} />
            <div className="mt-2 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
              <StatusBadge status={trip.status} onChange={canEdit ? changeStatus : undefined} t={t} />
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} /> {dateLabel}
              </span>
              <span className="inline-flex items-center gap-1 font-mono">
                <Banknote size={12} /> {trip.budgetCurrency}
              </span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} /> {t(`role_${trip.role || "viewer"}`)}
              </span>
            </div>
          </div>

          {trip.role === "owner" && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDelete}
              className="text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={14} /> {tCommon("delete")}
            </Button>
          )}
        </div>
        {trip.summary && (
          <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
            {trip.summary}
          </p>
        )}
      </div>
    </header>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function InlineTitle({
  trip,
  onTripChange,
  canEdit,
  t,
}: {
  trip: Trip;
  onTripChange: (trip: Trip) => void;
  canEdit: boolean;
  t: (k: string) => string;
}) {
  // Reuses the existing click-to-rename affordance. Not a full modal — that
  // lives on the old overview view and was deemed too heavy for the new hero.
  async function commit(next: string) {
    const v = next.trim();
    if (!v || v === trip.title) return;
    const updated = await updateTrip(trip.id, { title: v }).catch(() => null);
    if (updated) onTripChange(updated);
  }
  return (
    <h1
      contentEditable={canEdit}
      suppressContentEditableWarning
      onBlur={(e) => commit((e.target as HTMLElement).innerText)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          (e.target as HTMLElement).innerText = trip.title;
          (e.target as HTMLElement).blur();
        }
      }}
      className={cn(
        "text-3xl sm:text-4xl font-semibold leading-tight tracking-tight focus:outline-none",
        canEdit &&
          "hover:text-primary cursor-text rounded-sm focus:ring-2 focus:ring-primary/50",
      )}
      title={canEdit ? t("click_to_rename") : undefined}
    >
      {trip.title}
    </h1>
  );
}

function StatusBadge({
  status,
  onChange,
  t,
}: {
  status: TripStatus;
  onChange?: (s: TripStatus) => void;
  t: (k: string) => string;
}) {
  if (!onChange) {
    return (
      <span className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] uppercase tracking-wide">
        {t(`status_${status}`)}
      </span>
    );
  }
  return (
    <select
      value={status}
      onChange={(e) => onChange(e.target.value as TripStatus)}
      className="inline-flex items-center rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] uppercase tracking-wide cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      {STATUS_ORDER.map((s) => (
        <option key={s} value={s}>
          {t(`status_${s}`)}
        </option>
      ))}
    </select>
  );
}

function formatDateRange(
  trip: Trip,
  t: (k: string, o?: Record<string, unknown>) => string,
): string {
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  if (trip.startDate && trip.endDate) {
    return t("date_range", { start: fmt(trip.startDate), end: fmt(trip.endDate) });
  }
  if (trip.startDate) return t("date_start_only", { start: fmt(trip.startDate) });
  if (trip.endDate) return t("date_end_only", { end: fmt(trip.endDate) });
  return t("dates_not_set");
}

export function tripNights(trip: Trip): number {
  if (!trip.startDate || !trip.endDate) return 0;
  const a = new Date(trip.startDate + "T00:00:00").getTime();
  const b = new Date(trip.endDate + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}
