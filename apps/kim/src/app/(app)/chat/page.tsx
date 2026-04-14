"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, ArrowUp, Trash2 } from "lucide-react";
import { useKim } from "@/components/kim";
import { KimMessageList } from "@/components/kim/kim-message-list";
import {
  MODE_LABELS,
  type KimMode,
} from "@/components/kim/types";
import { commandsForMode } from "@/components/kim/slash-commands";
import {
  SlashCommandMenu,
  useSlashCommands,
  type SlashCommand,
} from "@/components/ui/slash-commands";
import { deleteLifeConversation } from "@/lib/life";

const MODES: KimMode[] = [
  "general",
  "calendar",
  "routines",
  "meals",
  "gym",
  "health",
];

export default function KimFullChatPage() {
  const kim = useKim();
  const {
    mode,
    setMode,
    conversations,
    conversationId,
    messages,
    streamingText,
    streamingTool,
    streamingToolHistory,
    sending,
    loadConversation,
    newConversation,
    send,
    refreshConversations,
    setOpen,
  } = kim;

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeCommands = useMemo(() => commandsForMode(mode), [mode]);
  const slash = useSlashCommands(activeCommands);

  // On this page, close the side drawer — we're the full view.
  useEffect(() => {
    setOpen(false);
  }, [setOpen]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, streamingText]);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

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
  const submit = () => submitText();

  const onInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value;
    setInput(v);
    slash.checkInput(v);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

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

  async function removeConvo(id: string) {
    if (!confirm("Delete this conversation?")) return;
    await deleteLifeConversation(id);
    if (id === conversationId) newConversation();
    refreshConversations();
  }

  return (
    <div className="kim-surface flex h-full relative">
      <div className="kim-grain" />
      <div className="kim-rail" />

      {/* History sidebar */}
      <aside
        className="w-64 shrink-0 border-r flex flex-col"
        style={{
          borderColor: "var(--kim-border)",
          background: "var(--kim-bg-sunken)",
        }}
      >
        <div className="p-4 flex items-center justify-between">
          <span
            className="kim-display text-3xl leading-none"
            style={{ color: "var(--kim-amber)" }}
          >
            kim
          </span>
          <button
            onClick={newConversation}
            className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-[var(--kim-amber-soft)]"
            style={{ color: "var(--kim-ink-dim)" }}
            title="New"
          >
            <Plus size={13} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          <div
            className="text-[10px] kim-mono uppercase tracking-[0.18em] px-2 py-1"
            style={{ color: "var(--kim-ink-faint)" }}
          >
            conversations
          </div>
          {conversations.length === 0 && (
            <div className="px-2 py-3 text-xs italic" style={{ color: "var(--kim-ink-faint)" }}>
              none yet
            </div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className="group flex items-center"
            >
              <button
                onClick={() => loadConversation(c.id)}
                className={`flex-1 text-left px-2 py-2 text-xs rounded-sm truncate ${c.id === conversationId ? "bg-[var(--kim-amber-soft)]" : "hover:bg-[var(--kim-amber-soft)]/50"}`}
                style={{
                  color:
                    c.id === conversationId
                      ? "var(--kim-amber)"
                      : "var(--kim-ink)",
                }}
              >
                <div className="truncate">{c.title || "untitled"}</div>
                <div className="kim-mono text-[9px] uppercase tracking-[0.14em] opacity-60">
                  {c.category}
                </div>
              </button>
              <button
                onClick={() => removeConvo(c.id)}
                className="opacity-0 group-hover:opacity-100 px-2 text-muted-foreground hover:text-[var(--kim-rose)]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main chat */}
      <div className="flex-1 flex flex-col min-w-0 relative">
        <header
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ borderColor: "var(--kim-border)" }}
        >
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as KimMode)}
            className="kim-mono text-[10.5px] uppercase tracking-[0.16em] bg-transparent border rounded-sm px-2 py-1"
            style={{
              borderColor: "var(--kim-border)",
              color: "var(--kim-amber)",
            }}
          >
            {MODES.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m]}
              </option>
            ))}
          </select>
        </header>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-10 py-6 max-w-3xl mx-auto w-full"
        >
          {messages.length === 0 && !streamingText && (
            <div className="py-16">
              <div
                className="kim-display text-4xl italic"
                style={{ color: "var(--kim-amber)" }}
              >
                kim
              </div>
              <p
                className="text-xs mt-4"
                style={{ color: "var(--kim-ink-faint)" }}
              >
                select items anywhere in the life tool to add them as context.
              </p>
            </div>
          )}
          <KimMessageList
            messages={messages}
            streamingText={streamingText}
            streamingTool={streamingTool}
            streamingHistory={streamingToolHistory}
            sending={sending}
          />
        </div>

        <div
          className="px-10 py-5 border-t"
          style={{ borderColor: "var(--kim-border)" }}
        >
          <div className="max-w-3xl mx-auto relative">
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
                onKeyDown={(e) => {
                  if (slash.menuVisible && ["ArrowUp", "ArrowDown", "Tab", "Enter", "Escape"].includes(e.key)) {
                    return;
                  }
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                rows={1}
                placeholder="type / for commands or ask kim…"
                disabled={sending}
                className="w-full resize-none bg-transparent px-4 py-3 pr-14 text-base outline-none placeholder:italic min-h-[56px] max-h-[200px]"
                style={{ color: "var(--kim-ink)" }}
              />
              <button
                onClick={submit}
                disabled={sending || !input.trim()}
                className="absolute bottom-3 right-3 w-9 h-9 rounded-sm flex items-center justify-center disabled:opacity-30"
                style={{
                  background: "var(--kim-amber)",
                  color: "var(--kim-bg)",
                }}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
