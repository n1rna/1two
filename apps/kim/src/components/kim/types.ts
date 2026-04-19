import type { ChatEffect, LifeMessage } from "@/lib/life";

export type KimMode =
  | "general"
  | "calendar"
  | "routines"
  | "meals"
  | "gym"
  | "health"
  | "onboarding";

export type SelectableKind =
  | "routine"
  | "event"
  | "task"
  | "meal-plan"
  | "meal-item"
  | "session"
  | "exercise"
  | "memory"
  | "actionable"
  | "metric";

export interface KimSelection {
  kind: SelectableKind;
  id: string;
  label: string;
  snapshot?: Record<string, unknown>;
}

export interface KimMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  effects?: ChatEffect[];
  mode?: KimMode;
  selection?: KimSelection[];
  pending?: boolean;
  createdAt: string;
}

export function messageFromLife(m: LifeMessage): KimMessage {
  return {
    id: m.id,
    role: (m.role as KimMessage["role"]) ?? "user",
    content: m.content,
    effects: m.toolCalls,
    createdAt: m.createdAt,
  };
}

export const MODE_LABELS: Record<KimMode, string> = {
  general: "general",
  calendar: "calendar",
  routines: "routines",
  meals: "meal plans",
  gym: "gym",
  health: "health",
  onboarding: "onboarding",
};

export const MODE_DESCRIPTIONS: Record<KimMode, string> = {
  general: "open conversation with Kim",
  calendar: "calendar events and tasks in context",
  routines: "create or update recurring routines",
  meals: "build or adjust meal plans",
  gym: "design or modify gym sessions",
  health: "profile, weight, and macros",
  onboarding: "first-run onboarding flow",
};
