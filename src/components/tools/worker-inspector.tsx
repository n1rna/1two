"use client";

import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Cog,
  RefreshCw,
  Trash2,
  Database,
  ExternalLink,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import {
  getRegistrations,
  unregisterWorker,
  updateWorker,
  getCacheEntries,
  deleteCache,
  isServiceWorkerSupported,
  isCacheStorageSupported,
  type WorkerRegistration,
  type CacheEntry,
} from "@/lib/tools/workers";

const STATE_COLORS: Record<string, string> = {
  activated: "bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/40",
  activating: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40",
  installed: "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/40",
  installing: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-500/40",
  redundant: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/40",
  unknown: "bg-muted text-muted-foreground border-border",
};

export function WorkerInspector() {
  const [registrations, setRegistrations] = useState<WorkerRegistration[]>([]);
  const [caches, setCaches] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [swSupported, setSwSupported] = useState(true);
  const [cacheSupported, setCacheSupported] = useState(true);
  const [expandedCaches, setExpandedCaches] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [regs, entries] = await Promise.all([
        getRegistrations(),
        getCacheEntries(),
      ]);
      setRegistrations(regs);
      setCaches(entries);
    } catch {
      // Silently handle — may not have permission
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    setSwSupported(isServiceWorkerSupported());
    setCacheSupported(isCacheStorageSupported());
    refresh();
  }, [refresh]);

  const handleUnregister = useCallback(
    async (scope: string) => {
      await unregisterWorker(scope);
      await refresh();
    },
    [refresh]
  );

  const handleUpdate = useCallback(
    async (scope: string) => {
      await updateWorker(scope);
      await refresh();
    },
    [refresh]
  );

  const handleDeleteCache = useCallback(
    async (name: string) => {
      await deleteCache(name);
      await refresh();
    },
    [refresh]
  );

  const toggleCacheExpand = useCallback((name: string) => {
    setExpandedCaches((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0 sticky top-0 z-10 bg-background">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Cog className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Worker Inspector</span>

          <span className="text-xs text-muted-foreground ml-2">
            {registrations.length} worker{registrations.length !== 1 ? "s" : ""}
            {" · "}
            {caches.length} cache{caches.length !== 1 ? "s" : ""}
          </span>

          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Service Workers */}
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Cog className="h-4 w-4 text-muted-foreground" />
              Service Workers
            </h2>

            {!swSupported ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Service Workers are not supported in this browser.
              </div>
            ) : registrations.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
                No service workers registered on this origin.
              </div>
            ) : (
              <div className="space-y-3">
                {registrations.map((reg) => (
                  <div
                    key={reg.id}
                    className="border rounded-lg p-4 bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                              STATE_COLORS[reg.state] || STATE_COLORS.unknown
                            }`}
                          >
                            {reg.state}
                          </span>
                          <span
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded border bg-muted text-muted-foreground border-border"
                          >
                            {reg.type}
                          </span>
                        </div>

                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                          <span className="text-muted-foreground">Script</span>
                          <span className="font-mono truncate text-foreground">
                            {reg.scriptURL}
                          </span>
                          <span className="text-muted-foreground">Scope</span>
                          <span className="font-mono truncate text-foreground">
                            {reg.scope}
                          </span>
                          <span className="text-muted-foreground">Update via cache</span>
                          <span className="text-foreground">{reg.updateViaCache}</span>
                        </div>
                      </div>

                      <div className="flex gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleUpdate(reg.scope)}
                          title="Check for updates"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600"
                          onClick={() => handleUnregister(reg.scope)}
                          title="Unregister"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => window.open(reg.scriptURL, "_blank")}
                          title="Open script"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Cache Storage */}
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Database className="h-4 w-4 text-muted-foreground" />
              Cache Storage
            </h2>

            {!cacheSupported ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg p-4">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Cache Storage is not supported in this browser.
              </div>
            ) : caches.length === 0 ? (
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-4 text-center">
                No caches found on this origin.
              </div>
            ) : (
              <div className="space-y-2">
                {caches.map((cache) => {
                  const expanded = expandedCaches.has(cache.name);
                  return (
                    <div
                      key={cache.name}
                      className="border rounded-lg bg-muted/20 overflow-hidden"
                    >
                      <div className="flex items-center gap-2 px-4 py-3">
                        <button
                          onClick={() => toggleCacheExpand(cache.name)}
                          className="text-muted-foreground hover:text-foreground shrink-0"
                        >
                          {expanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <span className="text-sm font-mono font-medium truncate">
                          {cache.name}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {cache.count} {cache.count === 1 ? "entry" : "entries"}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-red-500 hover:text-red-600 ml-auto shrink-0"
                          onClick={() => handleDeleteCache(cache.name)}
                          title="Delete cache"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      {expanded && cache.urls.length > 0 && (
                        <div className="border-t px-4 py-2 space-y-1 max-h-48 overflow-auto">
                          {cache.urls.map((url) => (
                            <div
                              key={url}
                              className="text-xs font-mono text-muted-foreground truncate"
                            >
                              {url}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
