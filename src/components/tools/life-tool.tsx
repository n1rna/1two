"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Brain,
  MessageSquare,
  Lightbulb,
  CalendarDays,
  Radio,
  Settings,
  Plus,
  Trash2,
  Edit2,
  Send,
  Loader2,
  CheckSquare,
  Repeat,
  Sun,
  Pencil,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  RefreshCw,
  Check,
  Clock,
  AlertCircle,
  Info,
  ToggleLeft,
  ToggleRight,
  Copy,
  GripVertical,
  Sparkles,
  Dumbbell,
  BookOpen,
  Phone,
  Target,
  Mail,
  MessageCircle,
  ExternalLink,
  MapPin,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSession } from "@/lib/auth-client";
import { AuthGate } from "@/components/layout/auth-gate";
import { useSyncedState } from "@/lib/sync";
import { usePathname, useRouter } from "next/navigation";
import {
  listLifeMemories,
  createLifeMemory,
  updateLifeMemory,
  deleteLifeMemory,
  listLifeConversations,
  getLifeConversationMessages,
  getRoutineConversationId,
  sendLifeChat,
  streamLifeChat,
  deleteLifeConversation,
  listLifeActionables,
  respondToActionable,
  listLifeRoutines,
  createLifeRoutine,
  updateLifeRoutine,
  deleteLifeRoutine,
  listChannelLinks,
  initChannelLink,
  verifyChannelLink,
  deleteChannelLink,
  type LifeMemory,
  type LifeMessage,
  type LifeConversation,
  type LifeActionable,
  type LifeRoutine,
  type ChatEffect,
  type ChannelLink,
  type InitChannelLinkResponse,
  getLifeRoutine,
  getGCalAuthUrl,
  exchangeGCalCode,
  getGCalStatus,
  disconnectGCal,
  listGCalEvents,
  type GCalStatus,
  type GCalEvent,
} from "@/lib/life";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

// ─── Types ────────────────────────────────────────────────────────────────────

type LifeTabType =
  | "today"
  | "actionables"
  | "routines"
  | "routine-detail"
  | "chat"
  | "memories"
  | "calendar"
  | "channels";

