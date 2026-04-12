"use client";

import { useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import {
  ArrowRight,
  Sparkles,
  Dumbbell,
  Apple,
  PieChart,
  Weight,
  CalendarDays,
  MessageSquare,
  TrendingDown,
  Flame,
  Target,
  Clock,
  Zap,
  Heart,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Shared components ───────────────────────────────────────────────────────

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

function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
  delay,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
  delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className="group relative"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 h-full transition-all duration-300 hover:border-border hover:shadow-lg hover:shadow-primary/5">
        <div
          className="pointer-events-none absolute -top-20 -right-20 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
          style={{ background: color }}
        />
        <div className="relative">
          <div
            className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl"
            style={{ background: `${color}15` }}
          >
            <Icon className="h-5 w-5" style={{ color }} />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Data ────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Apple,
    title: "Personalized Meal Plans",
    description: "Get weekly meal plans tailored to your goals, preferences, and dietary restrictions. Breakfast, lunch, dinner, and snacks.",
    color: "#10b981",
  },
  {
    icon: Dumbbell,
    title: "Workout Programs",
    description: "AI-designed workout sessions that match your fitness level, equipment, and schedule. Progressive overload built in.",
    color: "#6366f1",
  },
  {
    icon: PieChart,
    title: "Macro Tracking",
    description: "Automatic BMI, BMR, and TDEE calculations. See your protein, carbs, and fat targets in one clear breakdown.",
    color: "#f59e0b",
  },
  {
    icon: Weight,
    title: "Weight Management",
    description: "Track your weight over time with trend analysis. Visual charts show your progress toward your goal weight.",
    color: "#ec4899",
  },
  {
    icon: MessageSquare,
    title: "Chat with Your Agent",
    description: "Ask anything about nutrition or fitness. Log meals, get recipe ideas, adjust your plan - all through conversation.",
    color: "#3b82f6",
  },
  {
    icon: Flame,
    title: "Calorie Intelligence",
    description: "Know exactly what to eat to hit your targets. Get real-time suggestions that fit your remaining calorie budget.",
    color: "#ef4444",
  },
];

const howItWorks = [
  {
    step: "01",
    icon: Target,
    title: "Set your goals",
    description: "Tell the agent your height, weight, activity level, and what you want to achieve. It calculates your optimal targets instantly.",
  },
  {
    step: "02",
    icon: MessageSquare,
    title: "Chat naturally",
    description: "Ask for meal plans, log what you ate, request workout ideas, or check your macros. The agent handles everything through conversation.",
  },
  {
    step: "03",
    icon: TrendingDown,
    title: "Track progress",
    description: "Log your weight, review trends, and see how your nutrition and training align with your goals over time.",
  },
];

const faqs = [
  {
    q: "What dietary preferences are supported?",
    a: "All of them. Tell your agent you're vegan, keto, gluten-free, halal, or have any allergies - it adapts all meal plans and suggestions accordingly.",
  },
  {
    q: "Can I use this for bulking and cutting?",
    a: "Yes. Set your goal to gain, lose, or maintain weight. The agent adjusts your calorie targets, macro splits, and meal plans to match your phase.",
  },
  {
    q: "Do I need gym equipment?",
    a: "No. The workout planner supports bodyweight-only, home gym, and full gym setups. Tell your agent what you have access to.",
  },
  {
    q: "How does macro tracking work?",
    a: "The agent calculates your BMR and TDEE based on your profile, then splits calories into protein, carbs, and fat targets. You can ask for your breakdown anytime.",
  },
  {
    q: "Is this free?",
    a: "Yes, the health tool is free to use. Just sign in and start chatting with your AI health agent.",
  },
];

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/0.08,transparent_70%)]" />

      <div className="relative mx-auto max-w-5xl px-6 pb-24 pt-28 text-center sm:pb-32 sm:pt-36">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary"
        >
          <Heart className="h-3 w-3" />
          AI-powered health planning
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl"
        >
          Your AI companion for
          <br />
          <span className="text-primary">diet, nutrition & fitness</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground leading-relaxed sm:text-xl"
        >
          Personalized meal plans, workout programs, macro tracking, and weight management - all through a single conversation with your AI health agent.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/tools/health"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get started
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-8 py-3.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-foreground/20"
          >
            See features
          </a>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.55 }}
          className="mt-6 text-xs text-muted-foreground"
        >
          Free to use - no credit card required
        </motion.p>
      </div>
    </section>
  );
}

// ─── Features ────────────────────────────────────────────────────────────────

