"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { PageShell, Card } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxTrigger,
  ComboboxValue,
} from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { TimePicker } from "@/components/ui/time-picker";
import {
  getLifeProfile,
  updateLifeProfile,
  type LifeProfile,
} from "@/lib/life";

interface TzMeta {
  label: string;
  search: string;
}

function tzZoneName(tz: string, date: Date, type: "short" | "shortOffset") {
  try {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: type,
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? "";
  } catch {
    return "";
  }
}

function buildTimezones(): { values: string[]; meta: Record<string, TzMeta> } {
  const fn = (Intl as unknown as {
    supportedValuesOf?: (k: string) => string[];
  }).supportedValuesOf;
  const values =
    typeof fn === "function"
      ? fn("timeZone")
      : [
          "UTC",
          "Europe/Berlin",
          "Europe/London",
          "America/New_York",
          "America/Los_Angeles",
          "Asia/Tokyo",
        ];
  const jan = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 15));
  const jul = new Date(Date.UTC(new Date().getUTCFullYear(), 6, 15));
  const meta: Record<string, TzMeta> = {};
  for (const tz of values) {
    const segs = tz.split("/");
    const city = segs[segs.length - 1].replace(/_/g, " ");
    const region = segs.slice(0, -1).join(" / ").replace(/_/g, " ");
    const abbrWinter = tzZoneName(tz, jan, "short");
    const abbrSummer = tzZoneName(tz, jul, "short");
    const offset = tzZoneName(tz, new Date(), "shortOffset") || "UTC";
    const niceLabel = region ? `${city} · ${region}` : city;
    const abbrs = [abbrWinter, abbrSummer].filter(
      (v, i, a) => v && !v.startsWith("GMT") && a.indexOf(v) === i,
    );
    const label = `${niceLabel}  (${offset})`;
    meta[tz] = {
      label,
      search: [label, city, region, tz, offset, ...abbrs]
        .join(" ")
        .toLowerCase(),
    };
  }
  return { values, meta };
}

export default function SettingsPage() {
  const { t, i18n } = useTranslation("settings");
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const { values: timezones, meta: tzMeta } = useMemo(buildTimezones, []);

  useEffect(() => {
    (async () => {
      try {
        setProfile(await getLifeProfile());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setSaving(true);
    try {
      setProfile(await updateLifeProfile(profile));
    } finally {
      setSaving(false);
    }
  }

  function update<K extends keyof LifeProfile>(k: K, v: LifeProfile[K]) {
    setProfile((p) => (p ? { ...p, [k]: v } : p));
  }

  if (loading || !profile) {
    return (
      <PageShell title={t("page_title")}>
        <div className="h-48 rounded-lg bg-muted animate-pulse max-w-xl" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title={t("page_title")}
      subtitle={t("page_subtitle")}
      actions={
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? t("saving_btn") : t("save_btn")}
        </Button>
      }
    >
      <div className="max-w-xl">
        <Card>
          <Field label={t("field_timezone")}>
            <Combobox
              items={timezones}
              value={profile.timezone}
              onValueChange={(v) => update("timezone", (v as string) ?? "")}
              itemToStringLabel={(v) => tzMeta[v as string]?.label ?? String(v)}
              filter={(item, q) => {
                if (!q) return true;
                const hay = tzMeta[item as string]?.search ?? String(item).toLowerCase();
                return hay.includes(q.toLowerCase());
              }}
            >
              <ComboboxTrigger>
                <ComboboxValue placeholder={t("timezone_placeholder")} />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search city, region or abbr (EST, CET…)" />
                <ComboboxEmpty>No matches</ComboboxEmpty>
                <ComboboxList>
                  {(tz: string) => (
                    <ComboboxItem key={tz} value={tz}>
                      {tzMeta[tz]?.label ?? tz}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
          <Field label={t("field_wake_time")}>
            <TimePicker
              value={profile.wakeTime}
              onChange={(v) => update("wakeTime", v)}
            />
          </Field>
          <Field label={t("field_sleep_time")}>
            <TimePicker
              value={profile.sleepTime}
              onChange={(v) => update("sleepTime", v)}
            />
          </Field>
          <Field label={t("field_kim_agent")}>
            <div className="flex items-center gap-3 text-sm">
              <Switch
                checked={profile.agentEnabled}
                onCheckedChange={(checked) => update("agentEnabled", checked)}
              />
              <span className="text-muted-foreground">
                {t("agent_enabled_label")}
              </span>
            </div>
          </Field>
          <Field label="Language">
            <Combobox
              items={[...SUPPORTED_LOCALES]}
              value={i18n.language}
              onValueChange={(v) => v && i18n.changeLanguage(v as string)}
              itemToStringLabel={(v) => LOCALE_LABELS[v as typeof SUPPORTED_LOCALES[number]] ?? String(v)}
            >
              <ComboboxTrigger>
                <ComboboxValue placeholder="Select language" />
              </ComboboxTrigger>
              <ComboboxContent>
                <ComboboxInput placeholder="Search language…" />
                <ComboboxEmpty>No matches</ComboboxEmpty>
                <ComboboxList>
                  {(loc: string) => (
                    <ComboboxItem key={loc} value={loc}>
                      {LOCALE_LABELS[loc as typeof SUPPORTED_LOCALES[number]] ?? loc}
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </Field>
        </Card>
      </div>
    </PageShell>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block mb-3">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </div>
  );
}
