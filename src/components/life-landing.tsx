"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import {
  Brain,
  CheckSquare,
  Repeat2,
  Lightbulb,
  Calendar,
  Radio,
  ArrowRight,
  MessageSquare,
  Sparkles,
  BellRing,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  Star,
  Check,
  Link2,
  FileText,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Section wrapper ─────────────────────────────────────────────────────────

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
    <section id={id} className={cn("px-6 py-24 sm:py-32", className)}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

function SectionHeader({
  label,
  title,
  titleMuted,
  description,
}: {
  label: string;
  title: string;
  titleMuted?: string;
  description?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="mb-16 max-w-2xl"
    >
      <p className="text-sm font-semibold uppercase tracking-widest text-primary mb-3">
        {label}
      </p>
      <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
        {title}{" "}
        {titleMuted && (
          <span className="text-muted-foreground">{titleMuted}</span>
        )}
      </h2>
      {description && (
        <p className="mt-4 text-muted-foreground text-lg leading-relaxed">
          {description}
        </p>
      )}
    </motion.div>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Subtle radial gradient background */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/0.08,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-28 text-center sm:pb-32 sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <Sparkles className="h-3 w-3" />
          AI-powered life planning
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Your AI agent that handles
          <br />
          <span className="text-primary">daily life operations</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.25,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl"
        >
          Automate your tasks, build habits, sync your calendar, and get
          reminders through channels you already use — all from a single
          conversation.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/tools/life"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get Started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
          >
            View Features
          </a>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="h-3.5 w-3.5 fill-yellow-500 text-yellow-500"
              />
            ))}
            <span className="ml-1.5">5.0</span>
          </div>
          <span className="h-4 w-px bg-border" />
          <span>Works instantly</span>
          <span className="h-4 w-px bg-border" />
          <span>No setup required</span>
        </motion.div>
      </div>
    </section>
  );
}

// ─── Workflow demo ───────────────────────────────────────────────────────────

const workflows = [
  {
    tab: "Morning Routine",
    steps: [
      {
        label: "input",
        title: "Good morning check-in",
        description:
          'You say "Good morning" and the agent reviews your calendar, pending tasks, and routine schedule.',
      },
      {
        label: "action",
        title: "Planning & prioritization",
        description:
          "The agent builds your daily plan — what to tackle first, which routines are due, and any calendar conflicts.",
      },
      {
        label: "output",
        title: "Your daily briefing",
        description:
          "A clear summary of your day: top priorities, scheduled events, and habit reminders. Ready in seconds.",
      },
    ],
  },
  {
    tab: "Task Capture",
    steps: [
      {
        label: "input",
        title: "Mention a task in chat",
        description:
          '"I need to call the dentist this week" — just say it naturally in conversation.',
      },
      {
        label: "action",
        title: "Extraction & scheduling",
        description:
          "The agent extracts the actionable, sets a deadline, and adds it to your task list automatically.",
      },
      {
        label: "output",
        title: "Task created & tracked",
        description:
          "The task appears in your actionables with a due date. You'll get a reminder when it's time.",
      },
    ],
  },
  {
    tab: "Habit Building",
    steps: [
      {
        label: "input",
        title: "Describe your goal",
        description:
          '"I want to meditate every morning and read for 30 min before bed."',
      },
      {
        label: "action",
        title: "Routine creation",
        description:
          "The agent creates two routines with your preferred schedule, sets up tracking, and configures reminders.",
      },
      {
        label: "output",
        title: "Habits on autopilot",
        description:
          "You get daily nudges through Telegram or WhatsApp. The agent tracks streaks and adjusts timing based on your patterns.",
      },
    ],
  },
  {
    tab: "Calendar Sync",
    steps: [
      {
        label: "input",
        title: "Connect Google Calendar",
        description:
          "Link your calendar in one click. The agent immediately sees your schedule.",
      },
      {
        label: "action",
        title: "Conflict detection",
        description:
          "When creating tasks or routines, the agent checks for conflicts and suggests optimal time slots.",
      },
      {
        label: "output",
        title: "Perfectly scheduled",
        description:
          "Your tasks, routines, and events coexist without overlap. The agent adapts when your schedule changes.",
      },
    ],
  },
];

