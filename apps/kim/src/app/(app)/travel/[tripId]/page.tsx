import { TripOverviewView } from "@/components/travel/trip-overview-view";

export default async function TripOverviewPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripOverviewView tripId={tripId} />;
}
