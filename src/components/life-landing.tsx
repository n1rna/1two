"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Dumbbell,
  Apple,
  PieChart,
  Weight,
  CalendarDays,
  ListTodo,
  Repeat,
  Bell,
  Clock,
  Heart,
  Flame,
  Brain,
  MessageSquare,
  Check,
  Moon,
  Coffee,
  BookOpen,
  Target,
  Phone,
  Send,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Section primitives ──────────────────────────────────────────────────────

function Section({
  children,
  className,
  id,
}: {
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("relative px-6 py-24 sm:py-32", className)}>
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/60 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur">
      {children}
    </span>
  );
}

function SectionHeader({
  eyebrow,
  title,
  italic,
  description,
}: {
  eyebrow: string;
  title: React.ReactNode;
  italic?: string;
  description?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="mb-14 max-w-2xl"
    >
      <Eyebrow>
        <span className="h-1 w-1 rounded-full bg-primary" />
        {eyebrow}
      </Eyebrow>
      <h2 className="mt-5 font-[family-name:var(--font-display)] text-4xl leading-[1.02] tracking-tight sm:text-5xl md:text-[56px]">
        {title}
        {italic && (
          <>
            {" "}
            <span className="italic text-primary/90">{italic}</span>
          </>
        )}
      </h2>
      {description && (
        <p className="mt-5 max-w-xl text-base text-muted-foreground leading-relaxed sm:text-lg">
          {description}
        </p>
      )}
    </motion.div>
  );
}

// ─── Concentric arc rings for hero background ───────────────────────────────

function ArcRings() {
  const ref = useRef<SVGSVGElement>(null);
  const { scrollY } = useScroll();
  const rotate = useTransform(scrollY, [0, 800], [0, 18]);

  return (
    <motion.svg
      ref={ref}
      aria-hidden
      viewBox="0 0 1200 1200"
      className="pointer-events-none absolute left-1/2 top-[38%] h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      style={{ rotate }}
    >
      <defs>
        <radialGradient id="ring-stroke" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.55" />
          <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.16" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      {Array.from({ length: 9 }).map((_, i) => {
        const r = 80 + i * 62;
        return (
          <circle
            key={i}
            cx="600"
            cy="600"
            r={r}
            fill="none"
            stroke="url(#ring-stroke)"
            strokeWidth={1 + (8 - i) * 0.12}
          />
        );
      })}
      <path
        d="M 180 600 A 420 420 0 0 1 1020 600"
        fill="none"
        stroke="var(--primary)"
        strokeOpacity="0.35"
        strokeWidth="1.4"
        strokeDasharray="2 6"
      />
    </motion.svg>
  );
}

// Grain texture overlay
function GrainOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.035] mix-blend-multiply dark:opacity-[0.06] dark:mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.9'/></svg>\")",
      }}
    />
  );
}

// ─── Hero chat mockup ────────────────────────────────────────────────────────

type ChatMsg = {
  role: "user" | "assistant";
  content: string;
  tool?: { icon: LucideIcon; label: string };
};

const HERO_CONVO: ChatMsg[] = [
  { role: "user", content: "I weigh 76.2 kg now. Plan a leg day for tomorrow 7am and remind me to call mom." },
  { role: "assistant", content: "Got it — here's what I did:", tool: { icon: Weight, label: "Logged weight · 76.2 kg" } },
  { role: "assistant", content: "", tool: { icon: Dumbbell, label: "Built leg day · squats, lunges, RDLs" } },
  { role: "assistant", content: "", tool: { icon: CalendarDays, label: "Scheduled workout · Tue 7:00 AM" } },
  { role: "assistant", content: "", tool: { icon: Phone, label: "Task · Call mom (due today)" } },
];

