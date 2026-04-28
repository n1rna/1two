"use client";

import { useMemo, useState } from "react";
import { Bed, Edit3, FileText, MapPin, Plus, Sparkles, Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addReservation,
  type Destination,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LensSummaryStrip } from "./trip-day-transport-view";

const STAY_KINDS = ["hotel", "bnb"] as const;

interface StayItem extends Reservation {
  nights: number;
  checkInLabel: string;
  checkOutLabel: string;
}

interface StaySlot {
  id: string;
  destination: Destination | null; // null only for the "extras" tail
  /** Default check-in / check-out hints used when adding inline. */
  defaultCheckIn: string | null;
  defaultCheckOut: string | null;
  /** Estimated nights based on destination dates (or 1 if unknown). */
  estimatedNights: number;
  reservation: StayItem | null;
}

export function TripDayStayView({
  trip,
  nights: tripNightsTotal,
  destinations,
  reservations,
  onReservationAdded,
}: {
  trip: Trip;
  nights: number;
  destinations: Destination[];
  reservations: Reservation[];
  onReservationAdded: (r: Reservation) => void;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();

  const stays = useMemo(() => buildStays(reservations), [reservations]);
  const slots = useMemo(
    () => buildStaySlots(trip, destinations, stays),
    [trip, destinations, stays],
  );

  const totalCost = stays.reduce((s, x) => s + (x.costAmount ?? 0), 0);
  const booked = stays.filter((s) => s.status === "booked").length;
  const nightsCovered = stays.reduce((s, x) => s + x.nights, 0);
  const avgPerNight =
    nightsCovered > 0 ? Math.round(totalCost / nightsCovered) : 0;
  const openSlots = slots.filter((s) => !s.reservation).length;
  const openNights = Math.max(0, tripNightsTotal - nightsCovered);

  return (
    <div>
      <LensSummaryStrip
        items={[
          {
            label: t("day_lens_stay_summary_booked"),
            value: String(booked),
            ratio: stays.length || undefined,
          },
          {
            label: t("day_lens_stay_summary_nights"),
            value: String(nightsCovered),
            ratio: tripNightsTotal || undefined,
          },
          {
            label: t("day_lens_stay_summary_cost"),
            value: formatMoney(totalCost, trip.budgetCurrency),
          },
          {
            label: t("day_lens_stay_summary_avg"),
            value:
              avgPerNight > 0 ? formatMoney(avgPerNight, trip.budgetCurrency) : "—",
          },
        ]}
        cta={{
          label: t("day_lens_stay_cta"),
          onClick: () =>
            askKim(t("day_lens_stay_ask_kim", { trip: trip.title })),
          show: openSlots > 0 || openNights > 0 || stays.length === 0,
        }}
      />

      <ul className="flex flex-col gap-3.5">
        {slots.map((slot) =>
          slot.reservation ? (
            <FilledStayCard
              key={slot.id}
              slot={slot}
              stay={slot.reservation}
              trip={trip}
            />
          ) : (
            <MissingStayCard
              key={slot.id}
              slot={slot}
              trip={trip}
              onAdded={onReservationAdded}
            />
          ),
        )}
      </ul>
    </div>
  );
}

function FilledStayCard({
  slot,
  stay,
  trip,
}: {
  slot: StaySlot;
  stay: StayItem;
  trip: Trip;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const note = readPayloadString(stay, "note");
  const room = readPayloadString(stay, "room");
  const includes = readPayloadString(stay, "includes");
  const ratingRaw = stay.payload?.rating;
  const rating = typeof ratingRaw === "number" ? ratingRaw : null;
  const cityLabel = slot.destination?.name || stay.destPlace || stay.originPlace || "";

  return (
    <li
      className={cn(
        "overflow-hidden rounded-[10px] border bg-card",
        stay.status === "planned"
          ? "border-[color:var(--sand-border)]"
          : "border-border",
      )}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 bg-gradient-to-r from-muted/40 to-muted/20 px-5 py-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("day_lens_stay_check_in")}
          </div>
          <div className="text-sm font-medium">{stay.checkInLabel}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-px w-24 bg-border">
            <span className="absolute -top-[3px] left-0 size-1.5 rounded-full bg-teal-400" />
            <span className="absolute -top-[3px] right-0 size-1.5 rounded-full bg-teal-400" />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {t(stay.nights === 1 ? "day_lens_stay_nights_one" : "day_lens_stay_nights_other", {
              count: stay.nights,
            })}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("day_lens_stay_check_out")}
          </div>
          <div className="text-sm font-medium">{stay.checkOutLabel}</div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {cityLabel && (
              <div className="text-[11px] text-muted-foreground truncate">
                {cityLabel}
              </div>
            )}
            <div className="mt-0.5 text-lg font-semibold leading-tight truncate">
              {stay.title}
            </div>
          </div>
          {rating != null && (
            <div className="inline-flex items-center gap-1 font-mono text-[12px] travel-accent shrink-0">
              <Star size={11} className="fill-current" /> {rating.toFixed(1)}
            </div>
          )}
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 border-y border-dashed border-border py-3 text-sm sm:grid-cols-4">
          <MetaCell label={t("day_lens_stay_meta_room")} value={room ?? "—"} />
          <MetaCell label={t("day_lens_stay_meta_includes")} value={includes ?? "—"} />
          <MetaCell
            label={t("day_lens_stay_meta_conf")}
            value={stay.confirmationCode || "—"}
            mono
          />
          <MetaCell
            label={t("day_lens_stay_meta_total")}
            value={
              stay.costAmount != null
                ? formatMoney(stay.costAmount, stay.costCurrency || trip.budgetCurrency)
                : "—"
            }
          />
        </dl>

        {note && (
          <p className="mt-3 border-l-2 travel-accent-border pl-3 text-xs text-muted-foreground">
            {note}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() =>
              askKim(t("day_lens_stay_edit_ask_kim", { title: stay.title }))
            }
          >
            <Edit3 size={11} /> {t("day_lens_stay_edit")}
          </Button>
          {stay.confirmationCode && (
            <Button variant="outline" size="xs">
              <FileText size={11} /> {t("day_lens_stay_view_confirmation")}
            </Button>
          )}
          <Button variant="outline" size="xs">
            <MapPin size={11} /> {t("day_lens_stay_directions")}
          </Button>
        </div>
      </div>
    </li>
  );
}

function MissingStayCard({
  slot,
  trip,
  onAdded,
}: {
  slot: StaySlot;
  trip: Trip;
  onAdded: (r: Reservation) => void;
}) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const cityLabel = slot.destination?.name || trip.title;
  const inLabel = slot.defaultCheckIn ? formatDate(slot.defaultCheckIn) : "—";
  const outLabel = slot.defaultCheckOut ? formatDate(slot.defaultCheckOut) : "—";
  const nights = slot.estimatedNights;

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const created = await addReservation(trip.id, {
        kind: "hotel",
        title: trimmed,
        startAt: slot.defaultCheckIn
          ? new Date(slot.defaultCheckIn + "T15:00:00Z").toISOString()
          : undefined,
        endAt: slot.defaultCheckOut
          ? new Date(slot.defaultCheckOut + "T11:00:00Z").toISOString()
          : undefined,
        destinationId: slot.destination?.id ?? undefined,
        destPlace: cityLabel,
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
    <li
      className="overflow-hidden rounded-[10px] border border-dashed bg-[var(--sand-bg)]"
      style={{ borderColor: "var(--sand-border)" }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("day_lens_stay_check_in")}
          </div>
          <div className="text-sm font-medium">{inLabel}</div>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="relative h-px w-24">
            <div className="absolute inset-0 border-t border-dashed travel-accent-border" />
            <span className="absolute -top-[3px] left-0 size-1.5 rounded-full border border-dashed travel-accent-border bg-background" />
            <span className="absolute -top-[3px] right-0 size-1.5 rounded-full border border-dashed travel-accent-border bg-background" />
          </div>
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] travel-accent">
            {nights > 0
              ? t(nights === 1 ? "day_lens_stay_nights_one" : "day_lens_stay_nights_other", {
                  count: nights,
                })
              : t("day_lens_stay_missing_label")}
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
            {t("day_lens_stay_check_out")}
          </div>
          <div className="text-sm font-medium">{outLabel}</div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-dashed travel-accent-border px-5 py-4">
        <div className="grid size-10 shrink-0 place-items-center rounded-full border border-dashed travel-accent-border">
          <Bed size={16} className="travel-accent" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] text-muted-foreground truncate">{cityLabel}</div>
          <div className="text-sm font-semibold">{t("day_lens_stay_missing_title")}</div>
          {slot.destination?.notes && (
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {slot.destination.notes}
            </p>
          )}
        </div>

        {editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            className="flex items-center gap-2"
          >
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("day_lens_stay_missing_placeholder", { city: cityLabel })}
              disabled={submitting}
              className="h-8 w-44 min-w-0 rounded-md border border-border bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40"
            />
            <Button type="submit" size="sm" disabled={submitting || !title.trim()}>
              {submitting ? "…" : t("day_lens_stay_missing_save")}
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
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              className="travel-accent travel-accent-bg travel-accent-border hover:bg-[var(--sand-bg)]"
              onClick={() =>
                askKim(
                  t("day_lens_stay_missing_ask_kim", { city: cityLabel }),
                )
              }
            >
              <Sparkles size={12} /> {t("day_lens_stay_missing_cta")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
              <Plus size={12} /> {t("day_lens_stay_missing_book")}
            </Button>
          </div>
        )}
      </div>
    </li>
  );
}

