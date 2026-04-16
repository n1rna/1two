"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  CheckSquare,
  Dumbbell,
  GitFork,
  MessageSquare,
  Radio,
  Repeat,
  Sparkles,
  Sun,
  Utensils,
} from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { routes } from "@/lib/routes";
import { useTranslation } from "react-i18next";

// ─── Typed transcript (reused style from login page, teal-tinted) ──────────

type Turn =
  | { who: "you"; text: string }
  | { who: "kim"; text: string; tool?: string };

const SCRIPT: Turn[] = [
  { who: "you", text: "I'm drained. reschedule the 4pm + plan a quiet evening." },
  {
    who: "kim",
    tool: "calendar.move",
    text: "moved review to tomorrow 10:00. your evening is clear after 17:30.",
  },
  { who: "you", text: "make me a light dinner — nothing heavy." },
  {
    who: "kim",
    tool: "meal_plan.draft",
    text: "miso-glazed salmon, jasmine rice, wilted greens. 520 kcal. 18 min.",
  },
  { who: "you", text: "remind me to stretch before bed." },
  {
    who: "kim",
    tool: "routine.create",
    text: "added 'wind-down stretch' at 22:15. I'll ping you.",
  },
];

function useTypedTranscript() {
  const [lines, setLines] = useState<Turn[]>([]);
  const [typing, setTyping] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    let lineIdx = 0;
    let charIdx = 0;

    const tick = () => {
      if (cancelled) return;
      if (lineIdx >= SCRIPT.length) {
        setTimeout(() => {
          if (cancelled) return;
          lineIdx = 0;
          charIdx = 0;
          setLines([]);
          setTyping("");
          tick();
        }, 3600);
        return;
      }
      const line = SCRIPT[lineIdx];
      if (charIdx < line.text.length) {
        charIdx++;
        setTyping(line.text.slice(0, charIdx));
        setTimeout(tick, line.who === "kim" ? 18 : 34);
      } else {
        setLines((prev) => [...prev, line]);
        setTyping("");
        charIdx = 0;
        lineIdx++;
        setTimeout(tick, line.who === "kim" ? 900 : 550);
      }
    };
    const kickoff = setTimeout(tick, 600);
    return () => {
      cancelled = true;
      clearTimeout(kickoff);
    };
  }, []);

  const current: Turn | null =
    typing.length > 0 && lines.length < SCRIPT.length
      ? { ...SCRIPT[lines.length], text: typing }
      : null;

  return { lines, current };
}

function Caret() {
  return (
    <span
      className="inline-block w-[7px] h-[1em] align-[-2px] ml-0.5 bg-primary animate-[caret_1s_steps(2,_jump-none)_infinite]"
      aria-hidden
    />
  );
}

