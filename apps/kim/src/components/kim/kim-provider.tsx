"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import {
  listLifeConversations,
  getLifeConversationMessages,
  streamLifeChat,
  type LifeConversation,
} from "@/lib/life";
import {
  messageFromLife,
  type KimMessage,
  type KimMode,
  type KimSelection,
  type SelectableKind,
} from "./types";

interface KimState {
  open: boolean;
  width: number;
  mode: KimMode;
  modeLocked: boolean;
  conversationId: string | null;
  conversations: LifeConversation[];
  messages: KimMessage[];
  streamingText: string;
  streamingTool: string | null;
  sending: boolean;
  error: string | null;
  selection: KimSelection[];
  selectionMode: boolean;
}

export type KimFormKind = "routine" | "meal_plan" | "session";

export interface KimActiveForm {
  form: KimFormKind;
  title: string;
  values: Record<string, unknown>;
}

export type KimFormDraftHandler = (values: Record<string, unknown>) => void;
export type KimEffectHandler = (data: Record<string, unknown>) => void;

interface KimActions {
  setOpen: (open: boolean) => void;
  toggle: () => void;
  setWidth: (w: number) => void;
  setMode: (mode: KimMode, locked?: boolean) => void;
  newConversation: () => void;
  loadConversation: (id: string) => Promise<void>;
  send: (message: string) => Promise<void>;
  refreshConversations: () => Promise<void>;
  toggleSelectionMode: () => void;
  addSelection: (s: KimSelection) => void;
  removeSelection: (kind: SelectableKind, id: string) => void;
  toggleSelection: (s: KimSelection) => void;
  clearSelection: () => void;
  isSelected: (kind: SelectableKind, id: string) => boolean;
  updateActionableStatus: (msgId: string, actionableId: string, status: string) => void;
  setActiveForm: (form: KimActiveForm | null) => void;
  registerFormDraft: (form: KimFormKind, handler: KimFormDraftHandler) => () => void;
  registerEffectListener: (tool: string, handler: KimEffectHandler) => () => void;
  askKim: (message: string) => void;
}

interface KimStateExtra {
  streamingToolHistory: string[];
  activeForm: KimActiveForm | null;
}

const KimCtx = createContext<(KimState & KimStateExtra & KimActions) | null>(null);

const MODE_BY_PATH: Array<[RegExp, KimMode]> = [
  [/^\/routines/, "routines"],
  [/^\/calendar/, "calendar"],
  [/^\/health\/meals/, "meals"],
  [/^\/health\/sessions/, "gym"],
  [/^\/health/, "health"],
];

function modeForPath(path: string): KimMode {
  for (const [rx, mode] of MODE_BY_PATH) {
    if (rx.test(path)) return mode;
  }
  return "general";
}

const KIND_TO_MODE: Record<SelectableKind, KimMode> = {
  routine: "routines",
  event: "calendar",
  task: "calendar",
  "meal-plan": "meals",
  "meal-item": "meals",
  session: "gym",
  exercise: "gym",
  memory: "general",
  actionable: "general",
};

function modeForSelection(
  selection: KimSelection[],
  fallback: KimMode,
): KimMode {
  if (selection.length === 0) return fallback;
  const modes = new Set(selection.map((s) => KIND_TO_MODE[s.kind]));
  if (modes.size > 1) return "general";
  return modes.values().next().value ?? fallback;
}

