"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { getTrip, type Trip } from "@1tt/api-client/travel";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/**
 * Wraps every trip-scoped page with its loading and error states. Children
 * render once the trip record is hydrated and receive it plus a setter so
 * inline edits (title, status) propagate without re-fetching.
 */
export function TripPageLoader({
  tripId,
  children,
}: {
  tripId: string;
  children: (trip: Trip, setTrip: (t: Trip) => void) => React.ReactNode;
}) {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const trip = await getTrip(tripId);
      setTrip(trip);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("load_error"));
    } finally {
      setLoading(false);
    }
  }, [tripId, t]);

  useEffect(() => {
    void load();
  }, [load]);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              void load();
            }}
          >
            {t("retry")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => router.push(routes.travel)}>
            {tCommon("back")}
          </Button>
        </div>
      </div>
    );
  }

  return <>{children(trip, setTrip)}</>;
}
