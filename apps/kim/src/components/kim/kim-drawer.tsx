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
  ArrowUp,
  ChevronDown,
  FileEdit,
  History,
  Plus,
  X,
  Maximize2,
  Minimize2,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useKim } from "./kim-provider";
import { MODE_LABELS, type KimMode } from "./types";
import { KimMessageList } from "./kim-message-list";
import { commandsForMode } from "./slash-commands";
import { SlashCommandMenu, useSlashCommands } from "@/components/ui/slash-commands";
import type { SlashCommand } from "@/components/ui/slash-commands";
import { cn } from "@/lib/utils";

const MODES: KimMode[] = [
  "general",
  "calendar",
  "routines",
  "meals",
  "gym",
  "health",
];

export function KimDrawer() {
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
    clearSelection,
    send,
    conversations,
    conversationId,
    loadConversation,
    newConversation,
    setOpen,
    activeForm,
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

  if (!open) return <KimCollapsedRail />;

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
            kim
          </span>
          <span
            className="kim-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            agent
          </span>
        </div>
        <div className="flex items-center gap-1">
          <HeaderButton
            title={maximized ? "Restore" : "Expand"}
            onClick={() => setMaximized((m) => !m)}
          >
            {maximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </HeaderButton>
          <HeaderButton title="History" onClick={() => setShowHistory((s) => !s)}>
            <History size={13} />
          </HeaderButton>
          <HeaderButton title="New conversation" onClick={newConversation}>
            <Plus size={13} />
          </HeaderButton>
          <HeaderButton title="Close (⌘K)" onClick={() => setOpen(false)}>
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
              drafting form
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
                conversations
              </div>
              {conversations.length === 0 && (
                <div
                  className="text-xs italic px-1"
                  style={{ color: "var(--kim-ink-faint)" }}
                >
                  none yet
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
                  <div className="truncate">{c.title || "untitled"}</div>
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

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 relative">
        {messages.length === 0 && !streamingText && (
          <KimGreeting mode={mode} />
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
            className="mt-3 text-xs kim-mono px-3 py-2 rounded-sm"
            style={{
              background: "rgb(232 120 130 / 0.08)",
              border: "1px solid rgb(232 120 130 / 0.3)",
              color: "var(--kim-rose)",
            }}
          >
            error: {error}
          </div>
        )}
      </div>

      {/* Selection chips */}
      {selection.length > 0 && (
        <div
          className="px-5 py-2 border-t flex flex-wrap gap-1.5 items-center"
          style={{ borderColor: "var(--kim-border)" }}
        >
          <span
            className="kim-mono text-[9.5px] uppercase tracking-[0.18em] mr-1"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            context ·
          </span>
          {selection.map((s) => (
            <span key={`${s.kind}-${s.id}`} className="kim-chip">
              <span
                className="kim-mono text-[9px] uppercase tracking-[0.14em] opacity-70"
                style={{ color: "var(--kim-amber)" }}
              >
                {s.kind}
              </span>
              <span className="max-w-[140px] truncate">{s.label}</span>
              <button
                onClick={() => removeSelection(s.kind, s.id)}
                className="opacity-50 hover:opacity-100"
              >
                <X size={10} />
              </button>
            </span>
          ))}
          <button
            onClick={clearSelection}
            className="kim-mono text-[9.5px] uppercase tracking-[0.16em] ml-auto opacity-60 hover:opacity-100"
            style={{ color: "var(--kim-ink-dim)" }}
          >
            clear
          </button>
        </div>
      )}

      {/* Input */}
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
            placeholder="type / for commands or ask kim…"
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
            title="Send (Enter)"
          >
            <ArrowUp size={14} strokeWidth={2.5} />
          </button>
        </div>
        <div
          className="mt-2 flex items-center justify-between kim-mono text-[9.5px] uppercase tracking-[0.14em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          <span>⌘K toggle · ⇧enter newline</span>
          <Link
            href="/chat"
            className="hover:text-[var(--kim-amber)]"
            onClick={() => setOpen(false)}
          >
            full view →
          </Link>
        </div>
      </div>
    </motion.aside>
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

function KimGreeting({ mode }: { mode: KimMode }) {
  return (
    <div className="flex flex-col items-start gap-2 py-6">
      <div className="flex items-center gap-2">
        <Sparkles size={14} style={{ color: "var(--kim-amber)" }} />
        <span
          className="kim-mono text-[10px] uppercase tracking-[0.2em]"
          style={{ color: "var(--kim-ink-faint)" }}
        >
          ready · {MODE_LABELS[mode]}
        </span>
      </div>
      <p
        className="text-xs mt-1"
        style={{ color: "var(--kim-ink-faint)" }}
      >
        select items on the page to add them as context.
      </p>
    </div>
  );
}

function KimCollapsedRail() {
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
        className="kim-display text-2xl"
        style={{ color: "var(--kim-amber)" }}
      >
        k
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
