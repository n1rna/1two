"use client";

import { useState } from "react";
import {
  AlertCircle,
  Brain,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Dumbbell,
  Info,
  Lightbulb,
  ListTodo,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Phone,
  Repeat,
  Send,
  Sparkles,
  Sun,
  Target,
  Utensils,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { AskKimButton } from "@/components/kim";
import type { JourneyTrigger, LifeActionable } from "@/lib/life";
import { domainOf, type ActionableDomain } from "@/lib/actionables-group";

const DOMAIN_CHIP_META: Record<
  ActionableDomain,
  { icon: React.ReactNode; className: string }
> = {
  calendar: {
    icon: <CalendarDays className="h-2.5 w-2.5" />,
    className: "border-rose-500/30 bg-rose-500/10 text-rose-500",
  },
  task: {
    icon: <ListTodo className="h-2.5 w-2.5" />,
    className: "border-orange-500/30 bg-orange-500/10 text-orange-500",
  },
  routine: {
    icon: <Repeat className="h-2.5 w-2.5" />,
    className: "border-violet-500/30 bg-violet-500/10 text-violet-500",
  },
  meal: {
    icon: <Utensils className="h-2.5 w-2.5" />,
    className: "border-amber-500/30 bg-amber-500/10 text-amber-500",
  },
  memory: {
    icon: <Lightbulb className="h-2.5 w-2.5" />,
    className: "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  },
  suggestion: {
    icon: <Sparkles className="h-2.5 w-2.5" />,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  other: {
    icon: <Info className="h-2.5 w-2.5" />,
    className: "border-border bg-muted/40 text-muted-foreground",
  },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const ACTION_TYPE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  create_routine: { label: "Create routine", icon: <Repeat className="h-3.5 w-3.5 text-violet-500" /> },
  create_memory: { label: "Save memory", icon: <Lightbulb className="h-3.5 w-3.5 text-yellow-500" /> },
  create_calendar_event: { label: "Add to calendar", icon: <CalendarDays className="h-3.5 w-3.5 text-rose-500" /> },
  delete_calendar_event: { label: "Remove event", icon: <CalendarDays className="h-3.5 w-3.5 text-red-500" /> },
  create_task: { label: "Create task", icon: <ListTodo className="h-3.5 w-3.5 text-orange-500" /> },
};

const SECTION_ICONS: Record<string, React.ReactNode> = {
  calendar: <CalendarDays className="size-3.5" />,
  check: <Check className="size-3.5" />,
  target: <Target className="size-3.5" />,
  brain: <Brain className="size-3.5" />,
  dumbbell: <Dumbbell className="size-3.5" />,
  utensils: <Utensils className="size-3.5" />,
  phone: <Phone className="size-3.5" />,
  star: <Sparkles className="size-3.5" />,
  clock: <Clock className="size-3.5" />,
  alert: <AlertCircle className="size-3.5" />,
  "map-pin": <MapPin className="size-3.5" />,
  list: <ListTodo className="size-3.5" />,
};

const TEMPLATE_META: Record<string, { label: string; icon: React.ReactNode }> = {
  daily_plan: { label: "Daily Plan", icon: <Sun className="h-3.5 w-3.5 text-teal-500" /> },
  daily_review: { label: "Daily Review", icon: <Pencil className="h-3.5 w-3.5 text-violet-500" /> },
  routine_check: { label: "Routine Check", icon: <Repeat className="h-3.5 w-3.5 text-blue-500" /> },
  meal_choice: { label: "Meal Choice", icon: <Utensils className="h-3.5 w-3.5 text-orange-500" /> },
  schedule_pick: { label: "Schedule", icon: <CalendarDays className="h-3.5 w-3.5 text-indigo-500" /> },
  reminder: { label: "Reminder", icon: <Clock className="h-3.5 w-3.5 text-rose-500" /> },
  preference: { label: "Quick Question", icon: <MessageSquare className="h-3.5 w-3.5 text-sky-500" /> },
  task_roundup: { label: "Task Summary", icon: <ListTodo className="h-3.5 w-3.5 text-emerald-500" /> },
  streak: { label: "Streak", icon: <Target className="h-3.5 w-3.5 text-orange-500" /> },
  suggestion: { label: "Suggestion", icon: <Sparkles className="h-3.5 w-3.5 text-primary" /> },
};

const SECTION_TITLE_ICON_MAP: [RegExp, string][] = [
  [/calendar|event|schedule/i, "calendar"],
  [/task|todo|to-do/i, "check"],
  [/routine|habit|gym|workout|exercise/i, "dumbbell"],
  [/notable|highlight|remind/i, "star"],
  [/goal|target|focus/i, "target"],
  [/meal|food|breakfast|lunch|dinner|calori/i, "utensils"],
  [/call|phone|contact/i, "phone"],
  [/time|clock|deadline|due/i, "clock"],
  [/warn|alert|urgent|overdue/i, "alert"],
  [/location|place|map/i, "map-pin"],
];

function guessIconForTitle(title: string): string {
  for (const [re, icon] of SECTION_TITLE_ICON_MAP) {
    if (re.test(title)) return icon;
  }
  return "list";
}

function parseSectionsFromDescription(
  desc: string,
): { icon?: string; title: string; items: string[] }[] | null {
  const lines = desc.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: { icon?: string; title: string; items: string[] }[] = [];
  let current: { icon?: string; title: string; items: string[] } | null = null;

  for (const line of lines) {
    const headerMatch =
      line.match(/^\*\*\s*(?:\p{Emoji_Presentation}\s*)?(.+?):\s*\*\*$/u) ??
      line.match(/^##\s+(?:\p{Emoji_Presentation}\s*)?(.+)$/u);
    if (headerMatch) {
      if (current && current.items.length > 0) sections.push(current);
      const title = headerMatch[1].trim();
      current = { icon: guessIconForTitle(title), title, items: [] };
      continue;
    }

    const bulletMatch = line.match(/^[•\-*]\s+(.+)$/);
    if (bulletMatch && current) {
      current.items.push(bulletMatch[1].replace(/\*\*/g, "").trim());
      continue;
    }

    if (current && line.length > 0 && !line.startsWith("**")) {
      current.items.push(line.replace(/\*\*/g, "").trim());
    }
  }
  if (current && current.items.length > 0) sections.push(current);
  return sections.length >= 2 ? sections : null;
}

function ActionableSections({
  sections,
}: {
  sections: { icon?: string; title: string; items: string[] }[];
}) {
  return (
    <div className="mt-2 space-y-3">
      {sections.map((section, i) => (
        <div key={i}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-muted-foreground/60">
              {section.icon
                ? SECTION_ICONS[section.icon] ?? <ListTodo className="size-3.5" />
                : <ListTodo className="size-3.5" />}
            </span>
            <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
              {section.title}
            </span>
          </div>
          <ul className="space-y-0.5 pl-5">
            {section.items.map((item, j) => (
              <li
                key={j}
                className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5"
              >
                <span className="text-muted-foreground/30 mt-1.5 shrink-0 size-1 rounded-full bg-current" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ActionableContent({ actionable }: { actionable: LifeActionable }) {
  const tpl = actionable.actionPayload?.template;
  const d = actionable.actionPayload?.data;

  if (tpl === "daily_plan" && d?.sections) {
    return <ActionableSections sections={d.sections} />;
  }

  if (tpl === "daily_review" && d) {
    return (
      <div className="mt-2 space-y-2">
        {d.completed && d.completed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="size-3 text-green-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                Completed
              </span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.completed.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.missed && d.missed.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle className="size-3 text-teal-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                Missed
              </span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.missed.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.question && (
          <p className="text-xs text-muted-foreground/70 italic mt-1">
            {d.question}
          </p>
        )}
      </div>
    );
  }

  if (tpl === "routine_check" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.scheduled_time && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{d.scheduled_time}</span>
          </div>
        )}
        {d.details && (
          <p className="text-xs text-muted-foreground/70">{d.details}</p>
        )}
      </div>
    );
  }

  if (tpl === "reminder" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.message && <p className="text-xs text-foreground/80">{d.message}</p>}
        {d.time && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3" />
            <span>{d.time}</span>
          </div>
        )}
        {d.context && (
          <p className="text-[11px] text-muted-foreground/60">{d.context}</p>
        )}
      </div>
    );
  }

  if (tpl === "task_roundup" && d) {
    return (
      <div className="mt-2 space-y-2">
        {d.pending && d.pending.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <ListTodo className="size-3 text-orange-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                Pending
              </span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.pending.map((t, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground flex items-center gap-1.5"
                >
                  <span>{t.title}</span>
                  {t.due && (
                    <span className="text-[10px] text-muted-foreground/50">
                      · {t.due}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        {d.completed_today && d.completed_today.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Check className="size-3 text-green-500" />
              <span className="text-[11px] font-semibold text-foreground/80 uppercase tracking-wider">
                Done Today
              </span>
            </div>
            <ul className="space-y-0.5 pl-5">
              {d.completed_today.map((item, i) => (
                <li
                  key={i}
                  className="text-xs text-muted-foreground/60 line-through"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (tpl === "streak" && d) {
    return (
      <div className="mt-2 flex items-center gap-3">
        <div className="flex items-center justify-center size-10 rounded-full bg-primary/10">
          <span className="text-lg font-bold text-primary">{d.count ?? 0}</span>
        </div>
        <div>
          {d.message && (
            <p className="text-xs text-foreground/80">{d.message}</p>
          )}
          {d.best != null && d.best > 0 && (
            <p className="text-[10px] text-muted-foreground/50">
              Personal best: {d.best} {d.unit ?? "days"}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (tpl === "suggestion" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.suggestion && (
          <p className="text-xs text-foreground/80">{d.suggestion}</p>
        )}
        {d.reasoning && (
          <p className="text-[11px] text-muted-foreground/50 italic">
            {d.reasoning}
          </p>
        )}
      </div>
    );
  }

  if (tpl === "preference" && d) {
    return (
      <div className="mt-1.5 space-y-1">
        {d.question && (
          <p className="text-xs text-foreground/80">{d.question}</p>
        )}
        {d.context && (
          <p className="text-[11px] text-muted-foreground/50">{d.context}</p>
        )}
      </div>
    );
  }

  if ((tpl === "schedule_pick" || tpl === "meal_choice") && d?.context) {
    return (
      <p className="text-xs text-muted-foreground/70 mt-1">{d.context}</p>
    );
  }

  if (actionable.actionPayload?.sections?.length) {
    return <ActionableSections sections={actionable.actionPayload.sections} />;
  }
  if (actionable.description) {
    const parsed = parseSectionsFromDescription(actionable.description);
    if (parsed) return <ActionableSections sections={parsed} />;
    return (
      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
        {actionable.description}
      </p>
    );
  }
  return null;
}

export function ActionableCard({
  actionable,
  onRespond,
  variant = "default",
  className,
}: {
  actionable: LifeActionable;
  onRespond: (id: string, action: string, data?: unknown) => Promise<void>;
  /**
   * "default" matches the /actionables page (800+px container). "compact"
   * shrinks padding and suppresses the AskKim CTA for rendering inside
   * the Kim drawer (~460px). Everything else — response modes, content
   * templates, resolved state — is shared across variants. (QBL-112)
   */
  variant?: "default" | "compact";
  className?: string;
}) {
  const [textInput, setTextInput] = useState("");
  const [acting, setActing] = useState(false);
  const { t } = useTranslation("actionables");

  const compact = variant === "compact";
  const journeySource =
    actionable.source?.kind === "journey" &&
    typeof actionable.source.trigger === "string"
      ? actionable.source
      : null;
  const journeyTriggerKey = journeySource?.trigger as JourneyTrigger | undefined;
  const knownJourneyTriggers: JourneyTrigger[] = [
    "gym_session_updated",
    "meal_plan_updated",
    "routine_updated",
  ];
  const journeyTriggerLabel = journeyTriggerKey
    ? knownJourneyTriggers.includes(journeyTriggerKey)
      ? t(`journey_trigger_${journeyTriggerKey}`)
      : journeyTriggerKey
    : null;
  const domain = domainOf(actionable);
  const domainMeta = DOMAIN_CHIP_META[domain];
  const isPending = actionable.status === "pending";
  const isDueSoon =
    actionable.dueAt &&
    new Date(actionable.dueAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;
  const isOverdue =
    actionable.dueAt && new Date(actionable.dueAt).getTime() < Date.now();
  const actionMeta = actionable.actionType
    ? ACTION_TYPE_META[actionable.actionType]
    : null;

  const handleAction = async (action: string, data?: unknown) => {
    setActing(true);
    try {
      await onRespond(actionable.id, action, data);
    } finally {
      setActing(false);
    }
  };

  if (!isPending) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border/30 text-muted-foreground/50">
        {actionable.status === "confirmed" ? (
          <Check className="h-3.5 w-3.5 text-green-500/60 shrink-0" />
        ) : (
          <X className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className="text-xs line-through truncate flex-1">
          {actionable.title}
        </span>
        <span className="text-[10px] shrink-0">
          {relativeTime(actionable.resolvedAt ?? actionable.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-card transition-all",
        isDueSoon && !isOverdue && "border-teal-500/30",
        isOverdue && "border-red-500/30",
        className,
      )}
    >
      <div className={cn("flex items-start gap-3 pb-0", compact ? "p-3" : "p-4")}>
        <div className="mt-0.5 shrink-0">
          {TEMPLATE_META[actionable.actionPayload?.template ?? ""]?.icon ??
            actionMeta?.icon ??
            (actionable.type === "info" ? (
              <Info className="h-3.5 w-3.5 text-blue-500" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            ))}
        </div>

        <div className="flex-1 min-w-0">
          {(() => {
            const label =
              TEMPLATE_META[actionable.actionPayload?.template ?? ""]?.label ??
              actionMeta?.label;
            return label ? (
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-0.5">
                {label}
              </p>
            ) : null;
          })()}
          <p className="text-sm font-medium text-foreground leading-snug">
            {actionable.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px]">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5",
                domainMeta.className,
              )}
            >
              {domainMeta.icon}
              {t(`domain_${domain}`)}
            </span>
            {journeySource && (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                {journeyTriggerLabel}
              </span>
            )}
            {journeySource?.entity_title && (
              <span className="text-muted-foreground/70 truncate">
                {t("journey_source_chip", {
                  title: journeySource.entity_title,
                })}
              </span>
            )}
          </div>
          <ActionableContent actionable={actionable} />

          <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
            <span>{relativeTime(actionable.createdAt)}</span>
            {actionable.dueAt && (
              <span
                className={cn(
                  "flex items-center gap-0.5",
                  isOverdue ? "text-red-500" : isDueSoon ? "text-teal-500" : "",
                )}
              >
                <Clock className="h-2.5 w-2.5" />
                {isOverdue ? "Overdue" : `Due ${relativeTime(actionable.dueAt)}`}
              </span>
            )}
          </div>
        </div>
        {!compact && (
          <AskKimButton
            kind="actionable"
            id={actionable.id}
            title={actionable.title}
            snapshot={actionable as unknown as Record<string, unknown>}
            variant="icon-button"
            className="shrink-0"
          />
        )}
      </div>

      <div className={cn("pt-3", compact ? "p-2.5" : "p-3")}>
        {actionable.type === "confirm" && (
          <div className="flex items-center gap-2">
            <button
              disabled={acting}
              onClick={() => handleAction("confirm")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {acting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
              Approve
            </button>
            <button
              disabled={acting}
              onClick={() => handleAction("dismiss")}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              <X className="h-3 w-3" />
              Skip
            </button>
          </div>
        )}

        {actionable.type === "choose" &&
          (actionable.options ?? actionable.actionPayload?.data?.options) && (
            <div className="space-y-2">
              <div className="grid gap-1.5">
                {(
                  actionable.options ??
                  actionable.actionPayload?.data?.options ??
                  []
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => handleAction("choose", { optionId: opt.id })}
                    disabled={acting}
                    className="w-full flex items-center gap-2 rounded-lg border px-3 py-2 text-xs text-left transition-all disabled:opacity-50 border-border hover:border-primary/50 hover:bg-primary/5"
                  >
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="flex-1">
                      <span className="font-medium text-foreground">
                        {opt.label}
                      </span>
                      {opt.detail && (
                        <span className="block text-muted-foreground mt-0.5">
                          {opt.detail}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <button
                disabled={acting}
                onClick={() => handleAction("dismiss")}
                className="text-[10px] text-muted-foreground hover:underline"
              >
                Skip this
              </button>
            </div>
          )}

        {actionable.type === "input" && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={
                  actionable.actionPayload?.data?.placeholder ??
                  "Type your answer…"
                }
                className="flex-1 rounded-lg border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground/50"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textInput.trim()) {
                    handleAction("input", { value: textInput.trim() });
                  }
                }}
              />
              <button
                disabled={acting || !textInput.trim()}
                onClick={() => handleAction("input", { value: textInput.trim() })}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {acting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Send className="h-3 w-3" />
                )}
              </button>
            </div>
            <button
              disabled={acting}
              onClick={() => handleAction("dismiss")}
              className="text-[10px] text-muted-foreground hover:underline"
            >
              Skip this
            </button>
          </div>
        )}

        {actionable.type === "info" && (
          <button
            disabled={acting}
            onClick={() => handleAction("confirm")}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Acknowledge
          </button>
        )}
      </div>
    </div>
  );
}
