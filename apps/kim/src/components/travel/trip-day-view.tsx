"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Hotel, Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addActivity,
  listDestinations,
  listReservations,
  listTripActivities,
  type Activity,
  type Destination,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";
import { EmptyState } from "@/components/page-shell";
import { cn } from "@/lib/utils";
import { routes } from "@/lib/routes";
import { TripHeader, tripNights } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";

export function TripDayView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <DayBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

interface DaySlot {
  date: Date;
  destination: Destination | null;
  activities: Activity[];
  hotel: Reservation | null;
}

function DayBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    listDestinations(trip.id).then(setDestinations).catch(() => setDestinations([]));
    listTripActivities(trip.id).then(setActivities).catch(() => setActivities([]));
    listReservations(trip.id).then(setReservations).catch(() => setReservations([]));
  }, [trip.id]);

  const nights = tripNights(trip);
  const days = useMemo(
    () => buildDays(trip, nights, destinations, activities, reservations),
    [trip, nights, destinations, activities, reservations],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("day_title")}
        pageSubtitle={t("day_subtitle", { count: days.length })}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl">
          {days.length === 0 ? (
            <EmptyState title={t("day_empty_title")} hint={t("day_empty_hint")} />
          ) : (
            <ul className="flex flex-col gap-2">
              {days.map((d, i) => (
                <DayCard
                  key={d.date.toISOString()}
                  index={i}
                  slot={d}
                  onActivityAdded={(a) => setActivities((cur) => [...cur, a])}
                  t={t}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function DayCard({
  index,
  slot,
  onActivityAdded,
  t,
}: {
  index: number;
  slot: DaySlot;
  onActivityAdded: (a: Activity) => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const [open, setOpen] = useState(false);
  const { askKim } = useKim();
  const dateLabel = slot.date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  return (
    <li className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid w-full grid-cols-[120px_1fr_auto] items-center gap-3 px-3 py-3 text-left hover:bg-muted/30 sm:grid-cols-[140px_1fr_1.4fr_32px]"
      >
        <div>
          <div className="text-sm font-semibold">{t("day_label", { num: index + 1 })}</div>
          <div className="text-[11px] font-mono uppercase tracking-wide text-muted-foreground">
            {dateLabel}
          </div>
        </div>
        <div className="min-w-0">
          {slot.destination ? (
            <>
              <div className="truncate text-sm font-medium">{slot.destination.name}</div>
              <div className="truncate text-[11px] font-mono uppercase text-muted-foreground">
                {slot.destination.country || slot.destination.region || ""}
              </div>
            </>
          ) : (
            <div className="text-xs text-muted-foreground">{t("day_unscheduled")}</div>
          )}
        </div>
        <div className="hidden min-w-0 text-xs text-muted-foreground sm:block truncate">
          {slot.activities.length > 0
            ? t("route_activities_count_other", { count: slot.activities.length })
            : ""}
        </div>
        <ChevronRight
          size={14}
          className={cn(
            "shrink-0 text-muted-foreground transition-transform duration-150",
            open && "rotate-90 travel-accent",
          )}
        />
      </button>

      {open && (
        <div className="border-t border-border px-3 py-3 sm:px-4">
          <ul className="flex flex-col gap-1.5">
            {slot.activities.length === 0 && (
              <li className="text-xs text-muted-foreground italic">—</li>
            )}
            {slot.activities.map((a) => (
              <li
                key={a.id}
                className="flex items-start gap-3 rounded-md border border-border/60 bg-background px-2.5 py-2"
              >
                <div className="w-16 shrink-0 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {formatTime(a.startAt)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">{a.title}</div>
                  {a.category && (
                    <div className="truncate text-[11px] font-mono uppercase text-muted-foreground">
                      {a.category}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <ActivityInlineAdder
            destination={slot.destination}
            date={slot.date}
            onAdded={onActivityAdded}
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            {slot.hotel ? (
              <span className="inline-flex items-center gap-1 rounded-md travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border px-2 py-1">
                <Hotel size={12} /> {slot.hotel.title}
              </span>
            ) : (
              <button
                onClick={() =>
                  askKim(
                    t("route_ask_kim_hotel", {
                      destination: slot.destination?.name ?? "this stop",
                    }),
                  )
                }
                className="inline-flex items-center gap-1 rounded-md travel-accent ring-1 ring-inset travel-accent-border px-2 py-1 hover:travel-accent-bg"
              >
                <Sparkles size={12} /> {t("day_add_hotel")}
              </button>
            )}
            <button
              onClick={() =>
                askKim(t("day_ask_kim_day", { num: index + 1 }))
              }
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-muted-foreground hover:travel-accent"
            >
              <Sparkles size={11} /> {t("route_ask_kim_chip")}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function ActivityInlineAdder({
  destination,
  date,
  onAdded,
}: {
  destination: Destination | null;
  date: Date;
  onAdded: (a: Activity) => void;
}) {
  const { t } = useTranslation("travel");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!destination) return null;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting || !destination) return;
    setSubmitting(true);
    try {
      const iso = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
      ).toISOString();
      const created = await addActivity(destination.id, {
        title: trimmed,
        startAt: iso,
      });
      onAdded(created);
      setTitle("");
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus size={11} /> {t("day_add_activity")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="mt-2 flex items-center gap-2 rounded-md border border-dashed border-border bg-background p-2"
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) setEditing(false);
        }}
        placeholder={t("day_add_activity_placeholder")}
        disabled={submitting}
        className="h-7 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}

function buildDays(
  trip: Trip,
  nights: number,
  destinations: Destination[],
  activities: Activity[],
  reservations: Reservation[],
): DaySlot[] {
  if (!trip.startDate || nights <= 0) return [];
  const start = new Date(trip.startDate + "T00:00:00");
  const slots: DaySlot[] = [];
  const destForDay = buildDayToDestMap(destinations, nights);
  for (let i = 0; i <= nights; i++) {
    const d = new Date(start.getTime() + i * 86_400_000);
    const dest = destForDay[i] ?? null;
    const iso = d.toISOString().slice(0, 10);
    const dayActivities = activities.filter((a) =>
      a.startAt ? a.startAt.startsWith(iso) : false,
    );
    const hotel =
      reservations.find(
        (r) =>
          (r.kind === "hotel" || r.kind === "bnb") &&
          r.destinationId &&
          dest?.id === r.destinationId &&
          r.startAt &&
          r.startAt.startsWith(iso),
      ) ?? null;
    slots.push({ date: d, destination: dest, activities: dayActivities, hotel });
  }
  return slots;
}

function buildDayToDestMap(
  destinations: Destination[],
  nights: number,
): (Destination | null)[] {
  if (destinations.length === 0) return Array(nights + 1).fill(null);
  const totalDays = nights + 1;
  const per = Math.ceil(totalDays / destinations.length);
  const out: (Destination | null)[] = [];
  for (let i = 0; i < totalDays; i++) {
    out.push(destinations[Math.min(Math.floor(i / per), destinations.length - 1)]);
  }
  return out;
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
