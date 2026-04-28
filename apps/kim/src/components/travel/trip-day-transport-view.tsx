"use client";

import { useMemo, useState } from "react";
import {
  Bus,
  Car,
  Edit3,
  FileText,
  Plane,
  Plus,
  Sparkles,
  TrainFront,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addReservation,
  type Destination,
  type Reservation,
  type ReservationKind,
  type Trip,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRANSPORT_KINDS = ["flight", "train", "bus", "car"] as const;

export interface TransportLeg extends Reservation {
  durationLabel: string;
  depLabel: string;
  arrLabel: string;
  dateLabel: string;
}

type LegKind = "inbound" | "local" | "inter-city" | "outbound";

interface LegSlot {
  id: string;
  kind: LegKind;
  fromName: string;
  toName: string;
  destinationId: string | null;
  /** ISO date used as a default when adding inline. */
  defaultDate: string | null;
  reservation: TransportLeg | null;
}

const ICON_BY_KIND: Record<string, LucideIcon> = {
  flight: Plane,
  train: TrainFront,
  bus: Bus,
  car: Car,
};

export function TripDayTransportView({
  trip,
  destinations,
  reservations,
  onReservationAdded,
}: {
  trip: Trip;
  destinations: Destination[];
  reservations: Reservation[];
  onReservationAdded: (r: Reservation) => void;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();

  const legs = useMemo(() => buildLegs(reservations), [reservations]);
  const slots = useMemo(
    () => buildLegSlots(trip, destinations, legs),
    [trip, destinations, legs],
  );

  const totalCost = legs.reduce((s, l) => s + (l.costAmount ?? 0), 0);
  const confirmed = legs.filter((l) => l.status === "booked").length;
  const pending = legs.filter((l) => l.status === "planned").length;
  const cancelled = legs.filter((l) => l.status === "cancelled").length;
  const missing = slots.filter((s) => !s.reservation).length;

  return (
    <div>
      <LensSummaryStrip
        items={[
          {
            label: t("day_lens_summary_total_cost"),
            value: formatMoney(totalCost, trip.budgetCurrency),
          },
          {
            label: t("day_lens_summary_confirmed"),
            value: String(confirmed),
            ratio: legs.length,
          },
          {
            label: t("day_lens_summary_pending"),
            value: String(pending),
            valueClass: "travel-accent",
          },
          {
            label: t("day_lens_summary_missing"),
            value: String(missing),
            valueClass: "text-destructive",
          },
        ]}
        cta={{
          label: t("day_lens_transport_cta"),
          onClick: () =>
            askKim(t("day_lens_transport_ask_kim", { trip: trip.title })),
          show: missing > 0 || pending > 0 || legs.length === 0,
        }}
      />

      <div className="relative pt-2">
        <div
          aria-hidden
          className="pointer-events-none absolute left-[60px] top-0 bottom-0 w-px"
          style={{
            background:
              "linear-gradient(to bottom, transparent 0, var(--border) 24px, var(--border) calc(100% - 24px), transparent 100%)",
          }}
        />
        <ul className="flex flex-col gap-3.5">
          {slots.map((slot) => (
            <LegRow
              key={slot.id}
              slot={slot}
              trip={trip}
              onAdded={onReservationAdded}
            />
          ))}
        </ul>
      </div>

      {cancelled > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {t("day_lens_transport_cancelled_note", { count: cancelled })}
        </div>
      )}
    </div>
  );
}

function LegRow({
  slot,
  trip,
  onAdded,
}: {
  slot: LegSlot;
  trip: Trip;
  onAdded: (r: Reservation) => void;
}) {
  if (slot.reservation) {
    return <FilledLegCard slot={slot} leg={slot.reservation} trip={trip} />;
  }
  return <MissingLegCard slot={slot} trip={trip} onAdded={onAdded} />;
}

function FilledLegCard({
  slot,
  leg,
  trip,
}: {
  slot: LegSlot;
  leg: TransportLeg;
  trip: Trip;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const Icon = ICON_BY_KIND[leg.kind] ?? Plane;
  const note = readNote(leg);

  const cardTone =
    leg.status === "planned"
      ? "border-[color:var(--sand-border)]"
      : leg.status === "cancelled"
        ? "border-destructive/40 bg-destructive/[0.04]"
        : "border-border";

  return (
    <li className="relative grid grid-cols-[80px_1fr] items-start gap-3">
      <Stamp icon={<Icon size={14} className="text-muted-foreground" />} kind={slot.kind} />

      <div className={cn("rounded-[10px] border bg-card", cardTone)}>
        <div className="grid grid-cols-[1fr_minmax(120px,1.4fr)_1fr] items-center gap-3 px-4 pt-3 pb-3">
          <div>
            <div className="text-[22px] font-semibold leading-none">
              {leg.originPlace || slot.fromName || "—"}
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {leg.depLabel}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {leg.durationLabel}
            </div>
            <div className="relative h-px w-full bg-border">
              <span className="absolute -top-[3px] left-0 size-1.5 rounded-full travel-accent-fill" />
              <span className="absolute -top-[3px] right-0 size-1.5 rounded-full travel-accent-fill" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground truncate max-w-full">
              {[leg.provider, leg.confirmationCode].filter(Boolean).join(" · ")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-semibold leading-none">
              {leg.destPlace || slot.toName || "—"}
            </div>
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              {leg.arrLabel}
            </div>
          </div>
        </div>

        <dl className="grid grid-cols-[repeat(5,auto)] gap-x-6 gap-y-1 border-t border-dashed border-border px-4 py-3 text-sm">
          <MetaCell label={t("day_lens_transport_meta_date")} value={leg.dateLabel} />
          <MetaCell
            label={t("day_lens_transport_meta_class")}
            value={readPayloadString(leg, "class") ?? "—"}
          />
          <MetaCell
            label={t("day_lens_transport_meta_seat")}
            value={readPayloadString(leg, "seat") ?? "—"}
          />
          <MetaCell
            label={t("day_lens_transport_meta_price")}
            value={
              leg.costAmount != null
                ? formatMoney(leg.costAmount, leg.costCurrency || trip.budgetCurrency)
                : "—"
            }
          />
          <div className="flex items-center justify-end">
            <StatusPill status={leg.status} />
          </div>
        </dl>

        {note && (
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-md travel-accent-bg ring-1 ring-inset travel-accent-border px-3 py-2 text-xs">
            <Sparkles size={11} className="mt-0.5 travel-accent shrink-0" />
            <span className="text-foreground/80">{note}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              askKim(t("day_lens_transport_edit_ask_kim", { title: leg.title }))
            }
          >
            <Edit3 size={11} /> {t("day_lens_transport_edit")}
          </Button>
          {leg.confirmationCode && (
            <Button variant="outline" size="xs">
              <FileText size={11} /> {t("day_lens_transport_confirmation")}
            </Button>
          )}
          {leg.status !== "booked" && (
            <Button
              variant="outline"
              size="xs"
              className="travel-accent travel-accent-bg travel-accent-border hover:bg-[var(--sand-bg)]"
              onClick={() =>
                askKim(t("day_lens_transport_confirm_ask_kim", { title: leg.title }))
              }
            >
              <Sparkles size={11} /> {t("day_lens_transport_confirm")}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

function MissingLegCard({
  slot,
  trip,
  onAdded,
}: {
  slot: LegSlot;
  trip: Trip;
  onAdded: (r: Reservation) => void;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const Icon = slot.kind === "local" ? Bus : Plane;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const created = await addReservation(trip.id, {
        kind: defaultKindForSlot(slot.kind),
        title: trimmed,
        startAt: slot.defaultDate
          ? new Date(slot.defaultDate + "T12:00:00Z").toISOString()
          : undefined,
        destinationId: slot.destinationId ?? undefined,
        originPlace: slot.fromName,
        destPlace: slot.toName,
        status: "planned",
      });
      onAdded(created);
      setTitle("");
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <li className="relative grid grid-cols-[80px_1fr] items-start gap-3">
      <Stamp
        icon={<Icon size={14} className="text-destructive" />}
        kind={slot.kind}
        dashed
      />

      <div
        className="rounded-[10px] border border-dashed bg-destructive/[0.04]"
        style={{ borderColor: "rgb(227 120 120 / 0.35)" }}
      >
        <div className="grid grid-cols-[1fr_minmax(120px,1.4fr)_1fr] items-center gap-3 px-4 pt-3 pb-3">
          <div>
            <div className="text-[18px] font-medium leading-none truncate">
              {slot.fromName}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("day_lens_transport_missing_no_time")}
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-1.5">
            <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {t(`day_lens_transport_kind_${slot.kind}`)}
            </div>
            <div className="relative h-px w-full">
              <div className="absolute inset-0 border-t border-dashed border-destructive/40" />
            </div>
            <div className="font-mono text-[10px] uppercase tracking-wide text-destructive/80">
              {t("day_lens_transport_missing_label")}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[18px] font-medium leading-none truncate">
              {slot.toName}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {slot.defaultDate ? formatDate(slot.defaultDate) : "—"}
            </div>
          </div>
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex flex-wrap items-center gap-2 border-t border-dashed border-destructive/30 px-4 py-3"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("day_lens_transport_missing_placeholder", {
                from: slot.fromName,
                to: slot.toName,
              })}
              disabled={submitting}
              className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
              {submitting ? "…" : t("day_lens_transport_missing_save")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setTitle("");
              }}
            >
              {t("cancel", { defaultValue: "Cancel" })}
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-destructive/30 px-4 py-3">
            <Button
              size="xs"
              variant="outline"
              className="travel-accent travel-accent-bg travel-accent-border hover:bg-[var(--sand-bg)]"
              onClick={() =>
                askKim(
                  t("day_lens_transport_missing_ask_kim", {
                    from: slot.fromName,
                    to: slot.toName,
                  }),
                )
              }
            >
              <Sparkles size={11} /> {t("day_lens_transport_missing_find")}
            </Button>
            <Button size="xs" variant="outline" onClick={() => setEditing(true)}>
              <Plus size={11} /> {t("day_lens_transport_missing_book")}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function Stamp({
  icon,
  kind,
  dashed = false,
}: {
  icon: React.ReactNode;
  kind: LegKind;
  dashed?: boolean;
}) {
  const { t } = useTranslation("travel");
  return (
    <div className="relative flex flex-col items-center pt-1">
      <div
        className={cn(
          "z-[1] grid size-8 place-items-center rounded-full bg-background",
          dashed ? "border border-dashed border-destructive/40" : "border border-border",
        )}
      >
        {icon}
      </div>
      <div
        className={cn(
          "mt-1 font-mono text-[10px] uppercase tracking-[0.14em]",
          dashed ? "text-destructive/80" : "text-muted-foreground",
        )}
      >
        {t(`day_lens_transport_kind_${kind}`)}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] tabular-nums">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation("travel");
  const tone =
    status === "booked"
      ? "bg-emerald-500/10 text-emerald-500 ring-emerald-500/30"
      : status === "planned"
        ? "travel-accent travel-accent-bg travel-accent-border"
        : "bg-destructive/10 text-destructive ring-destructive/30";
  const label =
    status === "booked"
      ? t("day_lens_status_confirmed")
      : status === "planned"
        ? t("day_lens_status_pending")
        : t("day_lens_status_cancelled");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide ring-1 ring-inset",
        tone,
      )}
    >
      {label}
    </span>
  );
}

// ─── Stat strip used by all three category lenses ────────────────────────────
export function LensSummaryStrip({
  items,
  cta,
}: {
  items: Array<{
    label: string;
    value: string;
    ratio?: number;
    valueClass?: string;
  }>;
  cta?: { label: string; onClick: () => void; show?: boolean };
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-x-6 gap-y-3 rounded-[10px] border border-border bg-card px-4 py-3">
      {items.map((it) => (
        <div key={it.label} className="min-w-[88px]">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {it.label}
          </div>
          <div className="mt-1 text-[15px] font-medium tabular-nums">
            <span className={it.valueClass}>{it.value}</span>
            {it.ratio != null && (
              <span className="text-muted-foreground">/{it.ratio}</span>
            )}
          </div>
        </div>
      ))}
      {cta && cta.show !== false && (
        <Button
          size="sm"
          variant="outline"
          className="ml-auto travel-accent travel-accent-bg travel-accent-border hover:bg-[var(--sand-bg)]"
          onClick={cta.onClick}
        >
          <Sparkles size={12} /> {cta.label}
        </Button>
      )}
    </div>
  );
}

// ─── Slot building / matching ───────────────────────────────────────────────

export function isTransportKind(kind: string): boolean {
  return (TRANSPORT_KINDS as readonly string[]).includes(kind);
}

function defaultKindForSlot(kind: LegKind): ReservationKind {
  return kind === "local" ? "train" : "flight";
}

/**
 * Build the canonical sequence of legs for a trip:
 *   [Inbound] → for each destination [Local, Inter-city to next] → [Outbound]
 * Real reservations are matched into slots by `destinationId` (with
 * inbound/outbound matched by position when destinationId is missing).
 * Anything that doesn't fit a canonical slot is appended as an extra slot
 * so nothing the user has booked goes unrendered.
 */
function buildLegSlots(
  trip: Trip,
  destinations: Destination[],
  legs: TransportLeg[],
): LegSlot[] {
  if (destinations.length === 0) {
    // Fallback: render existing legs and an open inbound + outbound slot,
    // so the canvas still has the same shape.
    const fallback: LegSlot[] = [];
    legs.forEach((leg, i) => {
      fallback.push({
        id: leg.id,
        kind: i === 0 ? "inbound" : i === legs.length - 1 ? "outbound" : "inter-city",
        fromName: leg.originPlace || HOME_LABEL,
        toName: leg.destPlace || HOME_LABEL,
        destinationId: leg.destinationId,
        defaultDate: leg.startAt?.slice(0, 10) ?? null,
        reservation: leg,
      });
    });
    if (legs.length === 0) {
      fallback.push({
        id: "inbound-blank",
        kind: "inbound",
        fromName: HOME_LABEL,
        toName: trip.title || "Destination",
        destinationId: null,
        defaultDate: trip.startDate,
        reservation: null,
      });
      fallback.push({
        id: "outbound-blank",
        kind: "outbound",
        fromName: trip.title || "Destination",
        toName: HOME_LABEL,
        destinationId: null,
        defaultDate: trip.endDate,
        reservation: null,
      });
    }
    return fallback;
  }

  const slots: LegSlot[] = [];

  // Inbound
  slots.push({
    id: "slot-inbound",
    kind: "inbound",
    fromName: HOME_LABEL,
    toName: destinations[0].name,
    destinationId: destinations[0].id,
    defaultDate: destinations[0].arriveAt?.slice(0, 10) ?? trip.startDate,
    reservation: null,
  });

  for (let i = 0; i < destinations.length; i++) {
    const here = destinations[i];
    slots.push({
      id: `slot-local-${here.id}`,
      kind: "local",
      fromName: here.name,
      toName: here.name,
      destinationId: here.id,
      defaultDate: here.arriveAt?.slice(0, 10) ?? trip.startDate,
      reservation: null,
    });
    if (i < destinations.length - 1) {
      const next = destinations[i + 1];
      slots.push({
        id: `slot-inter-${here.id}-${next.id}`,
        kind: "inter-city",
        fromName: here.name,
        toName: next.name,
        destinationId: next.id,
        defaultDate:
          next.arriveAt?.slice(0, 10) ??
          here.departAt?.slice(0, 10) ??
          trip.startDate,
        reservation: null,
      });
    }
  }

  const last = destinations[destinations.length - 1];
  slots.push({
    id: "slot-outbound",
    kind: "outbound",
    fromName: last.name,
    toName: HOME_LABEL,
    destinationId: null,
    defaultDate: last.departAt?.slice(0, 10) ?? trip.endDate,
    reservation: null,
  });

  // ─── Match real reservations into slots ───────────────────────────────────
  const remaining = [...legs];

  // Inbound and inter-city: match by destinationId.
  for (const slot of slots) {
    if (slot.kind === "inbound" || slot.kind === "inter-city") {
      const idx = remaining.findIndex((l) => l.destinationId === slot.destinationId);
      if (idx >= 0) {
        slot.reservation = remaining[idx];
        remaining.splice(idx, 1);
      }
    }
  }

  // Outbound: latest unmatched leg with no destinationId, or just the last unmatched leg.
  const outboundSlot = slots.find((s) => s.kind === "outbound");
  if (outboundSlot && remaining.length > 0) {
    const homewardIdx = [...remaining].reverse().findIndex((l) => !l.destinationId);
    let pickIdx: number;
    if (homewardIdx >= 0) {
      pickIdx = remaining.length - 1 - homewardIdx;
    } else {
      // Latest by date.
      const sortedIdx = remaining
        .map((l, i) => ({ l, i, t: l.startAt ? Date.parse(l.startAt) : 0 }))
        .sort((a, b) => b.t - a.t);
      pickIdx = sortedIdx[0]?.i ?? -1;
    }
    if (pickIdx >= 0) {
      outboundSlot.reservation = remaining[pickIdx];
      remaining.splice(pickIdx, 1);
    }
  }

  // Local: match by destinationId (short hops, multiple welcome → first
  // matching wins; the rest fall through to the extras section below).
  for (const slot of slots) {
    if (slot.kind === "local") {
      const idx = remaining.findIndex((l) => l.destinationId === slot.destinationId);
      if (idx >= 0) {
        slot.reservation = remaining[idx];
        remaining.splice(idx, 1);
      }
    }
  }

  // Anything left (a second flight to the same city, an unrouted train, …):
  // drop in as extra "local" slots so the user can still see + edit them.
  for (const leg of remaining) {
    slots.push({
      id: leg.id,
      kind: "local",
      fromName: leg.originPlace || "",
      toName: leg.destPlace || "",
      destinationId: leg.destinationId,
      defaultDate: leg.startAt?.slice(0, 10) ?? null,
      reservation: leg,
    });
  }

  return slots;
}

const HOME_LABEL = "Home";

function buildLegs(reservations: Reservation[]): TransportLeg[] {
  const transport = reservations
    .filter((r) => isTransportKind(r.kind))
    .sort((a, b) => {
      const ax = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY;
      const bx = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY;
      return ax - bx;
    });

  return transport.map((r) => {
    const durationMinutes = computeDurationMinutes(r.startAt, r.endAt);
    return {
      ...r,
      durationLabel: formatDuration(durationMinutes),
      depLabel: formatTime(r.startAt),
      arrLabel: formatTime(r.endAt),
      dateLabel: formatDate(r.startAt),
    };
  });
}

function computeDurationMinutes(startAt: string | null, endAt: string | null): number | null {
  if (!startAt || !endAt) return null;
  const a = Date.parse(startAt);
  const b = Date.parse(endAt);
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

function readPayloadString(r: Reservation, key: string): string | null {
  const v = r.payload?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function readNote(r: Reservation): string | null {
  const v = r.payload?.note;
  return typeof v === "string" && v.length > 0 ? v : null;
}
