import type { Metadata } from "next";
import { HealthLanding } from "@/components/health-landing";

const SITE_URL = "https://1tt.dev";

export const metadata: Metadata = {
  title: "Health - AI-powered diet, nutrition, and fitness",
  description:
    "Your AI health companion - personalized meal plans, workout programs, macro tracking, weight management, and nutrition guidance. All through conversation.",
  keywords: [
    "AI diet planner",
    "meal plan generator",
    "macro tracker",
    "workout planner",
    "fitness AI",
    "nutrition assistant",
    "calorie counter",
    "weight management",
    "gym program",
    "health AI",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: `${SITE_URL}/health`,
    siteName: "1tt.dev",
    title: "Health - AI Diet, Nutrition & Fitness Planner",
    description:
      "Your AI health companion - personalized meal plans, workout programs, macro tracking, and weight management.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Health - AI Diet, Nutrition & Fitness Planner",
    description:
      "Personalized meal plans, workout programs, macro tracking, and weight management - all through conversation.",
  },
  alternates: {
    canonical: `${SITE_URL}/health`,
  },
};

export default function HealthLandingPage() {
  return <HealthLanding />;
}
