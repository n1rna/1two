import { TripBudgetView } from "@/components/travel/trip-budget-view";

export default async function TripBudgetPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = await params;
  return <TripBudgetView tripId={tripId} />;
}
