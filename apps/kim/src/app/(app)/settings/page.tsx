"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SUPPORTED_LOCALES, LOCALE_LABELS } from "@/i18n/config";
import { PageShell, Card } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  getLifeProfile,
  updateLifeProfile,
  type LifeProfile,
} from "@/lib/life";

export default function SettingsPage() {
  const { t, i18n } = useTranslation("settings");
  const [profile, setProfile] = useState<LifeProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
            <input
              value={profile.timezone}
              onChange={(e) => update("timezone", e.target.value)}
              placeholder={t("timezone_placeholder")}
              className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t("field_wake_time")}>
            <input
              type="time"
              value={profile.wakeTime ?? ""}
              onChange={(e) => update("wakeTime", e.target.value)}
              className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t("field_sleep_time")}>
            <input
              type="time"
              value={profile.sleepTime ?? ""}
              onChange={(e) => update("sleepTime", e.target.value)}
              className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm"
            />
          </Field>
          <Field label={t("field_kim_agent")}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={profile.agentEnabled}
                onChange={(e) => update("agentEnabled", e.target.checked)}
              />
              {t("agent_enabled_label")}
            </label>
          </Field>
          <Field label="Language">
            <select
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
              className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm"
            >
              {SUPPORTED_LOCALES.map((loc) => (
                <option key={loc} value={loc}>
                  {LOCALE_LABELS[loc]}
                </option>
              ))}
            </select>
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
    <label className="block mb-3">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}
