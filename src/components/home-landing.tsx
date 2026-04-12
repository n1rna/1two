"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView, useScroll, useTransform } from "motion/react";
import {
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Database,
  Brain,
  Terminal,
  Zap,
  Layers,
  Code2,
  Check,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

// ─── Hero background (concentric arcs) ──────────────────────────────────────

function ArcRings() {
  const { scrollY } = useScroll();
  const rotate = useTransform(scrollY, [0, 800], [0, 14]);
  return (
    <motion.svg
      aria-hidden
      viewBox="0 0 1200 1200"
      className="pointer-events-none absolute left-1/2 top-[42%] h-[140%] w-[140%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-60 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]"
      style={{ rotate }}
    >
      <defs>
        <radialGradient id="home-ring-stroke" cx="50%" cy="50%" r="50%">
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
            stroke="url(#home-ring-stroke)"
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

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <ArcRings />
      <div className="relative mx-auto w-full max-w-6xl px-6 pt-20 pb-24 sm:pt-28 lg:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-7 flex justify-center"
        >
          <Eyebrow>
            <Sparkles className="h-3 w-3 text-primary" />
            Free, fast, no sign-up for most tools
          </Eyebrow>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center font-[family-name:var(--font-display)] text-[56px] leading-[0.95] tracking-[-0.02em] sm:text-[76px] lg:text-[92px]"
        >
          Tools that{" "}
          <span className="italic text-primary">just work.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-7 max-w-xl text-center text-[17px] leading-relaxed text-muted-foreground"
        >
          One site. Dozens of focused utilities for developers, plus a handful of AI-powered
          studios that replace whole apps. No accounts, no trackers, no dark patterns.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            href="/tools"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgba(255,126,165,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(255,126,165,0.85)]"
          >
            Browse all tools
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/life"
            className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-[15px] font-medium text-foreground backdrop-blur transition-colors hover:border-border hover:bg-background"
          >
            Try the life planner
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> No ads
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> No tracking
          </span>
          <span className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5 text-primary" /> Works offline for most tools
          </span>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Flagship cards ──────────────────────────────────────────────────────────

function FlagshipCard({
  icon: Icon,
  eyebrow,
  title,
  italic,
  description,
  href,
  cta,
  visual,
  delay = 0,
  reverse = false,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  italic?: string;
  description: string;
  href: string;
  cta: string;
  visual: React.ReactNode;
  delay?: number;
  reverse?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-[28px] border border-border/60 bg-card/90 backdrop-blur-sm transition-all duration-500 hover:border-primary/40 hover:shadow-[0_30px_80px_-30px_rgba(179,62,93,0.3)]"
    >
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -inset-px rounded-[28px] opacity-0 transition-opacity duration-700 group-hover:opacity-100">
        <div className="absolute -top-20 left-1/3 h-60 w-60 rounded-full bg-primary/15 blur-3xl" />
      </div>

      <div
        className={cn(
          "relative grid gap-8 p-8 sm:p-10 md:grid-cols-[1.05fr_0.95fr] md:gap-12 md:p-12",
          reverse && "md:grid-flow-dense md:[&>*:first-child]:md:col-start-2"
        )}
      >
        <div className="flex flex-col justify-center">
          <Eyebrow>
            <span className="h-1 w-1 rounded-full bg-primary" />
            {eyebrow}
          </Eyebrow>
          <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
            <Icon className="h-[22px] w-[22px]" />
          </div>
          <h3 className="mt-5 font-[family-name:var(--font-display)] text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            {title}
            {italic && (
              <>
                {" "}
                <span className="italic text-primary/90">{italic}</span>
              </>
            )}
          </h3>
          <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
            {description}
          </p>
          <Link
            href={href}
            className="group/cta mt-7 inline-flex items-center gap-1.5 self-start rounded-full border border-border/70 bg-background/70 px-5 py-2.5 text-[13.5px] font-medium text-foreground backdrop-blur transition-all hover:border-primary/50 hover:bg-background"
          >
            {cta}
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/cta:translate-x-0.5 group-hover/cta:-translate-y-0.5" />
          </Link>
        </div>
        <div className="relative">{visual}</div>
      </div>
    </motion.div>
  );
}

// ── visuals for each flagship ──

function DatabaseStudioVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/0 to-primary/5 blur-2xl" />
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-background/90 shadow-[0_20px_60px_-20px_rgba(179,62,93,0.2)]">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/80">
            <Database className="h-3 w-3 text-primary" />
            prod · users_db
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-600">
            connected
          </span>
        </div>
        <div className="grid grid-cols-[auto_1fr] gap-x-4 px-4 py-4 font-mono text-[11.5px] leading-[1.9]">
          <span className="select-none text-muted-foreground/60">1</span>
          <span>
            <span className="text-primary">SELECT</span> id, email, created_at
          </span>
          <span className="select-none text-muted-foreground/60">2</span>
          <span>
            <span className="text-primary">FROM</span> users
          </span>
          <span className="select-none text-muted-foreground/60">3</span>
          <span>
            <span className="text-primary">WHERE</span> last_seen &gt;{" "}
            <span className="text-foreground/70">NOW()</span> -{" "}
            <span className="text-foreground/70">&apos;7 days&apos;</span>
          </span>
          <span className="select-none text-muted-foreground/60">4</span>
          <span>
            <span className="text-primary">ORDER BY</span> created_at{" "}
            <span className="text-primary">DESC</span>;
          </span>
        </div>
        <div className="border-t border-border/60 bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground/80">
            <span>1,284 rows</span>
            <span>·</span>
            <span>42ms</span>
          </div>
          <div className="space-y-1">
            {[
              ["usr_8x2k…", "ava@acme.io", "2d"],
              ["usr_p1mf…", "jordan@foo.dev", "4h"],
              ["usr_g7tq…", "sam@bar.co", "31m"],
            ].map((row, i) => (
              <div
                key={i}
                className="grid grid-cols-[1fr_1.4fr_auto] items-center gap-3 rounded-md bg-background/60 px-2.5 py-1.5 font-mono text-[11px]"
              >
                <span className="text-muted-foreground/80">{row[0]}</span>
                <span className="text-foreground">{row[1]}</span>
                <span className="text-muted-foreground/80">{row[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RedisStudioVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/15 via-primary/0 to-primary/5 blur-2xl" />
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-background/90 shadow-[0_20px_60px_-20px_rgba(179,62,93,0.2)]">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/80">
            <Zap className="h-3 w-3 text-primary" />
            redis · localhost:6379
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-emerald-600">
            1.2M keys
          </span>
        </div>
        <div className="grid grid-cols-[168px_1fr]">
          {/* Key tree */}
          <div className="space-y-1 border-r border-border/50 bg-muted/20 p-3 font-mono text-[11px]">
            {[
              { label: "session:*", count: "84.2k", active: false },
              { label: "cache:user:*", count: "412k", active: true },
              { label: "queue:jobs", count: "stream", active: false },
              { label: "rate:ip:*", count: "18.5k", active: false },
              { label: "feature:flags", count: "hash", active: false },
            ].map((k) => (
              <div
                key={k.label}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1.5 transition-colors",
                  k.active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-background/60"
                )}
              >
                <span className="truncate">{k.label}</span>
                <span className="ml-2 text-[9px] text-muted-foreground/70">{k.count}</span>
              </div>
            ))}
          </div>
          {/* Command + output */}
          <div className="p-4 font-mono text-[11.5px] leading-[1.9]">
            <div className="text-muted-foreground/60">
              &gt; <span className="text-foreground">GET cache:user:8x2k</span>
            </div>
            <div className="mt-1 text-primary">
              {"{ \"id\": 8320, \"plan\": \"pro\", \"seen\": \"31m\" }"}
            </div>
            <div className="mt-3 text-muted-foreground/60">
              &gt; <span className="text-foreground">TTL cache:user:8x2k</span>
            </div>
            <div className="mt-1 text-primary">842</div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              live · 12k ops/sec
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LifeVisual() {
  return (
    <div className="relative">
      <div className="absolute -inset-5 -z-10 rounded-[2rem] bg-gradient-to-br from-primary/20 via-primary/0 to-primary/10 blur-2xl" />
      <div className="overflow-hidden rounded-[18px] border border-border/70 bg-card/90 shadow-[0_20px_60px_-20px_rgba(179,62,93,0.25)]">
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/40 px-4 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground/80">
            <Brain className="h-3 w-3 text-primary" />
            life · morning summary
          </div>
          <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/80">
            tue apr 14
          </span>
        </div>
        <div className="space-y-2 p-4">
          {[
            { time: "07:00–08:00", label: "Morning routine", tone: "muted" },
            { time: "08:30–17:00", label: "Deep work · 4 meetings", tone: "primary" },
            { time: "17:30–18:30", label: "Gym · push day", tone: "primary" },
            { time: "19:00–20:00", label: "Dinner · 620 kcal", tone: "muted" },
            { time: "22:30–07:00", label: "Sleep", tone: "muted" },
          ].map((b, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px]",
                b.tone === "primary"
                  ? "border-primary/30 bg-primary/5"
                  : "border-border/50 bg-background/60"
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  b.tone === "primary" ? "bg-primary" : "bg-muted-foreground/40"
                )}
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                {b.time}
              </span>
              <span className="font-medium text-foreground">{b.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Flagships section ───────────────────────────────────────────────────────

function Flagships() {
  return (
    <Section id="flagships">
      <SectionHeader
        eyebrow="Three to know"
        title="The ones we get asked about"
        italic="most."
        description="A few tools on 1tt.dev have outgrown their category. These are the big ones — built as full studios for work you'd otherwise bounce between several apps to do."
      />

      <div className="space-y-5">
        <FlagshipCard
          icon={Database}
          eyebrow="Data · SQL"
          title="Database Studio"
          description="A full Postgres client in the browser. Connect, run queries, browse schemas, inspect rows, tunnel through the CLI to prod — no desktop install, no driver hell, no accidental writes to prod."
          href="/tools/database-studio"
          cta="Open Database Studio"
          visual={<DatabaseStudioVisual />}
          delay={0}
        />

        <FlagshipCard
          icon={Zap}
          eyebrow="Data · Cache"
          title="Redis Studio"
          description="Browse keys, inspect streams, watch live ops/sec, manage consumer groups, run commands. Upstash-friendly, tunnel-friendly, read-mostly or read-write — your call."
          href="/tools/redis-studio"
          cta="Open Redis Studio"
          visual={<RedisStudioVisual />}
          delay={0.1}
          reverse
        />

        <FlagshipCard
          icon={Brain}
          eyebrow="Planning · AI"
          title="Life Planner"
          italic="+ Health"
          description="One assistant for routines, calendar, tasks, weight, meals, and workouts. Talks to Google Calendar and Tasks, generates your morning summary, and takes action instead of describing it."
          href="/life"
          cta="Try the life planner"
          visual={<LifeVisual />}
          delay={0.15}
        />
      </div>
    </Section>
  );
}

// ─── Many more section ──────────────────────────────────────────────────────

const CATEGORY_PILLS: { label: string; icon: LucideIcon }[] = [
  { label: "Formatters", icon: Code2 },
  { label: "Parsers", icon: Layers },
  { label: "Encoders", icon: Terminal },
  { label: "Generators", icon: Sparkles },
  { label: "Converters", icon: Zap },
  { label: "Crypto", icon: Brain },
  { label: "Text tools", icon: Code2 },
  { label: "Web tools", icon: Layers },
];

function ManyMore() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <Section id="more" className="pb-28">
      <div className="relative overflow-hidden rounded-[28px] border border-border/60 bg-gradient-to-br from-muted/60 via-card to-primary/5 px-8 py-16 sm:px-12 sm:py-20">
        {/* Decorative rings */}
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
          ref={ref}
          initial={{ opacity: 0, y: 22 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto max-w-3xl text-center"
        >
          <Eyebrow>
            <Layers className="h-3 w-3 text-primary" />
            And many, many more
          </Eyebrow>
          <h2 className="mt-5 font-[family-name:var(--font-display)] text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            Plus every{" "}
            <span className="italic text-primary/90">little utility</span>
            <br />
            you forgot you needed.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            JWT decoder, JSON diff, Base64, UUID, regex tester, cron builder, timestamp converter,
            color picker, DNS lookup, og:image generator, QR codes, markdown, favicon maker, and
            on and on. Pick one with{" "}
            <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[12px]">⌘K</span>{" "}
            or browse them all.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-2">
            {CATEGORY_PILLS.map((p) => (
              <span
                key={p.label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/70 px-3 py-1.5 text-[12px] text-muted-foreground backdrop-blur"
              >
                <p.icon className="h-3 w-3 text-primary/70" />
                {p.label}
              </span>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/tools"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3.5 text-[15px] font-medium text-primary-foreground shadow-[0_8px_24px_-8px_rgba(255,126,165,0.7)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_36px_-8px_rgba(255,126,165,0.85)]"
            >
              Browse all tools
              <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </Link>
            <Link
              href="/life"
              className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/70 px-6 py-3 text-[14px] font-medium text-foreground backdrop-blur transition-colors hover:border-border hover:bg-background"
            >
              Or meet the life planner
            </Link>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function HomeLanding() {
  return (
    <div className="relative bg-background text-foreground">
      <GrainOverlay />
      <Hero />
      <Flagships />
      <ManyMore />
    </div>
  );
}
