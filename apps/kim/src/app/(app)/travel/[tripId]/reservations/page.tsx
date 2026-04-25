import { TripReservationsView } from "@/components/travel/trip-reservations-view";

export default async function TripReservationsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripReservationsView tripId={tripId} />;
}
