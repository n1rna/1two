"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CalendarDays,
  ChevronLeft,
  MapPin,
  Plane,
  Trash2,
  Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  deleteTrip,
  getTrip,
  listDestinations,
  listReservations,
  updateTrip,
  type Destination,
  type Reservation,
  type Trip,
  type TripStatus,
} from "@1tt/api-client/travel";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { DestinationsEditor } from "./destinations-editor";

const STATUS_ORDER: TripStatus[] = ["planning", "booked", "ongoing", "completed", "cancelled"];

export function TripOverviewView({ tripId }: { tripId: string }) {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [tripRes, destRes, resRes] = await Promise.all([
        getTrip(tripId),
        listDestinations(tripId).catch(() => [] as Destination[]),
        listReservations(tripId).catch(() => [] as Reservation[]),
      ]);
      setTrip(tripRes);
      setTitleDraft(tripRes.title);
      setDestinations(destRes);
      setReservations(resRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("load_error"));
    } finally {
      setLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveTitle() {
    if (!trip) return;
    const next = titleDraft.trim();
    if (!next || next === trip.title) {
      setEditingTitle(false);
      setTitleDraft(trip.title);
      return;
    }
    setSavingTitle(true);
    try {
      const updated = await updateTrip(trip.id, { title: next });
      setTrip(updated);
      setTitleDraft(updated.title);
      setEditingTitle(false);
    } catch {
      setTitleDraft(trip.title);
    } finally {
      setSavingTitle(false);
    }
  }

  async function changeStatus(status: TripStatus) {
    if (!trip || trip.status === status) return;
    const updated = await updateTrip(trip.id, { status }).catch(() => null);
    if (updated) setTrip(updated);
  }

  async function handleDelete() {
    if (!trip) return;
    const ok = typeof window !== "undefined"
      ? window.confirm(t("confirm_delete"))
      : true;
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteTrip(trip.id);
      router.push(routes.travel);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("delete_error"));
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">{tCommon("loading")}</div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-destructive">{error ?? t("load_error")}</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setLoading(true); void load(); }}>
            {t("retry")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push(routes.travel)}>
            {tCommon("back")}
          </Button>
        </div>
      </div>
    );
  }

  const canEdit = trip.role === "owner" || trip.role === "editor";
  const dateLabel = formatDateRange(trip, t);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="shrink-0 sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border">
        <div className="px-4 pt-3 pb-3 sm:px-8 sm:pt-5 sm:pb-4">
          <button
            onClick={() => router.push(routes.travel)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground mb-2"
          >
            <ChevronLeft size={12} /> {t("back_to_trips")}
          </button>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0 flex-1">
              {editingTitle && canEdit ? (
                <input
                  type="text"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  onBlur={saveTitle}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") {
                      setTitleDraft(trip.title);
                      setEditingTitle(false);
                    }
                  }}
                  autoFocus
                  disabled={savingTitle}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-xl sm:text-2xl font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              ) : (
                <h1
                  onClick={() => canEdit && setEditingTitle(true)}
                  className={cn(
                    "text-xl sm:text-2xl font-semibold leading-tight tracking-tight truncate",
                    canEdit && "cursor-text hover:text-primary",
                  )}
                  title={canEdit ? t("click_to_rename") : undefined}
                >
                  {trip.title}
                </h1>
              )}
              <div className="mt-1.5 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                <StatusBadge status={trip.status} onChange={canEdit ? changeStatus : undefined} t={t} />
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={12} /> {dateLabel}
                </span>
                <span className="inline-flex items-center gap-1">
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
                disabled={deleting}
                className="text-destructive hover:bg-destructive/10"
              >
                <Trash2 size={14} /> {tCommon("delete")}
              </Button>
            )}
          </div>
          {trip.summary && (
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{trip.summary}</p>
          )}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl space-y-5">
          {/* Map preview placeholder — real component lands with QBL-152 (Mapbox infra) */}
          <Card>
            <SectionHeading icon={<MapPin size={14} />}>{t("section_map")}</SectionHeading>
            <div className="h-40 rounded-md border border-dashed border-border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
              {t("map_placeholder")}
            </div>
          </Card>

          {/* Destinations */}
          <Card>
            <SectionHeading icon={<Plane size={14} />} count={destinations.length}>
              {t("section_destinations")}
            </SectionHeading>
            <DestinationsEditor
              tripId={trip.id}
              destinations={destinations}
              canEdit={canEdit}
              onChange={setDestinations}
            />
          </Card>

          {/* Reservations */}
          <Card>
            <SectionHeading icon={<CalendarDays size={14} />} count={reservations.length}>
              {t("section_reservations")}
            </SectionHeading>
            {reservations.length === 0 ? (
              <EmptyState title={t("empty_reservations_title")} hint={t("empty_reservations_hint")} />
            ) : (
              <ul className="flex flex-col gap-2">
                {reservations.map((r) => (
                  <li
                    key={r.id}
                    className="border border-border rounded-md px-3 py-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{r.title}</div>
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground mt-0.5">
                          {r.kind} · {r.status}
                        </div>
                      </div>
                      {r.costAmount != null && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          {r.costAmount.toFixed(2)} {r.costCurrency || trip.budgetCurrency}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function SectionHeading({
  children,
  icon,
  count,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  count?: number;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {children}
      </h2>
      {count != null && count > 0 && (
        <span className="text-xs text-muted-foreground tabular-nums">{count}</span>
      )}
    </div>
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
        <option key={s} value={s}>{t(`status_${s}`)}</option>
      ))}
    </select>
  );
}

function formatDateRange(trip: Trip, t: (k: string, o?: Record<string, unknown>) => string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  };
  if (trip.startDate && trip.endDate) {
    return t("date_range", { start: fmt(trip.startDate), end: fmt(trip.endDate) });
  }
  if (trip.startDate) return t("date_start_only", { start: fmt(trip.startDate) });
  if (trip.endDate) return t("date_end_only", { end: fmt(trip.endDate) });
  return t("dates_not_set");
}
