"use client";

import { useEffect, useState } from "react";
import {
  Bus,
  Car,
  Hotel,
  Plane,
  Ticket as TicketIcon,
  Train,
  Utensils,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listReservations,
  type Reservation,
  type ReservationKind,
  type Trip,
} from "@1tt/api-client/travel";
import { Card } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { TripHeader } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";
import { ReservationInlineAdder } from "./reservation-inline-adder";

export function TripReservationsView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <ReservationsBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

interface KindGroup {
  labelKey: string;
  kinds: ReservationKind[];
  primaryKind: ReservationKind;
  icon: typeof Plane;
}

const KIND_GROUPS: KindGroup[] = [
  { labelKey: "reservations_group_flights", kinds: ["flight"], primaryKind: "flight", icon: Plane },
  { labelKey: "reservations_group_hotels", kinds: ["hotel", "bnb"], primaryKind: "hotel", icon: Hotel },
  { labelKey: "reservations_group_trains", kinds: ["train"], primaryKind: "train", icon: Train },
  { labelKey: "reservations_group_buses", kinds: ["bus"], primaryKind: "bus", icon: Bus },
  { labelKey: "reservations_group_cars", kinds: ["car"], primaryKind: "car", icon: Car },
  { labelKey: "reservations_group_activities", kinds: ["event"], primaryKind: "event", icon: TicketIcon },
  { labelKey: "reservations_group_dining", kinds: ["restaurant"], primaryKind: "restaurant", icon: Utensils },
  { labelKey: "reservations_group_other", kinds: ["other"], primaryKind: "other", icon: TicketIcon },
];

function ReservationsBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    listReservations(trip.id).then(setReservations).catch(() => setReservations([]));
  }, [trip.id]);

  const confirmed = reservations.filter((r) => r.status === "booked").length;
  const pending = reservations.filter((r) => r.status === "planned").length;
  const drafts = 0;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("reservations_title")}
        pageSubtitle={t("reservations_subtitle", { confirmed, pending, draft: drafts })}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl space-y-3">
          {KIND_GROUPS.map((group) => {
            const items = reservations.filter((r) =>
              group.kinds.includes(r.kind as ReservationKind),
            );
            const Icon = group.icon;
            const label = t(group.labelKey);
            return (
              <Card key={group.labelKey}>
                <h2 className="mb-3 flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <Icon size={12} /> {label}
                  {items.length > 0 && <span className="tabular-nums">· {items.length}</span>}
                </h2>
                {items.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {items.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{r.title}</div>
                          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                            {[
                              r.provider,
                              r.originPlace && r.destPlace
                                ? `${r.originPlace} → ${r.destPlace}`
                                : r.originPlace || r.destPlace,
                              formatDate(r.startAt),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          {r.costAmount != null && (
                            <div className="text-sm font-mono tabular-nums">
                              {formatMoney(r.costAmount, r.costCurrency || trip.budgetCurrency)}
                            </div>
                          )}
                          {r.confirmationCode && (
                            <div className="rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                              {r.confirmationCode}
                            </div>
                          )}
                          <div className="text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                            {r.status}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <ReservationInlineAdder
                  tripId={trip.id}
                  tripTitle={trip.title}
                  kind={group.primaryKind}
                  kindLabel={label}
                  onAdded={(r) => setReservations((cur) => [...cur, r])}
                />
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
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