function Transcript() {
  const { lines, current } = useTypedTranscript();
  const rendered = current ? [...lines, current] : lines;

  return (
    <div className="font-mono text-[12.5px] leading-relaxed space-y-3 text-muted-foreground">
      {rendered.map((turn, i) => {
        const isLast = i === rendered.length - 1;
        const isTyping = isLast && current !== null;
        if (turn.who === "you") {
          return (
            <div key={i} className="flex gap-3">
              <span className="text-muted-foreground/60 select-none">you</span>
              <span className="text-foreground/80">
                {turn.text}
                {isTyping && <Caret />}
              </span>
            </div>
          );
        }
        return (
          <div key={i} className="flex gap-3">
            <span className="text-primary select-none font-semibold">kim</span>
            <div className="flex-1">
              {turn.tool && (
                <div className="inline-flex items-center gap-1.5 mb-1 px-1.5 py-0.5 rounded-sm bg-primary/10 border border-primary/20 text-[10px] uppercase tracking-[0.14em] text-primary/90">
                  <span className="h-1 w-1 rounded-full bg-primary animate-pulse" />
                  {turn.tool}
                </div>
              )}
              <div className="text-foreground">
                {turn.text}
                {isTyping && <Caret />}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Feature strip ───────────────────────────────────────────────────────────

const FEATURES: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  body: string;
}[] = [
  {
    icon: Sun,
    label: "today",
    body: "Morning plan, evening review, one conversation that runs your day.",
  },
  {
    icon: Repeat,
    label: "routines",
    body: "Wake-ups, workouts, chores, wind-downs — kim tracks and nudges.",
  },
  {
    icon: CalendarDays,
    label: "calendar",
    body: "Connected to Google Calendar. Move, block, and free up time.",
  },
  {
    icon: CheckSquare,
    label: "actionables",
    body: "A living inbox of things to do. Kim decides priority with you.",
  },
  {
    icon: Utensils,
    label: "meal plans",
    body: "Calorie-aware, preference-aware. Draft a day, a week, or a cut.",
  },
  {
    icon: Dumbbell,
    label: "gym sessions",
    body: "Structured lifts, tempo runs, recovery days — logged and reviewed.",
  },
  {
    icon: MessageSquare,
    label: "memories",
    body: "Preferences, constraints, habits — the things kim needs to know.",
  },
  {
    icon: Radio,
    label: "channels",
    body: "Push, email, telegram — kim reaches you where you already are.",
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export function LandingContent() {
  const { t } = useTranslation("landing");
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && session) {
      router.replace(routes.today);
    }
  }, [isPending, session, router]);

  // Hide the landing for logged-in users while we redirect
  if (!isPending && session) return null;

  return (
    <>
      <style>{`
        @keyframes caret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        @keyframes orbit-slow { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes rise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .rise { animation: rise 700ms cubic-bezier(.2,.7,.2,1) both }
      `}</style>

      {/* ─── Hero ───────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* ambient background */}
        <div
          className="absolute inset-0 pointer-events-none -z-10"
          style={{
            background:
              "radial-gradient(800px 500px at 85% 10%, rgba(95,149,152,0.18), transparent 60%), radial-gradient(700px 500px at 10% 90%, rgba(29,84,109,0.14), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none -z-10 opacity-[0.22]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(95,149,152,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(95,149,152,0.08) 1px, transparent 1px)",
            backgroundSize: "36px 36px",
            maskImage:
              "radial-gradient(ellipse at 60% 40%, black 35%, transparent 80%)",
          }}
        />
        <div
          className="absolute -top-40 -right-40 w-[520px] h-[520px] rounded-full border border-primary/10 pointer-events-none -z-10"
          style={{ animation: "orbit-slow 72s linear infinite" }}
        >
          <span className="absolute top-1/2 -left-[3px] h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_14px_rgba(95,149,152,0.9)]" />
        </div>

        <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-16 md:pt-24 pb-16 grid md:grid-cols-[1.1fr_1fr] gap-10 md:gap-16 items-start">
          {/* copy + CTA */}
          <div className="rise space-y-6 max-w-xl">
            <div className="flex items-center gap-3">
              <Image
                src="/logo.svg"
                alt="kim"
                width={44}
                height={44}
                priority
                className="rounded-full shadow-[0_0_30px_-5px_rgba(95,149,152,0.5)]"
              />
              <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                {t("tagline")}
              </span>
            </div>
            <h1
              className="text-[64px] md:text-[92px] leading-[0.95] italic tracking-tight"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              {t("hero_heading_line1")}
              <br />
              <span className="text-primary">{t("hero_heading_line2")}</span>
              <br />
              {t("hero_heading_line3")}
            </h1>
            <p className="text-[15px] leading-relaxed text-muted-foreground max-w-md">
              {t("hero_body")}
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-3">
              <Link
                href={routes.login()}
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground shadow-[0_12px_32px_-12px_rgba(29,84,109,0.6)] hover:-translate-y-0.5 transition-transform"
              >
                {t("hero_cta_sign_in")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={routes.marketplace()}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-5 py-3 text-[14px] font-medium hover:bg-card hover:border-foreground/20 transition-colors"
              >
                <GitFork className="h-4 w-4 text-muted-foreground" />
                {t("hero_cta_browse")}
              </Link>
            </div>
            <div className="flex items-center gap-3 pt-2 text-[10.5px] font-mono uppercase tracking-[0.2em] text-muted-foreground/70">
              <span className="h-px w-8 bg-border" />
              {t("hero_footnote")}
            </div>
          </div>

          {/* transcript showcase */}
          <div
            className="rise relative"
            style={{ animationDelay: "160ms" }}
          >
            <div className="relative rounded-xl border border-border bg-card/80 backdrop-blur shadow-[0_30px_80px_-40px_rgba(6,30,41,0.45)]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
                  {t("transcript_terminal_label")}
                </span>
              </div>
              <div className="p-5 min-h-[280px]">
                <Transcript />
              </div>
            </div>
            <div className="absolute -bottom-3 -right-3 hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-primary/30 bg-background text-[10px] font-mono uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" />
              {t("agent_online_badge")}
            </div>
          </div>
        </div>
      </section>

      {/* ─── What kim does ─────────────────────────────────────────── */}
      <section className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 md:py-24">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10 md:mb-14">
            <div className="space-y-3 max-w-xl">
              <div className="inline-flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                <span className="h-px w-6 bg-border" />
                {t("features_eyebrow")}
              </div>
              <h2
                className="text-3xl md:text-4xl italic leading-[1.08] tracking-tight"
                style={{ fontFamily: "var(--font-display), Georgia, serif" }}
              >
                {t("features_heading_line1")}
                <br />
                <span className="text-muted-foreground">{t("features_heading_line2")}</span>
              </h2>
            </div>
            <p className="text-sm text-muted-foreground md:max-w-sm leading-relaxed">
              {t("features_body")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map(({ icon: Icon, label, body }) => (
              <div
                key={label}
                className="group relative rounded-xl border border-border bg-card/40 p-5 hover:bg-card hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    {label}
                  </span>
                </div>
                <p className="text-[13.5px] leading-relaxed text-foreground/90">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How it works ────────────────────────────────────────── */}
      <section className="border-t border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 md:py-24">
          <div className="text-center space-y-3 max-w-2xl mx-auto mb-12">
            <div className="inline-flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
              <span className="h-px w-6 bg-border" />
              how it works
              <span className="h-px w-6 bg-border" />
            </div>
            <h2
              className="text-3xl md:text-4xl italic leading-[1.08] tracking-tight"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              {t("how_it_works_heading")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("how_it_works_subheading")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                n: "01",
                title: "sign in",
                body: "GitHub or Google. No passwords. One account works across kim1.ai and 1tt.dev.",
              },
              {
                n: "02",
                title: "tell kim what you want",
                body: "Plan a week. Build a routine. Draft dinner. Kim uses real tools to make it happen, not just suggest.",
              },
              {
                n: "03",
                title: "let it run",
                body: "Morning plan, evening review, nudges through the day. Your life runs in the background while you work.",
              },
            ].map((step) => (
              <div
                key={step.n}
                className="rounded-xl border border-border bg-card/60 p-6 space-y-3"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-primary">
                  {step.n}
                </div>
                <h3
                  className="text-xl italic leading-tight"
                  style={{ fontFamily: "var(--font-display), Georgia, serif" }}
                >
                  {step.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed text-muted-foreground">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────────────── */}
      <section className="border-t border-border/60">
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-20 md:py-28 text-center space-y-6">
          <div className="inline-flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            {t("final_cta_eyebrow")}
          </div>
          <h2
            className="text-4xl md:text-6xl italic leading-[1.02] tracking-tight"
            style={{ fontFamily: "var(--font-display), Georgia, serif" }}
          >
            {t("final_cta_heading")}
          </h2>
          <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
            {t("final_cta_body")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href={routes.login()}
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[14px] font-medium text-primary-foreground shadow-[0_12px_32px_-12px_rgba(29,84,109,0.6)] hover:-translate-y-0.5 transition-transform"
            >
              {t("final_cta_sign_in")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href={routes.marketplace()}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-5 py-3 text-[14px] font-medium hover:bg-card hover:border-foreground/20 transition-colors"
            >
              {t("final_cta_browse")}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
