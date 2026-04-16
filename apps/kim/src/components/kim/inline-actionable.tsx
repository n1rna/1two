"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LifeActionable } from "@/lib/life";
import { useTranslation } from "react-i18next";

export function InlineChatActionable({
  actionable,
  onRespond,
}: {
  actionable: LifeActionable;
  onRespond: (action: string, data?: unknown) => Promise<void>;
}) {
  const { t } = useTranslation("kim");
  const [acting, setActing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const resolved = actionable.status !== "pending";

  const handle = async (action: string, data?: unknown) => {
    setActing(true);
    try {
      await onRespond(action, data);
    } finally {
      setActing(false);
    }
  };

  return (
    <div className={cn("mt-2 space-y-2 text-sm", resolved && "opacity-50")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium" style={{ color: "var(--kim-ink)" }}>
            {actionable.title}
          </p>
          {actionable.description && (
            <p className="text-xs mt-0.5" style={{ color: "var(--kim-ink-dim)" }}>
              {actionable.description}
            </p>
          )}
        </div>
        {resolved && (
          <span
            className="kim-mono shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{
              background: "var(--kim-bg-raised)",
              color: "var(--kim-ink-dim)",
            }}
          >
            {actionable.status}
          </span>
        )}
      </div>

      {!resolved && actionable.type === "confirm" && (
        <div className="flex items-center gap-2 pt-1">
          <KimPillButton disabled={acting} onClick={() => handle("confirm")} variant="primary">
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : t("actionable_confirm_btn")}
          </KimPillButton>
          <KimPillButton disabled={acting} onClick={() => handle("dismiss")}>
            {t("actionable_dismiss_btn")}
          </KimPillButton>
        </div>
      )}

      {!resolved && actionable.type === "choose" && actionable.options && (
        <div className="space-y-1.5 pt-1">
          {actionable.options.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                selectedOption === opt.id ? "bg-[var(--kim-teal-soft)]" : "hover:bg-[var(--kim-bg-raised)]",
              )}
            >
              <input
                type="radio"
                name={`choice-${actionable.id}`}
                checked={selectedOption === opt.id}
                onChange={() => setSelectedOption(opt.id)}
                className="mt-0.5 accent-[var(--kim-amber)]"
              />
              <div>
                <span className="text-xs font-medium" style={{ color: "var(--kim-ink)" }}>{opt.label}</span>
                {opt.detail && <p className="text-[11px]" style={{ color: "var(--kim-ink-dim)" }}>{opt.detail}</p>}
              </div>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <KimPillButton
              disabled={acting || !selectedOption}
              onClick={() => handle("choose", { optionId: selectedOption })}
              variant="primary"
            >
              {t("actionable_select_btn")}
            </KimPillButton>
            <KimPillButton disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </KimPillButton>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "input" && (
        <div className="space-y-1.5 pt-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={t("actionable_input_placeholder")}
            className="w-full rounded-md px-2.5 py-1.5 text-xs focus:outline-none"
            style={{
              background: "var(--kim-bg-sunken)",
              border: "1px solid var(--kim-border)",
              color: "var(--kim-ink)",
            }}
          />
          <div className="flex items-center gap-2">
            <KimPillButton
              disabled={acting || !inputText.trim()}
              onClick={() => handle("input", { text: inputText })}
              variant="primary"
            >
              {t("actionable_submit_btn")}
            </KimPillButton>
            <KimPillButton disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </KimPillButton>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "info" && (
        <div className="pt-1">
          <KimPillButton disabled={acting} onClick={() => handle("confirm")}>
            {t("actionable_got_it_btn")}
          </KimPillButton>
        </div>
      )}
    </div>
  );
}

function KimPillButton({
  children,
  onClick,
  disabled,
  variant = "ghost",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "h-7 px-3 text-xs rounded-sm kim-mono uppercase tracking-[0.12em] transition-colors disabled:opacity-40",
        variant === "primary"
          ? "bg-[var(--kim-amber)] text-[var(--kim-bg)] hover:brightness-110"
          : "border border-[var(--kim-border)] text-[var(--kim-ink-dim)] hover:text-[var(--kim-ink)] hover:bg-[var(--kim-bg-raised)]",
      )}
    >
      {children}
    </button>
  );
}
