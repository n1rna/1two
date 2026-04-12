"use client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HealthProfile {
  userId: string;
  // Diet fields
  weightKg: number | null;
  heightCm: number | null;
  age: number | null;
  gender: string | null;
  activityLevel: string;
  dietType: string;
  dietaryRestrictions: string[];
  dietGoal: string;
  goalWeightKg: number | null;
  bmi: number | null;
  bmr: number | null;
  tdee: number | null;
  targetCalories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  // Gym fields
  fitnessLevel: string;
  fitnessGoal: string;
  availableEquipment: string[];
  physicalLimitations: string[];
  workoutLikes: string[];
  workoutDislikes: string[];
  preferredDurationMin: number;
  daysPerWeek: number;
  // Common
  onboarded: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HealthMemory {
  id: string;
  userId: string;
  category: string;
  content: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WeightEntry {
  id: string;
  userId: string;
  weightKg: number;
  note: string;
  recordedAt: string;
  createdAt: string;
}

export interface HealthMealPlan {
  id: string;
  userId: string;
  title: string;
  planType: string;
  dietType: string;
  targetCalories: number | null;
  content: {
    meals: MealItem[];
  };
  active: boolean;
  createdAt: string;
  updatedAt: string;
  forkedFromMpId?: string | null;
}

export interface MealItem {
  day?: string;
  meal_type: string;
  name: string;
  description?: string;
  calories: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export interface HealthSession {
  id: string;
  userId: string;
  title: string;
  description: string;
  status: string; // draft | active | archived
  targetMuscleGroups: string[];
  estimatedDuration: number | null;
  difficultyLevel: string;
  exerciseCount?: number;
  exercises?: HealthSessionExercise[];
  createdAt: string;
  updatedAt: string;
  forkedFromMpId?: string | null;
}

export interface HealthSessionExercise {
  id: string;
  sessionId: string;
  userId: string;
  exerciseName: string;
  sets: number;
  reps: string;
  weight: string;
  restSeconds: number;
  sortOrder: number;
  notes: string;
  supersetGroup: string | null;
  createdAt: string;
}

export interface HealthConversation {
  id: string;
  userId: string;
  title: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HealthMessage {
  id: string;
  conversationId: string;
  userId: string;
  role: string;
  content: string;
  toolCalls?: ChatEffect[];
  createdAt: string;
}

export interface ChatEffect {
  tool: string;
  id: string;
  success?: boolean;
  error?: string;
  data?: Record<string, unknown>;
}

export interface HealthCalculations {
  bmi: number;
  bmiCategory: string;
  bmr: number;
  tdee: number;
  target_calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function healthApiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`/api/proxy/health${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = "";
    try {
      const parsed = JSON.parse(text);
      message = parsed.error || parsed.message || "";
    } catch {
      message = text;
    }
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

export async function getHealthProfile(): Promise<HealthProfile> {
  const res = await healthApiFetch<{ profile: HealthProfile }>("/profile");
  return res.profile;
}

export async function updateHealthProfile(
  data: Partial<HealthProfile>
): Promise<HealthProfile> {
  const res = await healthApiFetch<{ profile: HealthProfile }>("/profile", {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.profile;
}

export async function markHealthOnboarded(): Promise<void> {
  await healthApiFetch<void>("/profile/onboarded", { method: "POST" });
}

// ─── Memories ─────────────────────────────────────────────────────────────────

export async function listHealthMemories(): Promise<HealthMemory[]> {
  const res = await healthApiFetch<{ memories: HealthMemory[] }>("/memories");
  return res.memories;
}

export async function createHealthMemory(
  content: string,
  category: string
): Promise<HealthMemory> {
  const res = await healthApiFetch<{ memory: HealthMemory }>("/memories", {
    method: "POST",
    body: JSON.stringify({ content, category }),
  });
  return res.memory;
}

export async function deleteHealthMemory(id: string): Promise<void> {
  return healthApiFetch<void>(`/memories/${id}`, { method: "DELETE" });
}

// ─── Weight ───────────────────────────────────────────────────────────────────

export async function listWeightEntries(): Promise<WeightEntry[]> {
  const res = await healthApiFetch<{ entries: WeightEntry[] }>("/weight");
  return res.entries;
}

export async function createWeightEntry(
  weightKg: number,
  note?: string,
  date?: string
): Promise<WeightEntry> {
  const res = await healthApiFetch<{ entry: WeightEntry }>("/weight", {
    method: "POST",
    body: JSON.stringify({ weightKg, note, date }),
  });
  return res.entry;
}

export async function deleteWeightEntry(id: string): Promise<void> {
  return healthApiFetch<void>(`/weight/${id}`, { method: "DELETE" });
}

// ─── Meal Plans ───────────────────────────────────────────────────────────────

export async function listMealPlans(): Promise<HealthMealPlan[]> {
  const res = await healthApiFetch<{ plans: HealthMealPlan[] }>("/meal-plans");
  return res.plans;
}

export async function deleteMealPlan(id: string): Promise<void> {
  return healthApiFetch<void>(`/meal-plans/${id}`, { method: "DELETE" });
}

export async function getMealPlan(id: string): Promise<HealthMealPlan> {
  const res = await healthApiFetch<{ plan: HealthMealPlan }>(`/meal-plans/${id}`);
  return res.plan;
}

export async function updateMealPlan(
  id: string,
  data: Partial<Pick<HealthMealPlan, "title" | "planType" | "dietType" | "targetCalories" | "content">>
): Promise<HealthMealPlan> {
  const res = await healthApiFetch<{ plan: HealthMealPlan }>(`/meal-plans/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.plan;
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function listHealthSessions(
  status?: string
): Promise<HealthSession[]> {
  const qs = status ? `?status=${encodeURIComponent(status)}` : "";
  const res = await healthApiFetch<{ sessions: HealthSession[] }>(
    `/sessions${qs}`
  );
  return res.sessions;
}

export async function getHealthSession(id: string): Promise<HealthSession> {
  const res = await healthApiFetch<{ session: HealthSession }>(`/sessions/${id}`);
  return res.session;
}

export async function updateHealthSession(
  id: string,
  data: Partial<HealthSession>
): Promise<HealthSession> {
  const res = await healthApiFetch<{ session: HealthSession }>(`/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res.session;
}

export async function deleteHealthSession(id: string): Promise<void> {
  return healthApiFetch<void>(`/sessions/${id}`, { method: "DELETE" });
}

export async function updateHealthSessionStatus(
  id: string,
  status: string
): Promise<void> {
  await healthApiFetch<void>(`/sessions/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

// ─── Session exercises ────────────────────────────────────────────────────────

export async function addHealthSessionExercise(
  sessionId: string,
  exercise: Partial<HealthSessionExercise>
): Promise<HealthSessionExercise> {
  const res = await healthApiFetch<{ exercise: HealthSessionExercise }>(
    `/sessions/${sessionId}/exercises`,
    {
      method: "POST",
      body: JSON.stringify(exercise),
    }
  );
  return res.exercise;
}

export async function updateHealthSessionExercise(
  sessionId: string,
  exerciseId: string,
  data: Partial<HealthSessionExercise>
): Promise<HealthSessionExercise> {
  const res = await healthApiFetch<{ exercise: HealthSessionExercise }>(
    `/sessions/${sessionId}/exercises/${exerciseId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
  return res.exercise;
}

export async function deleteHealthSessionExercise(
  sessionId: string,
  exerciseId: string
): Promise<void> {
  return healthApiFetch<void>(
    `/sessions/${sessionId}/exercises/${exerciseId}`,
    { method: "DELETE" }
  );
}

export async function reorderHealthSessionExercises(
  sessionId: string,
  order: string[]
): Promise<void> {
  await healthApiFetch<void>(`/sessions/${sessionId}/reorder`, {
    method: "PUT",
    body: JSON.stringify({ order }),
  });
}

// ─── Conversations ────────────────────────────────────────────────────────────

export async function listHealthConversations(): Promise<HealthConversation[]> {
  const res = await healthApiFetch<{ conversations: HealthConversation[] }>(
    "/conversations"
  );
  return res.conversations;
}

export async function getHealthConversationMessages(
  id: string
): Promise<HealthMessage[]> {
  const res = await healthApiFetch<{ messages: HealthMessage[] }>(
    `/conversations/${id}`
  );
  return res.messages;
}

export async function deleteHealthConversation(id: string): Promise<void> {
  return healthApiFetch<void>(`/conversations/${id}`, { method: "DELETE" });
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendHealthChat(
  message: string,
  conversationId?: string
): Promise<{
  conversationId: string;
  message: HealthMessage;
  effects?: ChatEffect[];
}> {
  return healthApiFetch<{
    conversationId: string;
    message: HealthMessage;
    effects?: ChatEffect[];
  }>("/chat", {
    method: "POST",
    body: JSON.stringify({ message, conversationId }),
  });
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onToolCall: (toolName: string) => void;
  onToolResult: (result: string) => void;
  onComplete: (data: {
    conversationId: string;
    message: HealthMessage;
    effects?: ChatEffect[];
  }) => void;
  onError: (error: string) => void;
}

export async function streamHealthChat(
  message: string,
  callbacks: StreamCallbacks,
  conversationId?: string
): Promise<void> {
  const res = await fetch("/api/proxy/health/chat/stream", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversationId }),
  });

  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      callbacks.onError("Service is temporarily unavailable. Please try again in a moment.");
      return;
    }
    const err = (await res.json().catch(() => ({}))) as Record<string, string>;
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
            // Wait for the final save event
          } else if (event.type === "error") {
            callbacks.onError((event.data as string) ?? "unknown error");
            return;
          } else if (event.conversationId) {
            callbacks.onComplete(
              event as unknown as {
                conversationId: string;
                message: HealthMessage;
                effects?: ChatEffect[];
              }
            );
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

// ─── Calculations (stateless) ─────────────────────────────────────────────────

export async function calculateHealth(params: {
  weightKg: number;
  heightCm: number;
  age: number;
  gender: string;
  activityLevel: string;
  dietType: string;
  goal: string;
}): Promise<HealthCalculations> {
  return healthApiFetch<HealthCalculations>("/calculations", {
    method: "POST",
    body: JSON.stringify(params),
  });
}
