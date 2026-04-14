import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { QueryProvider } from "@/components/layout/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const SITE_URL = "https://kim1.ai";

export const metadata: Metadata = {
  title: {
    default: "kim — your personal life agent",
    template: "%s · kim",
  },
  description:
    "kim is your AI life agent. Plan your days, track routines, build meal plans and gym sessions, and stay on top of everything with a single conversation.",
  metadataBase: new URL(SITE_URL),
  keywords: [
    "AI life agent",
    "personal assistant",
    "routines",
    "habits",
    "meal planner",
    "gym tracker",
    "calendar planning",
    "kim",
  ],
  authors: [{ name: "kim1.ai" }],
  creator: "kim1.ai",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: "kim1.ai",
    title: "kim — your personal life agent",
    description: "Plan, track, and live intentionally with a single AI agent.",
  },
  twitter: {
    card: "summary_large_image",
    title: "kim — your personal life agent",
    description: "Plan, track, and live intentionally with a single AI agent.",
  },
  robots: { index: true, follow: true },
  alternates: { canonical: SITE_URL },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