function WorkflowDemo() {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <Section className="bg-muted/20 border-y border-border/50">
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 24 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Tabs */}
        <div className="mb-10 flex flex-wrap gap-2">
          {workflows.map((w, i) => (
            <button
              key={w.tab}
              onClick={() => setActive(i)}
              className={cn(
                "rounded-full px-5 py-2 text-sm font-medium transition-all",
                i === active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {w.tab}
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="grid gap-4 sm:grid-cols-3">
          {workflows[active].steps.map((step, i) => (
            <motion.div
              key={`${active}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.4,
                delay: i * 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold",
                    step.label === "input"
                      ? "bg-blue-500/10 text-blue-500"
                      : step.label === "action"
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-green-500/10 text-green-500"
                  )}
                >
                  {i + 1}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {step.label}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

const featureList = [
  {
    icon: Brain,
    title: "AI Agent",
    description:
      "Chat naturally. Your agent understands context, remembers preferences, and proactively helps you plan.",
    color: "#6366f1",
  },
  {
    icon: CheckSquare,
    title: "Actionables",
    description:
      "Tasks and to-dos captured from conversations. Your agent creates and tracks them automatically.",
    color: "#10b981",
  },
  {
    icon: Repeat2,
    title: "Routines",
    description:
      "Build habits with custom schedules. Daily, weekly, or custom — the agent keeps you accountable.",
    color: "#8b5cf6",
  },
  {
    icon: Lightbulb,
    title: "Memory",
    description:
      "Your agent remembers what matters. Context and preferences persist across every conversation.",
    color: "#f59e0b",
  },
  {
    icon: Calendar,
    title: "Calendar Sync",
    description:
      "Connect Google Calendar. Your agent sees your schedule, avoids conflicts, and helps you time-block.",
    color: "#ec4899",
  },
  {
    icon: Radio,
    title: "Channels",
    description:
      "Nudges and reminders through Telegram or WhatsApp. Stay on track without opening another app.",
    color: "#06b6d4",
  },
];

function Features() {
  return (
    <Section id="features">
      <SectionHeader
        label="Features"
        title="Six features,"
        titleMuted="one conversation."
        description="Everything you need to organise your life, accessible through a single chat interface."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {featureList.map((feature, i) => {
          const Icon = feature.icon;
          return (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="group relative"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 h-full transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-primary/5">
                <div
                  className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
                  style={{ background: feature.color }}
                />
                <div className="relative">
                  <div
                    className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
                    style={{ background: `${feature.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: feature.color }} />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── How it works ────────────────────────────────────────────────────────────

const steps = [
  {
    icon: MessageSquare,
    title: "Describe what you need",
    description:
      'Tell the agent what you want in plain language — "I want to exercise 3 times a week" or "remind me to call mom every Sunday."',
  },
  {
    icon: Link2,
    title: "Connect your tools",
    description:
      "Link Google Calendar, Telegram, or WhatsApp. The agent syncs your schedule and delivers reminders where you already are.",
  },
  {
    icon: Eye,
    title: "Review and refine",
    description:
      "Every action is transparent. Approve, edit, or adjust anytime — the agent learns from your feedback to get better.",
  },
];

function HowItWorks() {
  return (
    <Section id="how-it-works" className="bg-muted/20 border-y border-border/50">
      <SectionHeader
        label="How it works"
        title="Talk naturally,"
        titleMuted="get things done."
        description="Think of it as YNAB for your life — every hour gets a purpose. Three steps to put your day on autopilot."
      />

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.5,
                delay: i * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="relative rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {i + 1}
                </span>
                <Icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">
                {step.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Use cases ───────────────────────────────────────────────────────────────

const useCases = [
  {
    tab: "Busy Professionals",
    title: "Busy professionals use Life to stay on top of competing priorities",
    description:
      "When your calendar is packed and tasks pile up, the agent triages your day — surfacing what's urgent, scheduling focused blocks, and nudging you through the right channel at the right time.",
    quote:
      "I used to lose track of tasks between meetings. Now my agent sends me a Telegram message before each focus block with exactly what to work on.",
    author: "Operations Manager",
  },
  {
    tab: "Students",
    title: "Students use Life to build study habits and track deadlines",
    description:
      "The agent creates study routines, tracks assignment deadlines, and sends reminders before things are due. No more all-nighters from forgotten homework.",
    quote:
      "It's like having a personal study coach that actually knows my schedule and doesn't let me procrastinate.",
    author: "University Student",
  },
  {
    tab: "Health & Wellness",
    title: "Health-focused users build sustainable routines with Life",
    description:
      "From gym schedules to meditation streaks to meal planning — the agent builds routines around your real calendar and sends gentle nudges when it's time.",
    quote:
      "I've maintained a 60-day meditation streak because the agent reminds me at the exact right moment every morning.",
    author: "Wellness Enthusiast",
  },
];

function UseCases() {
  const [active, setActive] = useState(0);
  const current = useCases[active];

  return (
    <Section id="use-cases">
      <SectionHeader
        label="Use cases"
        title="Practical ways"
        titleMuted="people use Life daily."
        description="Real workflows for real people."
      />

      <div className="flex flex-wrap gap-2 mb-10">
        {useCases.map((uc, i) => (
          <button
            key={uc.tab}
            onClick={() => setActive(i)}
            className={cn(
              "rounded-full px-5 py-2 text-sm font-medium transition-all",
              i === active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {uc.tab}
          </button>
        ))}
      </div>

      <motion.div
        key={active}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid gap-8 lg:grid-cols-2"
      >
        <div className="flex flex-col justify-center">
          <h3 className="text-2xl font-bold tracking-tight sm:text-3xl mb-4">
            {current.title}
          </h3>
          <p className="text-muted-foreground leading-relaxed mb-6">
            {current.description}
          </p>
          <Link
            href="/tools/life"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Try it yourself
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-2xl border border-border/50 bg-card p-8">
          <div className="mb-4 flex gap-0.5">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-yellow-500 text-yellow-500"
              />
            ))}
          </div>
          <blockquote className="text-foreground leading-relaxed mb-6">
            &ldquo;{current.quote}&rdquo;
          </blockquote>
          <p className="text-sm text-muted-foreground">
            — {current.author}
          </p>
        </div>
      </motion.div>
    </Section>
  );
}

// ─── Trust signals ───────────────────────────────────────────────────────────

function TrustSignals() {
  const items = [
    {
      icon: Zap,
      title: "Instant",
      description: "No setup required. Open and start chatting immediately.",
    },
    {
      icon: Shield,
      title: "Private",
      description:
        "Your data stays yours. No third-party training, no selling your information.",
    },
    {
      icon: Clock,
      title: "Always on",
      description:
        "Your agent is available 24/7 across all your devices and channels.",
    },
  ];

  return (
    <Section className="border-b border-border/50">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="text-center"
            >
              <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                {item.title}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {item.description}
              </p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

const faqItems = [
  {
    q: "What exactly is the Life tool?",
    a: "Life is your personal AI agent that automates daily planning through natural conversation. It manages tasks, builds habit routines, syncs your calendar, and sends reminders through Telegram or WhatsApp.",
  },
  {
    q: "How does pricing work?",
    a: "Life offers both free and premium tiers. Open the app to see current plans and what's included at each level.",
  },
  {
    q: "Do I need to install anything?",
    a: "No. Life runs entirely in your browser. Just open the app and start chatting. For notifications, connect your Telegram or WhatsApp — no additional app needed.",
  },
  {
    q: "How does the agent remember things about me?",
    a: "The agent has a memory system that persists across conversations. When you mention preferences, goals, or context, it stores them and uses that knowledge in future interactions to give better, more personalised help.",
  },
  {
    q: "Can I connect my Google Calendar?",
    a: "Yes. Link your Google Calendar and the agent will see your schedule, avoid conflicts when planning routines or tasks, and help you find optimal time slots.",
  },
  {
    q: "What notification channels are supported?",
    a: "Currently Telegram and WhatsApp. The agent sends reminders, daily briefings, and nudges through whichever channel you prefer.",
  },
  {
    q: "How is my data kept private?",
    a: "Your conversations and data are stored securely and never shared with third parties or used for AI training. You can delete your data at any time.",
  },
  {
    q: "What kind of tasks can the agent handle?",
    a: "Anything you'd normally put on a to-do list or calendar: task management, habit building, schedule planning, reminders, goal tracking, daily briefings, and more — all through natural conversation.",
  },
];

function FAQ() {
  return (
    <Section id="faq" className="bg-muted/20 border-y border-border/50">
      <div className="grid gap-16 lg:grid-cols-2">
        <div>
          <SectionHeader
            label="FAQ"
            title="Need help?"
            titleMuted="We've got answers."
          />
          <p className="text-muted-foreground leading-relaxed">
            Can&apos;t find what you&apos;re looking for? Open the Life tool and
            ask the agent directly — it can answer questions about itself too.
          </p>
        </div>

        <Accordion type="single" collapsible className="w-full">
          {faqItems.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-sm text-left">
                {item.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {item.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

// ─── Bottom CTA ──────────────────────────────────────────────────────────────

function BottomCTA() {
  return (
    <Section>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-border/50 bg-card"
      >
        {/* Subtle radial background */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-primary)/0.06,transparent_70%)]" />

        <div className="relative flex flex-col items-center gap-6 px-8 py-20 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Start planning smarter today
          </h2>
          <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
            Open the Life tool and have your first conversation. Your AI agent
            is ready to help you take control of your day.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <Link
              href="/tools/life"
              className="group inline-flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-base font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
            >
              View features
            </a>
          </div>
        </div>
      </motion.div>

    </Section>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function LifeLanding() {
  return (
    <div className="overflow-x-hidden">
      <Hero />
      <WorkflowDemo />
      <Features />
      <HowItWorks />
      <UseCases />
      <TrustSignals />
      <FAQ />
      <BottomCTA />
    </div>
  );
}
