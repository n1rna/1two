"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellRing,
  Key,
  Copy,
  Check,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  RefreshCw,
  Send,
  Trash2,
  Info,
  X,
  Circle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────

interface NotificationLog {
  id: string;
  title: string;
  body: string;
  timestamp: Date;
  source: "local" | "push";
  payload?: unknown;
}

type PermissionState = "default" | "granted" | "denied";

// ── VAPID Key Helpers ─────────────────────────────────

async function generateVapidKeys(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );

  const publicRaw = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", keyPair.privateKey);

  const publicKey = btoa(String.fromCharCode(...new Uint8Array(publicRaw)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  // URL-safe base64 of the d parameter (private key scalar)
  const privateKey = privateJwk.d || "";

  return { publicKey, privateKey };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ── Copy Button ───────────────────────────────────────

function CopyBtn({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className={`p-1 rounded hover:bg-muted transition-colors shrink-0 ${className || ""}`}
    >
      {copied ? (
        <Check className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
}

// ── Component ─────────────────────────────────────────

export function NotificationTester() {
  const [mounted, setMounted] = useState(false);
  const [permission, setPermission] = useState<PermissionState>("default");
  const [swRegistration, setSwRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [subscription, setSubscription] =
    useState<PushSubscription | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  // VAPID keys
  const [vapidPublic, setVapidPublic] = useState("");
  const [vapidPrivate, setVapidPrivate] = useState("");
  const [generatingKeys, setGeneratingKeys] = useState(false);

  // Test notification
  const [testTitle, setTestTitle] = useState("Test Notification");
  const [testBody, setTestBody] = useState("This is a test notification from 1two.dev");

  // Notification log
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [showGuide, setShowGuide] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);

  // Init
  useEffect(() => {
    setMounted(true);
    if (typeof Notification !== "undefined") {
      setPermission(Notification.permission as PermissionState);
    }
  }, []);

  // Listen for push messages from service worker
  useEffect(() => {
    if (!mounted) return;

    const handler = (event: MessageEvent) => {
      if (event.data?.type === "push-received") {
        const payload = event.data.payload;
        addLog({
          title: payload.title || "Push",
          body: payload.body || "",
          source: "push",
          payload,
        });
      }
    };

    navigator.serviceWorker?.addEventListener("message", handler);
    return () => {
      navigator.serviceWorker?.removeEventListener("message", handler);
    };
  }, [mounted]);

  // Auto-scroll logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = useCallback((entry: Omit<NotificationLog, "id" | "timestamp">) => {
    setLogs((prev) => [
      ...prev,
      { ...entry, id: crypto.randomUUID(), timestamp: new Date() },
    ]);
  }, []);

  // ── Actions ─────────────────────────────────────────

  const requestPermission = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  }, []);

  const handleGenerateKeys = useCallback(async () => {
    setGeneratingKeys(true);
    try {
      const keys = await generateVapidKeys();
      setVapidPublic(keys.publicKey);
      setVapidPrivate(keys.privateKey);
    } catch {
      // Fallback — shouldn't fail in modern browsers
    } finally {
      setGeneratingKeys(false);
    }
  }, []);

  const registerAndSubscribe = useCallback(async () => {
    if (!vapidPublic) return;
    setSubscribing(true);

    try {
      // Register service worker
      const reg = await navigator.serviceWorker.register("/notification-sw.js");
      await navigator.serviceWorker.ready;
      setSwRegistration(reg);

      // Subscribe to push
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic).buffer as ArrayBuffer,
      });

      setSubscription(sub);
      addLog({
        title: "Subscribed",
        body: "Push subscription created successfully",
        source: "local",
      });
    } catch (err) {
      addLog({
        title: "Subscription Failed",
        body: err instanceof Error ? err.message : "Unknown error",
        source: "local",
      });
    } finally {
      setSubscribing(false);
    }
  }, [vapidPublic, addLog]);

  const unsubscribe = useCallback(async () => {
    if (subscription) {
      await subscription.unsubscribe();
      setSubscription(null);
      addLog({
        title: "Unsubscribed",
        body: "Push subscription removed",
        source: "local",
      });
    }
    if (swRegistration) {
      await swRegistration.unregister();
      setSwRegistration(null);
    }
  }, [subscription, swRegistration, addLog]);

  const sendLocalNotification = useCallback(() => {
    if (permission !== "granted") return;

    const title = testTitle.trim() || "Test Notification";
    const body = testBody.trim() || "";

    new Notification(title, { body });

    addLog({ title, body, source: "local" });
  }, [permission, testTitle, testBody, addLog]);

  const subscriptionJson = subscription
    ? JSON.stringify(subscription.toJSON(), null, 2)
    : null;

  const PermissionIcon =
    permission === "granted"
      ? ShieldCheck
      : permission === "denied"
        ? ShieldX
        : ShieldAlert;

  const permissionColor =
    permission === "granted"
      ? "text-green-500"
      : permission === "denied"
        ? "text-destructive"
        : "text-amber-500";

  if (!mounted) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="border-b shrink-0">
        <div className="max-w-6xl mx-auto flex items-center gap-2 px-6 py-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">Notifications</span>

          <div className={`flex items-center gap-1 text-xs ml-2 ${permissionColor}`}>
            <PermissionIcon className="h-3.5 w-3.5" />
            {permission === "granted"
              ? "Allowed"
              : permission === "denied"
                ? "Blocked"
                : "Not requested"}
          </div>

          {subscription && (
            <div className="flex items-center gap-1 text-xs text-green-500 ml-2">
              <Circle className="h-2 w-2" fill="currentColor" strokeWidth={0} />
              Subscribed
            </div>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setShowGuide((v) => !v)}
            >
              <Info className="h-3 w-3 mr-1" />
              {showGuide ? "Hide" : "Guide"}
            </Button>
            {logs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setLogs([])}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Left panel — Controls */}
        <div className="lg:w-96 shrink-0 border-b lg:border-b-0 lg:border-r overflow-auto">
          <div className="p-4 space-y-5">
            {/* 1. Permission */}
            <Section title="1. Permission" number={1}>
              {permission === "granted" ? (
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <ShieldCheck className="h-4 w-4" />
                  Notifications allowed
                </div>
              ) : permission === "denied" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <ShieldX className="h-4 w-4" />
                    Notifications blocked
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Reset notification permissions in your browser settings for this site.
                  </p>
                </div>
              ) : (
                <Button size="sm" onClick={requestPermission} className="gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  Request Permission
                </Button>
              )}
            </Section>

            {/* 2. VAPID Keys */}
            <Section title="2. VAPID Keys" number={2}>
              <p className="text-xs text-muted-foreground mb-2">
                Generate a VAPID key pair for Web Push, or paste your own public key.
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateKeys}
                disabled={generatingKeys}
                className="gap-1.5 mb-3"
              >
                <Key className="h-3.5 w-3.5" />
                {generatingKeys ? "Generating..." : "Generate Keys"}
              </Button>

              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                    Public Key
                  </label>
                  <div className="flex items-center gap-1">
                    <Input
                      value={vapidPublic}
                      onChange={(e) => setVapidPublic(e.target.value)}
                      placeholder="Paste or generate VAPID public key"
                      className="font-mono text-[11px] h-8"
                      spellCheck={false}
                    />
                    {vapidPublic && <CopyBtn text={vapidPublic} />}
                  </div>
                </div>
                {vapidPrivate && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                      Private Key
                    </label>
                    <div className="flex items-center gap-1">
                      <Input
                        value={vapidPrivate}
                        readOnly
                        className="font-mono text-[11px] h-8"
                      />
                      <CopyBtn text={vapidPrivate} />
                    </div>
                    <p className="text-[10px] text-amber-500/80">
                      Keep this secret — only use it server-side.
                    </p>
                  </div>
                )}
              </div>
            </Section>

            {/* 3. Subscribe */}
            <Section title="3. Subscribe" number={3}>
              {!subscription ? (
                <Button
                  size="sm"
                  onClick={registerAndSubscribe}
                  disabled={
                    !vapidPublic || permission !== "granted" || subscribing
                  }
                  className="gap-1.5"
                >
                  <BellRing className="h-3.5 w-3.5" />
                  {subscribing ? "Subscribing..." : "Subscribe to Push"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] text-green-600 dark:text-green-400 border-green-500/30">
                      Active
                    </Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={unsubscribe}
                      className="h-6 px-2 text-xs text-destructive"
                    >
                      Unsubscribe
                    </Button>
                  </div>
                  <ExpandableJson label="Subscription" json={subscriptionJson!} />
                </div>
              )}
              {!vapidPublic && permission === "granted" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Generate or paste a VAPID public key first.
                </p>
              )}
              {permission !== "granted" && permission !== "denied" && (
                <p className="text-xs text-muted-foreground mt-1">
                  Request notification permission first.
                </p>
              )}
            </Section>

            {/* 4. Send Test */}
            <Section title="4. Send Test" number={4}>
              <div className="space-y-2">
                <Input
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="Notification title"
                  className="text-sm h-8"
                />
                <Textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  placeholder="Notification body"
                  className="text-sm min-h-[60px] max-h-[100px] resize-y"
                />
                <Button
                  size="sm"
                  onClick={sendLocalNotification}
                  disabled={permission !== "granted"}
                  className="gap-1.5"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send Local Notification
                </Button>
              </div>
            </Section>
          </div>
        </div>

        {/* Right panel — Log + Guide */}
        <div className="flex-1 min-h-0 relative">
          {/* Guide overlay */}
          {showGuide && (
            <div className="absolute inset-0 z-10 bg-background overflow-auto px-6 py-4">
              <div className="max-w-2xl mx-auto">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Push Notification Guide
                  </span>
                  <button onClick={() => setShowGuide(false)} className="p-1 hover:bg-muted rounded">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
                <div className="space-y-4 text-xs text-muted-foreground">
                  <div className="space-y-2">
                    <p className="font-medium text-foreground">How it works</p>
                    <ol className="list-decimal pl-4 space-y-1">
                      <li>Grant notification permission in your browser</li>
                      <li>Generate a VAPID key pair (or use your own)</li>
                      <li>Subscribe to push — this creates a push subscription with an endpoint URL and keys</li>
                      <li>Use the subscription JSON to send pushes from your server</li>
                    </ol>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Sending a push from your server</p>
                    <p>Use the subscription endpoint and keys with a Web Push library:</p>
                    <CodeBlock
                      title="Node.js (web-push)"
                      code={`const webpush = require('web-push');

webpush.setVapidDetails(
  'mailto:you@example.com',
  publicKey,
  privateKey
);

await webpush.sendNotification(
  subscription, // the subscription JSON from step 3
  JSON.stringify({
    title: 'Hello!',
    body: 'This is a push notification'
  })
);`}
                    />
                    <CodeBlock
                      title="Python (pywebpush)"
                      code={`from pywebpush import webpush

webpush(
    subscription_info=subscription_json,
    data='{"title":"Hello!","body":"Push notification"}',
    vapid_private_key=private_key,
    vapid_claims={"sub": "mailto:you@example.com"}
)`}
                    />
                    <CodeBlock
                      title="cURL"
                      code={`curl -X POST <subscription_endpoint> \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer <jwt_token>" \\
  -H "Crypto-Key: p256ecdsa=<vapid_public_key>" \\
  -d '{"title":"Hello!","body":"Test push"}'`}
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Firebase Cloud Messaging (FCM)</p>
                    <p>
                      If you use Firebase, paste your FCM VAPID public key (from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates) in the public key field instead of generating one.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Troubleshooting</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Permission denied</strong> — reset in browser settings (Site Settings → Notifications)</li>
                      <li><strong>Subscription fails</strong> — check that the VAPID key is valid URL-safe base64</li>
                      <li><strong>No notification shown</strong> — ensure browser tab is not focused (some browsers suppress notifications for active tabs)</li>
                      <li><strong>Service worker error</strong> — check the browser console for registration errors</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notification Log */}
          <div className="h-full overflow-auto px-6 py-4">
            <div className="max-w-2xl mx-auto space-y-2">
              {logs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40">
                  <BellRing className="h-10 w-10 mb-3" />
                  <p className="text-sm">No notifications yet</p>
                  <p className="text-xs mt-1">
                    Notifications will appear here as they arrive
                  </p>
                </div>
              )}
              {logs.map((log) => (
                <LogEntry key={log.id} log={log} />
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────

function Section({
  title,
  number,
  children,
}: {
  title: string;
  number: number;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold shrink-0">
          {number}
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="pl-7">{children}</div>
    </div>
  );
}

function ExpandableJson({ label, json }: { label: string; json: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        {label}
      </button>
      {expanded && (
        <div className="relative">
          <pre className="bg-muted rounded-md p-2.5 font-mono text-[11px] overflow-auto max-h-48 text-muted-foreground">
            {json}
          </pre>
          <CopyBtn text={json} className="absolute top-1.5 right-1.5" />
        </div>
      )}
    </div>
  );
}

function LogEntry({ log }: { log: NotificationLog }) {
  const isPush = log.source === "push";
  return (
    <div
      className={`rounded-lg border px-3 py-2.5 ${
        isPush
          ? "border-blue-500/20 bg-blue-500/5"
          : "border-muted"
      }`}
    >
      <div className="flex items-center gap-2 mb-0.5">
        {isPush ? (
          <BellRing className="h-3.5 w-3.5 text-blue-500 shrink-0" />
        ) : (
          <Bell className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
        <span className="text-sm font-medium truncate">{log.title}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 ${
            isPush
              ? "border-blue-500/30 text-blue-600 dark:text-blue-400"
              : "border-muted-foreground/20"
          }`}
        >
          {isPush ? "PUSH" : "LOCAL"}
        </Badge>
        <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums ml-auto shrink-0">
          {log.timestamp.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })}
        </span>
      </div>
      {log.body && (
        <p className="text-xs text-muted-foreground pl-5.5 ml-px">{log.body}</p>
      )}
    </div>
  );
}

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div className="relative">
      <div className="flex items-center justify-between bg-muted rounded-t-md px-2.5 py-1 border-b border-border/50">
        <span className="text-[10px] text-muted-foreground/60">{title}</span>
        <CopyBtn text={code} />
      </div>
      <pre className="bg-muted rounded-b-md p-2.5 font-mono text-[11px] overflow-auto max-h-40">
        {code}
      </pre>
    </div>
  );
}
