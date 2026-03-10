"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSyncedState } from "@/lib/sync";
import { SyncToggle } from "@/components/ui/sync-toggle";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Target,
  Plus,
  X,
  Check,
  Bell,
  BellOff,
  Settings2,
  ChevronDown,
  History,
  SkipForward,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────

type TimerType = "work" | "short-break" | "long-break";
type TimerStatus = "idle" | "running" | "paused";

interface Goal {
  id: string;
  text: string;
  completed: boolean;
  pomodorosTarget: number;
  pomodorosCompleted: number;
}

interface SessionLogEntry {
  id: string;
  type: TimerType;
  outcome: "completed" | "skipped";
  durationSeconds: number; // actual time spent
  timestamp: number; // when it ended (ms)
}

interface PomodoroSettings {
  workMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakInterval: number;
  autoStartBreak: boolean;
  autoStartWork: boolean;
  countSkipped: boolean;
}

const DEFAULT_SETTINGS: PomodoroSettings = {
  workMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  autoStartBreak: false,
  autoStartWork: false,
  countSkipped: true,
};

// ── Persistence ────────────────────────────────────────

const STORAGE_KEY = "pomodoro-state";

interface PersistedState {
  goals: Goal[];
  completedToday: number;
  settings: PomodoroSettings;
  date: string; // YYYY-MM-DD to reset daily
  // Timer state for restore across navigation/refresh
  timerEndTime: number | null; // absolute ms timestamp (running)
  timerRemaining: number | null; // seconds left (paused)
  timerType: TimerType;
  timerStatus: TimerStatus;
  totalSeconds: number;
  workSessionCount: number;
  activeGoalId: string | null;
  sessionLog: SessionLogEntry[];
}

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

const DEFAULT_PERSISTED: PersistedState = {
  goals: [],
  completedToday: 0,
  settings: DEFAULT_SETTINGS,
  date: todayKey(),
  timerEndTime: null,
  timerRemaining: null,
  timerType: "work",
  timerStatus: "idle",
  totalSeconds: DEFAULT_SETTINGS.workMinutes * 60,
  workSessionCount: 0,
  activeGoalId: null,
  sessionLog: [],
};