function MetaCell({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 truncate text-[13px]", mono && "font-mono tabular-nums")}>
        {value}
      </div>
    </div>
  );
}

// ─── Slot building / matching ────────────────────────────────────────────────

export function isStayKind(kind: string): boolean {
  return (STAY_KINDS as readonly string[]).includes(kind);
}

/**
 * One slot per destination — a typical trip has one place to stay per
 * destination. Real reservations are matched in by `destinationId`. Anything
 * extra (a second hotel in Tokyo, or a stay tied to no destination) is
 * appended at the end so it still renders.
 */
function buildStaySlots(
  trip: Trip,
  destinations: Destination[],
  stays: StayItem[],
): StaySlot[] {
  const slots: StaySlot[] = [];

  if (destinations.length === 0) {
    // Fall back to one open slot covering the whole trip plus any real stays.
    stays.forEach((s) => {
      slots.push({
        id: s.id,
        destination: null,
        defaultCheckIn: s.startAt?.slice(0, 10) ?? null,
        defaultCheckOut: s.endAt?.slice(0, 10) ?? null,
        estimatedNights: s.nights,
        reservation: s,
      });
    });
    if (stays.length === 0 && (trip.startDate || trip.endDate)) {
      slots.push({
        id: "stay-blank",
        destination: null,
        defaultCheckIn: trip.startDate,
        defaultCheckOut: trip.endDate,
        estimatedNights: estimateNightsBetween(trip.startDate, trip.endDate),
        reservation: null,
      });
    }
    return slots;
  }

  const remaining = [...stays];

  for (let i = 0; i < destinations.length; i++) {
    const dest = destinations[i];
    const next = destinations[i + 1];

    const inferredIn = dest.arriveAt?.slice(0, 10) ?? null;
    const inferredOut =
      dest.departAt?.slice(0, 10) ?? next?.arriveAt?.slice(0, 10) ?? null;

    const matchedIdx = remaining.findIndex((s) => s.destinationId === dest.id);
    const matched = matchedIdx >= 0 ? remaining.splice(matchedIdx, 1)[0] : null;

    slots.push({
      id: `stay-${dest.id}`,
      destination: dest,
      defaultCheckIn: matched?.startAt?.slice(0, 10) ?? inferredIn,
      defaultCheckOut: matched?.endAt?.slice(0, 10) ?? inferredOut,
      estimatedNights:
        matched?.nights ?? estimateNightsBetween(inferredIn, inferredOut),
      reservation: matched,
    });
  }

  // Extras: stays that didn't fit a destination slot (e.g. a second hotel in
  // the same city, or one with no destinationId).
  remaining.forEach((s) => {
    slots.push({
      id: s.id,
      destination:
        destinations.find((d) => d.id === s.destinationId) ?? null,
      defaultCheckIn: s.startAt?.slice(0, 10) ?? null,
      defaultCheckOut: s.endAt?.slice(0, 10) ?? null,
      estimatedNights: s.nights,
      reservation: s,
    });
  });

  return slots;
}

function buildStays(reservations: Reservation[]): StayItem[] {
  return reservations
    .filter((r) => isStayKind(r.kind))
    .sort((a, b) => {
      const ax = a.startAt ? Date.parse(a.startAt) : Number.POSITIVE_INFINITY;
      const bx = b.startAt ? Date.parse(b.startAt) : Number.POSITIVE_INFINITY;
      return ax - bx;
    })
    .map((r) => ({
      ...r,
      nights: computeNights(r.startAt, r.endAt),
      checkInLabel: formatDate(r.startAt),
      checkOutLabel: formatDate(r.endAt),
    }));
}

function computeNights(startAt: string | null, endAt: string | null): number {
  if (!startAt || !endAt) return 0;
  const a = new Date(startAt);
  const b = new Date(endAt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a) return 0;
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86_400_000));
}

function estimateNightsBetween(start: string | null, end: string | null): number {
  if (!start || !end) return 0;
  const a = new Date(start + "T00:00:00").getTime();
  const b = new Date(end + "T00:00:00").getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.max(1, Math.round((b - a) / 86_400_000));
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.length === 10 ? new Date(iso + "T00:00:00") : new Date(iso);
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
