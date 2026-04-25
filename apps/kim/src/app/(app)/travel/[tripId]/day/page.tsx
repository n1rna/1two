import { TripDayView } from "@/components/travel/trip-day-view";

export default async function TripDayPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripDayView tripId={tripId} />;
}
