import { TripRouteView } from "@/components/travel/trip-route-view";

export default async function TripRoutePage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripRouteView tripId={tripId} />;
}
