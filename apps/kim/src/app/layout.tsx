import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { QueryProvider } from "@/components/layout/query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { I18nProvider } from "@/components/layout/i18n-provider";

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
  icons: {
    icon: [
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/logo-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/logo-180x180.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/logo-48x48.png",
  },
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
          <I18nProvider>
            <QueryProvider>
              <TooltipProvider>{children}</TooltipProvider>
            </QueryProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
