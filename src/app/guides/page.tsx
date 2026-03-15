import type { Metadata } from "next";
import { GuideGrid } from "@/components/layout/guide-grid";

export const metadata: Metadata = {
  title: "Guides — 1two.dev",
  description:
    "Learn how to get the most out of 1two.dev — OG image serving, browser databases, cloud sync, config generators, and more.",
  alternates: { canonical: "https://1two.dev/guides" },
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <GuideGrid />
    </div>
  );
}
