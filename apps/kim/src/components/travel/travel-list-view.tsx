"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Plane, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { listTrips, type Trip } from "@1tt/api-client/travel";
import { Button } from "@/components/ui/button";
import { ListShell } from "@/components/list-shell";
import { EmptyState } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { CreateTripModal } from "./create-trip-modal";

export function TravelListView() {
  const { t } = useTranslation("travel");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const data = await listTrips();
      setTrips(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("load_error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleCreated = useCallback((trip: Trip) => {
    setTrips((cur) => [trip, ...cur]);
    setCreateOpen(false);
  }, []);

  return (
    <>
      <ListShell
        title={t("page_title")}
        subtitle={t("page_subtitle")}
        toolbar={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("new_trip")}
          </Button>
        }
      >
        <div className="px-4 py-4 sm:px-8 sm:py-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton />
              <Skeleton />
              <Skeleton />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => { setLoading(true); void refresh(); }}>
                {t("retry")}
              </Button>
            </div>
          ) : trips.length === 0 ? (
            <EmptyState title={t("empty_title")} hint={t("empty_hint")} />
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </ListShell>

      <CreateTripModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={handleCreated}
      />
    </>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function TripCard({ trip }: { trip: Trip }) {
  const { t } = useTranslation("travel");
  return (
    <Link
      href={routes.trip(trip.id)}
      className="group flex flex-col gap-2 rounded-lg border border-border bg-card p-4 transition hover:border-primary/50 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Plane className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px] uppercase tracking-wide">{t(`status_${trip.status}`)}</span>
          </div>
          <h3 className="mt-1 truncate text-base font-semibold group-hover:text-primary">
            {trip.title}
          </h3>
        </div>
      </div>

      {trip.summary && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{trip.summary}</p>
      )}

      <div className="mt-auto flex flex-col gap-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5 shrink-0" />
          <span>{formatTripDates(trip, t)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span>{trip.budgetCurrency}</span>
        </div>
      </div>
    </Link>
  );
}

function formatTripDates(trip: Trip, t: (k: string, o?: Record<string, unknown>) => string): string {
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

function Skeleton() {
  return (
    <div className="h-[128px] animate-pulse rounded-lg border border-border bg-muted/40" />
  );
}
