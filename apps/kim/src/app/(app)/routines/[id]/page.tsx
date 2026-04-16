"use client";

import { useParams } from "next/navigation";
import { RoutineDetailView } from "@/components/routines/routine-detail-view";

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  return <RoutineDetailView routineId={id} />;
}
