"use client";

import { useEffect } from "react";
import { AuthGate } from "@/components/layout/auth-gate";
import { RedisStudioInner } from "@/components/account/redis-studio";
import { setTunnelExecutor, type RedisCommandResult } from "@/lib/redis";

function RedisTunnelStudioInner({ token }: { token: string }) {
  // Set the tunnel executor so all Redis commands go through the tunnel
  useEffect(() => {
    setTunnelExecutor(async (command: string[]): Promise<RedisCommandResult> => {
      try {
        // queryTunnel returns the parsed JSON body. For Redis results,
        // the backend forwards the CLI's raw payload directly — which can
        // be a string, number, array, or object (not always { result: ... }).
        const raw = await fetch(`/api/proxy/tunnel/${token}/query`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command }),
        });
        if (!raw.ok) {
          const err = await raw.json().catch(() => ({})) as { message?: string; error?: string };
          return { result: null, error: err.message ?? err.error ?? `HTTP ${raw.status}` };
        }
        const body = await raw.json();
        // The response IS the raw Redis result (string, array, number, etc.)
        return { result: body };
      } catch (err) {
        return { result: null, error: err instanceof Error ? err.message : "Tunnel command failed" };
      }
    });

    return () => {
      // Clean up on unmount so hosted Redis pages work normally
      setTunnelExecutor(null);
    };
  }, [token]);

  // Use "tunnel" as a fake dbId — it won't be used for API calls
  // since the tunnel executor intercepts everything
  return <RedisStudioInner dbId={`tunnel:${token}`} />;
}

export function RedisTunnelStudio({ token }: { token: string }) {
  return (
    <AuthGate>
      <RedisTunnelStudioInner token={token} />
    </AuthGate>
  );
}
