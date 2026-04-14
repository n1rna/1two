"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const displayFont = { fontFamily: "var(--font-display), Georgia, serif" };
const monoFont = { fontFamily: "var(--font-geist-mono), ui-monospace, monospace" };

/**
 * Primary "Chat with Kim" CTA. Uses the Kim wordmark (Instrument Serif italic)
 * and an amber ink palette so it reads as a Kim control even on the warm
 * beige host surface.
 */
export function AskKimButton({
  onClick,
  label = "Chat with",
  className,
}: {
  onClick: () => void;
  label?: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-2 rounded-full pl-4 pr-5 h-11 relative overflow-hidden",
        "bg-[color:rgb(22_19_17)] text-[color:rgb(238_228_214)]",
        "dark:bg-[color:rgb(250_245_237)] dark:text-[color:rgb(48_38_28)]",
        "border border-[color:rgb(176_108_32/0.6)]",
        "shadow-[0_6px_24px_-6px_rgb(176_108_32/0.45)]",
        "hover:shadow-[0_10px_30px_-6px_rgb(232_176_92/0.6)]",
        "transition-all active:scale-[0.98]",
        className,
      )}
    >
      {/* Amber ember — sits behind the text and pulses softly on hover */}
      <span
        aria-hidden
        className="absolute inset-0 opacity-40 group-hover:opacity-60 transition-opacity"
        style={{
          background:
            "radial-gradient(circle at 80% 50%, rgb(232 176 92 / 0.45), transparent 65%)",
        }}
      />
      <Sparkles
        className="relative h-3.5 w-3.5"
        style={{ color: "rgb(232 176 92)" }}
      />
      <span className="relative text-[13px] tracking-wide">{label}</span>
      <span
        className="relative text-2xl italic leading-none -mb-0.5"
        style={{ ...displayFont, color: "rgb(232 176 92)" }}
      >
        kim
      </span>
    </button>
  );
}

/**
 * A prompt suggestion chip styled in Kim's aesthetic. Clicking it should
 * typically call `askKim(prompt)` to fire a seeded message into the agent.
 */
export function KimPromptChip({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full h-8 pl-3 pr-3.5",
        "bg-background/70 backdrop-blur",
        "border border-[color:rgb(176_108_32/0.35)]",
        "text-[12px] text-foreground",
        "hover:bg-[color:rgb(232_176_92/0.12)] hover:border-[color:rgb(176_108_32/0.7)]",
        "transition-all",
      )}
    >
      <span
        className="text-[color:rgb(176_108_32)] dark:text-[color:rgb(232_176_92)]"
      >
        {icon}
      </span>
      <span style={monoFont} className="text-[11px] tracking-wide">
        {label}
      </span>
    </button>
  );
}

/**
 * "Ask Kim" eyebrow shown above create-page heros.
 */
export function AskKimEyebrow() {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 h-6 rounded-full border mb-3"
      style={{
        borderColor: "rgb(176 108 32 / 0.35)",
        background: "rgb(232 176 92 / 0.1)",
      }}
    >
      <Sparkles
        className="h-3 w-3"
        style={{ color: "rgb(176 108 32)" }}
      />
      <span
        className="uppercase tracking-[0.18em]"
        style={{
          ...monoFont,
          color: "rgb(176 108 32)",
          fontSize: "9.5px",
        }}
      >
        ask
      </span>
      <span
        className="italic leading-none -mb-0.5 text-base"
        style={{ ...displayFont, color: "rgb(176 108 32)" }}
      >
        kim
      </span>
    </div>
  );
}