function HeroChatMockup() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (step >= HERO_CONVO.length) return;
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 700 : 520);
    return () => clearTimeout(t);
  }, [step]);

  return (
    <div className="relative">
      <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/0 to-primary/10 blur-2xl" />

      <div className="rounded-[22px] border border-border/70 bg-card/90 shadow-[0_24px_80px_-20px_rgba(179,62,93,0.25)] backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/60 bg-muted/40">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            </div>
            <span className="ml-3 text-[11px] font-mono text-muted-foreground/80">life · chat</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/80">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            live
          </div>
        </div>

        <div className="max-h-[420px] min-h-[420px] space-y-3 overflow-hidden px-5 py-5">
          {HERO_CONVO.slice(0, step).map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.tool ? (
                <div className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-background/80 px-3 py-2 text-[13px] text-foreground shadow-sm">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <msg.tool.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="font-medium">{msg.tool.label}</span>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                </div>
              ) : msg.role === "user" ? (
                <div className="max-w-[82%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground shadow-sm">
                  {msg.content}
                </div>
              ) : (
                <div className="max-w-[82%] rounded-2xl rounded-bl-md border border-border/60 bg-background/70 px-4 py-2.5 text-[13.5px] leading-relaxed text-foreground">
                  {msg.content}
                </div>
              )}
            </motion.div>
          ))}

          {step < HERO_CONVO.length && step > 0 && (
            <div className="flex items-center gap-1.5 pl-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.2s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60 [animation-delay:-0.1s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground/60" />
            </div>
          )}
        </div>

        <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3.5 py-2.5">
            <span className="text-[11px] font-mono text-muted-foreground/80">/</span>
            <span className="flex-1 text-[13px] text-muted-foreground/60">
              Type <span className="font-mono text-foreground/70">/summary</span> or ask anything…
            </span>
            <button className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Send className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <ArcRings />
      <div className="relative mx-auto w-full max-w-6xl px-6 pb-24 pt-20 sm:pt-28 lg:pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-7"
        >
          <Eyebrow>
            <Sparkles className="h-3 w-3 text-primary" />
            One assistant for your entire personal operating system
          </Eyebrow>
        </motion.div>

        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-xl">
            <motion.h1
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-[family-name:var(--font-display)] text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[76px] lg:text-[84px]"
            >
              Live{" "}
              <span className="italic text-primary">intentionally,</span>
              <br />
              not reactively.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 max-w-lg text-[17px] leading-relaxed text-muted-foreground"
            >
              Your routines, calendar, tasks, weight, meals, and workouts — in one conversation.
              Talk to your life the way you&apos;d talk to a thoughtful friend. The boring stuff gets handled.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="mt-9 flex flex-col items-start gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/tools/life"
                className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgba(255,126,165,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-8px_rgba(255,126,165,0.8)]"
              >
                Start for free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-[15px] font-medium text-foreground backdrop-blur transition-colors hover:border-border hover:bg-background"
              >
                See how it works
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> Google Calendar + Tasks
              </span>
              <span className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-primary" /> Your data, your device
              </span>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="lg:translate-y-2"
          >
            <HeroChatMockup />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Stats strip ─────────────────────────────────────────────────────────────

function StatsStrip() {
  const stats = [
    { k: "28+", v: "Tools in one chat" },
    { k: "1", v: "Place for everything" },
    { k: "24/7", v: "Always thinking ahead" },
    { k: "0", v: "Forms to fill out" },
  ];
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <div ref={ref} className="border-y border-border/50 bg-muted/30">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-y-8 px-6 py-10 sm:grid-cols-4 sm:gap-0">
        {stats.map((s, i) => (
          <motion.div
            key={s.v}
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            className="text-center sm:border-l sm:border-border/60 sm:first:border-l-0"
          >
            <div className="font-[family-name:var(--font-display)] text-4xl text-foreground sm:text-5xl">
              {s.k}
            </div>
            <div className="mt-1.5 text-[12px] uppercase tracking-widest text-muted-foreground">
              {s.v}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ─── Bento feature grid ──────────────────────────────────────────────────────

function BentoCard({
  className,
  icon: Icon,
  title,
  description,
  children,
  delay = 0,
}: {
  className?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "group relative overflow-hidden rounded-[20px] border border-border/60 bg-card/90 p-6 backdrop-blur-sm transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_20px_50px_-15px_rgba(179,62,93,0.25)]",
        className
      )}
    >
      <div className="pointer-events-none absolute -inset-px rounded-[20px] opacity-0 transition-opacity duration-500 group-hover:opacity-100">
        <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
      </div>
      <div className="relative flex h-full flex-col">
        <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <h3 className="font-[family-name:var(--font-display)] text-2xl leading-tight tracking-tight">
          {title}
        </h3>
        <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
          {description}
        </p>
        {children && <div className="mt-auto pt-5">{children}</div>}
      </div>
    </motion.div>
  );
}

function BentoGrid() {
  return (
    <Section id="features">
      <SectionHeader
        eyebrow="One assistant, every domain"
        title="Everything in your life,"
        italic="talking to each other."
        description="Most apps make you manage them. This one manages itself. Your routines know about your calendar. Your meals know about your macros. Your workouts know about your schedule. Ask in plain language, get action."
      />

      <div className="grid gap-5 md:grid-cols-3 md:grid-rows-[auto_auto]">
        <BentoCard
          className="md:col-span-2 md:row-span-2"
          icon={Brain}
          title="An agent that actually does things"
          description="Not a notetaker. Not a calendar. A model with 28+ tools that can log your weight, update your diet, create a workout, reschedule a meeting, save a memory, and summarize your day — in one turn."
          delay={0}
        >
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { icon: Weight, label: "Log weight" },
              { icon: Dumbbell, label: "Build workout" },
              { icon: Apple, label: "Plan meals" },
              { icon: CalendarDays, label: "Move events" },
              { icon: ListTodo, label: "Manage tasks" },
              { icon: Repeat, label: "Track routines" },
              { icon: Heart, label: "Health profile" },
              { icon: Bell, label: "Remember facts" },
            ].map((t) => (
              <div
                key={t.label}
                className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/60 px-3 py-2 text-[12.5px]"
              >
                <t.icon className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">{t.label}</span>
              </div>
            ))}
          </div>
        </BentoCard>

        <BentoCard
          icon={CalendarDays}
          title="Calendar that thinks"
          description="Google Calendar + Google Tasks, with a model that understands context. Move events, reschedule workouts, cancel meetings — by chat."
          delay={0.05}
        />

        <BentoCard
          icon={Flame}
          title="Macros without spreadsheets"
          description="Diet, nutrition targets, calorie budget, and meal plans. Ask for a plan that fits, log what you ate, done."
          delay={0.1}
        />

        <BentoCard
          className="md:col-span-2"
          icon={Sparkles}
          title="A morning summary, every morning"
          description="Your day, automatically generated each night. Sleep, work block, meals, gym, wind-down — one glance, no clicking around."
          delay={0.15}
        >
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-background/70 p-3 font-mono text-[11.5px] text-muted-foreground">
            <span className="flex items-center gap-1"><Moon className="h-3.5 w-3.5" /> 00:00–07:00 Sleep</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Coffee className="h-3.5 w-3.5" /> 07:00–09:00 Morning</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><Dumbbell className="h-3.5 w-3.5" /> 09:00–10:00 Gym</span>
            <span className="text-border">·</span>
            <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> 10:00–17:00 Work</span>
          </div>
        </BentoCard>
      </div>
    </Section>
  );
}

