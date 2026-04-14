"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RoutineDetailView } from "@/components/routines/routine-detail-view";

export default function RoutineDetailPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-3 border-b shrink-0">
        <Link
          href="/routines"
          className="inline-flex items-center gap-1 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft size={12} /> back to routines
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        <RoutineDetailView routineId={id} />
      </div>
    </div>
  );
}
