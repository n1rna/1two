"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plane } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listDestinations,
  listReservations,
  type Destination,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { Card, EmptyState } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { TripPageLoader } from "./trip-page-loader";
import { TripHeader, tripNights } from "./trip-header";

export function TripOverviewView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <OverviewBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

function OverviewBody({
  trip,
  setTrip,
}: {
  trip: Trip;
  setTrip: (trip: Trip) => void;
}) {
  const { t } = useTranslation("travel");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    listDestinations(trip.id)
      .then(setDestinations)
      .catch(() => setDestinations([]));
    listReservations(trip.id)
      .then(setReservations)
      .catch(() => setReservations([]));
  }, [trip.id]);

  const nights = tripNights(trip);
  const committed = reservations
    .filter((r) => r.status === "booked" && r.costAmount != null)
    .reduce((sum, r) => sum + (r.costAmount ?? 0), 0);
  const estimated = reservations
    .filter((r) => r.costAmount != null)
    .reduce((sum, r) => sum + (r.costAmount ?? 0), 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader trip={trip} onTripChange={setTrip} variant="hero" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-5xl space-y-5">
          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCell label={t("overview_stats_nights")} value={String(nights)} />
            <StatCell
              label={t("overview_stats_destinations")}
              value={String(destinations.length)}
            />
            <StatCell
              label={t("overview_stats_cost_committed")}
              value={formatMoney(committed, trip.budgetCurrency)}
            />
            <StatCell
              label={t("overview_stats_cost_estimated")}
              value={formatMoney(estimated, trip.budgetCurrency)}
            />
          </div>

          {/* Route + Reservations side-by-side on lg */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <SectionHeading
                title={t("overview_route_title")}
                subtitle={t("overview_route_subtitle", { count: destinations.length })}
                href={routes.tripRoute(trip.id)}
              />
              {destinations.length === 0 ? (
                <EmptyState
                  title={t("empty_destinations_title")}
                  hint={t("empty_destinations_hint")}
                />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {destinations.slice(0, 4).map((d, i) => (
                    <li
                      key={d.id}
                      className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <DestinationPill num={i + 1} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{d.name}</div>
                        {(d.country || d.region) && (
                          <div className="truncate text-[11px] text-muted-foreground">
                            {[d.region, d.country].filter(Boolean).join(", ")}
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionHeading
                title={t("section_reservations")}
                subtitle={t("reservations_subtitle", {
                  confirmed: reservations.filter((r) => r.status === "booked").length,
                  pending: reservations.filter((r) => r.status === "planned").length,
                  draft: 0,
                })}
                href={routes.tripReservations(trip.id)}
              />
              {reservations.length === 0 ? (
                <EmptyState
                  title={t("empty_reservations_title")}
                  hint={t("empty_reservations_hint")}
                />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {reservations.slice(0, 4).map((r) => (
                    <li
                      key={r.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50"
                    >
                      <Plane size={14} className="text-muted-foreground" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{r.title}</div>
                        <div className="truncate text-[11px] font-mono uppercase text-muted-foreground">
                          {r.kind} · {r.status}
                        </div>
                      </div>
                      {r.costAmount != null && (
                        <div className="shrink-0 text-xs font-mono text-muted-foreground">
                          {formatMoney(r.costAmount, r.costCurrency || trip.budgetCurrency)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Bits ────────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SectionHeading({
  title,
  subtitle,
  href,
}: {
  title: string;
  subtitle?: string;
  href?: string;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-2">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && (
          <div className="mt-0.5 text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
            {subtitle}
          </div>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          View <ChevronRight size={12} />
        </Link>
      )}
    </div>
  );
}

function DestinationPill({ num }: { num: number }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border text-[11px] font-mono font-semibold tabular-nums">
      {num}
    </span>
  );
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}