// ─── Capabilities marquee ────────────────────────────────────────────────────

function CapabilityChip({ icon: Icon, label }: { icon: LucideIcon; label: string }) {
  return (
    <div className="mx-3 inline-flex items-center gap-2.5 whitespace-nowrap rounded-full border border-border/60 bg-background/80 px-4 py-2 text-[13px] text-foreground shadow-sm backdrop-blur">
      <Icon className="h-3.5 w-3.5 text-primary" />
      <span className="font-medium">{label}</span>
    </div>
  );
}

function CapabilitiesMarquee() {
  const row = [
    { icon: Weight, label: "Log weight" },
    { icon: Dumbbell, label: "Leg day in 7 min" },
    { icon: Apple, label: "Keto dinner plan" },
    { icon: PieChart, label: "Macros today" },
    { icon: CalendarDays, label: "Reschedule dentist" },
    { icon: ListTodo, label: "Add to Google Tasks" },
    { icon: Repeat, label: "Mon/Wed/Fri 7am" },
    { icon: Heart, label: "Update diet goal" },
    { icon: Target, label: "New fitness goal" },
    { icon: Bell, label: "Remind me tomorrow" },
    { icon: MessageSquare, label: "Review my week" },
    { icon: Clock, label: "What's next today" },
  ];
  const doubled = [...row, ...row];

  return (
    <div className="relative overflow-hidden border-y border-border/50 bg-gradient-to-b from-background to-muted/20 py-10">
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-32 bg-gradient-to-l from-background to-transparent" />

      <div className="mb-5 text-center">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Things people actually say to it
        </p>
      </div>

      <div className="marquee-track flex min-w-max">
        {doubled.map((c, i) => (
          <CapabilityChip key={`${c.label}-${i}`} {...c} />
        ))}
      </div>

      <style jsx>{`
        .marquee-track {
          animation: marquee 46s linear infinite;
        }
        @keyframes marquee {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}

// ─── How it works ────────────────────────────────────────────────────────────

function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: MessageSquare,
      title: "Tell it about you",
      body: "A two-minute conversation sets up your routines, diet, fitness level, and goals. No forms. No dropdowns.",
    },
    {
      n: "02",
      icon: Sparkles,
      title: "Connect what you use",
      body: "Link Google Calendar and Google Tasks in one click. The agent takes it from there — create, edit, and delete events and tasks in chat.",
    },
    {
      n: "03",
      icon: Sun,
      title: "Let it run your day",
      body: "Your morning summary is ready before you wake up. Ask for a workout, a meal plan, or a reschedule anytime. Your routines keep themselves honest.",
    },
  ];

  return (
    <Section id="how">
      <SectionHeader
        eyebrow="How it works"
        title="From messy to"
        italic="meaningful"
        description="Three steps, under five minutes, and you have a personal assistant that actually takes action."
      />
      <div className="grid gap-5 md:grid-cols-3">
        {steps.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="relative rounded-[20px] border border-border/60 bg-card/80 p-7 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between">
                <div className="font-[family-name:var(--font-display)] text-5xl text-primary/30">
                  {s.n}
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <h3 className="mt-5 font-[family-name:var(--font-display)] text-2xl leading-tight">
                {s.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Pull quote ──────────────────────────────────────────────────────────────

function PullQuote() {
  return (
    <Section className="py-20 sm:py-28">
      <motion.figure
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative mx-auto max-w-3xl text-center"
      >
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 font-[family-name:var(--font-display)] text-8xl leading-none text-primary/20 select-none">
          &ldquo;
        </div>
        <blockquote className="relative font-[family-name:var(--font-display)] text-3xl leading-tight tracking-tight sm:text-4xl md:text-[44px]">
          I stopped opening five apps to plan my day. Now I just{" "}
          <span className="italic text-primary/90">tell one thing</span> what I
          want, and it&apos;s already done.
        </blockquote>
        <figcaption className="mt-8 text-[13px] uppercase tracking-widest text-muted-foreground">
          — The whole point
        </figcaption>
      </motion.figure>
    </Section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  const items = [
    {
      q: "Is this a health app or a life planner?",
      a: "Both, merged into one. Your routines know about your workouts. Your meals know about your calorie target. Your calendar knows about your gym sessions. One assistant, no switching.",
    },
    {
      q: "What does it actually connect to?",
      a: "Google Calendar for events and Google Tasks for to-dos. Everything else — routines, memories, weight, meals, workouts — lives here natively. More integrations are on the way.",
    },
    {
      q: "Do I need to fill out long forms?",
      a: "No. A two-minute chat-based onboarding captures everything needed. You can update your profile anytime — just tell the assistant what changed.",
    },
    {
      q: "What happens to my data?",
      a: "Your conversations, routines, and health profile are yours. We use them to give the assistant context and generate your morning summary. Nothing is sold or shared.",
    },
    {
      q: "How is this different from a generic chatbot?",
      a: "The assistant has 28+ real tools wired directly into your calendar, tasks, and health data. It doesn't just describe what to do — it does it. Every request results in a concrete action or a clear answer.",
    },
    {
      q: "Is there a free tier?",
      a: "Yes — sign up and use the full assistant free. We'll add paid tiers later with higher limits and advanced integrations. Early users get grandfathered.",
    },
  ];

  return (
    <Section id="faq" className="pb-24">
      <SectionHeader
        eyebrow="Questions"
        title="Frequently"
        italic="asked"
      />
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={i} value={`faq-${i}`} className="border-border/50">
            <AccordionTrigger className="py-5 text-left text-[17px] font-medium hover:no-underline">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </Section>
  );
}

// ─── Final CTA ───────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <Section className="pb-28 sm:pb-36">
      <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-primary/10 via-card to-muted/60 px-8 py-16 text-center sm:px-12 sm:py-20">
        <svg
          aria-hidden
          viewBox="0 0 800 400"
          className="pointer-events-none absolute left-1/2 top-1/2 h-[140%] w-[140%] -translate-x-1/2 -translate-y-1/2 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <circle
              key={i}
              cx="400"
              cy="200"
              r={60 + i * 42}
              fill="none"
              stroke="var(--primary)"
              strokeOpacity={0.15 - i * 0.02}
              strokeWidth="1"
            />
          ))}
        </svg>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-2xl"
        >
          <Eyebrow>
            <Heart className="h-3 w-3 text-primary" />
            Built for people who want less friction
          </Eyebrow>
          <h2 className="mt-5 font-[family-name:var(--font-display)] text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Start living{" "}
            <span className="italic text-primary/90">intentionally.</span>
          </h2>
          <p className="mt-5 text-[16px] text-muted-foreground">
            Your first conversation is free. Your morning summary tomorrow is on us.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tools/life"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgba(255,126,165,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(255,126,165,0.85)]"
            >
              Open your life assistant
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="#features"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:border-border hover:bg-background"
            >
              Scroll back
            </Link>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LifeLanding() {
  return (
    <div className="relative bg-background text-foreground">
      <GrainOverlay />
      <Hero />
      <StatsStrip />
      <BentoGrid />
      <CapabilitiesMarquee />
      <HowItWorks />
      <PullQuote />
      <FAQ />
      <FinalCTA />
    </div>
  );
}