/** Apply daily-reset migration to a loaded PersistedState. */
function applyDailyReset(s: PersistedState): PersistedState {
  if (s.date !== todayKey()) {
    return {
      ...s,
      completedToday: 0,
      date: todayKey(),
      workSessionCount: 0,
      sessionLog: [],
      goals: s.goals.map((g) => ({ ...g, pomodorosCompleted: 0, completed: false })),
    };
  }
  return s;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function getDurationForType(type: TimerType, settings: PomodoroSettings): number {
  switch (type) {
    case "work": return settings.workMinutes * 60;
    case "short-break": return settings.shortBreakMinutes * 60;
    case "long-break": return settings.longBreakMinutes * 60;
  }
}

// ── Component ──────────────────────────────────────────

export function PomodoroTool() {
  const {
    data: syncedData,
    setData,
    syncToggleProps,
  } = useSyncedState<PersistedState>(STORAGE_KEY, DEFAULT_PERSISTED);

  const [settings, setSettings] = useState<PomodoroSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);

  const [timerType, setTimerType] = useState<TimerType>("work");
  const [status, setStatus] = useState<TimerStatus>("idle");
  const [remaining, setRemaining] = useState(DEFAULT_SETTINGS.workMinutes * 60);
  const [totalSeconds, setTotalSeconds] = useState(DEFAULT_SETTINGS.workMinutes * 60);
  const endTimeRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [completedToday, setCompletedToday] = useState(0);
  const [workSessionCount, setWorkSessionCount] = useState(0);

  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const pendingSkipRef = useRef<TimerType | null>(null);

  const [goals, setGoals] = useState<Goal[]>([]);
  const [newGoalText, setNewGoalText] = useState("");
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const [sessionLog, setSessionLog] = useState<SessionLogEntry[]>([]);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  const startTimerRef = useRef<(type?: TimerType, duration?: number) => void>(() => {});
  const autoStartTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);

  // ── Persist helper ────────────────────

  const persistTimerState = useCallback(
    (overrides: Partial<Pick<PersistedState, "timerEndTime" | "timerRemaining" | "timerType" | "timerStatus" | "totalSeconds" | "workSessionCount" | "activeGoalId" | "completedToday" | "goals">>) => {
      setData((prev) => ({ ...prev, ...overrides }));
    },
    [setData]
  );

  const addLogEntry = useCallback(
    (type: TimerType, outcome: "completed" | "skipped", durationSeconds: number) => {
      const entry: SessionLogEntry = {
        id: crypto.randomUUID(),
        type,
        outcome,
        durationSeconds,
        timestamp: Date.now(),
      };
      setSessionLog((prev) => {
        const next = [entry, ...prev];
        setData((s) => ({ ...s, sessionLog: next }));
        return next;
      });
    },
    [setData]
  );

  // ── Load persisted state & restore timer ──
  // syncedData is populated by useSyncedState from localStorage (and optionally cloud).
  // We only run this once after the hook's initial load settles.

  const didRestoreRef = useRef(false);

  useEffect(() => {
    if (didRestoreRef.current) return;
    // syncedData starts as DEFAULT_PERSISTED on first render then updates via useSyncedState.
    // We wait until it's been read from storage (isSyncing might still be true for cloud fetch,
    // but local data is always available immediately after the first render cycle).
    didRestoreRef.current = true;

    const s = applyDailyReset({ ...DEFAULT_PERSISTED, ...syncedData });

    // If date changed, persist the reset
    if (s.date !== syncedData.date) {
      setData(s);
    }

    setGoals(s.goals);
    setCompletedToday(s.completedToday);
    setSettings(s.settings);
    setWorkSessionCount(s.workSessionCount);
    setActiveGoalId(s.activeGoalId);
    setSessionLog(s.sessionLog || []);
    setTimerType(s.timerType);

    if (s.timerStatus === "running" && s.timerEndTime) {
      const left = Math.max(0, Math.ceil((s.timerEndTime - Date.now()) / 1000));
      if (left > 0) {
        // Timer still active - restore running state
        setTotalSeconds(s.totalSeconds);
        setRemaining(left);
        endTimeRef.current = s.timerEndTime;
        setStatus("running");

        intervalRef.current = setInterval(() => {
          const r = Math.max(0, Math.ceil((endTimeRef.current! - Date.now()) / 1000));
          setRemaining(r);
        }, 250);
      } else {
        // Timer expired while away - treat as completed
        setTotalSeconds(s.totalSeconds);
        setRemaining(0);
        setStatus("idle");
        persistTimerState({ timerStatus: "idle", timerEndTime: null, timerRemaining: null });
      }
    } else if (s.timerStatus === "paused" && s.timerRemaining != null) {
      setTotalSeconds(s.totalSeconds);
      setRemaining(s.timerRemaining);
      setStatus("paused");
    } else {
      const dur = getDurationForType(s.timerType, s.settings);
      setTotalSeconds(dur);
      setRemaining(dur);
    }

    mountedRef.current = true;
  }, [syncedData]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist meaningful state changes (goals, settings, completedToday, activeGoalId).
  // Timer-tick fields (remaining, endTime) are persisted surgically via persistTimerState
  // to avoid cloud writes on every 250ms interval tick.
  useEffect(() => {
    if (!mountedRef.current) return;
    setData((prev) => ({
      ...prev,
      goals,
      completedToday,
      settings,
      date: todayKey(),
      workSessionCount,
      activeGoalId,
    }));
  }, [goals, completedToday, settings, workSessionCount, activeGoalId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Service Worker ────────────────────

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/pomodoro-sw.js")
      .then((reg) => {
        swRef.current = reg;
      })
      .catch(() => {});

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "timer-done") {
        handleTimerDone(event.data.payload.timerType);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notifications ─────────────────────

  useEffect(() => {
    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }
  }, []);

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
  }, []);

  // ── Global mouseup for drag, etc. ─────

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ── Timer logic ───────────────────────

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    endTimeRef.current = null;
  }, []);

  const notifyDone = useCallback(
    (type: TimerType) => {
      const title = "Pomodoro Timer";
      const body =
        type === "work"
          ? "Great work! Time for a break."
          : "Break's over - ready to focus?";

      if (swRef.current?.active) {
        swRef.current.active.postMessage({
          type: "show-notification",
          payload: { title, body, tag: "pomodoro-done" },
        });
      } else if (notifPermission === "granted") {
        new Notification(title, { body, tag: "pomodoro-done" });
      }

      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 800;
        gain.gain.value = 0.3;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
        setTimeout(() => {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.frequency.value = 1000;
          gain2.gain.value = 0.3;
          osc2.start();
          osc2.stop(ctx.currentTime + 0.3);
        }, 350);
      } catch {}
    },
    [notifPermission]
  );

  const handleTimerDone = useCallback(
    (type: TimerType) => {
      clearTimer();
      setStatus("idle");
      addLogEntry(type, "completed", getDurationForType(type, settings));

      if (type === "work") {
        setCompletedToday((c) => c + 1);
        setWorkSessionCount((c) => c + 1);

        if (activeGoalId) {
          setGoals((prev) =>
            prev.map((g) => {
              if (g.id !== activeGoalId) return g;
              const newCount = g.pomodorosCompleted + 1;
              return {
                ...g,
                pomodorosCompleted: newCount,
                completed: newCount >= g.pomodorosTarget,
              };
            })
          );
        }

        const nextCount = workSessionCount + 1;
        const isLongBreak = nextCount % settings.longBreakInterval === 0;
        const nextType: TimerType = isLongBreak ? "long-break" : "short-break";
        const dur = getDurationForType(nextType, settings);
        setTimerType(nextType);
        setRemaining(dur);
        setTotalSeconds(dur);

        persistTimerState({ timerStatus: "idle", timerEndTime: null, timerRemaining: null, timerType: nextType, totalSeconds: dur });

        if (settings.autoStartBreak) {
          autoStartTimeout.current = setTimeout(() => startTimerRef.current(nextType, dur), 300);
        }
      } else {
        const dur = getDurationForType("work", settings);
        setTimerType("work");
        setRemaining(dur);
        setTotalSeconds(dur);

        persistTimerState({ timerStatus: "idle", timerEndTime: null, timerRemaining: null, timerType: "work", totalSeconds: dur });

        if (settings.autoStartWork) {
          autoStartTimeout.current = setTimeout(() => startTimerRef.current("work", dur), 300);
        }
      }

      notifyDone(type);
    },
    [clearTimer, notifyDone, settings, activeGoalId, workSessionCount, persistTimerState, addLogEntry]
  );

  const startTimer = useCallback(
    (type?: TimerType, duration?: number) => {
      const t = type || timerType;
      const dur = duration || remaining;
      const end = Date.now() + dur * 1000;

      clearTimer();
      endTimeRef.current = end;
      setStatus("running");

      persistTimerState({ timerEndTime: end, timerStatus: "running", timerRemaining: null, timerType: t, totalSeconds: totalSeconds });

      if (swRef.current?.active) {
        swRef.current.active.postMessage({
          type: "start-timer",
          payload: { endTime: end, timerType: t, label: t },
        });
      }

      intervalRef.current = setInterval(() => {
        const left = Math.max(0, Math.ceil((endTimeRef.current! - Date.now()) / 1000));
        setRemaining(left);
        if (left <= 0) {
          handleTimerDone(t);
        }
      }, 250);
    },
    [timerType, remaining, totalSeconds, clearTimer, handleTimerDone, persistTimerState]
  );

  startTimerRef.current = startTimer;

  const pauseTimer = useCallback(() => {
    const left = endTimeRef.current ? Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)) : remaining;
    clearTimer();
    setStatus("paused");
    setRemaining(left);
    persistTimerState({ timerStatus: "paused", timerEndTime: null, timerRemaining: left });
    if (swRef.current?.active) {
      swRef.current.active.postMessage({ type: "stop-timer" });
    }
  }, [clearTimer, remaining, persistTimerState]);

  const resetTimer = useCallback(() => {
    clearTimer();
    setStatus("idle");
    const dur = getDurationForType(timerType, settings);
    setRemaining(dur);
    setTotalSeconds(dur);
    persistTimerState({ timerStatus: "idle", timerEndTime: null, timerRemaining: null, totalSeconds: dur });
    if (swRef.current?.active) {
      swRef.current.active.postMessage({ type: "stop-timer" });
    }
  }, [clearTimer, timerType, settings, persistTimerState]);

  const switchTimerType = useCallback(
    (type: TimerType, autoStart?: boolean) => {
      clearTimer();
      if (autoStartTimeout.current) {
        clearTimeout(autoStartTimeout.current);
        autoStartTimeout.current = null;
      }
      setStatus("idle");
      setTimerType(type);
      const dur = getDurationForType(type, settings);
      setRemaining(dur);
      setTotalSeconds(dur);
      persistTimerState({ timerStatus: "idle", timerEndTime: null, timerRemaining: null, timerType: type, totalSeconds: dur });
      if (swRef.current?.active) {
        swRef.current.active.postMessage({ type: "stop-timer" });
      }
      const shouldAutoStart =
        autoStart ??
        (type === "work" ? settings.autoStartWork : settings.autoStartBreak);
      if (shouldAutoStart) {
        autoStartTimeout.current = setTimeout(() => startTimerRef.current(type, dur), 300);
      }
    },
    [clearTimer, settings, persistTimerState]
  );

  // Update document title
  useEffect(() => {
    if (status === "running" || status === "paused") {
      document.title = `${formatTime(remaining)} - Pomodoro`;
    } else {
      document.title = "Pomodoro Timer - 1two";
    }
    return () => {
      document.title = "Pomodoro Timer - 1two";
    };
  }, [remaining, status]);

  // Progress
  const progress = totalSeconds > 0 ? ((totalSeconds - remaining) / totalSeconds) * 100 : 0;
  const circleR = 90;
  const circleC = 2 * Math.PI * circleR;
  const strokeDash = circleC * (progress / 100);

  // ── Goals ─────────────────────────────

  const addGoal = useCallback(() => {
    const text = newGoalText.trim();
    if (!text) return;
    setGoals((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text,
        completed: false,
        pomodorosTarget: 4,
        pomodorosCompleted: 0,
      },
    ]);
    setNewGoalText("");
  }, [newGoalText]);

  const removeGoal = useCallback((id: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== id));
    setActiveGoalId((prev) => (prev === id ? null : prev));
  }, []);

  const toggleGoalComplete = useCallback((id: string) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g))
    );
  }, []);

  const updateGoalTarget = useCallback((id: string, target: number) => {
    setGoals((prev) =>
      prev.map((g) => (g.id === id ? { ...g, pomodorosTarget: Math.max(1, target) } : g))
    );
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<PomodoroSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        if (status === "idle") {
          const dur = getDurationForType(timerType, next);
          setRemaining(dur);
          setTotalSeconds(dur);
        }
        return next;
      });
    },
    [status, timerType]
  );

  const timerColor =
    timerType === "work"
      ? "text-red-500"
      : timerType === "short-break"
        ? "text-green-500"
        : "text-blue-500";

  const strokeColor =
    timerType === "work"
      ? "#ef4444"
      : timerType === "short-break"
        ? "#22c55e"
        : "#3b82f6";

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Pomodoro</span>

          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-muted-foreground">
              {completedToday} session{completedToday !== 1 ? "s" : ""} today
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {notifPermission !== "granted" ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={requestNotifPermission}
              >
                <BellOff className="h-3.5 w-3.5 mr-1" />
                Enable Notifications
              </Button>
            ) : (
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Bell className="h-3 w-3" /> Notifications on
              </span>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setShowSettings((v) => !v)}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1" />
              Settings
              <ChevronDown
                className={`h-3 w-3 ml-0.5 transition-transform ${showSettings ? "rotate-180" : ""}`}
              />
            </Button>

            <SyncToggle {...syncToggleProps} />
          </div>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="border-b bg-muted/20 shrink-0">
          <div className="max-w-3xl mx-auto px-6 py-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-muted-foreground">Work (min)</span>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={settings.workMinutes}
                  onChange={(e) => updateSettings({ workMinutes: parseInt(e.target.value) || 25 })}
                  className="w-full h-8 px-2 rounded-md border bg-transparent text-sm font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Short Break (min)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.shortBreakMinutes}
                  onChange={(e) => updateSettings({ shortBreakMinutes: parseInt(e.target.value) || 5 })}
                  className="w-full h-8 px-2 rounded-md border bg-transparent text-sm font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Long Break (min)</span>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={settings.longBreakMinutes}
                  onChange={(e) => updateSettings({ longBreakMinutes: parseInt(e.target.value) || 15 })}
                  className="w-full h-8 px-2 rounded-md border bg-transparent text-sm font-mono"
                />
              </label>
              <label className="space-y-1">
                <span className="text-muted-foreground">Long break every</span>
                <input
                  type="number"
                  min={2}
                  max={10}
                  value={settings.longBreakInterval}
                  onChange={(e) => updateSettings({ longBreakInterval: parseInt(e.target.value) || 4 })}
                  className="w-full h-8 px-2 rounded-md border bg-transparent text-sm font-mono"
                />
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoStartBreak}
                  onChange={(e) => updateSettings({ autoStartBreak: e.target.checked })}
                  className="rounded"
                />
                <span className="text-muted-foreground">Auto-start breaks</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.autoStartWork}
                  onChange={(e) => updateSettings({ autoStartWork: e.target.checked })}
                  className="rounded"
                />
                <span className="text-muted-foreground">Auto-start work</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.countSkipped}
                  onChange={(e) => updateSettings({ countSkipped: e.target.checked })}
                  className="rounded"
                />
                <span className="text-muted-foreground">Count skipped in totals</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {/* Daily stats bar */}
          {sessionLog.length > 0 && <DailyStatsBar log={sessionLog} countSkipped={settings.countSkipped} />}

          {/* Timer type selector */}
          <div className="flex justify-center gap-1">
            {(
              [
                { type: "work" as TimerType, label: "Focus" },
                { type: "short-break" as TimerType, label: "Short Break" },
                { type: "long-break" as TimerType, label: "Long Break" },
              ] as const
            ).map(({ type, label }) => (
              <button
                key={type}
                onClick={() => switchTimerType(type)}
                disabled={status === "running"}
                className={`px-4 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  timerType === type
                    ? type === "work"
                      ? "bg-red-500/15 text-red-500"
                      : type === "short-break"
                        ? "bg-green-500/15 text-green-500"
                        : "bg-blue-500/15 text-blue-500"
                    : "text-muted-foreground hover:text-foreground"
                } disabled:opacity-50`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Timer circle */}
          <div className="flex justify-center">
            <div className="relative w-56 h-56">
              <svg
                className="w-full h-full -rotate-90"
                viewBox="0 0 200 200"
              >
                <circle
                  cx="100"
                  cy="100"
                  r={circleR}
                  fill="none"
                  stroke="currentColor"
                  className="text-muted/30"
                  strokeWidth="6"
                />
                <circle
                  cx="100"
                  cy="100"
                  r={circleR}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circleC}
                  strokeDashoffset={circleC - strokeDash}
                  className="transition-all duration-300"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold font-mono ${timerColor}`}>
                  {formatTime(remaining)}
                </span>
                <span className="text-xs text-muted-foreground mt-1 capitalize">
                  {timerType === "work"
                    ? "Focus Time"
                    : timerType === "short-break"
                      ? "Short Break"
                      : "Long Break"}
                </span>
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex justify-center items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={resetTimer}
              disabled={status === "idle" && remaining === totalSeconds}
              className="h-9 px-3"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>

            {status === "running" ? (
              <Button
                size="lg"
                onClick={pauseTimer}
                className="h-12 px-8 text-base"
              >
                <Pause className="h-5 w-5 mr-2" />
                Pause
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => startTimer()}
                className="h-12 px-8 text-base"
              >
                <Play className="h-5 w-5 mr-2" />
                {status === "paused" ? "Resume" : "Start"}
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const isLong =
                  (workSessionCount + 1) % settings.longBreakInterval === 0;
                const nextType: TimerType =
                  timerType === "work"
                    ? isLong
                      ? "long-break"
                      : "short-break"
                    : "work";
                if (status === "running" || status === "paused") {
                  pendingSkipRef.current = nextType;
                  setSkipConfirmOpen(true);
                } else {
                  switchTimerType(nextType, true);
                }
              }}
              className="h-9 px-3"
              title={timerType === "work" ? "Skip to break" : "Skip to focus"}
            >
              <Coffee className="h-4 w-4" />
            </Button>
          </div>

          {/* Session dots */}
          {settings.longBreakInterval > 0 && (
            <div className="flex justify-center gap-1.5">
              {Array.from({ length: settings.longBreakInterval }).map((_, i) => (
                <div
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-colors ${
                    i < (workSessionCount % settings.longBreakInterval)
                      ? "bg-red-500"
                      : "bg-muted-foreground/20"
                  }`}
                />
              ))}
            </div>
          )}

          {/* Goals */}
          <section className="space-y-3">
            <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Goals
            </h2>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addGoal()}
                placeholder="Add a goal for today..."
                className="flex-1 h-9 px-3 text-sm rounded-md border bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <Button size="sm" variant="outline" onClick={addGoal} disabled={!newGoalText.trim()}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {goals.length > 0 && (
              <div className="space-y-1.5">
                {goals.map((goal) => (
                  <div
                    key={goal.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                      activeGoalId === goal.id
                        ? "border-red-500/30 bg-red-500/5"
                        : "bg-muted/10"
                    } ${goal.completed ? "opacity-60" : ""}`}
                  >
                    <button
                      onClick={() => toggleGoalComplete(goal.id)}
                      className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                        goal.completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-muted-foreground/30 hover:border-foreground"
                      }`}
                    >
                      {goal.completed && <Check className="h-3 w-3" />}
                    </button>

                    <span
                      className={`flex-1 text-sm ${goal.completed ? "line-through text-muted-foreground" : ""}`}
                    >
                      {goal.text}
                    </span>

                    <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <span className="font-mono">
                        {goal.pomodorosCompleted}/{goal.pomodorosTarget}
                      </span>
                      <button
                        onClick={() => updateGoalTarget(goal.id, goal.pomodorosTarget - 1)}
                        className="hover:text-foreground px-0.5"
                      >
                        -
                      </button>
                      <button
                        onClick={() => updateGoalTarget(goal.id, goal.pomodorosTarget + 1)}
                        className="hover:text-foreground px-0.5"
                      >
                        +
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        setActiveGoalId((prev) =>
                          prev === goal.id ? null : goal.id
                        )
                      }
                      className={`shrink-0 p-1 rounded text-xs transition-colors ${
                        activeGoalId === goal.id
                          ? "text-red-500 bg-red-500/10"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                      title={
                        activeGoalId === goal.id
                          ? "Currently tracking"
                          : "Track this goal"
                      }
                    >
                      <Target className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => removeGoal(goal.id)}
                      className="shrink-0 p-1 rounded text-muted-foreground/50 hover:text-red-500 transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {goals.length === 0 && (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                Add goals to track your focus sessions.
              </p>
            )}
          </section>

          {/* Session Log */}
          {sessionLog.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5" />
                  Session Log
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                  onClick={() => setSessionLog([])}
                >
                  Clear
                </Button>
              </div>
              <div className="space-y-1">
                {sessionLog.map((entry) => (
                  <SessionLogRow key={entry.id} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Skip confirm dialog */}
      <Dialog open={skipConfirmOpen} onOpenChange={setSkipConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Skip {timerType === "work" ? "focus session" : "break"}?</DialogTitle>
            <DialogDescription>
              {timerType === "work"
                ? "Your current focus session will end and a break will start."
                : "Your break will end and a new focus session will start."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose
              render={<Button variant="outline" size="sm" />}
            >
              Cancel
            </DialogClose>
            <Button
              size="sm"
              onClick={() => {
                setSkipConfirmOpen(false);
                // Log the skipped session with elapsed time
                const elapsed = endTimeRef.current
                  ? Math.max(0, totalSeconds - Math.ceil((endTimeRef.current - Date.now()) / 1000))
                  : totalSeconds - remaining;
                addLogEntry(timerType, "skipped", elapsed);
                if (pendingSkipRef.current) {
                  switchTimerType(pendingSkipRef.current, true);
                  pendingSkipRef.current = null;
                }
              }}
            >
              Skip
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

const TYPE_COLORS: Record<TimerType, string> = {
  work: "bg-red-500",
  "short-break": "bg-green-500",
  "long-break": "bg-blue-500",
};

const TYPE_LABELS: Record<TimerType, string> = {
  work: "Focus",
  "short-break": "Short Break",
  "long-break": "Long Break",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatTimeOfDay(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function DailyStatsBar({ log, countSkipped }: { log: SessionLogEntry[]; countSkipped: boolean }) {
  const workEntries = log.filter((e) => e.type === "work" && (e.outcome === "completed" || (countSkipped && e.outcome === "skipped")));
  const workSkipped = log.filter((e) => e.type === "work" && e.outcome === "skipped");
  const workCompleted = log.filter((e) => e.type === "work" && e.outcome === "completed");
  const breakEntries = log.filter((e) => e.type !== "work" && (e.outcome === "completed" || (countSkipped && e.outcome === "skipped")));

  const totalFocusSeconds = workEntries.reduce((sum, e) => sum + e.durationSeconds, 0);
  const totalBreakSeconds = breakEntries.reduce((sum, e) => sum + e.durationSeconds, 0);

  return (
    <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
      <span>
        Focus: <span className="font-mono font-medium text-foreground">{formatDuration(totalFocusSeconds)}</span>
      </span>
      <span className="text-border">·</span>
      <span>
        Breaks: <span className="font-mono font-medium text-foreground">{formatDuration(totalBreakSeconds)}</span>
      </span>
      <span className="text-border">·</span>
      <span>
        <span className="font-mono font-medium text-foreground">{workCompleted.length}</span> completed
      </span>
      {workSkipped.length > 0 && (
        <>
          <span className="text-border">·</span>
          <span>
            <span className="font-mono font-medium text-foreground">{workSkipped.length}</span> skipped
          </span>
        </>
      )}
    </div>
  );
}

function SessionLogRow({ entry }: { entry: SessionLogEntry }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-card text-xs">
      <div className={`w-2 h-2 rounded-full shrink-0 ${TYPE_COLORS[entry.type]}`} />
      <span className="font-medium">{TYPE_LABELS[entry.type]}</span>
      <span className="text-muted-foreground">{formatDuration(entry.durationSeconds)}</span>
      {entry.outcome === "skipped" && (
        <span className="flex items-center gap-0.5 text-amber-500">
          <SkipForward className="h-3 w-3" />
          skipped
        </span>
      )}
      <span className="ml-auto text-muted-foreground font-mono text-[10px]">
        {formatTimeOfDay(entry.timestamp)}
      </span>
    </div>
  );
}
