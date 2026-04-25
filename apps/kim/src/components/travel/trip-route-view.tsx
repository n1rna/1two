"use client";

import { useEffect, useState } from "react";
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
import { Card } from "@/components/page-shell";
import { RouteTable } from "./route-table";
import { TripHeader } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";
import { routes } from "@/lib/routes";

export function TripRouteView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <RouteBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

function RouteBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    listDestinations(trip.id).then(setDestinations).catch(() => setDestinations([]));
    listReservations(trip.id).then(setReservations).catch(() => setReservations([]));
    listTripActivities(trip.id).then(setActivities).catch(() => setActivities([]));
  }, [trip.id]);

  const canEdit = trip.role === "owner" || trip.role === "editor";

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("route_title")}
        pageSubtitle={t("route_subtitle", { count: destinations.length })}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-5xl space-y-4">
          <Card>
            <div className="mb-2 grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_36px] gap-2 border-b border-border pb-2 text-[10px] font-mono uppercase tracking-[0.12em] text-muted-foreground">
              <span>{t("route_header_destination")}</span>
              <span>{t("route_header_nights")}</span>
              <span>{t("route_header_sleeping")}</span>
              <span>{t("route_header_activities")}</span>
              <span>{t("route_header_transport")}</span>
              <span />
            </div>
            <RouteTable
              trip={trip}
              destinations={destinations}
              reservations={reservations}
              activities={activities}
              canEdit={canEdit}
              onDestinationsChange={setDestinations}
              onReservationsChange={setReservations}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
