"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listDestinations,
  listReservations,
  listTripActivities,
  type Activity,
  type Destination,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { Card, EmptyState } from "@/components/page-shell";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { TripHeader } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";

export function TripCalendarView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <CalendarBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

function CalendarBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    listDestinations(trip.id).then(setDestinations).catch(() => setDestinations([]));
    listTripActivities(trip.id).then(setActivities).catch(() => setActivities([]));
    listReservations(trip.id).then(setReservations).catch(() => setReservations([]));
  }, [trip.id]);

  const month = trip.startDate ? new Date(trip.startDate + "T00:00:00") : new Date();
  const grid = useMemo(() => buildMonthGrid(month), [month]);
  const tripRange = trip.startDate && trip.endDate
    ? {
        start: new Date(trip.startDate + "T00:00:00").getTime(),
        end: new Date(trip.endDate + "T00:00:00").getTime(),
      }
    : null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("calendar_title")}
        pageSubtitle={month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl">
          {!trip.startDate ? (
            <EmptyState title={t("dates_not_set")} hint={t("day_empty_hint")} />
          ) : (
            <Card className="p-3 sm:p-4">
              <div className="grid grid-cols-7 gap-1 pb-2 text-center text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {grid.map((d, i) => {
                  const inMonth = d.getMonth() === month.getMonth();
                  const time = d.getTime();
                  const inTrip =
                    tripRange != null && time >= tripRange.start && time <= tripRange.end;
                  const iso = d.toISOString().slice(0, 10);
                  const dayActivities = activities.filter(
                    (a) => a.startAt && a.startAt.startsWith(iso),
                  );
                  const dayReservations = reservations.filter(
                    (r) => r.startAt && r.startAt.startsWith(iso),
                  );
                  const dest = pickDestForDate(d, trip, destinations);
                  return (
                    <div
                      key={i}
                      className={cn(
                        "min-h-[64px] rounded-md border border-transparent p-1.5 text-right transition-colors",
                        inMonth ? "text-foreground" : "text-muted-foreground/40",
                        inTrip && "travel-accent-bg",
                      )}
                    >
                      <div className="text-[11px] font-mono">{d.getDate()}</div>
                      {inTrip && dest && (
                        <div className="text-left text-[10px] text-muted-foreground truncate">
                          {dest.name}
                        </div>
                      )}
                      <div className="mt-0.5 flex flex-col items-start gap-0.5">
                        {dayReservations.slice(0, 1).map((r) => (
                          <span
                            key={r.id}
                            className="inline-flex max-w-full truncate rounded-full travel-accent ring-1 ring-inset travel-accent-border px-1 text-[9px] font-mono uppercase"
                          >
                            {r.kind}
                          </span>
                        ))}
                        {dayActivities.slice(0, 1).map((a) => (
                          <span
                            key={a.id}
                            className="inline-flex max-w-full truncate rounded-full bg-muted px-1 text-[9px]"
                          >
                            {a.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function buildMonthGrid(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  // Monday-first grid: JS getDay returns 0 for Sunday, shift so Mon=0.
  const shift = (first.getDay() + 6) % 7;
  start.setDate(first.getDate() - shift);
  const out: Date[] = [];
  for (let i = 0; i < 42; i++) {
    out.push(new Date(start.getTime() + i * 86_400_000));
  }
  return out;
}

function pickDestForDate(
  date: Date,
  trip: Trip,
  destinations: Destination[],
): Destination | null {
  if (destinations.length === 0 || !trip.startDate || !trip.endDate) return null;
  const startMs = new Date(trip.startDate + "T00:00:00").getTime();
  const endMs = new Date(trip.endDate + "T00:00:00").getTime();
  if (date.getTime() < startMs || date.getTime() > endMs) return null;
  const totalDays = Math.max(1, Math.round((endMs - startMs) / 86_400_000) + 1);
  const per = Math.ceil(totalDays / destinations.length);
  const dayIdx = Math.round((date.getTime() - startMs) / 86_400_000);
  return destinations[Math.min(Math.floor(dayIdx / per), destinations.length - 1)];
}
