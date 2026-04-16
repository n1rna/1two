"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LifeProfile {
  userId: string;
  timezone: string;
  wakeTime: string | null;
  sleepTime: string | null;
  agentEnabled: boolean;
  onboarded: boolean;
  onboardingStep: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LifeMemory {
  id: string;
  userId: string;
  category: string; // 'preference' | 'instruction' | 'fact' | 'habit'
  content: string;
  source: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LifeConversation {
  id: string;
  userId: string;
  channel: string;
  category: string; // "life" | "health" | "auto"
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LifeMessage {
  id: string;
  conversationId: string;
  role: string; // 'user' | 'assistant' | 'system'
  content: string;
  toolCalls?: ChatEffect[]; // persisted tool effects — available after load and on new messages
  createdAt: string;
}

export interface ChatEffect {
  tool: string; // "create_actionable" | "remember" | "create_routine" | "forget" | etc.
  id: string;
  success?: boolean;
  error?: string;
  actionable?: LifeActionable;
  data?: Record<string, unknown>; // parsed tool result for memory/routine
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function lifeApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/proxy/life${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Try to extract a message from JSON error responses
    let message = "";
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || "";
    } catch {
      message = text;
    }
    // Map common errors to friendly messages
    if (res.status === 502 || res.status === 503 || message === "Backend unavailable") {
      throw new Error("Service is temporarily unavailable. Please try again in a moment.");
    }
    if (res.status === 401) {
      throw new Error("Please sign in to continue.");
    }
    if (res.status === 429) {
      throw new Error("Too many requests. Please wait a moment and try again.");
    }
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function getLifeProfile(): Promise<LifeProfile> {
  const res = await lifeApiFetch<{ profile: LifeProfile }>("/profile");
  return res.profile;
}

export async function updateLifeProfile(
  data: Partial<LifeProfile>
): Promise<LifeProfile> {
  const res = await lifeApiFetch<{ profile: LifeProfile }>("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.profile;
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function listLifeMemories(): Promise<LifeMemory[]> {
  const res = await lifeApiFetch<{ memories: LifeMemory[] }>("/memories");
  return res.memories;
}

export async function createLifeMemory(
  content: string,
  category: string
): Promise<LifeMemory> {
  const res = await lifeApiFetch<{ memory: LifeMemory }>("/memories", {
    method: "POST",
    body: JSON.stringify({ content, category }),
  });
  return res.memory;
}

export async function updateLifeMemory(
  id: string,
  content: string,
  category: string
): Promise<LifeMemory> {
  const res = await lifeApiFetch<{ memory: LifeMemory }>(`/memories/${id}`, {
    method: "PUT",
    body: JSON.stringify({ content, category }),
  });
  return res.memory;
}

export async function deleteLifeMemory(id: string): Promise<void> {
  return lifeApiFetch<void>(`/memories/${id}`, { method: "DELETE" });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function listLifeConversations(): Promise<LifeConversation[]> {
  const res = await lifeApiFetch<{ conversations: LifeConversation[] }>("/conversations");
  return res.conversations;
}

export async function getLifeConversationMessages(id: string): Promise<LifeMessage[]> {
  const res = await lifeApiFetch<{ messages: LifeMessage[] }>(`/conversations/${id}`);
  return res.messages;
}

export async function getRoutineConversationId(routineId: string): Promise<string | null> {
  try {
    const res = await lifeApiFetch<{ conversationId: string | null }>(`/conversations/by-routine/${routineId}`);
    return res.conversationId;
  } catch {
    return null;
  }
}

export async function deleteLifeConversation(id: string): Promise<void> {
  return lifeApiFetch<void>(`/conversations/${id}`, { method: "DELETE" });
}

// ─── Actionables ──────────────────────────────────────────────────────────────

export interface LifeActionable {
  id: string;
  userId: string;
  type: string; // 'confirm' | 'choose' | 'input' | 'info'
  status: string; // 'pending' | 'confirmed' | 'dismissed' | 'snoozed' | 'expired'
  title: string;
  description: string;
  options: { id: string; label: string; detail?: string }[] | null;
  response: unknown;
  dueAt: string | null;
  snoozedUntil: string | null;
  routineId: string | null;
  actionType: string;
  actionPayload?: ActionablePayload;
  createdAt: string;
  resolvedAt: string | null;
}

// Semantic actionable type stored in actionPayload.template
export type ActionableTemplate =
  | "daily_plan" | "daily_review" | "routine_check"
  | "meal_choice" | "schedule_pick" | "reminder"
  | "preference" | "task_roundup" | "streak" | "suggestion";

export interface ActionablePayload {
  template?: ActionableTemplate;
  data?: ActionableData;
  // Legacy fields
  sections?: { icon?: string; title: string; items: string[] }[];
  [key: string]: unknown;
}

// Union of all possible data shapes
export type ActionableData = {
  // daily_plan
  sections?: { icon?: string; title: string; items: string[] }[];
  // daily_review
  completed?: string[];
  missed?: string[];
  question?: string;
  // routine_check
  routine_name?: string;
  routine_id?: string;
  scheduled_time?: string;
  details?: string;
  // meal_choice / schedule_pick
  meal?: string;
  context?: string;
  options?: { id: string; label: string; detail?: string }[];
  // reminder
  message?: string;
  time?: string;
  // preference
  placeholder?: string;
  // task_roundup
  pending?: { title: string; due?: string }[];
  completed_today?: string[];
  // streak
  count?: number;
  unit?: string;
  best?: number;
  // suggestion
  suggestion?: string;
  reasoning?: string;
}

export async function listLifeActionables(
  status?: string
): Promise<LifeActionable[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await lifeApiFetch<{ actionables: LifeActionable[] }>(
    `/actionables${qs}`
  );
  return res.actionables;
}

export async function respondToActionable(
  id: string,
  action: string,
  data?: unknown
): Promise<void> {
  return lifeApiFetch<void>(`/actionables/${id}/respond`, {
    method: "POST",
    body: JSON.stringify({ action, ...((data as object) ?? {}) }),
  });
}

export async function bulkDismissActionables(
  params: { ids?: string[]; allPending?: boolean }
): Promise<{ dismissed: number }> {
  return lifeApiFetch<{ dismissed: number }>("/actionables/bulk-dismiss", {
    method: "POST",
    body: JSON.stringify({
      ids: params.ids,
      all_pending: params.allPending,
    }),
  });
}

// ─── Routines ─────────────────────────────────────────────────────────────────

export interface LifeRoutine {
  id: string;
  userId: string;
  name: string;
  description: string;
  schedule: unknown; // {frequency, interval?, days?, time?, flexible?}
  config: unknown; // values conforming to configSchema
  configSchema: unknown; // RoutineConfigSchema describing the shape of config
  active: boolean;
  lastTriggered: string | null;
  createdAt: string;
  updatedAt: string;
  forkedFromMpId?: string | null;
}

export async function listLifeRoutines(): Promise<LifeRoutine[]> {
  const res = await lifeApiFetch<{ routines: LifeRoutine[] }>("/routines");
  return res.routines;
}

export async function getLifeRoutine(id: string): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>(`/routines/${id}`);
  return res.routine;
}

export async function createLifeRoutine(
  routine: Partial<LifeRoutine>
): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>("/routines", {
    method: "POST",
    body: JSON.stringify(routine),
  });
  return res.routine;
}

export async function updateLifeRoutine(
  id: string,
  data: Partial<LifeRoutine>
): Promise<LifeRoutine> {
  const res = await lifeApiFetch<{ routine: LifeRoutine }>(`/routines/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.routine;
}

export async function deleteLifeRoutine(id: string): Promise<void> {
  return lifeApiFetch<void>(`/routines/${id}`, { method: "DELETE" });
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export interface ChannelLink {
  id: string;
  userId: string;
  channel: string; // "telegram" | "email"
  channelUid: string;
  verified: boolean;
  displayName: string;
  createdAt: string;
}

export interface InitChannelLinkResponse {
  id: string;
  channel: string;
  verifyCode: string;
  displayName: string;
}

export async function listChannelLinks(): Promise<ChannelLink[]> {
  const res = await lifeApiFetch<{ links: ChannelLink[] }>("/channels");
  return res.links;
}

export async function initChannelLink(channel: string, channelUid?: string): Promise<InitChannelLinkResponse> {
  const res = await lifeApiFetch<InitChannelLinkResponse>("/channels", {
    method: "POST",
    body: JSON.stringify({ channel, channelUid }),
  });
  return res;
}

export async function verifyChannelLink(id: string, code: string): Promise<void> {
  await lifeApiFetch<void>(`/channels/${id}/verify`, {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function deleteChannelLink(id: string): Promise<void> {
  await lifeApiFetch<void>(`/channels/${id}`, { method: "DELETE" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

// ─── Chat streaming ───────────────────────────────────────────────────────────

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolName: string) => void;
  onToolResult: (result: string) => void;
  onComplete: (data: { conversationId: string; message: LifeMessage; effects?: ChatEffect[] }) => void;
  onError: (error: string) => void;
}

export async function streamLifeChat(
  message: string,
  callbacks: StreamCallbacks,
  conversationId?: string,
  systemContext?: string,
  routineId?: string,
  autoApprove?: boolean,
  category?: string,
): Promise<void> {
  const res = await fetch("/api/proxy/life/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId, systemContext, routineId, autoApprove, category }),
  });

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      callbacks.onError("Service is temporarily unavailable. Please try again in a moment.");
      return;
    }
    const err = await res.json().catch(() => ({})) as Record<string, string>;
    callbacks.onError(err.error ?? `Request failed (${res.status})`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    callbacks.onError("No stream");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;
        try {
          const event = JSON.parse(jsonStr) as Record<string, unknown>;
          if (event.type === "token") {
            callbacks.onToken((event.data as string) ?? "");
          } else if (event.type === "tool_call") {
            callbacks.onToolCall((event.data as string) ?? "");
          } else if (event.type === "tool_result") {
            callbacks.onToolResult((event.data as string) ?? "");
          } else if (event.type === "done") {
            // done event data is the ChatResult JSON — ignored; wait for the
            // final save event below.
          } else if (event.type === "error") {
            callbacks.onError((event.data as string) ?? "unknown error");
            return;
          } else if (event.conversationId) {
            // Final save event: contains conversationId + message + effects.
            callbacks.onComplete(event as unknown as { conversationId: string; message: LifeMessage; effects?: ChatEffect[] });
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ─── Google Calendar ──────────────────────────────────────────────────────────

export async function markOnboarded(): Promise<void> {
  await lifeApiFetch<void>("/profile/onboarded", { method: "POST" });
}

export interface GCalStatus {
  connected: boolean;
  email?: string;
  tokenExpiry?: string;
}

export interface GCalEvent {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  allDay: boolean;
  status: string;
  colorId?: string;
  htmlLink: string;
  routineId?: string;
  routineName?: string;
}

export async function getGCalAuthUrl(): Promise<{ url: string }> {
  return lifeApiFetch<{ url: string }>("/gcal/auth-url");
}

export async function exchangeGCalCode(code: string): Promise<void> {
  await lifeApiFetch<void>("/gcal/callback", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}

export async function getGCalStatus(): Promise<GCalStatus> {
  return lifeApiFetch<GCalStatus>("/gcal/status");
}

export async function disconnectGCal(): Promise<void> {
  await lifeApiFetch<void>("/gcal", { method: "DELETE" });
}

export async function listGCalEvents(from?: string, to?: string, days?: number): Promise<GCalEvent[]> {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (!from && !to && days) params.set("days", String(days));
  const qs = params.toString();
  const res = await lifeApiFetch<{ events: GCalEvent[] }>(`/gcal/events${qs ? `?${qs}` : ""}`);
  return res.events;
}

export async function sendLifeChat(
  message: string,
  conversationId?: string,
  systemContext?: string,
  routineId?: string,
  autoApprove?: boolean,
  category?: string,
): Promise<{ conversationId: string; message: LifeMessage; effects?: ChatEffect[] }> {
  return lifeApiFetch<{ conversationId: string; message: LifeMessage; effects?: ChatEffect[] }>(
    "/chat",
    {
      method: "POST",
      body: JSON.stringify({ message, conversationId, systemContext, routineId, autoApprove, category }),
    }
  );
}

// ─── Google Tasks ────────────────────────────────────────────────────────────

export interface GTaskList {
  id: string;
  title: string;
}

export interface GTask {
  id: string;
  title: string;
  notes: string;
  status: string; // "needsAction" | "completed"
  due: string;
  completed: string;
  position: string;
  parent: string;
  updated: string;
}

export async function listGTaskLists(): Promise<GTaskList[]> {
  const res = await lifeApiFetch<{ lists: GTaskList[] }>("/gtasks/lists");
  return res.lists;
}

export async function createGTaskList(title: string): Promise<GTaskList> {
  return lifeApiFetch<GTaskList>("/gtasks/lists", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function listGTasks(listId: string, showCompleted = false): Promise<GTask[]> {
  const params = new URLSearchParams({ listId });
  if (showCompleted) params.set("showCompleted", "true");
  const res = await lifeApiFetch<{ tasks: GTask[] }>(`/gtasks/tasks?${params}`);
  return res.tasks;
}

export async function createGTask(listId: string, title: string, notes?: string, due?: string): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/tasks", {
    method: "POST",
    body: JSON.stringify({ listId, title, notes, due }),
  });
}

export async function updateGTask(listId: string, taskId: string, updates: { title?: string; notes?: string; due?: string; status?: string }): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/tasks", {
    method: "PUT",
    body: JSON.stringify({ listId, taskId, ...updates }),
  });
}

export async function deleteGTask(listId: string, taskId: string): Promise<void> {
  await lifeApiFetch<void>(`/gtasks/tasks?listId=${encodeURIComponent(listId)}&taskId=${encodeURIComponent(taskId)}`, {
    method: "DELETE",
  });
}

export async function completeGTask(listId: string, taskId: string): Promise<GTask> {
  return lifeApiFetch<GTask>("/gtasks/complete", {
    method: "POST",
    body: JSON.stringify({ listId, taskId }),
  });
}

// ─── Day Summaries ────────────────────────────────────────────────────────────

export interface DayBlock {
  type: "sleep" | "morning_routine" | "commute" | "work" | "tasks" | "meal" | "exercise" | "social" | "personal" | "project" | "rest" | "errand";
  label: string;
  description: string;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
  eventIds?: string[];
}

export interface DaySummary {
  date: string; // "2026-03-25"
  blocks: DayBlock[] | null;
  pending?: boolean;
  generatedAt?: string;
}

export async function getDaySummaries(from: string, to: string): Promise<DaySummary[]> {
  const res = await lifeApiFetch<{ summaries: DaySummary[] }>(`/calendar/summaries?from=${from}&to=${to}`);
  return res.summaries;
}
