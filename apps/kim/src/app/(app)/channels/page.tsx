"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  AlertCircle,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Loader2,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  Unplug,
  X,
  type LucideIcon,
} from "lucide-react";
import { ListShell } from "@/components/list-shell";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  deleteChannelLink,
  disconnectGCal,
  getGCalAuthUrl,
  getGCalStatus,
  initChannelLink,
  listChannelLinks,
  verifyChannelLink,
  type ChannelLink,
  type GCalStatus,
} from "@/lib/life";

// ─── Types ───────────────────────────────────────────────────────────────────

type Status = "connected" | "pending" | "disconnected";

interface PendingVerification {
  id: string;
  channel: string;
  verifyCode: string;
}

interface IntegrationDefinition {
  id: "google" | "telegram" | "email";
  name: string;
  subtitle: string;
  icon: LucideIcon;
  capabilities: string[];
}

const INTEGRATIONS: IntegrationDefinition[] = [
  {
    id: "google",
    name: "Google",
    subtitle: "Calendar + Tasks, one OAuth connection",
    icon: CalendarDays,
    capabilities: ["Read & write events", "Sync task lists", "Morning summaries"],
  },
  {
    id: "telegram",
    name: "Telegram",
    subtitle: "Chat with kim from the Telegram app",
    icon: Send,
    capabilities: ["Push reminders", "Two-way chat", "Daily summaries"],
  },
  {
    id: "email",
    name: "Email",
    subtitle: "Reach kim from any inbox",
    icon: Mail,
    capabilities: ["Reply to nudges", "Forward anything for triage", "Daily digest"],
  },
];

// ─── Page ────────────────────────────────────────────────────────────────────

export default function ChannelsPage() {
  const [links, setLinks] = useState<ChannelLink[]>([]);
  const [gcal, setGcal] = useState<GCalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingVerification | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [initializing, setInitializing] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [emailDraft, setEmailDraft] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [linksRes, gcalRes] = await Promise.allSettled([
        listChannelLinks(),
        getGCalStatus(),
      ]);
      if (linksRes.status === "fulfilled") setLinks(linksRes.value);
      if (gcalRes.status === "fulfilled") setGcal(gcalRes.value);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load channels");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Channel link actions ─────────────────────────────────────────────────

  const startLink = async (
    channel: "telegram" | "email",
    channelUid?: string,
  ) => {
    setInitializing(channel);
    setError(null);
    try {
      const res = await initChannelLink(channel, channelUid);
      setPending({ id: res.id, channel: res.channel, verifyCode: res.verifyCode });
      if (channel === "email") setEmailDraft(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start link");
    } finally {
      setInitializing(null);
    }
  };

  const cancelPending = () => {
    setPending(null);
    setVerifyCode("");
  };

  const verify = async () => {
    if (!pending) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyChannelLink(pending.id, verifyCode);
      setPending(null);
      setVerifyCode("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  const removeLink = async (id: string) => {
    setDisconnecting(id);
    try {
      await deleteChannelLink(id);
      setLinks((cur) => cur.filter((l) => l.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect");
    } finally {
      setDisconnecting(null);
    }
  };

  // ─── Google actions ───────────────────────────────────────────────────────

  const connectGoogle = async () => {
    setInitializing("google");
    setError(null);
    try {
      const { url } = await getGCalAuthUrl();
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start Google OAuth");
      setInitializing(null);
    }
  };

  const removeGoogle = async () => {
    setDisconnecting("google");
    try {
      await disconnectGCal();
      setGcal({ connected: false });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to disconnect Google");
    } finally {
      setDisconnecting(null);
    }
  };

  // ─── Derived per-integration state ────────────────────────────────────────

  const googleStatus: Status = gcal?.connected ? "connected" : "disconnected";
  const telegramLinks = links.filter((l) => l.channel === "telegram");
  const emailLinks = links.filter((l) => l.channel === "email");

  const connectedCount =
    (gcal?.connected ? 1 : 0) +
    telegramLinks.filter((l) => l.verified).length +
    emailLinks.filter((l) => l.verified).length;
  const pendingCount =
    telegramLinks.filter((l) => !l.verified).length +
    emailLinks.filter((l) => !l.verified).length;

  return (
    <ListShell
      title="Channels"
      subtitle="Where kim can reach you and what she has access to"
      toolbar={
        <>
          <Metric label="connected" value={connectedCount} tone="primary" />
          <Metric label="pending" value={pendingCount} tone="warn" />
          <div className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            onClick={load}
            disabled={loading}
            className="gap-1.5 h-7"
          >
            <RefreshCw className={cn("h-3 w-3", loading && "animate-spin")} />
            Refresh
          </Button>
        </>
      }
    >
      <div className="px-8 py-6 space-y-5">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError(null)}
              className="hover:opacity-60 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {pending && (
          <VerifyPanel
            pending={pending}
            code={verifyCode}
            onChange={setVerifyCode}
            onVerify={verify}
            onCancel={cancelPending}
            verifying={verifying}
          />
        )}

        {loading && !links.length && !gcal ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 rounded-xl border border-border bg-card animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <GoogleCard
              def={INTEGRATIONS[0]}
              status={googleStatus}
              gcal={gcal}
              initializing={initializing === "google"}
              disconnecting={disconnecting === "google"}
              onConnect={connectGoogle}
              onDisconnect={removeGoogle}
            />

            <ChannelLinkCard
              def={INTEGRATIONS[1]}
              links={telegramLinks}
              initializing={initializing === "telegram"}
              disconnectingId={disconnecting}
              onAdd={() => startLink("telegram")}
              onRemove={removeLink}
            />

            <ChannelLinkCard
              def={INTEGRATIONS[2]}
              links={emailLinks}
              initializing={initializing === "email"}
              disconnectingId={disconnecting}
              onAdd={() => setEmailDraft((cur) => (cur === null ? "" : cur))}
              onRemove={removeLink}
              draft={emailDraft}
              onDraftChange={setEmailDraft}
              onSubmitDraft={() => {
                if (emailDraft && emailDraft.trim()) {
                  void startLink("email", emailDraft.trim());
                }
              }}
              onCancelDraft={() => setEmailDraft(null)}
              draftPlaceholder="you@example.com"
              draftCtaLabel="Send verification code"
              addCtaLabel={emailLinks.length > 0 ? "Add another" : "Connect email"}
            />
          </div>
        )}
      </div>
    </ListShell>
  );
}

