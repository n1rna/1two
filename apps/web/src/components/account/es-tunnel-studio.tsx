"use client";

import { useCallback } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { ElasticsearchExplorer, type EsFetchFn } from "@/components/tools/elasticsearch-explorer";

function EsTunnelStudioInner({ token }: { token: string }) {
  const tunnelFetch: EsFetchFn = useCallback(
    async (_conn, path, options) => {
      const method = (options?.method ?? "GET").toUpperCase();
      const body = typeof options?.body === "string" ? options.body : "";
      const res = await fetch(`/api/proxy/tunnel/${token}/query`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path, body: body || undefined }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: string;
        };
        throw new Error(err.message ?? err.error ?? `HTTP ${res.status}`);
      }
      return res.json();
    },
    [token]
  );

  return <ElasticsearchExplorer tunnelMode fetchFn={tunnelFetch} />;
}

export function EsTunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <EsTunnelStudioInner token={token} />
    </AuthGate>
  );
}
