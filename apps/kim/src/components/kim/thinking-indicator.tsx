"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { THINKING_PHRASES } from "./tool-labels";

function useRotatingPhrase() {
  const [phrase, setPhrase] = useState(() =>
    THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)],
  );
  useEffect(() => {
    const interval = setInterval(() => {
      setPhrase(THINKING_PHRASES[Math.floor(Math.random() * THINKING_PHRASES.length)]);
    }, 3000);
    return () => clearInterval(interval);
  }, []);
  return phrase;
}

function Dots() {
  return (
    <div className="flex items-center gap-1">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="h-1 w-1 rounded-full animate-bounce"
          style={{
            background: "var(--kim-amber)",
            animationDelay: `${delay}ms`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}

export function TypingIndicator() {
  const phrase = useRotatingPhrase();
  return (
    <div className="py-3">
      <div
        className="kim-mono text-[10px] uppercase tracking-[0.18em] mb-1"
        style={{ color: "var(--kim-amber)" }}
      >
        kim
      </div>
      <div className="flex items-center gap-2">
        <Dots />
        <span className="text-xs animate-pulse" style={{ color: "var(--kim-ink-dim)" }}>
          {phrase}…
        </span>
      </div>
    </div>
  );
}

export function StreamingThinkingIndicator() {
  const phrase = useRotatingPhrase();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-xs py-0.5"
      style={{ color: "var(--kim-ink-dim)" }}
    >
      <Dots />
      <span className="animate-pulse">{phrase}…</span>
    </motion.div>
  );
}
