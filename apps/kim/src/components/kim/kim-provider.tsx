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
  getLifeActionable,
  listLifeConversations,
  getLifeConversationMessages,
  streamLifeChat,
  type LifeActionable,
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
  /**
   * Key of the currently-primary selection (the one the smart-UI card
   * represents). Null when no selection exists. Tracked separately from
   * the `selection` array so attaching or promoting doesn't reorder the
   * stack — it just re-points this pointer.
   */
  primaryKey: { kind: SelectableKind; id: string } | null;
  selectionMode: boolean;
  /**
   * Cache of full actionable records keyed by id. Populated from streaming
   * tool_result events, from effect.actionable payloads after save, and
   * refreshed via getLifeActionable(id) after the user responds to an
   * inline card. (QBL-112)
   */
  actionables: Record<string, LifeActionable>;
  /**
   * When true, the Smart-UI module above the composer is collapsed down to a
   * one-row bar so actionables / agent responses have room in the drawer.
   * Set automatically after the user picks a smart action; reset whenever
   * the primary selection changes. User can re-expand by clicking the bar.
   * (QBL-113)
   */
  smartUiCollapsed: boolean;
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
  /**
   * Promote a supporting selection to primary. Finds the matching item in
   * `selection`; if found and not already at index 0, swaps it with
   * `selection[0]`. No-op otherwise. Used by the composer ctx-chip row so
   * clicking a supporting chip makes it the smart-UI primary. (QBL-114)
   */
  promoteSelection: (kind: SelectableKind, id: string) => void;
  updateActionableStatus: (msgId: string, actionableId: string, status: string) => void;
  /**
   * Refetch a single actionable by id and update the in-memory cache. Called
   * after a user responds to an inline ActionableCard so the card reflects
   * the new status / resolved state without a full conversation reload.
   * (QBL-112)
   */
  refreshActionable: (id: string) => Promise<void>;
  setActiveForm: (form: KimActiveForm | null) => void;
  registerFormDraft: (form: KimFormKind, handler: KimFormDraftHandler) => () => void;
  registerEffectListener: (tool: string, handler: KimEffectHandler) => () => void;
  askKim: (message: string) => void;
  /**
   * Post a silent marker message (no LLM call). Renders in the thread as
   * "→ {label}" with an optional short ack note underneath. Used by
   * Smart-UI quick actions that call the backend directly without invoking
   * the agent.
   */
  postSilent: (label: string, ack?: string) => void;
  /** Imperatively sets the composer input value (used by smartPrompt). */
  setInput: (value: string) => void;
  /** Focuses the composer textarea (used by smartPrompt). */
  focusComposer: () => void;
  /** Internal: lets the drawer register its composer refs. */
  registerComposer: (h: ComposerHandle | null) => void;
  /** Collapses the Smart-UI module down to a one-row bar. (QBL-113) */
  collapseSmartUi: () => void;
  /** Re-expands a collapsed Smart-UI module. (QBL-113) */
  expandSmartUi: () => void;
}

export interface ComposerHandle {
  setInput: (v: string) => void;
  focus: () => void;
}

interface KimStateExtra {
  streamingToolHistory: string[];
  activeForm: KimActiveForm | null;
}

const KimCtx = createContext<(KimState & KimStateExtra & KimActions) | null>(null);

