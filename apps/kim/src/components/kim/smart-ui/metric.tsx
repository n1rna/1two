"use client";

import { useState } from "react";
import {
  Activity,
  GitCompare,
  LineChart,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { KimSelection } from "../types";
import { SmartBody } from "./smart-body";
import { SmartCard } from "./smart-card";
import { SmartHead } from "./smart-head";
import { QaBtn, QaGrid } from "./qa-grid";
import { Stepper } from "./stepper";
import { useSmartActions } from "./actions";

/**
 * Loose metric shape. Health page today attaches derived metrics like
 * BMI/BMR/TDEE which have `{ metric, value, unit?, ... }` snapshots — none
 * of which have a writable target field. We accept richer shapes (source,
 * window, trend, series, target) for future metric sources, and degrade
 * gracefully when fields are absent.
 */
interface MetricSnapshot {
  metric?: string;
  name?: string;
  value?: number | string;
  unit?: string;
  source?: string;
  window?: string;
  trend?: string;
  target?: number | string;
  /** If true, this metric supports target-setting. */
  supportsTarget?: boolean;
}

export function MetricSmartCard({ item }: { item: KimSelection }) {
  const { t } = useTranslation("smart_actions");
  const { smartAgent } = useSmartActions();
  const m = (item.snapshot ?? {}) as MetricSnapshot;

  const [targetOpen, setTargetOpen] = useState(false);
  const initialTarget = typeof m.target === "number" ? m.target : 0;
  const [target, setTarget] = useState(initialTarget);

  const name = m.name ?? (m.metric ? m.metric.toUpperCase() : item.label);
  const kickerParts = [m.source, m.window].filter(Boolean) as string[];
  const kicker = kickerParts.length > 0 ? kickerParts.join(" · ") : m.source;

  const valueLabel =
    m.value != null
      ? `${typeof m.value === "number" ? m.value.toLocaleString() : m.value}${
          m.unit ? ` ${m.unit}` : ""
        }`
      : undefined;

  // Target-setting is only enabled when the snapshot explicitly supports it
  // (or exposes a `target` field). Derived metrics like BMI/BMR/TDEE opt
  // out so we render a muted "Not supported" hint instead.
  const canSetTarget =
    m.supportsTarget === true || typeof m.target !== "undefined";

  return (
    <SmartCard
      head={
        <SmartHead
          icon={<Activity className="h-3 w-3" />}
          kicker={kicker}
          title={name}
          sub={m.trend}
          meta={
            valueLabel ? (
              <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
                {valueLabel}
              </span>
            ) : null
          }
        />
      }
    >
      <SmartBody>
        <QaGrid>
          <QaBtn
            icon={<TrendingUp className="h-3.5 w-3.5" />}
            label={t("metric.explain_trend")}
            onClick={() =>
              smartAgent({
                actionKey: "metric.explain_trend",
                label: t("metric.explain_trend"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Sparkles className="h-3.5 w-3.5" />}
            label={t("metric.suggest_interventions")}
            onClick={() =>
              smartAgent({
                actionKey: "metric.suggest_interventions",
                label: t("metric.suggest_interventions"),
                item,
              })
            }
          />
          <QaBtn
            icon={<LineChart className="h-3.5 w-3.5" />}
            label={t("metric.compare_last_month")}
            onClick={() =>
              smartAgent({
                actionKey: "metric.compare_last_month",
                label: t("metric.compare_last_month"),
                item,
              })
            }
          />
          <QaBtn
            icon={<GitCompare className="h-3.5 w-3.5" />}
            label={t("metric.correlate")}
            onClick={() =>
              smartAgent({
                actionKey: "metric.correlate",
                label: t("metric.correlate"),
                item,
              })
            }
          />
          <QaBtn
            icon={<Target className="h-3.5 w-3.5" />}
            label={t("metric.set_target")}
            disabled={!canSetTarget}
            onClick={() => setTargetOpen((v) => !v)}
          />
        </QaGrid>

        {!canSetTarget && (
          <p
            className="text-[10.5px] text-muted-foreground italic"
            title={t("common.not_supported")}
          >
            {t("common.not_supported")}
          </p>
        )}

        {targetOpen && canSetTarget && (
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">target</span>
            <Stepper
              value={target}
              min={0}
              max={100000}
              step={1}
              onChange={setTarget}
              label="target"
            />
            <button
              type="button"
              onClick={() => {
                // Route through the agent: there's no generic metric-target
                // PUT endpoint yet, but Kim can update the underlying goal
                // (e.g. goalWeightKg for weight) via its existing tools.
                smartAgent({
                  actionKey: "metric.set_target",
                  label: `${t("metric.set_target")} → ${target}`,
                  item,
                  systemContext: `Set target for this metric to ${target}.`,
                });
                setTargetOpen(false);
              }}
              className="ml-auto text-[11px] font-mono uppercase tracking-[0.14em] px-2.5 py-1 rounded border border-border hover:bg-muted"
            >
              {t("common.commit")}
            </button>
          </div>
        )}
      </SmartBody>
    </SmartCard>
  );
}
