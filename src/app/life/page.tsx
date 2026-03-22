import type { Metadata } from "next";
import { LifeLanding } from "@/components/life-landing";

const SITE_URL = "https://1tt.dev";

export const metadata: Metadata = {
  title: "Life Tool — AI-powered life planning",
  description:
    "Chat with an AI agent that manages your tasks, routines, habits, memories, and calendar. Stay on track with Telegram and WhatsApp notifications.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "AI life planner",
    "habit tracker",
    "task manager",
    "AI agent",
    "routine builder",
    "calendar sync",
    "life planning tool",
    "productivity AI",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/life`,
    siteName: "1tt.dev",
    title: "Life Tool — Your AI Life Planner",
    description:
      "Chat with an AI agent that manages your tasks, routines, habits, memories, and calendar. Stay on track with Telegram and WhatsApp notifications.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Life Tool — Your AI Life Planner",
    description:
      "Chat with an AI agent that manages your tasks, routines, habits, memories, and calendar.",
  },
  alternates: {
    canonical: `${SITE_URL}/life`,
  },
};

export default function LifeLandingPage() {
  return <LifeLanding />;
}
