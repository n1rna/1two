import { TripCalendarView } from "@/components/travel/trip-calendar-view";

export default async function TripCalendarPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripCalendarView tripId={tripId} />;
}