function Features() {
  return (
    <Section id="features">
      <SectionHeader
        label="Features"
        title="Everything you need,"
        titleMuted="one conversation."
        description="From calorie targets to workout splits - your AI agent handles diet, nutrition, and fitness in one unified tool."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <FeatureCard key={f.title} {...f} delay={i * 0.08} />
        ))}
      </div>
    </Section>
  );
}

// ─── How it works ────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <Section className="bg-muted/20">
      <SectionHeader
        label="How it works"
        title="Three steps to"
        titleMuted="better health."
      />
      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {howItWorks.map((step, i) => {
          const Icon = step.icon;
          return (
            <motion.div
              key={step.step}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="relative"
            >
              <span className="text-6xl font-bold text-muted-foreground/10 absolute -top-4 -left-2 select-none">
                {step.step}
              </span>
              <div className="relative pt-8">
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}

// ─── Chat demo ───────────────────────────────────────────────────────────────

function ChatDemo() {
  const messages = [
    { role: "user" as const, text: "I want to lose 5kg. I'm vegetarian and go to the gym 3x a week." },
    { role: "agent" as const, text: "Based on your profile, I've set your daily target to **1,850 kcal** with a macro split of 140g protein, 185g carbs, and 62g fat. Here's a sample day:" },
    { role: "agent" as const, text: "| Meal | Calories | Protein |\n|---|---|---|\n| Breakfast: Greek yogurt + granola | 380 | 28g |\n| Lunch: Lentil curry + rice | 520 | 32g |\n| Snack: Protein shake + banana | 310 | 30g |\n| Dinner: Tofu stir-fry + quinoa | 480 | 35g |" },
  ];

  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <Section>
      <SectionHeader
        label="See it in action"
        title="Just tell it"
        titleMuted="what you want."
      />
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.5 }}
        className="mx-auto max-w-2xl rounded-2xl border border-border/50 bg-card overflow-hidden"
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          <span className="ml-2 text-xs text-muted-foreground font-mono">health-agent</span>
        </div>

        {/* Messages */}
        <div className="p-5 space-y-3">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 0.3 + i * 0.4 }}
              className={cn(
                msg.role === "user" && "flex justify-end",
                msg.role === "agent" && "flex justify-start",
              )}
            >
              <div
                className={cn(
                  "rounded-2xl px-4 py-2.5 text-sm max-w-[90%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                <span className="whitespace-pre-line">{msg.text}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </Section>
  );
}

// ─── Stats ───────────────────────────────────────────────────────────────────

function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  const stats = [
    { icon: Apple, value: "Unlimited", label: "Meal plans" },
    { icon: Dumbbell, value: "Custom", label: "Workout programs" },
    { icon: Zap, value: "Instant", label: "Macro calculations" },
    { icon: Clock, value: "24/7", label: "AI availability" },
  ];

  return (
    <motion.section
      ref={ref}
      initial={{ opacity: 0 }}
      animate={inView ? { opacity: 1 } : {}}
      transition={{ duration: 0.6 }}
      className="border-y border-border/50 bg-muted/30"
    >
      <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="text-center">
              <Icon className="h-5 w-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground sm:text-3xl">{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
            </div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────

function FAQ() {
  return (
    <Section>
      <SectionHeader
        label="FAQ"
        title="Common questions"
      />
      <div className="max-w-2xl">
        <Accordion type="single" collapsible className="space-y-2">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className="border rounded-xl px-4">
              <AccordionTrigger className="text-sm font-medium text-left">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}

// ─── CTA ─────────────────────────────────────────────────────────────────────

function CTA() {
  return (
    <Section>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl border border-border/50"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/0.12,transparent_70%)]" />

        <div className="relative z-10 flex flex-col items-center gap-6 px-8 py-20 text-center sm:px-16">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl md:text-5xl">
            Start your health journey
          </h2>
          <p className="text-muted-foreground text-lg max-w-md leading-relaxed">
            Open the Health tool and chat with your AI agent. It's ready to build your first meal plan.
          </p>
          <Link
            href="/tools/health"
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-10 py-4 text-base font-semibold text-primary-foreground transition-all hover:shadow-lg hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]"
          >
            Get started - it's free
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
          <p className="text-xs text-muted-foreground">No credit card required</p>
        </div>
      </motion.div>
    </Section>
  );
}

// ─── Root ────────────────────────────────────────────────────────────────────

export function HealthLanding() {
  return (
    <div className="overflow-x-hidden">
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <ChatDemo />
      <FAQ />
      <CTA />
    </div>
  );
}