// ─── Toolbar metric pill ─────────────────────────────────────────────────────

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warn";
}) {
  if (value === 0 && tone === "warn") return null;
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider">
      <span
        className={cn(
          "font-mono text-sm",
          tone === "primary" ? "text-primary" : "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

// ─── Verify panel for pending telegram/email links ──────────────────────────

function VerifyPanel({
  pending,
  code,
  onChange,
  onVerify,
  onCancel,
  verifying,
}: {
  pending: PendingVerification;
  code: string;
  onChange: (v: string) => void;
  onVerify: () => void;
  onCancel: () => void;
  verifying: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const channelLabel = pending.channel === "telegram" ? "Telegram" : "email";
  const instruction =
    pending.channel === "telegram"
      ? "Open @kim1_bot on Telegram and send this code to it. Kim will reply with a short confirmation code."
      : "Send an email to kim@kim1.ai with this code in the subject line. Kim will reply with a short confirmation code.";

  const copy = () => {
    navigator.clipboard.writeText(pending.verifyCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-primary/40 bg-primary/5 overflow-hidden">
      <div className="px-5 py-4 border-b border-primary/20 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <h3 className="text-sm font-semibold">
              Finish linking {channelLabel}
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {instruction}
          </p>
        </div>
        <button
          onClick={onCancel}
          className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          aria-label="Cancel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-5 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            step 1 — send this code
          </div>
          <button
            onClick={copy}
            className="group inline-flex items-center gap-2 font-mono text-lg tracking-wider px-3 py-2 rounded-md bg-background border border-border hover:border-primary transition-colors"
            title="Copy code"
          >
            {pending.verifyCode}
            {copied ? (
              <Check className="h-3.5 w-3.5 text-primary" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
            )}
          </button>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mb-1.5">
            step 2 — paste kim&apos;s confirmation
          </div>
          <div className="flex gap-2">
            <input
              value={code}
              onChange={(e) => onChange(e.target.value)}
              placeholder="abc123"
              className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-ring"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !verifying && code) onVerify();
              }}
              autoFocus
            />
            <Button size="sm" onClick={onVerify} disabled={verifying || !code}>
              {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Verify"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Shared card chrome ──────────────────────────────────────────────────────

interface BaseCardProps {
  def: IntegrationDefinition;
  status: Status;
  statusDetail?: string;
  actions: ReactNode;
  children?: ReactNode;
}

function IntegrationCard({
  def,
  status,
  statusDetail,
  actions,
  children,
}: BaseCardProps) {
  const Icon = def.icon;
  const statusMeta: Record<Status, { label: string; cls: string; dot: string }> = {
    connected: {
      label: "connected",
      cls: "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
      dot: "bg-emerald-500",
    },
    pending: {
      label: "pending",
      cls: "text-amber-700 dark:text-amber-400 bg-amber-500/10 border-amber-500/30",
      dot: "bg-amber-500 animate-pulse",
    },
    disconnected: {
      label: "not connected",
      cls: "text-muted-foreground bg-muted/40 border-border",
      dot: "bg-muted-foreground/50",
    },
  };
  const meta = statusMeta[status];

  return (
    <section className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-border">
        <div className="min-w-0 flex items-start gap-3">
          <div className="mt-0.5 h-10 w-10 shrink-0 rounded-md bg-muted text-primary flex items-center justify-center">
            <Icon className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold tracking-tight">
                {def.name}
              </h2>
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded-full border text-[9px] uppercase tracking-[0.12em] font-medium",
                  meta.cls,
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
                {meta.label}
              </span>
            </div>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">
              {def.subtitle}
            </p>
            {statusDetail && (
              <p className="text-[11px] text-muted-foreground/80 mt-1 font-mono">
                {statusDetail}
              </p>
            )}
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">{actions}</div>
      </div>

      <div className="px-5 py-3 flex items-center gap-x-3 gap-y-1 flex-wrap text-[11px] text-muted-foreground">
        {def.capabilities.map((cap, i) => (
          <span key={cap} className="inline-flex items-center gap-1.5">
            {i > 0 && <span className="text-border">·</span>}
            <CheckCircle2 className="h-3 w-3 text-primary/70" />
            {cap}
          </span>
        ))}
      </div>

      {children && (
        <div className="border-t border-border px-5 py-4">{children}</div>
      )}
    </section>
  );
}

// ─── Google card ─────────────────────────────────────────────────────────────

function GoogleCard({
  def,
  status,
  gcal,
  initializing,
  disconnecting,
  onConnect,
  onDisconnect,
}: {
  def: IntegrationDefinition;
  status: Status;
  gcal: GCalStatus | null;
  initializing: boolean;
  disconnecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const expiryText = useMemo(() => {
    if (!gcal?.tokenExpiry) return null;
    const expiry = new Date(gcal.tokenExpiry).getTime();
    const now = Date.now();
    if (Number.isNaN(expiry)) return null;
    if (expiry <= now) return "token expired — kim will refresh on next call";
    const mins = Math.round((expiry - now) / 60000);
    if (mins < 60) return `refreshes in ${mins} min`;
    const hours = Math.round(mins / 60);
    return `refreshes in ${hours}h`;
  }, [gcal?.tokenExpiry]);

  const statusDetail = gcal?.connected
    ? [gcal.email, expiryText].filter(Boolean).join(" · ")
    : undefined;

  const actions = status === "connected" ? (
    <Button
      size="sm"
      variant="outline"
      onClick={onDisconnect}
      disabled={disconnecting}
      className="gap-1.5 h-8 text-destructive hover:text-destructive"
    >
      {disconnecting ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Unplug className="h-3.5 w-3.5" />
      )}
      Disconnect
    </Button>
  ) : (
    <Button size="sm" onClick={onConnect} disabled={initializing} className="gap-1.5 h-8">
      {initializing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      Connect Google
    </Button>
  );

  return (
    <IntegrationCard
      def={def}
      status={status}
      statusDetail={statusDetail}
      actions={actions}
    />
  );
}

// ─── Telegram / Email card (multi-account supported) ────────────────────────

function ChannelLinkCard({
  def,
  links,
  initializing,
  disconnectingId,
  onAdd,
  onRemove,
  draft,
  onDraftChange,
  onSubmitDraft,
  onCancelDraft,
  draftPlaceholder,
  draftCtaLabel,
  addCtaLabel,
}: {
  def: IntegrationDefinition;
  links: ChannelLink[];
  initializing: boolean;
  disconnectingId: string | null;
  onAdd: () => void;
  onRemove: (id: string) => void;
  /** When non-null, an inline form is shown instead of calling onAdd directly. */
  draft?: string | null;
  onDraftChange?: (value: string) => void;
  onSubmitDraft?: () => void;
  onCancelDraft?: () => void;
  draftPlaceholder?: string;
  draftCtaLabel?: string;
  addCtaLabel?: string;
}) {
  const verified = links.filter((l) => l.verified);
  const pending = links.filter((l) => !l.verified);
  const status: Status = verified.length > 0
    ? "connected"
    : pending.length > 0
      ? "pending"
      : "disconnected";

  const statusDetail = verified.length > 0
    ? `${verified.length} account${verified.length > 1 ? "s" : ""} linked`
    : pending.length > 0
      ? "waiting for verification"
      : undefined;

  const draftOpen = draft !== undefined && draft !== null;

  const actions = (
    <Button
      size="sm"
      variant="outline"
      onClick={onAdd}
      disabled={initializing || draftOpen}
      className="gap-1.5 h-8"
    >
      {initializing ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plus className="h-3.5 w-3.5" />
      )}
      {addCtaLabel ?? (verified.length > 0 ? "Add another" : `Connect ${def.name}`)}
    </Button>
  );

  const hasAny = links.length > 0;

  return (
    <IntegrationCard
      def={def}
      status={status}
      statusDetail={statusDetail}
      actions={actions}
    >
      {draftOpen && (
        <form
          className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmitDraft?.();
          }}
        >
          <label className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            Email address
          </label>
          <input
            type="email"
            autoFocus
            required
            value={draft ?? ""}
            onChange={(e) => onDraftChange?.(e.target.value)}
            placeholder={draftPlaceholder ?? "you@example.com"}
            className="w-full bg-background border border-border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex items-center gap-2 justify-end">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onCancelDraft?.()}
              disabled={initializing}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={initializing || !draft || !draft.trim()}
            >
              {initializing ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : null}
              {draftCtaLabel ?? "Continue"}
            </Button>
          </div>
        </form>
      )}
      {hasAny && (
        <ul className="space-y-2">
          {links.map((link) => (
            <LinkRow
              key={link.id}
              link={link}
              disconnecting={disconnectingId === link.id}
              onRemove={() => onRemove(link.id)}
            />
          ))}
        </ul>
      )}
    </IntegrationCard>
  );
}

function LinkRow({
  link,
  disconnecting,
  onRemove,
}: {
  link: ChannelLink;
  disconnecting: boolean;
  onRemove: () => void;
}) {
  const created = new Date(link.createdAt);
  const dateLabel = Number.isNaN(created.getTime())
    ? null
    : created.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });

  const Icon = link.channel === "telegram" ? Send : Mail;

  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm truncate">
              {link.displayName || link.channelUid}
            </span>
            {link.verified ? (
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="h-2.5 w-2.5" />
                verified
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Clock className="h-2.5 w-2.5" />
                pending
              </span>
            )}
          </div>
          {dateLabel && (
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              linked {dateLabel}
            </div>
          )}
        </div>
      </div>
      <button
        onClick={onRemove}
        disabled={disconnecting}
        className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
        title="Disconnect"
      >
        {disconnecting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Trash2 className="h-3.5 w-3.5" />
        )}
      </button>
    </li>
  );
}