const MODE_BY_PATH: Array<[RegExp, KimMode]> = [
  [/^\/onboarding/, "onboarding"],
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
  metric: "health",
  "diet-profile": "health",
  "gym-profile": "health",
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
  const [actionables, setActionables] = useState<Record<string, LifeActionable>>({});
  const [smartUiCollapsed, setSmartUiCollapsed] = useState(false);
  const prevPrimaryIdRef = useRef<string | null>(null);
  const [activeForm, setActiveFormState] = useState<KimActiveForm | null>(null);
  const activeFormRef = useRef<KimActiveForm | null>(null);
  const formDraftHandlersRef = useRef<
    Record<KimFormKind, KimFormDraftHandler[]>
  >({ routine: [], meal_plan: [], session: [] });
  const effectHandlersRef = useRef<Record<string, KimEffectHandler[]>>({});
  const streamBufRef = useRef("");
  const composerRef = useRef<ComposerHandle | null>(null);

  const registerComposer = useCallback((h: ComposerHandle | null) => {
    composerRef.current = h;
  }, []);

  const setInput = useCallback((v: string) => {
    composerRef.current?.setInput(v);
  }, []);

  const focusComposer = useCallback(() => {
    setOpen(true);
    requestAnimationFrame(() => composerRef.current?.focus());
  }, []);

  const postSilent = useCallback((label: string, ack?: string) => {
    const now = new Date().toISOString();
    setOpen(true);
    setMessages((cur) => [
      ...cur,
      {
        id: `silent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        role: "user",
        content: label,
        silent: true,
        ack,
        createdAt: now,
      },
    ]);
  }, []);

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

  // Force-open the drawer during first-run onboarding so Kim is always visible
  // alongside the stepper.
  useEffect(() => {
    if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
      setOpen(true);
    }
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
    setActionables({});
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
      // Mirror the status bump into the per-id cache so inline cards rendered
      // via actionableIds update too.
      setActionables((prev) => {
        const cur = prev[actionableId];
        if (!cur) return prev;
        return { ...prev, [actionableId]: { ...cur, status } };
      });
    },
    [],
  );

  const refreshActionable = useCallback(async (id: string) => {
    try {
      const fresh = await getLifeActionable(id);
      if (fresh) {
        setActionables((prev) => ({ ...prev, [id]: fresh }));
      }
    } catch (e) {
      console.error("kim: refresh actionable failed", id, e);
    }
  }, []);

  const loadConversation = useCallback(async (id: string) => {
    setConversationId(id);
    setError(null);
    try {
      const msgs = await getLifeConversationMessages(id);
      const kimMsgs = msgs.map(messageFromLife);
      setMessages(kimMsgs);
      // Prime the actionables cache from historical effect.actionable
      // payloads so inline cards in prior turns render without a refetch.
      const seed: Record<string, LifeActionable> = {};
      for (const m of msgs) {
        for (const eff of m.toolCalls ?? []) {
          if (
            eff.tool === "create_actionable" &&
            eff.actionable &&
            !seed[eff.actionable.id]
          ) {
            seed[eff.actionable.id] = eff.actionable as LifeActionable;
          }
        }
      }
      if (Object.keys(seed).length > 0) {
        setActionables((prev) => ({ ...seed, ...prev }));
      }
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
      // IDs of actionables produced during this streaming turn, accumulated
      // from onToolResult events so inline cards can render before the final
      // save event arrives with the fully-hydrated effects payload.
      const turnActionableIds: string[] = [];

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
            onToolResult: (result) => {
              setStreamingTool(null);
              // Detect create_actionable results by presence of an
              // actionable_id field in the JSON payload. Other tool results
              // are ignored here. Malformed JSON (e.g. error strings) is
              // silently skipped.
              const aid = extractActionableId(result);
              if (!aid || turnActionableIds.includes(aid)) return;
              turnActionableIds.push(aid);
              // Ensure a placeholder assistant message exists (tools can run
              // before any assistant tokens stream) and append the id to it.
              if (!placeholderAdded) {
                placeholderAdded = true;
                setMessages((cur) => [
                  ...cur,
                  {
                    id: placeholderId,
                    role: "assistant",
                    content: "",
                    createdAt: new Date().toISOString(),
                    actionableIds: [aid],
                  },
                ]);
              } else {
                setMessages((cur) =>
                  cur.map((m) =>
                    m.id === placeholderId
                      ? {
                          ...m,
                          actionableIds: [
                            ...(m.actionableIds ?? []),
                            aid,
                          ],
                        }
                      : m,
                  ),
                );
              }
              // Fetch the full record into the cache so the inline card can
              // render immediately. Best-effort — failure just delays the card
              // until the final save event carries the hydrated effect.
              void (async () => {
                try {
                  const fresh = await getLifeActionable(aid);
                  if (fresh) {
                    setActionables((prev) => ({ ...prev, [aid]: fresh }));
                  }
                } catch {
                  /* silent */
                }
              })();
            },
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
                const finalEffects =
                  effects && effects.length > 0 ? effects : message.toolCalls;
                // Merge ids collected live during streaming with ids surfaced
                // in the save-event effects so nothing is dropped.
                const idsFromEffects = (finalEffects ?? [])
                  .filter((e) => e.tool === "create_actionable" && e.actionable)
                  .map((e) => e.actionable!.id);
                const allIds = Array.from(
                  new Set([...turnActionableIds, ...idsFromEffects]),
                );
                const assistantMsg: KimMessage = {
                  id: message.id,
                  role: "assistant",
                  content: message.content,
                  effects: finalEffects,
                  createdAt: message.createdAt,
                  actionableIds: allIds.length > 0 ? allIds : undefined,
                };
                return [...withoutTmp, confirmedUser, assistantMsg];
              });
              // Prime the cache from any effect.actionable payloads that
              // showed up on the final save event (covers the edge case
              // where the inline fetch during streaming lost the race).
              if (effects && effects.length > 0) {
                const seed: Record<string, LifeActionable> = {};
                for (const eff of effects) {
                  if (
                    eff.tool === "create_actionable" &&
                    eff.actionable &&
                    !seed[eff.actionable.id]
                  ) {
                    seed[eff.actionable.id] =
                      eff.actionable as LifeActionable;
                  }
                }
                if (Object.keys(seed).length > 0) {
                  setActionables((prev) => ({ ...seed, ...prev }));
                }
              }
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

  const [primaryKey, setPrimaryKey] = useState<
    { kind: SelectableKind; id: string } | null
  >(null);

  const addSelection = useCallback((s: KimSelection) => {
    setSelection((cur) =>
      cur.some((x) => x.kind === s.kind && x.id === s.id) ? cur : [...cur, s],
    );
    setPrimaryKey({ kind: s.kind, id: s.id });
  }, []);
  const removeSelection = useCallback(
    (kind: SelectableKind, id: string) => {
      setSelection((cur) =>
        cur.filter((x) => !(x.kind === kind && x.id === id)),
      );
      setPrimaryKey((cur) =>
        cur && cur.kind === kind && cur.id === id ? null : cur,
      );
    },
    [],
  );
  const toggleSelection = useCallback((s: KimSelection) => {
    setSelection((cur) => {
      const exists = cur.some((x) => x.kind === s.kind && x.id === s.id);
      return exists
        ? cur.filter((x) => !(x.kind === s.kind && x.id === s.id))
        : [...cur, s];
    });
    setPrimaryKey((cur) => {
      if (cur && cur.kind === s.kind && cur.id === s.id) return null;
      return { kind: s.kind, id: s.id };
    });
  }, []);
  const clearSelection = useCallback(() => {
    setSelection([]);
    setPrimaryKey(null);
  }, []);
  const promoteSelection = useCallback(
    (kind: SelectableKind, id: string) => {
      setPrimaryKey({ kind, id });
    },
    [],
  );
  const isSelected = useCallback(
    (kind: SelectableKind, id: string) =>
      selection.some((x) => x.kind === kind && x.id === id),
    [selection],
  );
  const toggleSelectionMode = useCallback(
    () => setSelectionMode((s) => !s),
    [],
  );

  const collapseSmartUi = useCallback(() => setSmartUiCollapsed(true), []);
  const expandSmartUi = useCallback(() => setSmartUiCollapsed(false), []);

  // Auto-expand the Smart-UI module whenever the primary selection id
  // changes (including initial attachment). Keeps the collapsed state tied
  // to the item the user last acted on rather than leaking across swaps.
  // (QBL-113)
  useEffect(() => {
    const effective =
      primaryKey &&
      selection.find(
        (s) => s.kind === primaryKey.kind && s.id === primaryKey.id,
      )
        ? `${primaryKey.kind}:${primaryKey.id}`
        : selection[0]
          ? `${selection[0].kind}:${selection[0].id}`
          : null;
    if (effective !== prevPrimaryIdRef.current) {
      prevPrimaryIdRef.current = effective;
      setSmartUiCollapsed(false);
    }
  }, [selection, primaryKey]);

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
      primaryKey,
      selectionMode,
      activeForm,
      actionables,
      smartUiCollapsed,
      collapseSmartUi,
      expandSmartUi,
      refreshActionable,
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
      promoteSelection,
      updateActionableStatus,
      setActiveForm,
      registerFormDraft,
      registerEffectListener,
      askKim,
      postSilent,
      setInput,
      focusComposer,
      registerComposer,
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
      primaryKey,
      selectionMode,
      activeForm,
      actionables,
      smartUiCollapsed,
      collapseSmartUi,
      expandSmartUi,
      refreshActionable,
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
      promoteSelection,
      toggleSelectionMode,
      updateActionableStatus,
      setActiveForm,
      registerFormDraft,
      registerEffectListener,
      askKim,
      postSilent,
      setInput,
      focusComposer,
      registerComposer,
    ],
  );

  return <KimCtx.Provider value={value}>{children}</KimCtx.Provider>;
}

export function useKim() {
  const ctx = useContext(KimCtx);
  if (!ctx) throw new Error("useKim must be used within KimProvider");
  return ctx;
}

/**
 * Parse a stream `tool_result` payload and pull out an `actionable_id` if
 * present. The backend emits the raw tool-result JSON string; for
 * `create_actionable` that shape is `{ "actionable_id": "<uuid>", ... }`.
 * Other tools produce unrelated payloads which we skip. Malformed JSON is
 * handled silently so we never throw inside a stream handler. (QBL-112)
 */
function extractActionableId(raw: string | undefined | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const id = parsed?.actionable_id;
    return typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
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
