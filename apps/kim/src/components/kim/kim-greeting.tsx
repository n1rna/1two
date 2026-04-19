"use client";

import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { MODE_LABELS, type KimMode } from "./types";

export interface KimGreetingProps {
  mode: KimMode;
  /** Invoked when a starter chip is clicked. Receives the prompt text. */
  onStarterClick?: (text: string) => void;
}

const STARTER_KEYS: readonly string[] = [
  "starter_plan_day",
  "starter_log_meal",
  "starter_whats_next",
  "starter_review_today",
] as const;

export function KimGreeting({ mode, onStarterClick }: KimGreetingProps) {
  const { t } = useTranslation("kim");

  return (
    <div className="flex flex-col items-start gap-3 py-6">
      <div className="flex items-center gap-2">
        <Sparkles size={14} style={{ color: "var(--kim-amber)" }} strokeWidth={1.75} />
        <span
          className="kim-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          {t("greeting_ready", { mode: MODE_LABELS[mode] })}
        </span>
      </div>
      <p
        className="text-xs"
        style={{ color: "var(--kim-ink-faint)" }}
      >
        {t("greeting_hint")}
      </p>

      {onStarterClick && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {STARTER_KEYS.map((key) => {
            const label = t(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => onStarterClick(label)}
                className="kim-mono text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-sm border transition-colors"
                style={{
                  background: "var(--kim-bg-sunken)",
                  borderColor: "var(--kim-border)",
                  color: "var(--kim-ink-dim)",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
