"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useSearchParams, useRouter } from "next/navigation";
import { Github } from "lucide-react";
import { useSession, signIn } from "@/lib/auth-client";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

// ─── Ambient transcript ──────────────────────────────────────────────────────

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
        // restart loop after a beat
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

function Transcript() {
  const { lines, current } = useTypedTranscript();
  const rendered = current ? [...lines, current] : lines;

  return (
    <div className="font-mono text-[12.5px] leading-relaxed space-y-3 text-zinc-400">
      {rendered.map((turn, i) => {
        const isLast = i === rendered.length - 1;
        const isTyping = isLast && current !== null;
        if (turn.who === "you") {
          return (
            <div key={i} className="flex gap-3">
              <span className="text-zinc-600 select-none">you</span>
              <span className="text-zinc-300">
                {turn.text}
                {isTyping && <Caret />}
              </span>
            </div>
          );
        }
        return (
          <div key={i} className="flex gap-3">
            <span className="text-teal-400/90 select-none">kim</span>
            <div className="flex-1">
              {turn.tool && (
                <div className="inline-flex items-center gap-1.5 mb-1 px-1.5 py-0.5 rounded-sm bg-teal-400/10 border border-teal-400/20 text-[10px] uppercase tracking-[0.14em] text-teal-300/80">
                  <span className="h-1 w-1 rounded-full bg-teal-400 animate-pulse" />
                  {turn.tool}
                </div>
              )}
              <div className="text-zinc-200">
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

function Caret() {
  return (
    <span
      className="inline-block w-[7px] h-[1em] align-[-2px] ml-0.5 bg-teal-300/90 animate-[caret_1s_steps(2,_jump-none)_infinite]"
      aria-hidden
    />
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function LoginContent() {
  const { data: session, isPending } = useSession();
  const searchParams = useSearchParams();
  const router = useRouter();
  const redirect = searchParams.get("redirect") || "/";

  useEffect(() => {
    if (session && !isPending) {
      router.replace(redirect);
    }
  }, [session, isPending, redirect, router]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 grid md:grid-cols-[1.15fr_1fr] relative overflow-hidden">
      <style>{`
        @keyframes caret { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }
        @keyframes orbit-slow { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        @keyframes rise { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        .rise { animation: rise 700ms cubic-bezier(.2,.7,.2,1) both }
      `}</style>

      {/* ─── LEFT — showcase ─────────────────────────────────────────────── */}
      <aside className="relative flex flex-col justify-between p-10 md:p-14 lg:p-16 border-b md:border-b-0 md:border-r border-zinc-800/80 overflow-hidden min-h-[560px]">
        {/* background: radial amber + fine grid + grain */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(800px 500px at 85% 8%, rgba(95,149,152,0.18), transparent 60%), radial-gradient(600px 400px at 10% 90%, rgba(29,84,109,0.14), transparent 60%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.18]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            maskImage:
              "radial-gradient(ellipse at 60% 50%, black 35%, transparent 80%)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.035] mix-blend-overlay"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
          }}
        />
        {/* slow orbiting hairline ring in the top-right */}
        <div
          className="absolute -top-40 -right-40 w-[480px] h-[480px] rounded-full border border-teal-400/10 pointer-events-none"
          style={{ animation: "orbit-slow 60s linear infinite" }}
        >
          <span className="absolute top-1/2 -left-[3px] h-1.5 w-1.5 rounded-full bg-teal-400/80 shadow-[0_0_12px_rgba(95,149,152,0.9)]" />
        </div>

        {/* header status */}
        <header className="relative flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.22em] text-zinc-500">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            <span>kim agent · online</span>
          </div>
          <span className="hidden sm:block">kim1.ai / v0</span>
        </header>

        {/* wordmark + pitch */}
        <div className="relative mt-16 md:mt-20">
          <div className="rise">
            <Image
              src="/logo.svg"
              alt="kim"
              width={140}
              height={140}
              priority
              className="rounded-full shadow-[0_0_80px_-10px_rgba(95,149,152,0.55)]"
            />
          </div>
          <p
            className="rise mt-6 max-w-md text-[15px] leading-relaxed text-zinc-400"
            style={{ animationDelay: "120ms" }}
          >
            one conversation. your routines, your meals, your calendar,
            your workouts. kim pays attention so you don't have to.
          </p>
          <div
            className="rise mt-5 flex items-center gap-2 text-[10.5px] font-mono uppercase tracking-[0.22em] text-zinc-600"
            style={{ animationDelay: "180ms" }}
          >
            <span className="h-px w-6 bg-zinc-700" />
            a personal life agent
          </div>
        </div>

        {/* terminal transcript */}
        <div
          className="rise relative mt-12 md:mt-14 max-w-xl rounded-lg border border-zinc-800/90 bg-zinc-900/60 backdrop-blur-sm shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]"
          style={{ animationDelay: "260ms" }}
        >
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/80">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
              <span className="h-2 w-2 rounded-full bg-zinc-700" />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-600">
              kim — live
            </span>
          </div>
          <div className="p-5 min-h-[260px]">
            <Transcript />
          </div>
        </div>

        {/* footer */}
        <footer className="relative mt-10 md:mt-14 flex items-center justify-between text-[10.5px] font-mono uppercase tracking-[0.22em] text-zinc-600">
          <span>© 1tt.dev</span>
          <a
            href="https://1tt.dev"
            target="_blank"
            rel="noreferrer"
            className="hover:text-zinc-400 transition-colors"
          >
            ↗ 1tt.dev
          </a>
        </footer>
      </aside>

      {/* ─── RIGHT — sign in ─────────────────────────────────────────────── */}
      <section className="relative flex items-center justify-center px-8 py-16 bg-zinc-950">
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            background:
              "radial-gradient(600px 500px at 50% 0%, rgba(255,255,255,0.03), transparent 60%)",
          }}
        />
        <div className="relative w-full max-w-[360px]">
          <div className="rise">
            <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-zinc-600 mb-5">
              ① sign in
            </div>
            <h1
              className="text-5xl md:text-[54px] leading-[1.05] italic text-zinc-50"
              style={{ fontFamily: "var(--font-display), Georgia, serif" }}
            >
              come in.
            </h1>
            <p className="mt-4 text-[14px] leading-relaxed text-zinc-400">
              kim lives behind a quiet door. sign in with an account you
              already trust — we don't do passwords.
            </p>
          </div>

          <div
            className="rise mt-10 flex flex-col gap-3"
            style={{ animationDelay: "150ms" }}
          >
            <button
              onClick={() =>
                signIn.social({ provider: "github", callbackURL: redirect })
              }
              disabled={isPending || !!session}
              className="group relative flex items-center gap-3 w-full px-4 py-3.5 rounded-md border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 transition-all text-left disabled:opacity-50"
            >
              <Github className="h-4 w-4 text-zinc-300 shrink-0" />
              <span className="text-[13.5px] text-zinc-200 flex-1">
                continue with GitHub
              </span>
              <span className="font-mono text-[10px] text-zinc-600 group-hover:text-teal-400/90 transition-colors">
                →
              </span>
            </button>
            <button
              onClick={() =>
                signIn.social({ provider: "google", callbackURL: redirect })
              }
              disabled={isPending || !!session}
              className="group relative flex items-center gap-3 w-full px-4 py-3.5 rounded-md border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-900 hover:border-zinc-700 transition-all text-left disabled:opacity-50"
            >
              <GoogleIcon className="h-4 w-4 shrink-0" />
              <span className="text-[13.5px] text-zinc-200 flex-1">
                continue with Google
              </span>
              <span className="font-mono text-[10px] text-zinc-600 group-hover:text-teal-400/90 transition-colors">
                →
              </span>
            </button>
          </div>

          <div
            className="rise mt-8 flex items-center gap-3 text-[10.5px] font-mono uppercase tracking-[0.2em] text-zinc-600"
            style={{ animationDelay: "220ms" }}
          >
            <span className="h-px flex-1 bg-zinc-800" />
            <span>one account, kim + 1tt</span>
            <span className="h-px flex-1 bg-zinc-800" />
          </div>

          <p
            className="rise mt-6 text-[11px] leading-relaxed text-zinc-500"
            style={{ animationDelay: "280ms" }}
          >
            by continuing you agree to the 1tt.dev terms. your kim profile
            lives on the same account — one sign-in covers both.
          </p>
        </div>
      </section>
    </div>
  );
}
