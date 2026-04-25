"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listReservations,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { Card, EmptyState } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { TripHeader } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";

export function TripBudgetView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <BudgetBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

const CATEGORIES: { labelKey: string; kinds: string[] }[] = [
  { labelKey: "budget_category_flights", kinds: ["flight"] },
  { labelKey: "budget_category_stays", kinds: ["hotel", "bnb"] },
  { labelKey: "budget_category_trains", kinds: ["train", "bus", "car"] },
  { labelKey: "budget_category_activities", kinds: ["event"] },
  { labelKey: "budget_category_dining", kinds: ["restaurant"] },
  { labelKey: "budget_category_other", kinds: ["other"] },
];

function BudgetBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    listReservations(trip.id).then(setReservations).catch(() => setReservations([]));
  }, [trip.id]);

  const total = reservations
    .filter((r) => r.costAmount != null)
    .reduce((sum, r) => sum + (r.costAmount ?? 0), 0);
  const committed = reservations
    .filter((r) => r.status === "booked" && r.costAmount != null)
    .reduce((sum, r) => sum + (r.costAmount ?? 0), 0);

  const rows = CATEGORIES.map((cat) => {
    const amount = reservations
      .filter((r) => cat.kinds.includes(r.kind) && r.costAmount != null)
      .reduce((sum, r) => sum + (r.costAmount ?? 0), 0);
    return { labelKey: cat.labelKey, amount };
  }).filter((row) => row.amount > 0);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("budget_title")}
        pageSubtitle={t("budget_subtitle")}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-3xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Card className="p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("budget_total_committed")}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(committed, trip.budgetCurrency)}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("budget_total_estimated")}
              </div>
              <div className="mt-1 text-lg font-semibold tabular-nums">
                {formatMoney(total, trip.budgetCurrency)}
              </div>
            </Card>
          </div>

          <Card>
            {rows.length === 0 ? (
              <EmptyState title={t("budget_empty_title")} hint={t("budget_empty_hint")} />
            ) : (
              <ul className="flex flex-col gap-3">
                {rows.map((row) => {
                  const pct = total > 0 ? Math.round((row.amount / total) * 100) : 0;
                  return (
                    <li key={row.labelKey} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{t(row.labelKey)}</span>
                        <span className="font-mono tabular-nums">
                          {formatMoney(row.amount, trip.budgetCurrency)}
                          <span className="ml-2 text-[10px] text-muted-foreground">{pct}%</span>
                        </span>
                      </div>
                      <div className="h-[3px] w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full travel-accent-fill"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
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
