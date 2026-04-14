import type { Metadata } from "next";
import { LandingContent } from "./landing-content";

const SITE_URL = "https://kim1.ai";

export const metadata: Metadata = {
  title: "kim — your personal life agent",
  description:
    "kim is an AI agent that runs your life on the side. Plan days, track routines, build meal plans and gym sessions, and keep your calendar honest — in one conversation.",
  alternates: { canonical: SITE_URL },
  openGraph: {
    type: "website",
    url: SITE_URL,
    title: "kim — your personal life agent",
    description:
      "Plan, track, and live intentionally with a single AI agent.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kim — your personal life agent",
    description:
      "Plan, track, and live intentionally with a single AI agent.",
  },
};

export default function HomePage() {
  return <LandingContent />;
}