interface LifeTab {
  id: string;
  type: LifeTabType;
  title?: string;
  convId?: string; // for chat tabs — the conversation ID
  chatNum?: number; // display number for chat tabs (#1, #2, etc.)
  routineId?: string; // for routine-detail tabs
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

interface SidebarItem {
  id: LifeTabType;
  label: string;
  icon: React.ReactNode;
}

const TAB_LABELS: Record<LifeTabType, string> = {
  today: "Today",
  actionables: "Actionables",
  routines: "Routines",
  "routine-detail": "Routine",
  chat: "Chat",
  memories: "Memories",
  calendar: "Calendar",
  channels: "Channels",
};

const TAB_ICONS: Record<LifeTabType, React.ReactNode> = {
  today: <Sun className="h-3 w-3" />,
  actionables: <CheckSquare className="h-3 w-3" />,
  routines: <Repeat className="h-3 w-3" />,
  "routine-detail": <Repeat className="h-3 w-3" />,
  chat: <MessageSquare className="h-3 w-3" />,
  memories: <Lightbulb className="h-3 w-3" />,
  calendar: <CalendarDays className="h-3 w-3" />,
  channels: <Radio className="h-3 w-3" />,
};

// ─── URL Routing ──────────────────────────────────────────────────────────────

const LIFE_BASE = "/tools/life";

function tabToUrl(tab: LifeTab): string {
  if (tab.type === "chat") {
    return tab.convId ? `${LIFE_BASE}/c/${tab.convId}` : LIFE_BASE;
  }
  if (tab.type === "routine-detail" && tab.routineId) {
    return `${LIFE_BASE}/routines/${tab.routineId}`;
  }
  return `${LIFE_BASE}/${tab.type}`;
}

function urlToTab(pathname: string): { type: LifeTabType; convId?: string; routineId?: string } | null {
  const rel = pathname.replace(LIFE_BASE, "").replace(/^\//, "");
  if (!rel || rel === "") return { type: "chat" };
  if (rel.startsWith("c/")) {
    const convId = rel.slice(2);
    return convId ? { type: "chat", convId } : { type: "chat" };
  }
  if (rel.startsWith("routines/")) {
    const routineId = rel.slice(9);
    return routineId ? { type: "routine-detail", routineId } : { type: "routines" };
  }
  const validTypes: LifeTabType[] = ["today", "actionables", "routines", "chat", "memories", "calendar", "channels"];
  if (validTypes.includes(rel as LifeTabType)) return { type: rel as LifeTabType };
  return { type: "chat" };
}

// ─── Persisted State ──────────────────────────────────────────────────────────

interface LifePersistedState {
  tabs: LifeTab[];
  activeTabId: string | null;
  activeConvId: string | null;
}

const DEFAULT_LIFE_STATE: LifePersistedState = {
  tabs: [{ id: "tab:chat", type: "chat" }],
  activeTabId: "tab:chat",
  activeConvId: null,
};

const MEMORY_CATEGORIES = [
  { value: "preference", label: "Preference" },
  { value: "instruction", label: "Instruction" },
  { value: "fact", label: "Fact" },
  { value: "habit", label: "Habit" },
];

const CATEGORY_COLORS: Record<string, string> = {
  preference: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  instruction: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  fact: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  habit: "bg-green-500/15 text-green-600 dark:text-green-400",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function LifeSidebar({
  activeTabType,
  onOpenTab,
}: {
  activeTabType: LifeTabType | null;
  onOpenTab: (type: LifeTabType) => void;
}) {
  const groups: SidebarGroup[] = [
    {
      label: "Overview",
      items: [
        {
          id: "today",
          label: "Today",
          icon: <Sun className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Actions",
      items: [
        {
          id: "actionables",
          label: "Actionables",
          icon: <CheckSquare className="h-3.5 w-3.5" />,
        },
        {
          id: "routines",
          label: "Routines",
          icon: <Repeat className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Agent",
      items: [
        {
          id: "chat",
          label: "Chat",
          icon: <MessageSquare className="h-3.5 w-3.5" />,
        },
        {
          id: "memories",
          label: "Memories",
          icon: <Lightbulb className="h-3.5 w-3.5" />,
        },
      ],
    },
    {
      label: "Connect",
      items: [
        {
          id: "calendar",
          label: "Calendar",
          icon: <CalendarDays className="h-3.5 w-3.5" />,
        },
        {
          id: "channels",
          label: "Channels",
          icon: <Radio className="h-3.5 w-3.5" />,
        },
      ],
    },
  ];

  return (
    <aside className="w-52 shrink-0 border-r flex flex-col overflow-hidden bg-muted/20">
      <div className="flex-1 overflow-y-auto px-1.5 py-2 space-y-3">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onOpenTab(item.id)}
                  className={cn(
                    "flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs transition-colors",
                    activeTabType === item.id
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 mr-auto max-w-[80%]">
      <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3 flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: LifeMessage }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);
  const time = new Date(msg.createdAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={cn(
        "group flex items-end gap-2",
        isUser ? "ml-auto flex-row-reverse max-w-[80%]" : "mr-auto max-w-[80%]"
      )}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm whitespace-pre-wrap break-words"
            : "bg-muted text-foreground rounded-bl-sm"
        )}
      >
        {isUser ? (
          msg.content
        ) : (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              ul: ({ children }) => <ul className="list-disc list-inside mb-2 last:mb-0 space-y-0.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-0.5">{children}</ol>,
              li: ({ children }) => <li className="leading-relaxed">{children}</li>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children, className }) => {
                const isBlock = className?.startsWith("language-");
                if (isBlock) {
                  return <code className="block bg-background/50 rounded-md px-3 py-2 text-xs font-mono my-2 overflow-x-auto">{children}</code>;
                }
                return <code className="bg-background/50 px-1 py-0.5 rounded text-xs font-mono">{children}</code>;
              },
              pre: ({ children }) => <pre className="my-2">{children}</pre>,
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>
              ),
              h1: ({ children }) => <p className="font-bold text-base mb-1">{children}</p>,
              h2: ({ children }) => <p className="font-bold text-sm mb-1">{children}</p>,
              h3: ({ children }) => <p className="font-semibold text-sm mb-1">{children}</p>,
              blockquote: ({ children }) => <blockquote className="border-l-2 border-primary/40 pl-3 italic text-muted-foreground my-2">{children}</blockquote>,
              hr: () => <hr className="border-border/50 my-2" />,
              table: ({ children }) => <div className="overflow-x-auto my-2"><table className="text-xs border-collapse w-full">{children}</table></div>,
              th: ({ children }) => <th className="text-left px-2 py-1 border-b font-semibold text-xs">{children}</th>,
              td: ({ children }) => <td className="px-2 py-1 border-b border-border/30 text-xs">{children}</td>,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mb-1">
        <span className="text-[10px] text-muted-foreground/50">
          {time}
        </span>
        {!isUser && (
          <button
            onClick={handleCopy}
            className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title="Copy message"
          >
            {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Inline Chat Actionable ───────────────────────────────────────────────────

function InlineChatActionable({
  actionable,
  onRespond,
}: {
  actionable: LifeActionable;
  onRespond: (action: string, data?: unknown) => void;
}) {
  const [acting, setActing] = useState(false);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const resolved = actionable.status !== "pending";

  const handle = async (action: string, data?: unknown) => {
    setActing(true);
    await onRespond(action, data);
    setActing(false);
  };

  const typeColors: Record<string, string> = {
    confirm: "border-blue-500/30 bg-blue-500/5",
    choose: "border-purple-500/30 bg-purple-500/5",
    input: "border-amber-500/30 bg-amber-500/5",
    info: "border-green-500/30 bg-green-500/5",
  };

  return (
    <div className={cn(
      "ml-0 mr-auto max-w-[80%] mt-2 rounded-xl border p-3 space-y-2 text-sm",
      typeColors[actionable.type] ?? "border-border bg-muted/30",
      resolved && "opacity-60"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{actionable.title}</p>
          {actionable.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{actionable.description}</p>
          )}
        </div>
        {resolved && (
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {actionable.status}
          </span>
        )}
      </div>

      {!resolved && actionable.type === "confirm" && (
        <div className="flex items-center gap-2 pt-1">
          <Button size="sm" className="h-7 text-xs" disabled={acting} onClick={() => handle("confirm")}>
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
            Dismiss
          </Button>
        </div>
      )}

      {!resolved && actionable.type === "choose" && actionable.options && (
        <div className="space-y-1.5 pt-1">
          {actionable.options.map((opt) => (
            <label
              key={opt.id}
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                selectedOption === opt.id ? "border-primary bg-primary/5" : "border-border/50 hover:bg-muted/30"
              )}
            >
              <input
                type="radio"
                name={`choice-${actionable.id}`}
                checked={selectedOption === opt.id}
                onChange={() => setSelectedOption(opt.id)}
                className="mt-0.5"
              />
              <div>
                <span className="text-xs font-medium">{opt.label}</span>
                {opt.detail && <p className="text-[11px] text-muted-foreground">{opt.detail}</p>}
              </div>
            </label>
          ))}
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={acting || !selectedOption} onClick={() => handle("choose", { optionId: selectedOption })}>
              Select
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "input" && (
        <div className="space-y-1.5 pt-1">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Your response..."
            className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs" disabled={acting || !inputText.trim()} onClick={() => handle("input", { text: inputText })}>
              Submit
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("dismiss")}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      {!resolved && actionable.type === "info" && (
        <div className="pt-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" disabled={acting} onClick={() => handle("confirm")}>
            Got it
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Tool Call Display ────────────────────────────────────────────────────────
// Modern collapsible card inspired by Claude/Gemini tool call indicators.

function ToolCallDisplay({
  effect,
  onActionableRespond,
  msgId,
  onActionableStatusChange,
}: {
  effect: ChatEffect;
  onActionableRespond: (id: string, action: string, data?: unknown) => void;
  msgId: string;
  onActionableStatusChange?: (msgId: string, actionableId: string, status: string) => void;
}) {
  const TOOL_META: Record<string, { label: string; icon: React.ReactNode }> = {
    remember: { label: "Saved to memory", icon: <Lightbulb className="size-3.5" /> },
    forget: { label: "Removed memory", icon: <X className="size-3.5" /> },
    create_routine: { label: "Created routine", icon: <Repeat className="size-3.5" /> },
    update_routine: { label: "Updated routine", icon: <Repeat className="size-3.5" /> },
    delete_routine: { label: "Removed routine", icon: <Repeat className="size-3.5" /> },
    create_actionable: { label: "Action required", icon: <CheckSquare className="size-3.5" /> },
    list_routines: { label: "Looked up routines", icon: <Repeat className="size-3.5" /> },
    list_actionables: { label: "Looked up actionables", icon: <CheckSquare className="size-3.5" /> },
  };

  const meta = TOOL_META[effect.tool] ?? { label: effect.tool, icon: <Settings className="size-3.5" /> };

  // ── Actionable (interactive) ───────────────────────────────────────────────
  if (effect.tool === "create_actionable" && effect.actionable) {
    const a = effect.actionable as LifeActionable;
    const resolved = a.status !== "pending";

    if (resolved) {
      return (
        <div className="mt-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Check className="size-3.5" />
            <span>{a.title}</span>
            <span className="opacity-50">· {a.status}</span>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-2 rounded-lg border border-border/60 p-3 space-y-2 max-w-[85%]">
        <p className="text-sm font-medium text-foreground">{a.title}</p>
        {a.description && (
          <p className="text-xs text-muted-foreground">{a.description}</p>
        )}
        <InlineChatActionable
          actionable={a}
          onRespond={async (action, data) => {
            await onActionableRespond(effect.id, action, data);
            onActionableStatusChange?.(msgId, effect.id, action === "dismiss" ? "dismissed" : "confirmed");
          }}
        />
      </div>
    );
  }

  // ── Read-only tools (list_routines, list_actionables) — hide from UI ──────
  if (effect.tool === "list_routines" || effect.tool === "list_actionables") {
    return null;
  }

  // ── All other tools — collapsible subtle trigger ──────────────────────────
  const detail = effect.data
    ? effect.tool === "remember"
      ? String(effect.data.content ?? "")
      : effect.tool === "create_routine" || effect.tool === "update_routine"
        ? String(effect.data.name ?? "")
        : effect.tool === "delete_routine"
          ? "Deactivated"
          : effect.tool === "forget"
            ? "Removed"
            : null
    : null;

  const isMemory = effect.tool === "remember" && effect.data;
  const isRoutine = effect.tool === "create_routine" || effect.tool === "update_routine";

  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
      {meta.icon}
      <span>{meta.label}</span>
      {detail && <span className="opacity-50 truncate max-w-[200px]">· {detail}</span>}
      {isRoutine && (
        <a href="/tools/life/routines" className="text-primary hover:underline ml-0.5">View →</a>
      )}
      {isMemory && (
        <a href="/tools/life/memories" className="text-primary hover:underline ml-0.5">View →</a>
      )}
    </div>
  );
}

// ─── Conversation List ─────────────────────────────────────────────────────────

function ConversationList({
  conversations,
  activeId,
  onSelect,
  onDelete,
  onNew,
  loading,
}: {
  conversations: LifeConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  loading: boolean;
}) {
  return (
    <div className="w-52 shrink-0 border-r flex flex-col overflow-hidden bg-muted/10">
      <div className="flex items-center justify-between px-3 h-10 border-b shrink-0">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Conversations
        </span>
        <button
          onClick={onNew}
          className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="New conversation"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5">
        {loading && (
          <div className="space-y-1.5 px-1 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {!loading && conversations.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground text-center">
            No conversations yet
          </p>
        )}
        {!loading &&
          conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex items-center gap-1 w-full px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
                activeId === conv.id
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
              onClick={() => onSelect(conv.id)}
            >
              <span className="flex-1 truncate">{conv.title}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
                title="Delete conversation"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Chat View ────────────────────────────────────────────────────────────────

function ChatView({
  persistedConvId,
  onConvIdChange,
  onNewChat,
  systemContext,
  routineId,
  hideConversations,
  onToolEffect,
}: {
  persistedConvId: string | null;
  onConvIdChange: (id: string | null) => void;
  onNewChat?: () => void;
  systemContext?: string;
  routineId?: string;
  hideConversations?: boolean;
  onToolEffect?: (tool: string) => void;
}) {
  const [messages, setMessages] = useState<LifeMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [streamingToolCall, setStreamingToolCall] = useState<string | null>(null);
  const [activeConvId, setActiveConvIdLocal] = useState<string | null>(persistedConvId);
  const [conversations, setConversations] = useState<LifeConversation[]>([]);
  const [convsLoading, setConvsLoading] = useState(true);
  const [showConvList, setShowConvList] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const setActiveConvId = useCallback((id: string | null) => {
    setActiveConvIdLocal(id);
    onConvIdChange(id);
  }, [onConvIdChange]);

  // Load messages when persisted conversation ID becomes available
  const loadedConvRef = useRef<string | null>(null);
  useEffect(() => {
    if (persistedConvId && persistedConvId !== loadedConvRef.current) {
      loadedConvRef.current = persistedConvId;
      setActiveConvIdLocal(persistedConvId);
      getLifeConversationMessages(persistedConvId)
        .then(setMessages)
        .catch(() => {});
    }
  }, [persistedConvId]);

  // For routine-scoped chats, load the existing conversation on mount
  useEffect(() => {
    if (!routineId) return;
    // If we already have messages loaded (e.g., from persistedConvId), skip
    if (activeConvId && loadedConvRef.current === activeConvId) return;

    let cancelled = false;
    getRoutineConversationId(routineId).then(async (convId) => {
      if (cancelled || !convId) return;
      setActiveConvIdLocal(convId);
      loadedConvRef.current = convId;
      try {
        const msgs = await getLifeConversationMessages(convId);
        if (!cancelled) setMessages(msgs);
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineId]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, sending, scrollToBottom]);

  // Load conversation list
  const loadConversations = useCallback(async () => {
    setConvsLoading(true);
    try {
      const convs = await listLifeConversations();
      setConversations(convs);
    } catch {
      // silently fail — conversations panel just stays empty
    } finally {
      setConvsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const handleNewChat = useCallback(() => {
    setActiveConvId(null);
    setMessages([]);
    textareaRef.current?.focus();
  }, []);

  const handleSelectConv = useCallback(async (id: string) => {
    setActiveConvId(id);
    setMessages([]);
    try {
      const msgs = await getLifeConversationMessages(id);
      setMessages(msgs);
    } catch {
      // failed to load — leave empty
    }
    textareaRef.current?.focus();
  }, []);

  const handleDeleteConv = useCallback(
    async (id: string) => {
      try {
        await deleteLifeConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConvId === id) {
          setActiveConvId(null);
          setMessages([]);
        }
      } catch {
        // silently fail
      }
    },
    [activeConvId]
  );

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimisticUserMsg: LifeMessage = {
      id: `tmp-${Date.now()}`,
      conversationId: activeConvId ?? "",
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const placeholderId = `streaming-${Date.now()}`;
    let placeholderAdded = false;

    setMessages((prev) => [...prev, optimisticUserMsg]);
    setInput("");
    setStreamingText("");
    setStreamingToolCall(null);
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      await streamLifeChat(
        text,
        {
          onToken: (token) => {
            if (!token) return;
            // Add the placeholder bubble on first real token
            if (!placeholderAdded) {
              placeholderAdded = true;
              setMessages((prev) => [...prev, {
                id: placeholderId,
                conversationId: activeConvId ?? "",
                role: "assistant",
                content: token,
                createdAt: new Date().toISOString(),
              }]);
              setStreamingText(token);
              return;
            }
            setStreamingText((prev) => {
              const next = prev + token;
              setMessages((msgs) =>
                msgs.map((m) =>
                  m.id === placeholderId ? { ...m, content: next } : m
                )
              );
              return next;
            });
          },
          onToolCall: (toolName) => {
            setStreamingToolCall(toolName);
          },
          onToolResult: () => {
            setStreamingToolCall(null);
          },
          onComplete: (result) => {
            // Update conversation ID if this was a new chat.
            if (!activeConvId) {
              setActiveConvId(result.conversationId);
              loadConversations();
            }

            // Replace optimistic user msg + placeholder with final records.
            setMessages((prev) => {
              const withoutTmp = prev.filter(
                (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
              );
              const confirmedUser: LifeMessage = {
                ...optimisticUserMsg,
                id: `user-${Date.now()}`,
                conversationId: result.conversationId,
              };
              const assistantMsg: LifeMessage = {
                ...result.message,
                toolCalls:
                  result.effects && result.effects.length > 0
                    ? result.effects
                    : result.message.toolCalls,
              };
              return [...withoutTmp, confirmedUser, assistantMsg];
            });

            setStreamingText("");
            setStreamingToolCall(null);

            if (onToolEffect && result.effects) {
              for (const eff of result.effects) {
                onToolEffect(eff.tool);
              }
            }
          },
          onError: (errMsg) => {
            setMessages((prev) => {
              const withoutTmp = prev.filter(
                (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
              );
              const errBubble: LifeMessage = {
                id: `err-${Date.now()}`,
                conversationId: activeConvId ?? "",
                role: "assistant",
                content: `Sorry, something went wrong: ${errMsg}`,
                createdAt: new Date().toISOString(),
              };
              return [...withoutTmp, errBubble];
            });
            setStreamingText("");
            setStreamingToolCall(null);
          },
        },
        activeConvId ?? undefined,
        systemContext,
        routineId,
      );
    } catch (err) {
      // Network-level failure before streaming could start.
      setMessages((prev) => {
        const withoutTmp = prev.filter(
          (m) => m.id !== optimisticUserMsg.id && m.id !== placeholderId
        );
        const errBubble: LifeMessage = {
          id: `err-${Date.now()}`,
          conversationId: activeConvId ?? "",
          role: "assistant",
          content: `Sorry, something went wrong: ${String(err)}`,
          createdAt: new Date().toISOString(),
        };
        return [...withoutTmp, errBubble];
      });
      setStreamingText("");
      setStreamingToolCall(null);
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }, [input, sending, activeConvId, loadConversations, systemContext, routineId, onToolEffect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    // Auto-resize
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
  };

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Conversation list panel */}
      {!hideConversations && showConvList && (
        <ConversationList
          conversations={conversations}
          activeId={activeConvId}
          onSelect={handleSelectConv}
          onDelete={handleDeleteConv}
          onNew={onNewChat ?? handleNewChat}
          loading={convsLoading}
        />
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Chat toolbar */}
        {!hideConversations && (
        <div className="flex items-center gap-2 px-4 h-10 border-b shrink-0">
          <button
            onClick={() => setShowConvList((v) => !v)}
            className={cn(
              "p-1.5 rounded hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground",
              showConvList && "bg-muted text-foreground"
            )}
            title={showConvList ? "Hide conversations" : "Show conversations"}
          >
            {showConvList ? (
              <PanelLeftClose className="h-3.5 w-3.5" />
            ) : (
              <PanelLeft className="h-3.5 w-3.5" />
            )}
          </button>
          <span className="text-xs text-muted-foreground truncate flex-1">
            {activeConvId
              ? (conversations.find((c) => c.id === activeConvId)?.title ??
                "Chat")
              : "New conversation"}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-xs h-7"
            onClick={onNewChat ?? handleNewChat}
          >
            <Plus className="h-3.5 w-3.5" />
            New Chat
          </Button>
        </div>
        )}

        {/* Messages */}
        <div className={cn("flex-1 px-4 py-4 space-y-3", messages.length > 0 || sending ? "overflow-y-auto" : "flex flex-col overflow-hidden")}>
          {messages.length === 0 && !sending && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">
                  {systemContext ? "Edit this routine" : "Your AI life assistant"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {systemContext
                    ? "Ask me to update the schedule, add items, or change anything"
                    : "Plan your day, build routines, and stay organized"}
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-md">
                {(systemContext
                  ? [
                      { icon: <Edit2 className="h-3 w-3" />, text: "Change the schedule to weekdays only" },
                      { icon: <Plus className="h-3 w-3" />, text: "Add a new item to this routine" },
                      { icon: <Repeat className="h-3 w-3" />, text: "Make this routine more flexible" },
                    ]
                  : [
                      { icon: <Target className="h-3 w-3" />, text: "Plan my day tomorrow" },
                      { icon: <Dumbbell className="h-3 w-3" />, text: "Create a gym routine" },
                      { icon: <Phone className="h-3 w-3" />, text: "Remind me to call family weekly" },
                      { icon: <BookOpen className="h-3 w-3" />, text: "Help me build a reading habit" },
                    ]
                ).map((s) => (
                  <button
                    key={s.text}
                    onClick={() => {
                      setInput(s.text);
                      textareaRef.current?.focus();
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/60 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-accent/60 transition-all"
                  >
                    {s.icon}
                    {s.text}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div key={msg.id}>
              <MessageBubble msg={msg} />
              {msg.role === "assistant" && msg.toolCalls?.map((eff, i) => (
                <ToolCallDisplay
                  key={`${eff.tool}-${eff.id ?? i}`}
                  effect={eff}
                  msgId={msg.id}
                  onActionableRespond={async (actionableId, action, data) => {
                    try {
                      await respondToActionable(actionableId, action, data);
                    } catch { /* ignore */ }
                  }}
                  onActionableStatusChange={(mId, actionableId, status) => {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === mId
                          ? {
                              ...m,
                              toolCalls: m.toolCalls?.map((e) =>
                                e.id === actionableId && e.actionable
                                  ? { ...e, actionable: { ...e.actionable, status } }
                                  : e
                              ),
                            }
                          : m
                      )
                    );
                  }}
                />
              ))}
            </div>
          ))}
          {sending && streamingText === "" && streamingToolCall === null && <TypingIndicator />}
          {streamingToolCall && (
            <div className="flex items-end gap-2 mr-auto max-w-[80%]">
              <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                <span>Using {streamingToolCall}&hellip;</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t px-4 py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={systemContext ? "Describe changes to this routine..." : "Ask me anything about your plans..."}
              disabled={sending}
              rows={1}
              className={cn(
                "flex-1 resize-none rounded-xl border bg-background px-3.5 py-2.5 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "min-h-[40px] max-h-[160px] leading-relaxed"
              )}
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sending}
              className="h-10 w-10 rounded-xl shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/40 mt-1.5 px-1">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Memories View ────────────────────────────────────────────────────────────

function MemoriesView() {
  const [memories, setMemories] = useState<LifeMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [editorCategory, setEditorCategory] = useState("instruction");
  const [editorDirty, setEditorDirty] = useState(false);
  const [isNew, setIsNew] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoading(true);
    setError(null);
    try { setMemories(await listLifeMemories()); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadMemories(); }, [loadMemories]);

  const selectMemory = useCallback((m: LifeMemory) => {
    setSelectedId(m.id);
    setEditorContent(m.content);
    setEditorCategory(m.category);
    setEditorDirty(false);
    setIsNew(false);
  }, []);

  const startNew = useCallback(() => {
    setSelectedId(`new-${Date.now()}`);
    setEditorContent("");
    setEditorCategory("instruction");
    setEditorDirty(false);
    setIsNew(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!editorContent.trim()) return;
    setSaving(true);
    try {
      if (isNew) {
        const m = await createLifeMemory(editorContent.trim(), editorCategory);
        setMemories((prev) => [m, ...prev]);
        setSelectedId(m.id);
        setIsNew(false);
      } else if (selectedId) {
        const u = await updateLifeMemory(selectedId, editorContent.trim(), editorCategory);
        setMemories((prev) => prev.map((m) => (m.id === u.id ? u : m)));
      }
      setEditorDirty(false);
    } catch (e) { setError(String(e)); }
    finally { setSaving(false); }
  }, [isNew, selectedId, editorContent, editorCategory]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) { setSelectedId(null); setEditorContent(""); setEditorDirty(false); }
    } catch (e) { setError(String(e)); }
    finally { setConfirmDeleteId(null); }
  }, [selectedId]);

  const filtered = filterCategory === "all" ? memories : memories.filter((m) => m.category === filterCategory);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b shrink-0">
        <div className="flex items-center gap-1 flex-1 flex-wrap">
          <button onClick={() => setFilterCategory("all")} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === "all" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50")}>All</button>
          {MEMORY_CATEGORIES.map((cat) => (
            <button key={cat.value} onClick={() => setFilterCategory(cat.value)} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", filterCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-muted text-foreground") : "text-muted-foreground hover:bg-muted/50")}>{cat.label}</button>
          ))}
        </div>
        <button onClick={loadMemories} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Refresh">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <Button size="sm" variant="outline" className="gap-1 text-xs h-7" onClick={startNew}>
          <Plus className="h-3 w-3" /> Add
        </Button>
      </div>

      {/* Split: list + editor */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: compact list */}
        <div className={cn("flex flex-col overflow-hidden", selectedId || isNew ? "w-64 shrink-0 border-r" : "flex-1")}>
          {error && (
            <div className="flex items-center gap-1.5 mx-2 mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              <AlertCircle className="h-3 w-3 shrink-0" />
              <span className="truncate flex-1">{error}</span>
              <button onClick={() => setError(null)}><X className="h-2.5 w-2.5" /></button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-2 space-y-1">{[...Array(6)].map((_, i) => <div key={i} className="h-8 rounded bg-muted/50 animate-pulse" />)}</div>}
            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <Lightbulb className="h-8 w-8 text-muted-foreground/20" />
                <p className="text-xs text-muted-foreground">{filterCategory === "all" ? "No memories yet" : `No ${filterCategory} memories`}</p>
              </div>
            )}
            {!loading && filtered.map((memory) => (
              <button
                key={memory.id}
                onClick={() => selectMemory(memory)}
                className={cn(
                  "w-full text-left flex items-center gap-2 px-3 py-1.5 text-xs border-b border-border/20 hover:bg-accent/40 transition-colors group",
                  selectedId === memory.id && "bg-accent/60"
                )}
              >
                <span className={cn("shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase leading-none", CATEGORY_COLORS[memory.category] ?? "bg-muted text-muted-foreground")}>
                  {memory.category.slice(0, 4)}
                </span>
                <span className="flex-1 min-w-0 truncate text-foreground/80">{memory.content.split("\n")[0] || "Empty"}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(memory.id); }}
                  className="shrink-0 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))}
          </div>
        </div>

        {/* Right: editor */}
        {(selectedId || isNew) && (
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0">
              <div className="flex items-center gap-1 flex-1 flex-wrap">
                {MEMORY_CATEGORIES.map((cat) => (
                  <button key={cat.value} onClick={() => { setEditorCategory(cat.value); setEditorDirty(true); }} className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors", editorCategory === cat.value ? cn(CATEGORY_COLORS[cat.value] ?? "bg-primary text-primary-foreground", "ring-1 ring-primary/30") : "bg-muted/50 text-muted-foreground hover:bg-muted")}>{cat.label}</button>
                ))}
              </div>
              <Button size="sm" className="gap-1 text-xs h-6" onClick={handleSave} disabled={!editorContent.trim() || saving || (!editorDirty && !isNew)}>
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                {isNew ? "Create" : "Save"}
              </Button>
              <button onClick={() => { setSelectedId(null); setIsNew(false); setEditorDirty(false); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
              <textarea
                value={editorContent}
                onChange={(e) => { setEditorContent(e.target.value); setEditorDirty(true); }}
                placeholder="Write your memory in markdown..."
                className="w-full h-full resize-none bg-background px-4 py-3 text-sm font-mono leading-relaxed focus:outline-none placeholder:text-muted-foreground/40"
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); } }}
                autoFocus
              />
            </div>
            <div className="flex items-center gap-3 px-4 py-1 border-t text-[10px] text-muted-foreground/50 shrink-0">
              <span>{editorContent.length} chars</span>
              <span>{editorContent.split("\n").length} lines</span>
              {editorDirty && <span className="text-amber-500">unsaved</span>}
              {!editorDirty && !isNew && <span className="text-green-500">saved</span>}
              <span className="ml-auto">Cmd+S to save</span>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      <Dialog open={!!confirmDeleteId} onOpenChange={() => setConfirmDeleteId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Delete Memory</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Are you sure? This cannot be undone.</p>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button variant="destructive" size="sm" onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatSchedule(schedule: unknown): string {
  if (!schedule || typeof schedule !== "object") return "No schedule set";
  const s = schedule as Record<string, unknown>;
  const freq = s.frequency as string | undefined;
  const days = s.days as (number | string)[] | undefined;
  const time = s.time as string | undefined;
  const interval = s.interval as number | undefined;
  const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (freq === "daily") {
    return time ? `Every day at ${time}` : "Every day";
  }
  if (freq === "weekly" && days?.length) {
    const dayNames = days
      .map((d) => typeof d === "number" ? (DAY_NAMES[d] ?? String(d)) : String(d).charAt(0).toUpperCase() + String(d).slice(1, 3))
      .join(", ");
    return time ? `${dayNames} at ${time}` : dayNames;
  }
  if ((freq === "every_n_days" || freq === "custom") && interval) {
    return time ? `Every ${interval} days at ${time}` : `Every ${interval} days`;
  }
  return freq ?? "Custom schedule";
}

// ─── Actionables View ─────────────────────────────────────────────────────────

const ACTIONABLE_TYPE_COLORS: Record<string, string> = {
  confirm: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  choose: "bg-purple-500/15 text-purple-600 dark:text-purple-400",
  input: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  info: "bg-green-500/15 text-green-600 dark:text-green-400",
};

function ActionableCard({
  actionable,
  onRespond,
}: {
  actionable: LifeActionable;
  onRespond: (id: string, action: string, data?: unknown) => Promise<void>;
}) {
  const [textInput, setTextInput] = useState("");
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const isPending = actionable.status === "pending";
  const typeColor =
    ACTIONABLE_TYPE_COLORS[actionable.type] ?? "bg-muted text-muted-foreground";

  const isDueSoon =
    actionable.dueAt &&
    new Date(actionable.dueAt).getTime() - Date.now() < 24 * 60 * 60 * 1000;

  const handleAction = async (action: string, data?: unknown) => {
    setActing(true);
    try {
      await onRespond(actionable.id, action, data);
    } finally {
      setActing(false);
    }
  };

  return (
    <div
      className={cn(
        "rounded-lg border bg-card p-4 space-y-3 transition-colors",
        !isPending && "opacity-60"
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {actionable.title}
          </p>
          {actionable.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              {actionable.description}
            </p>
          )}
        </div>
        <span
          className={cn(
            "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize",
            typeColor
          )}
        >
          {actionable.type}
        </span>
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{relativeTime(actionable.createdAt)}</span>
        {actionable.dueAt && (
          <span
            className={cn(
              "flex items-center gap-1",
              isDueSoon && isPending && "text-amber-500"
            )}
          >
            <Clock className="h-3 w-3" />
            Due {relativeTime(actionable.dueAt)}
          </span>
        )}
        {!isPending && (
          <span className="flex items-center gap-1 ml-auto capitalize">
            {actionable.status === "confirmed" ? (
              <Check className="h-3 w-3 text-green-500" />
            ) : (
              <X className="h-3 w-3 text-muted-foreground" />
            )}
            {actionable.status}
          </span>
        )}
      </div>

      {/* Resolved response */}
      {!isPending && actionable.response != null && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
          Response: {typeof actionable.response === "string"
            ? actionable.response
            : JSON.stringify(actionable.response)}
        </div>
      )}

      {/* Action area — only for pending */}
      {isPending && (
        <div className="space-y-2">
          {actionable.type === "confirm" && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 text-xs gap-1.5"
                disabled={acting}
                onClick={() => handleAction("confirm")}
              >
                {acting ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Check className="h-3 w-3" />
                )}
                Confirm
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                disabled={acting}
                onClick={() => handleAction("snooze")}
              >
                <Clock className="h-3 w-3 mr-1" />
                Snooze
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground"
                disabled={acting}
                onClick={() => handleAction("dismiss")}
              >
                Dismiss
              </Button>
            </div>
          )}

          {actionable.type === "choose" && actionable.options && (
            <div className="space-y-2">
              <div className="space-y-1">
                {actionable.options.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedOption(opt.id)}
                    className={cn(
                      "w-full flex items-start gap-2 rounded-md border px-3 py-2 text-xs text-left transition-colors",
                      selectedOption === opt.id
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border hover:border-border/80 hover:bg-muted/30 text-muted-foreground"
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border",
                        selectedOption === opt.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground/40"
                      )}
                    />
                    <span>
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={acting || !selectedOption}
                  onClick={() =>
                    handleAction("choose", { optionId: selectedOption })
                  }
                >
                  {acting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Select
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={acting}
                  onClick={() => handleAction("dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {actionable.type === "input" && (
            <div className="space-y-2">
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Type your response…"
                className={cn(
                  "w-full rounded-md border bg-background px-3 py-2 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50",
                  "placeholder:text-muted-foreground/50"
                )}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && textInput.trim()) {
                    handleAction("input", { value: textInput.trim() });
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={acting || !textInput.trim()}
                  onClick={() =>
                    handleAction("input", { value: textInput.trim() })
                  }
                >
                  {acting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  Submit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  disabled={acting}
                  onClick={() => handleAction("dismiss")}
                >
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          {actionable.type === "info" && (
            <Button
              size="sm"
              className="h-7 text-xs gap-1.5"
              disabled={acting}
              onClick={() => handleAction("confirm")}
            >
              {acting ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Info className="h-3 w-3" />
              )}
              Got it
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function ActionablesView() {
  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "resolved">("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLifeActionables();
      setActionables(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRespond = useCallback(
    async (id: string, action: string, data?: unknown) => {
      await respondToActionable(id, action, data);
      // Refresh to get updated status
      const updated = await listLifeActionables();
      setActionables(updated);
    },
    []
  );

  const filtered = actionables.filter((a) => {
    if (filter === "pending") return a.status === "pending";
    if (filter === "resolved") return a.status !== "pending";
    return true;
  });

  const filterPills: { key: "all" | "pending" | "resolved"; label: string }[] =
    [
      { key: "all", label: "All" },
      { key: "pending", label: "Pending" },
      { key: "resolved", label: "Resolved" },
    ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {filterPills.map((p) => (
            <button
              key={p.key}
              onClick={() => setFilter(p.key)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                filter === p.key
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button
              onClick={() => { setError(null); load(); }}
              className="ml-auto text-xs underline"
            >
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-28 rounded-lg border bg-card animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && filtered.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <CheckSquare className="h-10 w-10 text-muted-foreground/30" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {filter === "pending"
                  ? "No pending actionables"
                  : filter === "resolved"
                  ? "No resolved actionables"
                  : "No actionables — you're all caught up!"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Items will appear here when your AI creates tasks for you
              </p>
            </div>
          </div>
        )}

        {!loading &&
          filtered.map((a) => (
            <ActionableCard key={a.id} actionable={a} onRespond={handleRespond} />
          ))}
      </div>
    </div>
  );
}

// ─── Routines View ────────────────────────────────────────────────────────────

const ROUTINE_TYPES = [
  { value: "call_loved_ones", label: "Call Loved Ones" },
  { value: "gym", label: "Gym" },
  { value: "reading", label: "Reading" },
  { value: "custom", label: "Custom" },
];

const ROUTINE_TYPE_COLORS: Record<string, string> = {
  call_loved_ones: "bg-pink-500/15 text-pink-600 dark:text-pink-400",
  gym: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  reading: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  custom: "bg-muted text-muted-foreground",
};

const DAYS_OF_WEEK = [
  { value: "monday", short: "Mon" },
  { value: "tuesday", short: "Tue" },
  { value: "wednesday", short: "Wed" },
  { value: "thursday", short: "Thu" },
  { value: "friday", short: "Fri" },
  { value: "saturday", short: "Sat" },
  { value: "sunday", short: "Sun" },
];

// ─── Type-specific Config Editors ──────────────────────────────────────────────

const inputCls = "w-full rounded-md border bg-background px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50";

function CallLovedOnesConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.contacts) ? c : { contacts: [] }; } catch { return { contacts: [] }; } })();
  const contacts: { name: string; frequency: string }[] = parsed.contacts ?? [];

  const update = (newContacts: { name: string; frequency: string }[]) => {
    onChange(JSON.stringify({ ...parsed, contacts: newContacts }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">People to call</p>
      {contacts.map((c, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={c.name}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], name: e.target.value }; update(n); }}
            placeholder="Name"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={c.frequency}
            onChange={(e) => { const n = [...contacts]; n[i] = { ...n[i], frequency: e.target.value }; update(n); }}
            className={cn(inputCls, "w-32")}
          >
            <option value="daily">Daily</option>
            <option value="every_other_day">Every other day</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>
          <button onClick={() => update(contacts.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...contacts, { name: "", frequency: "weekly" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add contact
      </button>
    </div>
  );
}

function GymConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.variations) ? c : { variations: [] }; } catch { return { variations: [] }; } })();
  const variations: { day: string; workout: string }[] = parsed.variations ?? [];

  const update = (newVars: { day: string; workout: string }[]) => {
    onChange(JSON.stringify({ ...parsed, variations: newVars }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Workout variations</p>
      {variations.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <select
            value={v.day}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], day: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            {DAYS_OF_WEEK.map((d) => <option key={d.value} value={d.value}>{d.short}</option>)}
          </select>
          <input
            type="text"
            value={v.workout}
            onChange={(e) => { const n = [...variations]; n[i] = { ...n[i], workout: e.target.value }; update(n); }}
            placeholder="e.g. Upper body, Cardio, Legs"
            className={cn(inputCls, "flex-1")}
          />
          <button onClick={() => update(variations.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...variations, { day: "monday", workout: "" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add variation
      </button>
    </div>
  );
}

function ReadingConfigEditor({ config, onChange }: { config: string; onChange: (c: string) => void }) {
  const parsed = (() => { try { const c = JSON.parse(config); return Array.isArray(c.books) ? c : { books: [] }; } catch { return { books: [] }; } })();
  const books: { title: string; status: string }[] = parsed.books ?? [];

  const update = (newBooks: { title: string; status: string }[]) => {
    onChange(JSON.stringify({ ...parsed, books: newBooks }, null, 2));
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide font-medium">Reading list</p>
      {books.map((b, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            value={b.title}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], title: e.target.value }; update(n); }}
            placeholder="Book title"
            className={cn(inputCls, "flex-1")}
          />
          <select
            value={b.status}
            onChange={(e) => { const n = [...books]; n[i] = { ...n[i], status: e.target.value }; update(n); }}
            className={cn(inputCls, "w-28")}
          >
            <option value="queued">Queued</option>
            <option value="reading">Reading</option>
            <option value="completed">Completed</option>
          </select>
          <button onClick={() => update(books.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        onClick={() => update([...books, { title: "", status: "queued" }])}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <Plus className="h-3 w-3" /> Add book
      </button>
    </div>
  );
}

// ─── Routine Dialog ───────────────────────────────────────────────────────────

interface RoutineFormState {
  name: string;
  type: string;
  description: string;
  frequency: string;
  interval: string;
  days: string[];
  time: string;
  config: string; // JSON string
}

function RoutineDialog({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial?: LifeRoutine | null;
  onSave: (data: Partial<LifeRoutine>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<RoutineFormState>(() => {
    if (!initial) {
      return {
        name: "",
        type: "custom",
        description: "",
        frequency: "weekly",
        interval: "1",
        days: [],
        time: "09:00",
        config: "{}",
      };
    }
    const s = (initial.schedule as Record<string, unknown>) ?? {};
    return {
      name: initial.name,
      type: initial.type,
      description: initial.description,
      frequency: (s.frequency as string) ?? "weekly",
      interval: String(s.interval ?? "1"),
      days: (s.days as string[]) ?? [],
      time: (s.time as string) ?? "09:00",
      config: JSON.stringify(initial.config ?? {}, null, 2),
    };
  });

  const setField = <K extends keyof RoutineFormState>(
    key: K,
    value: RoutineFormState[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (day: string) => {
    setForm((prev) => ({
      ...prev,
      days: prev.days.includes(day)
        ? prev.days.filter((d) => d !== day)
        : [...prev.days, day],
    }));
  };

  const handleSave = () => {
    let parsedConfig: unknown = {};
    try {
      parsedConfig = JSON.parse(form.config || "{}");
    } catch {
      parsedConfig = {};
    }

    const schedule: Record<string, unknown> = {
      frequency: form.frequency,
    };
    if (form.frequency === "weekly") schedule.days = form.days;
    if (form.frequency === "custom") schedule.interval = parseInt(form.interval) || 1;
    if (form.time) schedule.time = form.time;

    onSave({
      name: form.name.trim(),
      type: form.type,
      description: form.description.trim(),
      schedule,
      config: parsedConfig,
    });
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Routine" : "New Routine"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Name
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              placeholder="Routine name…"
              className={cn(
                "w-full rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>

          {/* Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Type
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ROUTINE_TYPES.map((rt) => (
                <button
                  key={rt.value}
                  onClick={() => setField("type", rt.value)}
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    form.type === rt.value
                      ? cn(
                          ROUTINE_TYPE_COLORS[rt.value] ??
                            "bg-muted text-foreground",
                          "ring-2 ring-primary/40"
                        )
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  )}
                >
                  {rt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              placeholder="What is this routine about?"
              rows={2}
              className={cn(
                "w-full resize-none rounded-md border bg-background px-3 py-2 text-sm",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                "placeholder:text-muted-foreground/50"
              )}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Schedule
            </label>

            {/* Frequency selector */}
            <div className="flex gap-1.5">
              {[
                { value: "daily", label: "Daily" },
                { value: "weekly", label: "Weekly" },
                { value: "custom", label: "Every N days" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setField("frequency", opt.value)}
                  className={cn(
                    "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors border",
                    form.frequency === opt.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-border/80 hover:bg-muted/30"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Custom interval */}
            {form.frequency === "custom" && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground text-xs">Every</span>
                <input
                  type="number"
                  min="1"
                  value={form.interval}
                  onChange={(e) => setField("interval", e.target.value)}
                  className={cn(
                    "w-16 rounded-md border bg-background px-2 py-1.5 text-sm",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50"
                  )}
                />
                <span className="text-muted-foreground text-xs">days</span>
              </div>
            )}

            {/* Day selectors (weekly) */}
            {form.frequency === "weekly" && (
              <div className="flex flex-wrap gap-1">
                {DAYS_OF_WEEK.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => toggleDay(d.value)}
                    className={cn(
                      "h-7 w-10 rounded-md text-xs font-medium transition-colors border",
                      form.days.includes(d.value)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-border/80 hover:bg-muted/30"
                    )}
                  >
                    {d.short}
                  </button>
                ))}
              </div>
            )}

            {/* Time */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">Time</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setField("time", e.target.value)}
                className={cn(
                  "rounded-md border bg-background px-2 py-1.5 text-sm",
                  "focus:outline-none focus:ring-2 focus:ring-primary/50"
                )}
              />
            </div>
          </div>

          {/* Config — type-specific editors */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Config
            </label>

            {form.type === "call_loved_ones" && (
              <CallLovedOnesConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {form.type === "gym" && (
              <GymConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {form.type === "reading" && (
              <ReadingConfigEditor
                config={form.config}
                onChange={(c) => setField("config", c)}
              />
            )}

            {!["call_loved_ones", "gym", "reading"].includes(form.type) && (
              <div className="space-y-1.5">
                <textarea
                  value={form.config}
                  onChange={(e) => setField("config", e.target.value)}
                  placeholder="{}"
                  rows={3}
                  spellCheck={false}
                  className={cn(
                    "w-full resize-y rounded-md border bg-background px-3 py-2 text-xs font-mono",
                    "focus:outline-none focus:ring-2 focus:ring-primary/50",
                    "placeholder:text-muted-foreground/50"
                  )}
                />
                <p className="text-[10px] text-muted-foreground/60">
                  Custom config as JSON. Leave {"{ }"} if unsure.
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!form.name.trim() || saving}
          >
            {saving && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            {initial ? "Save Changes" : "Create Routine"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RoutineCard({
  routine,
  onDelete,
  onToggleActive,
  onOpen,
}: {
  routine: LifeRoutine;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, active: boolean) => void;
  onOpen: (id: string) => void;
}) {
  const typeColor =
    ROUTINE_TYPE_COLORS[routine.type] ?? "bg-muted text-muted-foreground";
  const typeLabel =
    ROUTINE_TYPES.find((t) => t.value === routine.type)?.label ?? routine.type;

  const routineIcons: Record<string, React.ReactNode> = {
    gym: <Dumbbell className="h-4 w-4" />,
    reading: <BookOpen className="h-4 w-4" />,
    call_loved_ones: <Phone className="h-4 w-4" />,
    morning_routine: <Sun className="h-4 w-4" />,
    evening_routine: <Sun className="h-4 w-4" />,
  };
  const icon = routineIcons[routine.type] ?? <Repeat className="h-4 w-4" />;

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer",
        "hover:bg-muted/50",
        !routine.active && "opacity-50"
      )}
      onClick={() => onOpen(routine.id)}
    >
      {/* Icon */}
      <div className={cn(
        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
        typeColor
      )}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground truncate">{routine.name}</p>
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          {formatSchedule(routine.schedule)}
          {routine.description ? ` · ${routine.description}` : ""}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* Toggle switch */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActive(routine.id, !routine.active); }}
          className="relative shrink-0"
          title={routine.active ? "Pause routine" : "Resume routine"}
        >
          <div className={cn(
            "h-5 w-9 rounded-full transition-colors",
            routine.active ? "bg-primary" : "bg-muted-foreground/20"
          )} />
          <div className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            routine.active ? "translate-x-[18px]" : "translate-x-0.5"
          )} />
        </button>

        {/* Delete — show on hover */}
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(routine.id); }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

function RoutinesView({ onOpenRoutine }: { onOpenRoutine?: (id: string, name: string) => void }) {
  const [routines, setRoutines] = useState<LifeRoutine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [editRoutine, setEditRoutine] = useState<LifeRoutine | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listLifeRoutines();
      setRoutines(data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(
    async (data: Partial<LifeRoutine>) => {
      setSaving(true);
      try {
        if (editRoutine) {
          const updated = await updateLifeRoutine(editRoutine.id, data);
          setRoutines((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r))
          );
        } else {
          const created = await createLifeRoutine(data);
          setRoutines((prev) => [created, ...prev]);
        }
        setShowDialog(false);
        setEditRoutine(null);
      } catch (e) {
        setError(String(e));
      } finally {
        setSaving(false);
      }
    },
    [editRoutine]
  );

  const handleToggleActive = useCallback(
    async (id: string, active: boolean) => {
      try {
        const updated = await updateLifeRoutine(id, { active });
        setRoutines((prev) =>
          prev.map((r) => (r.id === updated.id ? updated : r))
        );
      } catch (e) {
        setError(String(e));
      }
    },
    []
  );

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteLifeRoutine(id);
      setRoutines((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(String(e));
    } finally {
      setConfirmDeleteId(null);
    }
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          {routines.length > 0 &&
            `${routines.filter((r) => r.active).length} active`}
        </span>
        <button
          onClick={load}
          className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
          title="Refresh"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-7"
          onClick={() => {
            setEditRoutine(null);
            setShowDialog(true);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          New Routine
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="flex items-center gap-2 mx-4 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={() => { setError(null); load(); }} className="ml-auto text-xs underline">Retry</button>
          </div>
        )}

        {loading && (
          <div className="px-3 py-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && routines.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Repeat className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">No routines yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Create one to build consistent habits</p>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs mt-1" onClick={() => { setEditRoutine(null); setShowDialog(true); }}>
              <Plus className="h-3.5 w-3.5" />
              New Routine
            </Button>
          </div>
        )}

        {!loading && routines.length > 0 && (
          <div className="px-2 py-1.5">
            {routines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                onDelete={setConfirmDeleteId}
                onToggleActive={handleToggleActive}
                onOpen={(id) => onOpenRoutine?.(id, routine.name)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit dialog */}
      {showDialog && (
        <RoutineDialog
          initial={editRoutine}
          onSave={handleSave}
          onCancel={() => {
            setShowDialog(false);
            setEditRoutine(null);
          }}
          saving={saving}
        />
      )}

      {/* Delete confirmation */}
      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={() => setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Routine</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this routine? This cannot be undone.
          </p>
          <DialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDeleteId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Routine Detail View ──────────────────────────────────────────────────────

function RoutineDetailView({ routineId }: { routineId: string }) {
  const [routine, setRoutine] = useState<LifeRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleStr, setScheduleStr] = useState("{}");
  const [configStr, setConfigStr] = useState("{}");

  // Resizable panel
  const [panelWidth, setPanelWidth] = useState(420);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    draggingRef.current = true;
    startXRef.current = e.clientX;
    startWidthRef.current = panelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    const handleMouseMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const delta = startXRef.current - ev.clientX;
      setPanelWidth(Math.max(300, Math.min(700, startWidthRef.current + delta)));
    };
    const handleMouseUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [panelWidth]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getLifeRoutine(routineId);
      setRoutine(r);
      setName(r.name);
      setDescription(r.description);
      setScheduleStr(JSON.stringify(r.schedule, null, 2));
      setConfigStr(JSON.stringify(r.config, null, 2));
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [routineId]);

  useEffect(() => { load(); }, [load]);

  // Silent refresh — updates data without showing loading spinner
  const refresh = useCallback(async () => {
    try {
      const r = await getLifeRoutine(routineId);
      setRoutine(r);
      if (!editing) {
        setName(r.name);
        setDescription(r.description);
        setScheduleStr(JSON.stringify(r.schedule, null, 2));
        setConfigStr(JSON.stringify(r.config, null, 2));
      }
    } catch { /* silent */ }
  }, [routineId, editing]);

  const handleSave = async () => {
    if (!routine) return;
    setSaving(true);
    try {
      let schedule: unknown = {};
      let config: unknown = {};
      try { schedule = JSON.parse(scheduleStr); } catch { /* keep default */ }
      try { config = JSON.parse(configStr); } catch { /* keep default */ }
      const updated = await updateLifeRoutine(routine.id, {
        name,
        description,
        schedule,
        config,
      } as Partial<LifeRoutine>);
      setRoutine(updated);
      setEditing(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error ?? "Routine not found"}</p>
        <Button variant="ghost" size="sm" onClick={load}>Retry</Button>
      </div>
    );
  }

  const typeLabel = ROUTINE_TYPES.find((t) => t.value === routine.type)?.label ?? routine.type;
  const typeColor = ROUTINE_TYPE_COLORS[routine.type] ?? "bg-muted text-muted-foreground";

  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      {/* Left: Chat scoped to this routine */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <ChatView
          persistedConvId={null}
          onConvIdChange={() => {}}
          systemContext={`The user is viewing and editing the routine "${routine.name}" (id: ${routine.id}, type: ${routine.type}). Help them modify this routine — update its schedule, config, description, etc. Use update_routine with routine_id="${routine.id}" to make changes. Current routine data:\n${JSON.stringify(routine, null, 2)}`}
          routineId={routine.id}
          hideConversations
          onToolEffect={(tool) => {
            if (tool === "update_routine" || tool === "create_routine" || tool === "delete_routine") {
              refresh();
            }
          }}
        />
      </div>

      {/* Resize handle */}
      <div
        className="w-1.5 shrink-0 cursor-col-resize bg-transparent hover:bg-primary/10 active:bg-primary/20 transition-colors flex items-center justify-center group"
        onMouseDown={handleMouseDown}
      >
        <GripVertical className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60" />
      </div>

      {/* Right: Routine details */}
      <div style={{ width: panelWidth }} className="shrink-0 border-l overflow-y-auto">
        <div className="px-5 py-5 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1 min-w-0">
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="text-base font-semibold bg-transparent border-b border-primary/50 focus:outline-none focus:border-primary w-full"
                />
              ) : (
                <h2 className="text-base font-semibold text-foreground">{routine.name}</h2>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium", typeColor)}>
                  {typeLabel}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {routine.active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {editing ? (
                <>
                  <Button size="sm" className="h-7 text-xs" onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => {
                    setEditing(false);
                    setName(routine.name);
                    setDescription(routine.description);
                    setScheduleStr(JSON.stringify(routine.schedule, null, 2));
                    setConfigStr(JSON.stringify(routine.config, null, 2));
                  }}>
                    Cancel
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setEditing(true)}>
                  <Edit2 className="h-3 w-3" />
                  Edit
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Description</label>
            {editing ? (
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <p className="text-sm text-foreground">
                {routine.description || <span className="text-muted-foreground/50 italic">No description</span>}
              </p>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Schedule</label>
            {editing ? (
              <textarea
                value={scheduleStr}
                onChange={(e) => setScheduleStr(e.target.value)}
                rows={4}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <div className="rounded-md border bg-muted/30 px-3 py-2">
                <p className="text-sm">{formatSchedule(routine.schedule)}</p>
                <pre className="text-[11px] font-mono text-muted-foreground mt-1 whitespace-pre-wrap">
                  {JSON.stringify(routine.schedule, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Config */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Configuration</label>
            {editing ? (
              <textarea
                value={configStr}
                onChange={(e) => setConfigStr(e.target.value)}
                rows={8}
                className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
              />
            ) : (
              <pre className="rounded-md border bg-muted/30 px-3 py-2 text-[11px] font-mono text-foreground whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(routine.config, null, 2)}
              </pre>
            )}
          </div>

          {/* Meta */}
          <div className="border-t pt-3 space-y-1 text-[11px] text-muted-foreground/60">
            <p>Last triggered: {routine.lastTriggered ? relativeTime(routine.lastTriggered) : "Never"}</p>
            <p>Updated: {relativeTime(routine.updatedAt)}</p>
            <p>Created: {relativeTime(routine.createdAt)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Channels View ────────────────────────────────────────────────────────────

function TelegramChannelCard({
  link,
  pending,
  onConnect,
  onCancel,
  onDisconnect,
}: {
  link: ChannelLink | undefined;
  pending: InitChannelLinkResponse | null;
  onConnect: () => void;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const command = pending ? `/start ${pending.verifyCode}` : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      await onConnect();
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-md bg-sky-500/10 text-sky-500">
          <MessageCircle className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Telegram</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Chat with your AI assistant via Telegram
          </p>
        </div>
      </div>

      {link ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
            <span className="text-xs text-muted-foreground">{link.displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Waiting for verification</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Send this message to{" "}
              <a
                href="https://t.me/1ttbot"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-500 hover:underline font-medium"
              >
                @1ttbot
              </a>{" "}
              on Telegram:
            </p>
            <div className="flex items-center gap-2 rounded-md bg-muted/60 border px-3 py-2 font-mono text-xs">
              <span className="flex-1 select-all">{command}</span>
              <button
                onClick={handleCopy}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                title="Copy command"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground/60 mt-1.5">
              Code expires in 15 minutes
            </p>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={handleConnect}
          disabled={connecting}
        >
          {connecting ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
          ) : (
            <MessageCircle className="h-3 w-3 mr-1.5" />
          )}
          Connect Telegram
        </Button>
      )}
    </div>
  );
}

function EmailChannelCard({
  link,
  pending,
  onConnect,
  onVerify,
  onCancel,
  onDisconnect,
}: {
  link: ChannelLink | undefined;
  pending: InitChannelLinkResponse | null;
  onConnect: (email: string) => void;
  onVerify: (code: string) => void;
  onCancel: () => void;
  onDisconnect: () => void;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleConnect = async () => {
    if (!email.trim()) return;
    setConnecting(true);
    try {
      await onConnect(email.trim());
    } finally {
      setConnecting(false);
    }
  };

  const handleVerify = async () => {
    if (!code.trim()) return;
    setVerifying(true);
    try {
      await onVerify(code.trim());
    } finally {
      setVerifying(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="rounded-lg border p-5 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 p-2 rounded-md bg-violet-500/10 text-violet-500">
          <Mail className="h-4 w-4" />
        </div>
        <div>
          <p className="text-sm font-semibold">Email</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Forward emails to your AI assistant
          </p>
        </div>
      </div>

      {link ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 shrink-0" />
            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Connected</span>
            <span className="text-xs text-muted-foreground">{link.displayName}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={handleDisconnect}
            disabled={disconnecting}
          >
            {disconnecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Disconnect"}
          </Button>
        </div>
      ) : pending ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500 shrink-0 animate-pulse" />
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Verification sent</span>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-2">
              Enter the verification code sent to{" "}
              <span className="font-medium text-foreground">{pending.displayName}</span>:
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                placeholder="Verification code"
                className="flex-1 h-7 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring font-mono"
              />
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={handleVerify}
                disabled={verifying || !code.trim()}
              >
                {verifying ? <Loader2 className="h-3 w-3 animate-spin" /> : "Verify"}
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={onCancel}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            placeholder="your@email.com"
            className="flex-1 h-7 rounded-md border bg-background px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs shrink-0"
            onClick={handleConnect}
            disabled={connecting || !email.trim()}
          >
            {connecting ? <Loader2 className="h-3 w-3 animate-spin" /> : "Connect"}
          </Button>
        </div>
      )}
    </div>
  );
}

function ChannelsView() {
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [telegramPending, setTelegramPending] = useState<InitChannelLinkResponse | null>(null);
  const [emailPending, setEmailPending] = useState<InitChannelLinkResponse | null>(null);

  const telegramLink = links.find((l) => l.channel === "telegram" && l.verified);
  const emailLink = links.find((l) => l.channel === "email" && l.verified);

  const loadLinks = useCallback(async () => {
    try {
      const data = await listChannelLinks();
      setLinks(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLinks();
  }, [loadLinks]);

  const handleConnectTelegram = async () => {
    const res = await initChannelLink("telegram");
    setTelegramPending(res);
  };

  const handleCancelTelegram = () => setTelegramPending(null);

  const handleDisconnectTelegram = async () => {
    if (!telegramLink) return;
    await deleteChannelLink(telegramLink.id);
    await loadLinks();
  };

  const handleConnectEmail = async (emailAddr: string) => {
    const res = await initChannelLink("email", emailAddr);
    setEmailPending(res);
  };

  const handleVerifyEmail = async (code: string) => {
    if (!emailPending) return;
    await verifyChannelLink(emailPending.id, code);
    setEmailPending(null);
    await loadLinks();
  };

  const handleCancelEmail = () => setEmailPending(null);

  const handleDisconnectEmail = async () => {
    if (!emailLink) return;
    await deleteChannelLink(emailLink.id);
    await loadLinks();
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl px-6 py-6 space-y-6">
        <div>
          <h2 className="text-base font-semibold">Channels</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external messaging channels to chat with your AI assistant
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-4">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-lg border p-5 space-y-3 animate-pulse">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-md bg-muted" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 rounded bg-muted" />
                    <div className="h-2.5 w-40 rounded bg-muted" />
                  </div>
                </div>
                <div className="h-7 w-36 rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <TelegramChannelCard
              link={telegramLink}
              pending={telegramPending}
              onConnect={handleConnectTelegram}
              onCancel={handleCancelTelegram}
              onDisconnect={handleDisconnectTelegram}
            />
            <EmailChannelCard
              link={emailLink}
              pending={emailPending}
              onConnect={handleConnectEmail}
              onVerify={handleVerifyEmail}
              onCancel={handleCancelEmail}
              onDisconnect={handleDisconnectEmail}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function formatEventTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatDayHeader(dateStr: string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  // dateStr may be a date-only string like "2025-03-22" or full ISO
  const d = new Date(dateStr.length === 10 ? dateStr + "T00:00:00" : dateStr);
  d.setHours(0, 0, 0, 0);

  const dayLabel = d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });

  if (d.getTime() === today.getTime()) return `Today, ${dayLabel}`;
  if (d.getTime() === tomorrow.getTime()) return `Tomorrow, ${dayLabel}`;
  return dayLabel;
}

function groupEventsByDay(events: GCalEvent[]): { dateKey: string; events: GCalEvent[] }[] {
  const map = new Map<string, GCalEvent[]>();
  for (const ev of events) {
    const key = ev.allDay ? ev.start : ev.start.slice(0, 10);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(ev);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, evs]) => ({ dateKey, events: evs }));
}

function CalendarView() {
  const [status, setStatus] = useState<GCalStatus | null>(null);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const s = await getGCalStatus();
      setStatus(s);
      if (s.connected) {
        const evs = await listGCalEvents(7);
        setEvents(evs);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load calendar status");
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle OAuth callback code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      setConnecting(true);
      exchangeGCalCode(code)
        .then(() => {
          window.history.replaceState(null, "", window.location.pathname);
          return loadStatus();
        })
        .catch((e) => {
          setError(e instanceof Error ? e.message : "OAuth exchange failed");
        })
        .finally(() => setConnecting(false));
    } else {
      loadStatus();
    }
  }, [loadStatus]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const { url } = await getGCalAuthUrl();
      window.open(url, "_self");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get auth URL");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    setError(null);
    try {
      await disconnectGCal();
      setStatus({ connected: false });
      setEvents([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading || connecting) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Not connected state
  if (!status?.connected) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-5 px-8 text-center">
        <div className="rounded-full bg-muted p-4">
          <CalendarDays className="h-8 w-8 text-muted-foreground/60" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-semibold">Connect Google Calendar</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            View and manage your events directly from the Life Tool
          </p>
        </div>
        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive max-w-sm">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}
        <Button size="sm" onClick={handleConnect} disabled={connecting}>
          {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />}
          Connect Google Calendar
        </Button>
      </div>
    );
  }

  // Connected state
  const grouped = groupEventsByDay(events);

  // Build a list of the next 7 days to show even empty ones
  const days7: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days7.push(d.toISOString().slice(0, 10));
  }

  // Merge grouped events with the 7-day skeleton
  const eventsMap = new Map(grouped.map((g) => [g.dateKey, g.events]));
  const displayDays = days7.map((dateKey) => ({
    dateKey,
    events: eventsMap.get(dateKey) ?? [],
  }));

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl px-6 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Calendar</h2>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
              <span className="text-xs text-muted-foreground">{status.email}</span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="text-xs h-7 px-2.5 text-muted-foreground hover:text-foreground shrink-0"
          >
            {disconnecting ? (
              <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : null}
            Disconnect
          </Button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
          </div>
        )}

        {/* Day groups */}
        <div className="space-y-4">
          {displayDays.map(({ dateKey, events: dayEvents }) => (
            <div key={dateKey}>
              {/* Day header */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {formatDayHeader(dateKey)}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {dayEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground/50 px-3 py-1.5">No events</p>
              ) : (
                <div className="space-y-0.5">
                  {dayEvents.map((ev) => (
                    <a
                      key={ev.id}
                      href={ev.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-3 py-2 px-3 rounded-lg hover:bg-muted/50 cursor-pointer group transition-colors"
                    >
                      {/* Time column */}
                      <span className="text-xs text-muted-foreground font-mono w-24 shrink-0 pt-px">
                        {ev.allDay
                          ? "All day"
                          : `${formatEventTime(ev.start)} – ${formatEventTime(ev.end)}`}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-foreground truncate leading-snug">
                            {ev.summary || "(No title)"}
                          </span>
                          <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/0 group-hover:text-muted-foreground/50 transition-colors shrink-0" />
                        </div>
                        {ev.location && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <MapPin className="h-2.5 w-2.5 text-muted-foreground/50 shrink-0" />
                            <span className="text-xs text-muted-foreground truncate">{ev.location}</span>
                          </div>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Placeholder View ─────────────────────────────────────────────────────────

function PlaceholderView({
  tab,
}: {
  tab: LifeTabType;
}) {
  const config: Record<
    LifeTabType,
    { icon: React.ReactNode; title: string; description: string }
  > = {
    today: {
      icon: <Sun className="h-10 w-10 text-muted-foreground/30" />,
      title: "Today's Overview",
      description:
        "Your daily summary — tasks, routines, and schedule at a glance.",
    },
    actionables: {
      icon: <CheckSquare className="h-10 w-10 text-muted-foreground/30" />,
      title: "Actionables",
      description:
        "Track tasks and action items captured from your conversations.",
    },
    routines: {
      icon: <Repeat className="h-10 w-10 text-muted-foreground/30" />,
      title: "Routines",
      description:
        "Build and track recurring habits and daily routines.",
    },
    calendar: {
      icon: <CalendarDays className="h-10 w-10 text-muted-foreground/30" />,
      title: "Calendar",
      description:
        "Connect your calendar to sync events and schedules with your AI.",
    },
    channels: {
      icon: <Radio className="h-10 w-10 text-muted-foreground/30" />,
      title: "Channels",
      description:
        "Connect messaging channels like WhatsApp or Telegram for notifications.",
    },
    "routine-detail": {
      icon: <Repeat className="h-10 w-10 text-muted-foreground/30" />,
      title: "Routine",
      description: "",
    },
    // These tabs are implemented and won't reach PlaceholderView
    chat: {
      icon: <MessageSquare className="h-10 w-10 text-muted-foreground/30" />,
      title: "Chat",
      description: "",
    },
    memories: {
      icon: <Lightbulb className="h-10 w-10 text-muted-foreground/30" />,
      title: "Memories",
      description: "",
    },
  };

  const { icon, title, description } = config[tab];

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8">
      {icon}
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs">
          {description}
        </p>
      </div>
      <span className="rounded-full bg-muted px-3 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        Coming soon
      </span>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function SettingsPanel({ onClose }: { onClose: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Life Tool Settings</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Settings and profile configuration coming soon.
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Life Tool (main export) ──────────────────────────────────────────────────

// ─── Tab Bar ─────────────────────────────────────────────────────────────────

function LifeTabBar({
  tabs,
  activeTabId,
  onSwitch,
  onClose,
  onNewChat,
}: {
  tabs: LifeTab[];
  activeTabId: string | null;
  onSwitch: (id: string) => void;
  onClose: (id: string) => void;
  onNewChat: () => void;
}) {
  return (
    <div className="flex items-end border-b bg-muted/10 overflow-x-auto shrink-0 min-h-[36px]">
      <div className="flex items-end min-w-0">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          const label = tab.type === "chat"
            ? (tab.title ?? `Chat #${tab.chatNum ?? ""}`)
            : (tab.title ?? TAB_LABELS[tab.type]);
          return (
            <div
              key={tab.id}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 text-xs cursor-pointer select-none",
                "border-r border-border/50 shrink-0 max-w-[180px] group transition-colors",
                isActive
                  ? "bg-background border-b-2 border-b-primary text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
              onClick={() => onSwitch(tab.id)}
            >
              {TAB_ICONS[tab.type]}
              <span className="truncate font-medium">{label}</span>
              <button
                className={cn(
                  "shrink-0 rounded hover:bg-muted transition-colors p-0.5 -mr-0.5",
                  isActive
                    ? "opacity-60 hover:opacity-100"
                    : "opacity-0 group-hover:opacity-60 hover:!opacity-100"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                aria-label={`Close ${label}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          );
        })}
      </div>
      <button
        className="flex items-center justify-center h-8 w-8 shrink-0 ml-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/40 rounded-sm transition-colors"
        onClick={onNewChat}
        aria-label="New chat"
        title="New Chat"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LifeTool() {
  const pathname = usePathname();
  const router = useRouter();
  const stateSync = useSyncedState<LifePersistedState>("1tt:life-state", DEFAULT_LIFE_STATE);
  const lifeState = stateSync.data;
  const setLifeState = stateSync.setData;
  const chatCounterRef = useRef(0);
  const [hydrated, setHydrated] = useState(false);

  // Wait for synced state to hydrate from localStorage before rendering content
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Enable cloud sync by default on first use
  useEffect(() => {
    if (stateSync.isLoggedIn && stateSync.syncMode === "local") {
      const hasBeenSet = localStorage.getItem("sync-mode:1tt:life-state");
      if (!hasBeenSet) {
        stateSync.setSyncMode("cloud");
      }
    }
  }, [stateSync.isLoggedIn, stateSync.syncMode, stateSync.setSyncMode]);

  // Derive next chat number from existing tabs
  useEffect(() => {
    const chatNums = lifeState.tabs
      .filter((t) => t.type === "chat")
      .map((t) => t.chatNum ?? 0);
    chatCounterRef.current = chatNums.length > 0 ? Math.max(...chatNums) : 0;
  }, [lifeState.tabs]);

  const tabs = lifeState.tabs;
  const activeTabId = lifeState.activeTabId;
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Update URL when active tab changes
  const updateUrl = useCallback((tab: LifeTab | null) => {
    if (!tab) return;
    const url = tabToUrl(tab);
    if (pathname !== url) {
      window.history.replaceState(null, "", url);
    }
  }, [pathname]);

  // On mount: resolve initial tab from URL
  const initializedFromUrl = useRef(false);
  const urlSyncReady = useRef(false);
  useEffect(() => {
    if (initializedFromUrl.current) return;
    initializedFromUrl.current = true;

    const parsed = urlToTab(pathname);
    if (!parsed) return;

    if (parsed.type === "chat" && parsed.convId) {
      // URL has a specific conversation — open/find that chat tab
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.type === "chat" && t.convId === parsed.convId);
        if (existing) return { ...prev, activeTabId: existing.id };
        const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
        const newTab: LifeTab = { id: `tab:chat:${parsed.convId}`, type: "chat", convId: parsed.convId, chatNum: num };
        return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
      });
    } else if (parsed.type === "routine-detail" && parsed.routineId) {
      const id = `tab:routine:${parsed.routineId}`;
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.id === id);
        return {
          ...prev,
          tabs: existing ? prev.tabs : [...prev.tabs, { id, type: "routine-detail", routineId: parsed.routineId, title: "Routine" }],
          activeTabId: id,
        };
      });
    } else if (parsed.type !== "chat") {
      // Non-chat tab from URL
      const id = `tab:${parsed.type}`;
      setLifeState((prev) => {
        const existing = prev.tabs.find((t) => t.id === id);
        return {
          ...prev,
          tabs: existing ? prev.tabs : [...prev.tabs, { id, type: parsed.type }],
          activeTabId: id,
        };
      });
    }
    // If just /tools/life with no specific path, use the persisted active tab

    // Allow URL sync after a tick so the URL-driven state takes priority over persisted state
    requestAnimationFrame(() => { urlSyncReady.current = true; });
  }, [pathname, setLifeState]);

  // Sync URL when active tab changes (only after URL init has settled)
  const activeTab = tabs.find((t) => t.id === activeTabId) ?? null;
  useEffect(() => {
    if (urlSyncReady.current) updateUrl(activeTab);
  }, [activeTab, updateUrl]);


  const switchTab = useCallback((id: string) => {
    setLifeState((prev) => ({ ...prev, activeTabId: id }));
  }, [setLifeState]);

  const openTab = useCallback((type: LifeTabType) => {
    if (type === "chat") {
      // "Chat" in sidebar opens a new chat or focuses the first chat tab
      setLifeState((prev) => {
        const firstChat = prev.tabs.find((t) => t.type === "chat");
        if (firstChat) return { ...prev, activeTabId: firstChat.id };
        const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
        const newTab: LifeTab = { id: `tab:chat:new-${num}`, type: "chat", chatNum: num };
        return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
      });
      return;
    }
    const id = `tab:${type}`;
    setLifeState((prev) => {
      const existing = prev.tabs.find((t) => t.id === id);
      return {
        ...prev,
        tabs: existing ? prev.tabs : [...prev.tabs, { id, type }],
        activeTabId: id,
      };
    });
  }, [setLifeState]);

  const openNewChat = useCallback(() => {
    setLifeState((prev) => {
      const num = (prev.tabs.filter((t) => t.type === "chat").map((t) => t.chatNum ?? 0).reduce((a, b) => Math.max(a, b), 0)) + 1;
      const newTab: LifeTab = { id: `tab:chat:new-${num}`, type: "chat", chatNum: num };
      return { ...prev, tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
    });
  }, [setLifeState]);

  const openRoutineDetail = useCallback((routineId: string, name: string) => {
    const id = `tab:routine:${routineId}`;
    setLifeState((prev) => {
      const existing = prev.tabs.find((t) => t.id === id);
      return {
        ...prev,
        tabs: existing ? prev.tabs : [...prev.tabs, { id, type: "routine-detail" as LifeTabType, routineId, title: name }],
        activeTabId: id,
      };
    });
  }, [setLifeState]);

  const closeTab = useCallback((id: string) => {
    setLifeState((prev) => {
      const idx = prev.tabs.findIndex((t) => t.id === id);
      const next = prev.tabs.filter((t) => t.id !== id);
      const newActive = prev.activeTabId === id
        ? (next[Math.min(idx, next.length - 1)]?.id ?? null)
        : prev.activeTabId;
      return { ...prev, tabs: next, activeTabId: newActive };
    });
  }, [setLifeState]);

  // When a chat tab gets a conversation ID, update the tab's convId and URL
  const onChatConvIdChange = useCallback((tabId: string, convId: string | null) => {
    setLifeState((prev) => {
      const newTabs = prev.tabs.map((t) =>
        t.id === tabId && t.type === "chat"
          ? { ...t, convId: convId ?? undefined, id: convId ? `tab:chat:${convId}` : t.id }
          : t
      );
      const newActiveTabId = prev.activeTabId === tabId && convId
        ? `tab:chat:${convId}`
        : prev.activeTabId;
      return { ...prev, tabs: newTabs, activeTabId: newActiveTabId };
    });
    if (convId) {
      window.history.replaceState(null, "", `${LIFE_BASE}/c/${convId}`);
    }
  }, [setLifeState]);

  if (!hydrated) {
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar skeleton */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Life Tool</span>
          </div>
        </div>
        {/* Body skeleton */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Sidebar skeleton */}
          <aside className="w-52 shrink-0 border-r bg-muted/20 p-3 space-y-4">
            {[...Array(4)].map((_, g) => (
              <div key={g} className="space-y-1.5">
                <div className="h-2.5 w-16 rounded bg-muted animate-pulse" />
                {[...Array(g === 0 ? 1 : 2)].map((_, i) => (
                  <div key={i} className="h-7 rounded-md bg-muted animate-pulse" />
                ))}
              </div>
            ))}
          </aside>
          {/* Content skeleton */}
          <div className="flex-1 flex flex-col">
            <div className="h-9 border-b bg-muted/10" />
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top bar */}
        <div className="border-b shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Life Tool</span>
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1.5 rounded-md hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
                title="Settings"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <LifeSidebar
            activeTabType={activeTab?.type ?? null}
            onOpenTab={openTab}
          />

          {/* Main content area */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
            {/* Tab bar */}
            <LifeTabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onSwitch={switchTab}
              onClose={closeTab}
              onNewChat={openNewChat}
            />

            {/* Tab content */}
            <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
              {activeTab === null ? (
                <PlaceholderView tab="today" />
              ) : activeTab.type === "chat" ? (
                <ChatView
                  key={activeTab.id}
                  persistedConvId={activeTab.convId ?? null}
                  onConvIdChange={(id) => onChatConvIdChange(activeTab.id, id)}
                  onNewChat={openNewChat}
                />
              ) : activeTab.type === "memories" ? (
                <MemoriesView />
              ) : activeTab.type === "actionables" ? (
                <ActionablesView />
              ) : activeTab.type === "routines" ? (
                <RoutinesView onOpenRoutine={openRoutineDetail} />
              ) : activeTab.type === "routine-detail" && activeTab.routineId ? (
                <RoutineDetailView key={activeTab.routineId} routineId={activeTab.routineId} />
              ) : activeTab.type === "channels" ? (
                <ChannelsView />
              ) : activeTab.type === "calendar" ? (
                <CalendarView />
              ) : (
                <PlaceholderView tab={activeTab.type} />
              )}
            </div>
          </div>
        </div>

        {settingsOpen && (
          <SettingsPanel onClose={() => setSettingsOpen(false)} />
        )}
      </div>
    </AuthGate>
  );
}