export function KimProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState(440);
  const [mode, setModeState] = useState<KimMode>("general");
  const [modeLocked, setModeLocked] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<LifeConversation[]>([]);
  const [messages, setMessages] = useState<KimMessage[]>([]);
  const [streamingText, setStreamingText] = useState("");
  const [streamingTool, setStreamingTool] = useState<string | null>(null);
  const [streamingToolHistory, setStreamingToolHistory] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<KimSelection[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [activeForm, setActiveFormState] = useState<KimActiveForm | null>(null);
  const activeFormRef = useRef<KimActiveForm | null>(null);
  const formDraftHandlersRef = useRef<
    Record<KimFormKind, KimFormDraftHandler[]>
  >({ routine: [], meal_plan: [], session: [] });
  const effectHandlersRef = useRef<Record<string, KimEffectHandler[]>>({});
  const streamBufRef = useRef("");

  const setActiveForm = useCallback((form: KimActiveForm | null) => {
    setActiveFormState(form);
    activeFormRef.current = form;
  }, []);

  const registerFormDraft = useCallback(
    (form: KimFormKind, handler: KimFormDraftHandler) => {
      const handlers = formDraftHandlersRef.current;
      handlers[form] = [...(handlers[form] ?? []), handler];
      return () => {
        handlers[form] = (handlers[form] ?? []).filter((h) => h !== handler);
      };
    },
    [],
  );

  const registerEffectListener = useCallback(
    (tool: string, handler: KimEffectHandler) => {
      const map = effectHandlersRef.current;
      map[tool] = [...(map[tool] ?? []), handler];
      return () => {
        map[tool] = (map[tool] ?? []).filter((h) => h !== handler);
      };
    },
    [],
  );

  const askKim = useCallback(
    (message: string) => {
      setOpen(true);
      // Defer one tick so the drawer's effect picks up the open state before
      // we push the user message through the stream.
      requestAnimationFrame(() => {
        void sendRef.current?.(message);
      });
    },
    [],
  );

  const sendRef = useRef<((text: string) => Promise<void>) | null>(null);

  const dispatchFormDrafts = useCallback(
    (effects: { tool: string; data?: Record<string, unknown> }[] | undefined) => {
      if (!effects) return;
      for (const eff of effects) {
        if (eff.tool === "draft_form" && eff.data) {
          const form = eff.data.form as KimFormKind | undefined;
          const values = eff.data.values as Record<string, unknown> | undefined;
          if (form && values) {
            const handlers = formDraftHandlersRef.current[form] ?? [];
            for (const h of handlers) {
              try {
                h(values);
              } catch (err) {
                console.error("kim form draft handler error:", err);
              }
            }
          }
          continue;
        }
        // Generic effect listeners (e.g. create pages watching generate_meal_plan).
        const effHandlers = effectHandlersRef.current[eff.tool] ?? [];
        if (effHandlers.length > 0 && eff.data) {
          for (const h of effHandlers) {
            try {
              h(eff.data);
            } catch (err) {
              console.error(`kim effect handler error (${eff.tool}):`, err);
            }
          }
        }
      }
    },
    [],
  );

  // Sync mode to pathname + selection unless user has explicitly locked it.
  // Selection persists across navigation so users can pull context from many
  // pages; when the selection spans multiple modes we auto-switch to general.
  useEffect(() => {
    if (modeLocked) return;
    const pathMode = modeForPath(pathname);
    setModeState(modeForSelection(selection, pathMode));
  }, [pathname, modeLocked, selection]);

  // Exit explicit selection mode on nav but keep the actual selection.
  useEffect(() => {
    setSelectionMode(false);
  }, [pathname]);

  // Restore drawer width
  useEffect(() => {
    const saved = Number(localStorage.getItem("kim:width") || 0);
    if (saved > 320 && saved < 1200) setWidth(saved);
    const openSaved = localStorage.getItem("kim:open");
    if (openSaved === "1") setOpen(true);
  }, []);
  useEffect(() => {
    localStorage.setItem("kim:width", String(width));
  }, [width]);
  useEffect(() => {
    localStorage.setItem("kim:open", open ? "1" : "0");
  }, [open]);

  const refreshConversations = useCallback(async () => {
    try {
      const list = await listLifeConversations();
      setConversations(list);
    } catch (e) {
      console.error("kim: list conversations failed", e);
    }
  }, []);

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  // ⌘K / ⌘⇧K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const setMode = useCallback((m: KimMode, locked = true) => {
    setModeState(m);
    setModeLocked(locked);
  }, []);

  const newConversation = useCallback(() => {
    setConversationId(null);
    setMessages([]);
    setStreamingText("");
    setStreamingTool(null);
    setStreamingToolHistory([]);
    setError(null);
  }, []);

  const updateActionableStatus = useCallback(
    (msgId: string, actionableId: string, status: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msgId
            ? {
                ...m,
                effects: m.effects?.map((e) =>
                  e.id === actionableId && e.actionable
                    ? { ...e, actionable: { ...e.actionable, status } }
                    : e,
                ),
              }
            : m,
        ),
      );
    },
    [],
  );

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setError(null);
    try {
      const msgs = await getLifeConversationMessages(id);
      setMessages(msgs.map(messageFromLife));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  }, []);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || sending) return;
      const capturedSelection = selection.slice();
      const userMsgId = `tmp-user-${Date.now()}`;
      const placeholderId = `streaming-${Date.now()}`;
      let placeholderAdded = false;

      const userMsg: KimMessage = {
        id: userMsgId,
        role: "user",
        content: text,
        mode,
        selection: capturedSelection,
        createdAt: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      setSending(true);
      setError(null);
      setStreamingText("");
      setStreamingTool(null);
      setStreamingToolHistory([]);
      streamBufRef.current = "";

      const systemContext = buildSystemContext(
        mode,
        capturedSelection,
        activeFormRef.current,
      );

      try {
        await streamLifeChat(
          text,
          {
            onToken: (t) => {
              if (!t) return;
              streamBufRef.current += t;
              setStreamingText(streamBufRef.current);
              // Add placeholder assistant message on first token so the
              // markdown renderer streams live into the same bubble.
              if (!placeholderAdded) {
                placeholderAdded = true;
                setMessages((cur) => [
                  ...cur,
                  {
                    id: placeholderId,
                    role: "assistant",
                    content: t,
                    createdAt: new Date().toISOString(),
                  },
                ]);
              } else {
                const next = streamBufRef.current;
                setMessages((cur) =>
                  cur.map((m) => (m.id === placeholderId ? { ...m, content: next } : m)),
                );
              }
            },
            onToolCall: (name) => {
              setStreamingTool(name);
              setStreamingToolHistory((prev) => [...prev, name]);
            },
            onToolResult: () => setStreamingTool(null),
            onComplete: ({ conversationId: newId, message, effects }) => {
              setConversationId(newId);
              // Fire any form-draft handlers registered for this form kind.
              dispatchFormDrafts(
                effects as
                  | { tool: string; data?: Record<string, unknown> }[]
                  | undefined,
              );
              // Replace tmp user msg + streaming placeholder with real records.
              setMessages((cur) => {
                const withoutTmp = cur.filter(
                  (m) => m.id !== userMsgId && m.id !== placeholderId,
                );
                const confirmedUser: KimMessage = {
                  ...userMsg,
                  id: `user-${Date.now()}`,
                };
                const assistantMsg: KimMessage = {
                  id: message.id,
                  role: "assistant",
                  content: message.content,
                  effects:
                    effects && effects.length > 0 ? effects : message.toolCalls,
                  createdAt: message.createdAt,
                };
                return [...withoutTmp, confirmedUser, assistantMsg];
              });
              setStreamingText("");
              setStreamingTool(null);
              setStreamingToolHistory([]);
              refreshConversations();
            },
            onError: (err) => {
              // Roll back tmp + placeholder on error.
              setMessages((cur) =>
                cur.filter((m) => m.id !== userMsgId && m.id !== placeholderId),
              );
              setError(err);
              setStreamingText("");
              setStreamingTool(null);
              setStreamingToolHistory([]);
            },
          },
          conversationId ?? undefined,
          systemContext,
          undefined,
          false,
          mode,
        );
      } catch (e) {
        setMessages((cur) =>
          cur.filter((m) => m.id !== userMsgId && m.id !== placeholderId),
        );
        setError(e instanceof Error ? e.message : "Stream failed");
      } finally {
        setSending(false);
      }
    },
    [sending, selection, mode, conversationId, refreshConversations, dispatchFormDrafts],
  );

  // Keep a ref pointing at the latest `send` closure so askKim can invoke it
  // without being re-bound on every render.
  useEffect(() => {
    sendRef.current = send;
  }, [send]);

  const addSelection = useCallback((s: KimSelection) => {
    setSelection((cur) =>
      cur.some((x) => x.kind === s.kind && x.id === s.id)
        ? cur
        : [...cur, s],
    );
  }, []);
  const removeSelection = useCallback(
    (kind: SelectableKind, id: string) =>
      setSelection((cur) =>
        cur.filter((x) => !(x.kind === kind && x.id === id)),
      ),
    [],
  );
  const toggleSelection = useCallback((s: KimSelection) => {
    setSelection((cur) =>
      cur.some((x) => x.kind === s.kind && x.id === s.id)
        ? cur.filter((x) => !(x.kind === s.kind && x.id === s.id))
        : [...cur, s],
    );
  }, []);
  const clearSelection = useCallback(() => setSelection([]), []);
  const isSelected = useCallback(
    (kind: SelectableKind, id: string) =>
      selection.some((x) => x.kind === kind && x.id === id),
    [selection],
  );
  const toggleSelectionMode = useCallback(
    () => setSelectionMode((s) => !s),
    [],
  );

  const value = useMemo(
    () => ({
      open,
      width,
      mode,
      modeLocked,
      conversationId,
      conversations,
      messages,
      streamingText,
      streamingTool,
      streamingToolHistory,
      sending,
      error,
      selection,
      selectionMode,
      activeForm,
      setOpen,
      toggle: () => setOpen((o) => !o),
      setWidth,
      setMode,
      newConversation,
      loadConversation,
      send,
      refreshConversations,
      toggleSelectionMode,
      addSelection,
      removeSelection,
      toggleSelection,
      clearSelection,
      isSelected,
      updateActionableStatus,
      setActiveForm,
      registerFormDraft,
      registerEffectListener,
      askKim,
    }),
    [
      open,
      width,
      mode,
      modeLocked,
      conversationId,
      conversations,
      messages,
      streamingText,
      streamingTool,
      streamingToolHistory,
      sending,
      error,
      selection,
      selectionMode,
      activeForm,
      setMode,
      newConversation,
      loadConversation,
      send,
      refreshConversations,
      addSelection,
      removeSelection,
      toggleSelection,
      clearSelection,
      isSelected,
      toggleSelectionMode,
      updateActionableStatus,
      setActiveForm,
      registerFormDraft,
      registerEffectListener,
      askKim,
    ],
  );

  return <KimCtx.Provider value={value}>{children}</KimCtx.Provider>;
}

