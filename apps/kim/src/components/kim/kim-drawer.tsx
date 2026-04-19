"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AlertCircle,
  ArrowUp,
  ChevronDown,
  FileEdit,
  History,
  Plus,
  RotateCw,
  X,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useKim } from "./kim-provider";
import { routes } from "@/lib/routes";
import { MODE_LABELS, type KimMode } from "./types";
import { KimMessageList } from "./kim-message-list";
import { KimGreeting } from "./kim-greeting";
import { CtxChip } from "./ctx-chip";
import { SmartUiSlot } from "./smart-ui/smart-ui-slot";
import { ActivitySection } from "./activity-section";
import { useAgentRunsPulse } from "./use-agent-runs-pulse";
import { commandsForMode } from "./slash-commands";
import { SlashCommandMenu, useSlashCommands } from "@/components/ui/slash-commands";
import type { SlashCommand } from "@/components/ui/slash-commands";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const MODES: KimMode[] = [
  "general",
  "calendar",
  "routines",
  "meals",
  "gym",
  "health",
];

export function KimDrawer() {
  const { t } = useTranslation("kim");
  const kim = useKim();
  const {
    open,
    width,
    setWidth,
    mode,
    setMode,
    modeLocked,
    messages,
    streamingText,
    streamingTool,
    streamingToolHistory,
    sending,
    error,
    selection,
    removeSelection,
    promoteSelection,
    clearSelection,
    send,
    conversations,
    conversationId,
    loadConversation,
    newConversation,
    setOpen,
    activeForm,
    registerComposer,
  } = kim;
  const activeCommands = useMemo(() => commandsForMode(mode), [mode]);
  const slash = useSlashCommands(activeCommands);

  const [input, setInput] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [maximized, setMaximized] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus on open
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }, [open]);

  // Expose composer imperative handle to the provider so smart-UI actions
  // (e.g. smartPrompt) can prefill + focus without threading refs through
  // React.
  useEffect(() => {
    registerComposer({
      setInput: (v: string) => {
        setInput(v);
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (!el) return;
          el.style.height = "auto";
          el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
        });
      },
      focus: () => {
        requestAnimationFrame(() => textareaRef.current?.focus());
      },
    });
    return () => registerComposer(null);
  }, [registerComposer]);

  // Autoscroll on stream
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  // ⌘⇧K focuses input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
        requestAnimationFrame(() => textareaRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const submitText = useCallback(
    (override?: string) => {
      const v = (override ?? input).trim();
      if (!v || sending) return;
      setInput("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      send(v);
    },
    [input, sending, send],
  );
  const onSubmit = useCallback(() => submitText(), [submitText]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Let the slash menu handle nav keys.
      if (slash.menuVisible && ["ArrowUp", "ArrowDown", "Tab", "Enter", "Escape"].includes(e.key)) {
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        onSubmit();
      }
    },
    [onSubmit, slash.menuVisible],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      setInput(v);
      slash.checkInput(v);
      e.target.style.height = "auto";
      e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
    },
    [slash],
  );

  const onSlashCommand = useCallback(
    (cmd: SlashCommand) => {
      slash.close();
      if (cmd.prompt.endsWith(": ")) {
        setInput(cmd.prompt);
        textareaRef.current?.focus();
        return;
      }
      submitText(cmd.prompt);
    },
    [slash, submitText],
  );

  // Drag to resize left edge
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      dragRef.current = { startX: e.clientX, startW: width };
      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const dx = dragRef.current.startX - ev.clientX;
        const next = Math.min(1000, Math.max(360, dragRef.current.startW + dx));
        setWidth(next);
      };
      const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width, setWidth],
  );

  const effectiveWidth = maximized
    ? (typeof window !== "undefined" ? Math.min(920, window.innerWidth * 0.55) : width)
    : width;
  const streaming = sending || !!streamingText || !!streamingTool;
  const pulse = useAgentRunsPulse({ open });

  if (!open) return <KimCollapsedRail pulseRunning={pulse.running} pulseCount={pulse.count} />;

  return (
    <motion.aside
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: effectiveWidth, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 30 }}
      className="kim-surface shrink-0 h-full relative flex flex-col border-l shadow-2xl overflow-hidden"
      style={{ borderColor: "var(--kim-border)" }}
      data-streaming={streaming}
    >
      <div className="kim-grain" />
      <div className="kim-rail" />

      {/* Drag handle on the left edge — lets users resize while the panel
          stays anchored to the right side of the layout. */}
      <div
        onMouseDown={onDragStart}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-[var(--kim-amber)]/30 z-50"
        aria-hidden
      />

      {/* Header */}
      <header className="relative flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-baseline gap-2">
          <span
            className="kim-display text-3xl leading-none"
            style={{ color: "var(--kim-amber)" }}
          >
            {t("drawer_title")}
          </span>
          <span
            className="kim-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            {t("drawer_subtitle")}
          </span>
          <KimStatusPill streaming={streaming} />
          <ActivityPulse running={pulse.running} count={pulse.count} />
        </div>
        <div className="flex items-center gap-1">
          <HeaderButton
            title={maximized ? t("drawer_restore_title") : t("drawer_expand_title")}
            onClick={() => setMaximized((m) => !m)}
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </HeaderButton>
          <HeaderButton title={t("drawer_history_title")} onClick={() => setShowHistory((s) => !s)}>
            <History size={13} />
          </HeaderButton>
          <HeaderButton title={t("drawer_new_conversation_title")} onClick={newConversation}>
            <Plus size={13} />
          </HeaderButton>
          <HeaderButton title={t("drawer_close_title")} onClick={() => setOpen(false)}>
            <X size={13} />
          </HeaderButton>
        </div>
      </header>

      {/* Mode + selection bar */}
      <div
        className="relative px-5 pb-3 flex items-center gap-2 border-b"
        style={{ borderColor: "var(--kim-border)" }}
      >
        <button
          onClick={() => setShowModeMenu((s) => !s)}
          className="kim-mono text-[10.5px] uppercase tracking-[0.16em] px-2 py-1 rounded-sm flex items-center gap-1.5 hover:opacity-100"
          style={{
            background: "var(--kim-bg-sunken)",
            border: "1px solid var(--kim-border)",
            color: "var(--kim-ink-dim)",
          }}
        >
          <span style={{ color: "var(--kim-amber)" }}>▸</span>
          {MODE_LABELS[mode]}
          {modeLocked && <span className="opacity-50">·lock</span>}
          <ChevronDown size={10} />
        </button>

        {showModeMenu && (
          <div
            className="absolute top-full left-5 mt-1 z-10 rounded-sm overflow-hidden"
            style={{
              background: "var(--kim-bg-raised)",
              border: "1px solid var(--kim-border-strong)",
              boxShadow: "0 8px 24px rgb(0 0 0 / 0.4)",
            }}
          >
            {MODES.map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setShowModeMenu(false);
                }}
                className={cn(
                  "block w-40 text-left px-3 py-2 text-xs kim-mono uppercase tracking-[0.14em]",
                  m === mode && "bg-[var(--kim-teal-soft)]",
                )}
                style={{
                  color: m === mode ? "var(--kim-amber)" : "var(--kim-ink-dim)",
                }}
              >
                {MODE_LABELS[m]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active form banner — shows when the user is on a create/edit page */}
      {activeForm && (
        <div
          className="relative px-5 py-2.5 border-b flex items-center gap-2"
          style={{
            borderColor: "var(--kim-border)",
            background: "var(--kim-teal-soft)",
          }}
        >
          <FileEdit size={12} style={{ color: "var(--kim-amber)" }} />
          <div className="flex-1 min-w-0">
            <div
              className="kim-mono text-[9.5px] uppercase tracking-[0.18em]"
              style={{ color: "var(--kim-amber)" }}
            >
              {t("drawer_drafting_form")}
            </div>
            <div
              className="text-xs truncate"
              style={{ color: "var(--kim-ink)" }}
            >
              {activeForm.title}
            </div>
          </div>
          <span
            className="kim-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm"
            style={{
              color: "var(--kim-amber)",
              border: "1px solid rgb(232 176 92 / 0.4)",
            }}
          >
            {activeForm.form.replace("_", " ")}
          </span>
        </div>
      )}

      {/* History drawer (inline) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 220 }}
            exit={{ height: 0 }}
            className="overflow-hidden border-b"
            style={{ borderColor: "var(--kim-border)" }}
          >
            <div className="p-3 overflow-y-auto h-full">
              <div
                className="text-[10px] kim-mono uppercase tracking-[0.18em] mb-2 px-1"
                style={{ color: "var(--kim-ink-faint)" }}
              >
                {t("drawer_history_heading")}
              </div>
              {conversations.length === 0 && (
                <div
                  className="text-xs italic px-1"
                  style={{ color: "var(--kim-ink-faint)" }}
                >
                  {t("drawer_history_empty")}
                </div>
              )}
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    loadConversation(c.id);
                    setShowHistory(false);
                  }}
                  className={cn(
                    "w-full text-left px-2 py-2 text-xs hover:bg-[var(--kim-teal-soft)] rounded-sm truncate",
                    c.id === conversationId && "bg-[var(--kim-teal-soft)]",
                  )}
                  style={{
                    color:
                      c.id === conversationId
                        ? "var(--kim-amber)"
                        : "var(--kim-ink)",
                  }}
                >
                  <div className="truncate">{c.title || t("drawer_history_untitled")}</div>
                  <div
                    className="kim-mono text-[9.5px] uppercase tracking-[0.14em] opacity-60"
                  >
                    {c.category}
                  </div>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background agent activity — collapsible list of recent runs. */}
      <ActivitySection open={open} />

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 relative">
        {messages.length === 0 && !streamingText && (
          <KimGreeting
            mode={mode}
            onStarterClick={(text) => {
              setInput(text);
              requestAnimationFrame(() => {
                const el = textareaRef.current;
                if (!el) return;
                el.focus();
                el.style.height = "auto";
                el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
              });
            }}
          />
        )}
        <KimMessageList
          messages={messages}
          streamingText={streamingText}
          streamingTool={streamingTool}
          streamingHistory={streamingToolHistory}
          sending={sending}
        />
        {error && (
          <div
            className="mt-3 flex items-start gap-2 px-3 py-2.5 rounded-sm"
            style={{
              background: "rgb(232 120 130 / 0.08)",
              border: "1px solid rgb(232 120 130 / 0.3)",
              color: "var(--kim-rose)",
            }}
          >
            <AlertCircle size={12} className="mt-0.5 shrink-0" strokeWidth={1.75} />
            <div className="flex-1 min-w-0">
              <div
                className="kim-mono text-[9.5px] uppercase tracking-[0.16em] mb-0.5 opacity-80"
              >
                {t("error_label")}
              </div>
              <div className="text-xs kim-mono break-words">{error}</div>
            </div>
            {(() => {
              const lastUser = [...messages].reverse().find((m) => m.role === "user");
              if (!lastUser) return null;
              return (
                <button
                  onClick={() => void send(lastUser.content)}
                  disabled={sending}
                  className="shrink-0 inline-flex items-center gap-1 kim-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-sm border transition-colors disabled:opacity-50"
                  style={{
                    borderColor: "rgb(232 120 130 / 0.4)",
                    color: "var(--kim-rose)",
                  }}
                  title={t("retry", { ns: "common" })}
                >
                  <RotateCw size={10} strokeWidth={1.75} />
                  {t("retry", { ns: "common" })}
                </button>
              );
            })()}
          </div>
        )}
      </div>

      {/* Smart-UI slot — renders a card matching the primary selection
          kind (meal, exercise, etc.). Sits between the thread and composer
          so the user can act on the item without leaving the drawer. */}
      <SmartUiSlot />

      {/* Composer region — context chips directly above the textarea so
          users can see what Kim is reasoning over. */}
      <div
        className="relative px-5 pt-3 pb-4 border-t"
        style={{ borderColor: "var(--kim-border)" }}
      >
        <SlashCommandMenu
          commands={activeCommands}
          input={input}
          onSelect={onSlashCommand}
          onClose={slash.close}
          visible={slash.menuVisible}
        />
        <div
          className="relative rounded-sm"
          style={{
            background: "var(--kim-bg-sunken)",
            border: "1px solid var(--kim-border)",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={t("drawer_input_placeholder")}
            className="w-full resize-none bg-transparent px-3 py-3 pr-12 text-sm outline-none placeholder:italic min-h-[44px] max-h-[160px]"
            style={{
              color: "var(--kim-ink)",
              fontFamily: "var(--font-geist-sans)",
            }}
            disabled={sending}
          />
          <button
            onClick={onSubmit}
            disabled={sending || !input.trim()}
            className="absolute bottom-2 right-2 w-7 h-7 rounded-sm flex items-center justify-center transition-opacity disabled:opacity-30"
            style={{
              background: "var(--kim-amber)",
              color: "var(--kim-bg)",
            }}
            title={t("drawer_send_title")}
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div
          className="mt-2 flex items-center justify-between kim-mono text-[9.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          <span>{t("drawer_shortcuts_hint")}</span>
          <Link
            href={routes.chat}
            className="hover:text-[var(--kim-amber)]"
            onClick={() => setOpen(false)}
          >
            {t("drawer_full_view")}
          </Link>
        </div>
      </div>
    </motion.aside>
  );
}

function ActivityPulse({
  running,
  count,
}: {
  running: boolean;
  count: number;
}) {
  const { t } = useTranslation("kim");
  if (!running) return null;
  return (
    <span
      aria-label={t("activity_pulse_aria", { count })}
      title={t("activity_pulse_aria", { count })}
      className="inline-flex items-center"
    >
      <span
        aria-hidden
        className="ml-1 inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: "var(--kim-amber)",
          animation: "kim-pulse-dot 1.4s ease-in-out infinite",
        }}
      />
    </span>
  );
}

