import type { Metadata } from "next";
import { GuideGrid } from "@/components/layout/guide-grid";

export const metadata: Metadata = {
  title: "Guides - 1tt.dev",
  description:
    "Learn how to get the most out of 1tt.dev - OG image serving, browser databases, cloud sync, config generators, and more.",
  alternates: { canonical: "https://1tt.dev/guides" },
};

export default function GuidesPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <GuideGrid />
    </div>
  );
}
