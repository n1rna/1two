import { TripTipsView } from "@/components/travel/trip-tips-view";

export default async function TripTipsPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripTipsView tripId={tripId} />;
}
