"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getTrip, type Trip } from "@1tt/api-client/travel";

/**
 * Extracts the active trip id from the current path when the user is inside
 * a `/travel/[tripId]/*` route, and hydrates the matching Trip record.
 * Returns `null` for the id + trip on trip-list and leaf travel routes
 * (`/travel`, `/travel/actionables`, `/travel/memories`).
 */
export function useTripContext(): {
  tripId: string | null;
  trip: Trip | null;
  loading: boolean;
} {
  const pathname = usePathname();
  const tripId = extractTripId(pathname);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tripId) {
      setTrip(null);
      return;
    }
    setLoading(true);
    getTrip(tripId)
      .then((t) => {
        if (!cancelled) setTrip(t);
      })
      .catch(() => {
        if (!cancelled) setTrip(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tripId]);

  return { tripId, trip, loading };
}

export function extractTripId(pathname: string): string | null {
  const m = pathname.match(/^\/travel\/([^/]+)(?:\/|$)/);
  if (!m) return null;
  const id = m[1];
  if (id === "actionables" || id === "memories") return null;
  return id;
}
