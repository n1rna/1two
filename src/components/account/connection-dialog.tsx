"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Check,
  Copy,
  Database,
  Eye,
  EyeOff,
  Loader2,
} from "lucide-react";
import type { DatabaseDetail } from "@/lib/databases";

function obfuscateUri(uri: string): string {
  return uri.replace(/:([^/:@]+)@/, ":••••••••@");
}

function parseUriParts(uri: string) {
  try {
    const match = uri.match(
      /^(postgresql):\/\/([^:]+):([^@]+)@([^/:]+):?(\d+)?\/([^?]+)(\?.+)?$/
    );
    if (!match) return null;
    return {
      protocol: match[1],
      user: match[2],
      password: match[3],
      host: match[4],
      port: match[5] ?? "5432",
      database: match[6],
      params: match[7] ?? "",
    };
  } catch {
    return null;
  }
}

export function ConnectionDialog({
  dbId,
  dbName,
  open,
  onOpenChange,
}: {
  dbId: string;
  dbName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [detail, setDetail] = useState<DatabaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/databases/${dbId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
      setDetail((await res.json()) as DatabaseDetail);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [dbId]);

  useEffect(() => {
    if (open) {
      setRevealed(false);
      setCopiedField(null);
      loadDetail();
    } else {
      setDetail(null);
    }
  }, [open, loadDetail]);

  const copyValue = async (value: string, field: string) => {
    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const uri = detail?.connectionUri ?? "";
  const parts = uri ? parseUriParts(uri) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Database className="h-4 w-4 text-muted-foreground" />
            Connection Details — {dbName}
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive py-4">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!loading && !error && detail && (
          <div className="space-y-4 min-w-0 overflow-hidden">
            {/* Full connection string */}
            <div className="space-y-1.5 min-w-0">
              <label className="text-xs font-medium text-muted-foreground">
                Connection string
              </label>
              <div className="flex items-center gap-1.5 min-w-0">
                <code className="flex-1 min-w-0 block rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all leading-relaxed select-all overflow-hidden">
                  {revealed ? uri : obfuscateUri(uri)}
                </code>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setRevealed((v) => !v)}
                    title={revealed ? "Hide password" : "Show password"}
                  >
                    {revealed ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => copyValue(uri, "uri")}
                    title="Copy connection string"
                  >
                    {copiedField === "uri" ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Individual fields */}
            {parts && (
              <div className="rounded-md border divide-y min-w-0 overflow-hidden">
                {([
                  ["Host", parts.host, "host"],
                  ["Port", parts.port, "port"],
                  ["Database", parts.database, "database"],
                  ["User", parts.user, "user"],
                  ["Password", revealed ? parts.password : "••••••••", "password"],
                ] as [string, string, string][]).map(([label, value, key]) => (
                  <div
                    key={key}
                    className="flex items-center gap-3 px-3 py-2 text-xs min-w-0"
                  >
                    <span className="w-20 shrink-0 text-muted-foreground font-medium">
                      {label}
                    </span>
                    <code className="flex-1 min-w-0 font-mono text-foreground truncate select-all">
                      {value}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0"
                      onClick={() =>
                        copyValue(
                          key === "password" ? parts.password : value,
                          key
                        )
                      }
                      title={`Copy ${label.toLowerCase()}`}
                    >
                      {copiedField === key ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {parts?.params && (
              <div className="space-y-1.5 min-w-0">
                <label className="text-xs font-medium text-muted-foreground">
                  Parameters
                </label>
                <code className="block rounded-md border bg-muted/40 px-3 py-2 text-xs font-mono break-all text-muted-foreground overflow-hidden">
                  {parts.params.slice(1)}
                </code>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
