import { CalendarTool } from "@/components/tools/calendar";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Calendar — 1two.dev",
  description:
    "Plan and visualize with multiple views, day selection, markers for milestones and epics, and timeline summaries",
};

export default function CalendarPage() {
  return (
    <>
      <style>{`body { overflow: hidden; }`}</style>
      <CalendarTool />
    </>
  );
}
