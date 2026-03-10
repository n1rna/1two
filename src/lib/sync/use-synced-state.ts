"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSession } from "@/lib/auth-client";
import { SYNCABLE_KEY_MAP } from "./schema";

interface CloudStateEntry {
  key: string;
  data: unknown;
  updatedAt: string;
}

interface GetToolStateResponse {
  states: CloudStateEntry[];
}

interface PutToolStateResponse {
  updatedAt: string;
}

export function useSyncedState<T>(
  key: string,
  defaultValue: T,
): {
  data: T;
  setData: (value: T | ((prev: T) => T)) => void;
  syncMode: "local" | "cloud";
  setSyncMode: (mode: "local" | "cloud") => void;
  pushToCloud: () => Promise<void>;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  isLoggedIn: boolean;
  syncToggleProps: {
    syncMode: "local" | "cloud";
    onSyncModeChange: (mode: "local" | "cloud") => void;
    onPushToCloud: () => Promise<void>;
    isSyncing: boolean;
    lastSyncedAt: string | null;
    isLoggedIn: boolean;
  };
} {
  const metaKey = `sync-mode:${key}`;
  const { data: session } = useSession();
  const isLoggedIn = !!session?.user;

  const [syncMode, setSyncModeState] = useState<"local" | "cloud">("local");
  const [data, setDataState] = useState<T>(defaultValue);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(false);

  const hasFetchedCloud = useRef(false);

  // On mount: read syncMode and data from localStorage
  useEffect(() => {
    isMounted.current = true;

    const storedMode = localStorage.getItem(metaKey);
    const resolvedMode: "local" | "cloud" =
      storedMode === "cloud" ? "cloud" : "local";
    setSyncModeState(resolvedMode);

    const storedRaw = localStorage.getItem(key);
    let localData: T = defaultValue;
    if (storedRaw !== null) {
      try {
        localData = JSON.parse(storedRaw) as T;
      } catch {
        localData = defaultValue;
      }
    }
    setDataState(localData);

    return () => {
      isMounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch from cloud when session becomes available (or on mount if already logged in)
  useEffect(() => {
    if (!isLoggedIn || syncMode !== "cloud" || hasFetchedCloud.current) return;
    hasFetchedCloud.current = true;
    setIsSyncing(true);
    fetch(`/api/proxy/tool-state?key=${encodeURIComponent(key)}`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (res.status === 404) return null;
        if (!res.ok) return null;
        return res.json() as Promise<GetToolStateResponse>;
      })
      .then((json) => {
        if (!isMounted.current) return;
        if (json && json.states.length > 0) {
          const entry = json.states[0];
          setDataState(entry.data as T);
          localStorage.setItem(key, JSON.stringify(entry.data));
          setLastSyncedAt(entry.updatedAt);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted.current) setIsSyncing(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, syncMode]);

  const putToCloud = useCallback(
    async (value: T): Promise<void> => {
      if (!SYNCABLE_KEY_MAP.has(key)) return;
      setIsSyncing(true);
      try {
        const res = await fetch("/api/proxy/tool-state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, data: value }),
          credentials: "include",
        });
        if (res.ok) {
          const json = (await res.json()) as PutToolStateResponse;
          if (isMounted.current) setLastSyncedAt(json.updatedAt);
        }
      } catch {
        // silently ignore sync errors
      } finally {
        if (isMounted.current) setIsSyncing(false);
      }
    },
    [key],
  );

  const setData = useCallback(
    (value: T | ((prev: T) => T)) => {
      setDataState((prev) => {
        const next =
          typeof value === "function"
            ? (value as (prev: T) => T)(prev)
            : value;
        localStorage.setItem(key, JSON.stringify(next));

        if (syncMode === "cloud" && isLoggedIn) {
          if (debounceTimer.current) clearTimeout(debounceTimer.current);
          debounceTimer.current = setTimeout(() => {
            putToCloud(next);
          }, 500);
        }

        return next;
      });
    },
    [key, syncMode, isLoggedIn, putToCloud],
  );

  const setSyncMode = useCallback(
    (mode: "local" | "cloud") => {
      localStorage.setItem(metaKey, mode);
      setSyncModeState(mode);

      if (mode === "cloud" && isLoggedIn) {
        // Fetch cloud state if it exists, don't auto-push local
        hasFetchedCloud.current = false;
        setIsSyncing(true);
        fetch(`/api/proxy/tool-state?key=${encodeURIComponent(key)}`, {
          credentials: "include",
        })
          .then(async (res) => {
            if (res.status === 404) return null;
            if (!res.ok) return null;
            return res.json() as Promise<GetToolStateResponse>;
          })
          .then((json) => {
            if (!isMounted.current) return;
            hasFetchedCloud.current = true;
            if (json && json.states.length > 0) {
              const entry = json.states[0];
              setDataState(entry.data as T);
              localStorage.setItem(key, JSON.stringify(entry.data));
              setLastSyncedAt(entry.updatedAt);
            }
          })
          .catch(() => {})
          .finally(() => {
            if (isMounted.current) setIsSyncing(false);
          });
      } else if (mode === "local") {
        setIsSyncing(true);
        fetch(`/api/proxy/tool-state?key=${encodeURIComponent(key)}`, {
          method: "DELETE",
          credentials: "include",
        })
          .catch(() => {})
          .finally(() => {
            if (isMounted.current) setIsSyncing(false);
          });
      }
    },
    [metaKey, key, defaultValue, isLoggedIn, putToCloud],
  );

  const pushToCloud = useCallback(async (): Promise<void> => {
    const storedRaw = localStorage.getItem(key);
    let current: T = defaultValue;
    if (storedRaw !== null) {
      try {
        current = JSON.parse(storedRaw) as T;
      } catch {
        current = defaultValue;
      }
    }
    await putToCloud(current);
  }, [key, defaultValue, putToCloud]);

  const syncToggleProps = {
    syncMode,
    onSyncModeChange: setSyncMode,
    onPushToCloud: pushToCloud,
    isSyncing,
    lastSyncedAt,
    isLoggedIn,
  };

  return {
    data,
    setData,
    syncMode,
    setSyncMode,
    pushToCloud,
    isSyncing,
    lastSyncedAt,
    isLoggedIn,
    syncToggleProps,
  };
}