export function useKim() {
  const ctx = useContext(KimCtx);
  if (!ctx) throw new Error("useKim must be used within KimProvider");
  return ctx;
}

function buildSystemContext(
  mode: KimMode,
  selection: KimSelection[],
  activeForm: KimActiveForm | null,
): string {
  const parts: string[] = [];
  parts.push(`[kim-mode=${mode}]`);
  if (selection.length > 0) {
    parts.push("Selected context from current page:");
    for (const s of selection) {
      const line = `- ${s.kind}:${s.id} "${s.label}"`;
      parts.push(
        s.snapshot ? `${line}\n  ${JSON.stringify(s.snapshot)}` : line,
      );
    }
  }
  if (activeForm) {
    parts.push("");
    parts.push(`## Active form: ${activeForm.title}`);
    parts.push(
      `The user is editing a ${activeForm.form.replace("_", " ")} form. ` +
        `DO NOT call create_${activeForm.form} / update_${activeForm.form} / ` +
        `generate_${activeForm.form} — the user submits the form themselves. ` +
        `Use the draft_form tool with form="${activeForm.form}" and values containing ` +
        `only the fields you want to change. Current form values:`,
    );
    parts.push(JSON.stringify(activeForm.values, null, 2));
  } else {
    parts.push("");
    parts.push(
      "## No active form",
    );
    parts.push(
      "There is NO create/edit form open. DO NOT call draft_form under any circumstances. " +
        "When the user asks you to modify an existing item (routine / calendar event / meal plan / session / etc.), " +
        "call the appropriate update_* tool directly with the item's id — do NOT draft form fields.",
    );
  }
  return parts.join("\n");
}