function KimStatusPill({ streaming }: { streaming: boolean }) {
  const { t } = useTranslation("kim");
  return (
    <span
      className="kim-mono text-[9px] uppercase tracking-[0.2em] px-1.5 py-0.5 rounded-sm inline-flex items-center gap-1 ml-1"
      style={{
        background: streaming ? "var(--kim-teal-soft)" : "transparent",
        border: "1px solid var(--kim-border)",
        color: streaming ? "var(--kim-amber)" : "var(--kim-ink-faint)",
      }}
      aria-live="polite"
    >
      <span
        aria-hidden
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{
          background: streaming
            ? "var(--kim-amber)"
            : "var(--kim-ink-faint)",
          animation: streaming ? "kim-pulse-dot 1.4s ease-in-out infinite" : undefined,
        }}
      />
      {streaming ? t("status_thinking") : t("status_ready")}
    </span>
  );
}

function HeaderButton({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--kim-teal-soft)]"
      style={{ color: "var(--kim-ink-dim)" }}
    >
      {children}
    </button>
  );
}

function KimCollapsedRail({
  pulseRunning = false,
  pulseCount = 0,
}: {
  pulseRunning?: boolean;
  pulseCount?: number;
}) {
  const { t } = useTranslation("kim");
  const { setOpen, selection } = useKim();
  const pathname = usePathname();
  // The full-screen chat page is itself a Kim surface — no rail needed.
  if (pathname.startsWith("/chat")) return null;
  return (
    <button
      onClick={() => setOpen(true)}
      className="kim-surface shrink-0 h-full w-12 border-l flex flex-col items-center justify-between py-4 hover:brightness-110 transition-all relative"
      style={{ borderColor: "var(--kim-border)" }}
      title="Open Kim (⌘K)"
    >
      <div className="kim-rail" />
      <span
        className="kim-display text-2xl relative"
        style={{ color: "var(--kim-amber)" }}
      >
        k
        {pulseRunning && (
          <span
            aria-label={t("activity_pulse_aria", { count: pulseCount })}
            className="absolute -top-0.5 -right-1.5 inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: "var(--kim-amber)",
              animation: "kim-pulse-dot 1.4s ease-in-out infinite",
            }}
          />
        )}
      </span>
      <div
        className="kim-display italic"
        style={{
          color: "var(--kim-amber)",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: "14px",
          letterSpacing: "0.08em",
        }}
      >
        kim
      </div>
      {selection.length > 0 && (
        <div
          className="kim-mono text-[9px] uppercase tracking-[0.14em] px-1.5 py-0.5 rounded-sm"
          style={{
            background: "var(--kim-amber)",
            color: "var(--kim-bg)",
          }}
        >
          {selection.length}
        </div>
      )}
      {selection.length === 0 && (
        <span
          className="kim-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          ⌘K
        </span>
      )}
    </button>
  );
}
