"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ─── Utils (adapted from https://time.openstatus.dev) ───────────────────────

type PickerType = "hours" | "minutes";

function isValidHour(v: string) {
  return /^(0[0-9]|1[0-9]|2[0-3])$/.test(v);
}
function isValidMinute(v: string) {
  return /^[0-5][0-9]$/.test(v);
}

function clamp(value: string, min: number, max: number, loop: boolean) {
  let n = parseInt(value, 10);
  if (isNaN(n)) return "00";
  if (loop) {
    if (n > max) n = min;
    if (n < min) n = max;
  } else {
    if (n > max) n = max;
    if (n < min) n = min;
  }
  return n.toString().padStart(2, "0");
}

function getValidHour(v: string) {
  return isValidHour(v) ? v : clamp(v, 0, 23, false);
}
function getValidMinute(v: string) {
  return isValidMinute(v) ? v : clamp(v, 0, 59, false);
}
function arrow(value: string, step: number, max: number) {
  const n = parseInt(value, 10);
  if (isNaN(n)) return "00";
  return clamp(String(n + step), 0, max, true);
}

// ─── HH:MM helpers ──────────────────────────────────────────────────────────

function splitHHMM(v: string | null | undefined): { h: string; m: string } {
  if (!v || !/^\d{1,2}:\d{1,2}(:\d{1,2})?$/.test(v)) return { h: "00", m: "00" };
  const [h, m] = v.split(":");
  return { h: getValidHour(h), m: getValidMinute(m) };
}

function joinHHMM(h: string, m: string) {
  return `${h}:${m}`;
}

// ─── Digit input ────────────────────────────────────────────────────────────

interface DigitInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  picker: PickerType;
  value: string;
  onValueChange: (next: string) => void;
  onLeftFocus?: () => void;
  onRightFocus?: () => void;
}

const DigitInput = React.forwardRef<HTMLInputElement, DigitInputProps>(
  function DigitInput(
    { className, picker, value, onValueChange, onLeftFocus, onRightFocus, ...props },
    ref,
  ) {
    const [flag, setFlag] = React.useState(false);

    React.useEffect(() => {
      if (!flag) return;
      const t = setTimeout(() => setFlag(false), 2000);
      return () => clearTimeout(t);
    }, [flag]);

    const max = picker === "hours" ? 23 : 59;
    const validate = picker === "hours" ? getValidHour : getValidMinute;

    const calcNew = (key: string) => (!flag ? "0" + key : value.slice(1, 2) + key);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab") return;
      e.preventDefault();
      if (e.key === "ArrowRight") onRightFocus?.();
      if (e.key === "ArrowLeft") onLeftFocus?.();
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        const step = e.key === "ArrowUp" ? 1 : -1;
        if (flag) setFlag(false);
        onValueChange(arrow(value, step, max));
      }
      if (e.key >= "0" && e.key <= "9") {
        const next = validate(calcNew(e.key));
        if (flag) onRightFocus?.();
        setFlag((p) => !p);
        onValueChange(next);
      }
    };

    return (
      <Input
        ref={ref}
        id={picker}
        name={picker}
        type="tel"
        inputMode="decimal"
        value={value}
        onChange={() => {}}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-12 text-center font-mono tabular-nums caret-transparent focus-visible:bg-accent focus-visible:text-accent-foreground [&::-webkit-inner-spin-button]:appearance-none",
          className,
        )}
        {...props}
      />
    );
  },
);

// ─── Public TimePicker (HH:MM) ──────────────────────────────────────────────

export interface TimePickerProps {
  value: string | null | undefined;
  onChange: (next: string) => void;
  disabled?: boolean;
  className?: string;
  showIcon?: boolean;
}

export function TimePicker({
  value,
  onChange,
  disabled,
  className,
  showIcon = true,
}: TimePickerProps) {
  const { h, m } = splitHHMM(value);
  const hourRef = React.useRef<HTMLInputElement>(null);
  const minRef = React.useRef<HTMLInputElement>(null);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <DigitInput
        ref={hourRef}
        picker="hours"
        value={h}
        onValueChange={(next) => onChange(joinHHMM(next, m))}
        onRightFocus={() => minRef.current?.focus()}
        disabled={disabled}
        aria-label="hours"
      />
      <span className="text-muted-foreground">:</span>
      <DigitInput
        ref={minRef}
        picker="minutes"
        value={m}
        onValueChange={(next) => onChange(joinHHMM(h, next))}
        onLeftFocus={() => hourRef.current?.focus()}
        disabled={disabled}
        aria-label="minutes"
      />
      {showIcon && <Clock className="ml-1 size-4 text-muted-foreground" />}
    </div>
  );
}
