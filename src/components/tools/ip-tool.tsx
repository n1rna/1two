"use client";

import { Copy, Check, MapPin, Globe, Wifi, Terminal } from "lucide-react";
import { useState } from "react";

// ── Types ─────────────────────────────────────────────

export interface IpInfo {
  ip?: string;
  country?: string;
  countryCode?: string;
  region?: string;
  regionName?: string;
  city?: string;
  zip?: string;
  timezone?: string;
  isp?: string;
  org?: string;
  as?: string;
  lat?: number;
  lon?: number;
  [key: string]: unknown;
}

export interface IpToolProps {
  ipv4: string | null;
  ipv6: string | null;
  info: IpInfo | null;
  error?: string | null;
}

// ── Helpers ───────────────────────────────────────────

function useCopy(text: string, duration = 1500) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), duration);
    } catch {
      // ignore
    }
  }
  return { copied, copy };
}

// ── Sub-components ────────────────────────────────────

function CopyButton({ text, size = "sm" }: { text: string; size?: "sm" | "xs" }) {
  const { copied, copy } = useCopy(text);
  const cls =
    size === "xs"
      ? "p-1 rounded hover:bg-muted transition-colors"
      : "p-1.5 rounded-md hover:bg-muted transition-colors";
  const iconCls = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  return (
    <button onClick={copy} className={cls} aria-label="Copy">
      {copied ? (
        <Check className={`${iconCls} text-green-500`} />
      ) : (
        <Copy className={`${iconCls} text-muted-foreground`} />
      )}
    </button>
  );
}

interface InfoCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

function InfoCard({ label, value, icon }: InfoCardProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border bg-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <span className="text-sm font-medium break-all">{value}</span>
    </div>
  );
}

function CodeBlock({ label, command }: { label: string; command: string }) {
  return (
    <div className="group flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">
          {label}
        </span>
        <code className="font-mono text-sm text-foreground truncate">{command}</code>
      </div>
      <div className="shrink-0 ml-3">
        <CopyButton text={command} size="xs" />
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────

export function IpTool({ ipv4, ipv6, info, error }: IpToolProps) {
  // Build info card rows
  const infoRows: { label: string; value: string; icon: React.ReactNode }[] = [];
  if (info) {
    if (info.country || info.countryCode) {
      const val = [info.country, info.countryCode ? `(${info.countryCode})` : ""]
        .filter(Boolean)
        .join(" ");
      infoRows.push({ label: "Country", value: val, icon: <Globe className="h-3 w-3" /> });
    }
    if (info.regionName || info.region) {
      infoRows.push({ label: "Region", value: (info.regionName || info.region)!, icon: <MapPin className="h-3 w-3" /> });
    }
    if (info.city) {
      infoRows.push({ label: "City", value: info.city, icon: <MapPin className="h-3 w-3" /> });
    }
    if (info.zip) {
      infoRows.push({ label: "ZIP / Postal Code", value: info.zip, icon: <MapPin className="h-3 w-3" /> });
    }
    if (info.timezone) {
      infoRows.push({ label: "Timezone", value: info.timezone, icon: <Globe className="h-3 w-3" /> });
    }
    if (info.isp) {
      infoRows.push({ label: "ISP", value: info.isp, icon: <Wifi className="h-3 w-3" /> });
    }
    if (info.org) {
      infoRows.push({ label: "Organization", value: info.org, icon: <Wifi className="h-3 w-3" /> });
    }
    if (info.as) {
      infoRows.push({ label: "AS Number", value: info.as, icon: <Wifi className="h-3 w-3" /> });
    }
    if (info.lat != null && info.lon != null) {
      infoRows.push({
        label: "Coordinates",
        value: `${info.lat}, ${info.lon}`,
        icon: <MapPin className="h-3 w-3" />,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Section A - Your IP Address */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Your IP Address
        </h2>
        {error && !ipv4 && !ipv6 ? (
          <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ipv4 && (
              <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">IPv4</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-2xl font-semibold tracking-tight text-foreground">
                    {ipv4}
                  </span>
                  <CopyButton text={ipv4} />
                </div>
              </div>
            )}
            {ipv6 && (
              <div className="rounded-xl border bg-card p-6 flex flex-col items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">IPv6</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-semibold tracking-tight text-foreground break-all text-center">
                    {ipv6}
                  </span>
                  <CopyButton text={ipv6} />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Section B - Location & Network Info */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
          Location &amp; Network Info
        </h2>
        {infoRows.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {infoRows.map((row) => (
              <InfoCard key={row.label} label={row.label} value={row.value} icon={row.icon} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Geolocation data unavailable
          </div>
        )}
      </section>

      {/* Section C - Use from Terminal */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5" />
          Use from Terminal
        </h2>
        <div className="rounded-xl border bg-card p-4 space-y-2">
          <CodeBlock label="Get your IPv4 address" command="curl -4 1two.dev/ip" />
          <CodeBlock label="Get your IPv6 address" command="curl -6 1two.dev/ip" />
          <CodeBlock label="Get detailed IP info" command="curl 1two.dev/ip/info" />
        </div>
      </section>

    </div>
  );
}
