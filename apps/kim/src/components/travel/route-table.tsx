"use client";

import { useCallback, useRef, useState } from "react";
import {
  GripVertical,
  Hotel,
  MoreHorizontal,
  Plane,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addDestination,
  addReservation,
  deleteDestination,
  reorderDestinations,
  updateDestination,
  type Activity,
  type Destination,
  type Reservation,
  type Trip,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/page-shell";

interface Props {
  trip: Trip;
  destinations: Destination[];
  reservations: Reservation[];
  activities: Activity[];
  canEdit: boolean;
  onDestinationsChange: (next: Destination[]) => void;
  onReservationsChange: (next: Reservation[]) => void;
}

/**
 * Inline route editor. Each row shows the destination, a nights stepper,
 * sleeping / activities / transport pills, and an Ask-Kim chip to delegate
 * planning tasks to the agent. No modals — adders expand inline at the
 * bottom of the table.
 */
export function RouteTable({
  trip,
  destinations,
  reservations,
  activities,
  canEdit,
  onDestinationsChange,
  onReservationsChange,
}: Props) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragEnterCountRef = useRef(0);

  const activityCountByDest = new Map<string, number>();
  for (const a of activities) {
    activityCountByDest.set(a.destinationId, (activityCountByDest.get(a.destinationId) ?? 0) + 1);
  }
  const hotelByDest = new Map<string, Reservation>();
  const transportByDest = new Map<string, Reservation>();
  for (const r of reservations) {
    if (!r.destinationId) continue;
    if ((r.kind === "hotel" || r.kind === "bnb") && !hotelByDest.has(r.destinationId)) {
      hotelByDest.set(r.destinationId, r);
    }
    if (
      (r.kind === "flight" || r.kind === "train" || r.kind === "bus" || r.kind === "car") &&
      !transportByDest.has(r.destinationId)
    ) {
      transportByDest.set(r.destinationId, r);
    }
  }

  const commitReorder = useCallback(
    async (fromIdx: number, toIdx: number) => {
      if (fromIdx === toIdx) return;
      const next = [...destinations];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      const renumbered = next.map((d, i) => ({ ...d, ordinal: i }));
      onDestinationsChange(renumbered);
      try {
        await reorderDestinations(
          trip.id,
          renumbered.map((d) => d.id),
        );
      } catch {
        onDestinationsChange(destinations);
      }
    },
    [destinations, onDestinationsChange, trip.id],
  );

  async function handleNightsDelta(d: Destination, delta: number) {
    const current = nightsFromDates(d);
    const next = Math.max(0, (current || 0) + delta);
    // Derive arriveAt if unset: start from trip.startDate + cumulative prior nights.
    const arriveAt = d.arriveAt ?? deriveArriveFor(d, destinations, trip);
    const arriveDate = arriveAt ? new Date(arriveAt) : null;
    if (!arriveDate || Number.isNaN(arriveDate.getTime())) return;
    const departIso = new Date(
      arriveDate.getTime() + next * 86_400_000,
    ).toISOString();
    const updated = await updateDestination(d.id, {
      arriveAt,
      departAt: departIso,
    }).catch(() => null);
    if (!updated) return;
    onDestinationsChange(destinations.map((x) => (x.id === d.id ? updated : x)));
  }

  async function handleDeleteDest(d: Destination) {
    if (typeof window !== "undefined" && !window.confirm(t("confirm_delete_destination"))) {
      return;
    }
    try {
      await deleteDestination(d.id);
      onDestinationsChange(destinations.filter((x) => x.id !== d.id));
    } catch {
      /* keep list intact */
    }
  }

  async function handleAddHotel(d: Destination, title: string) {
    const created = await addReservation(trip.id, {
      kind: "hotel",
      title,
      destinationId: d.id,
      status: "planned",
    }).catch(() => null);
    if (!created) return;
    onReservationsChange([...reservations, created]);
  }

  async function handleAddTransport(d: Destination, title: string) {
    const created = await addReservation(trip.id, {
      kind: "train",
      title,
      destinationId: d.id,
      status: "planned",
    }).catch(() => null);
    if (!created) return;
    onReservationsChange([...reservations, created]);
  }

  return (
    <div className="flex flex-col gap-1">
      {destinations.length === 0 ? (
        <EmptyState
          title={t("empty_destinations_title")}
          hint={canEdit ? t("empty_destinations_hint_editable") : t("empty_destinations_hint")}
        />
      ) : (
        <ul className="flex flex-col">
          {destinations.map((d, i) => {
            const showTopLine =
              dropIndex === i && dragIndex != null && dragIndex !== i && dragIndex !== i - 1;
            return (
              <li key={d.id} className="relative">
                {showTopLine && <DropLine />}
                <RouteRow
                  destination={d}
                  index={i}
                  trip={trip}
                  destinations={destinations}
                  activitiesCount={activityCountByDest.get(d.id) ?? 0}
                  hotel={hotelByDest.get(d.id) ?? null}
                  transport={transportByDest.get(d.id) ?? null}
                  canEdit={canEdit}
                  dragging={dragIndex === i}
                  onDragStart={() => {
                    setDragIndex(i);
                    dragEnterCountRef.current = 0;
                  }}
                  onDragOver={(target) => setDropIndex(target)}
                  onDragEnd={() => {
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onDrop={(target) => {
                    if (dragIndex != null) {
                      const resolved = target > dragIndex ? target - 1 : target;
                      void commitReorder(dragIndex, resolved);
                    }
                    setDragIndex(null);
                    setDropIndex(null);
                  }}
                  onNightsDelta={(delta) => void handleNightsDelta(d, delta)}
                  onDelete={() => void handleDeleteDest(d)}
                  onAddHotel={(title) => void handleAddHotel(d, title)}
                  onAddTransport={(title) => void handleAddTransport(d, title)}
                  onAskKimHotel={() =>
                    askKim(t("route_ask_kim_hotel", { destination: d.name }))
                  }
                  onAskKimTransport={() => {
                    const prev = destinations[i - 1];
                    askKim(
                      t("route_ask_kim_transport", {
                        from: prev?.name ?? trip.title,
                        to: d.name,
                      }),
                    );
                  }}
                  onAskKimActivities={() =>
                    askKim(t("route_ask_kim_activities", { destination: d.name }))
                  }
                  t={t}
                />
              </li>
            );
          })}
          {dragIndex != null && dropIndex === destinations.length && (
            <li>
              <DropLine />
            </li>
          )}
        </ul>
      )}

      {canEdit && (
        <InlineAdder
          tripId={trip.id}
          onAdded={(d) => onDestinationsChange([...destinations, d])}
          onAskKim={() => askKim(t("route_ask_kim_add"))}
        />
      )}
    </div>
  );
}

// ─── Row ─────────────────────────────────────────────────────────────────────

function RouteRow({
  destination,
  index,
  trip,
  activitiesCount,
  hotel,
  transport,
  canEdit,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onNightsDelta,
  onDelete,
  onAddHotel,
  onAddTransport,
  onAskKimHotel,
  onAskKimTransport,
  onAskKimActivities,
  t,
}: {
  destination: Destination;
  index: number;
  trip: Trip;
  destinations: Destination[];
  activitiesCount: number;
  hotel: Reservation | null;
  transport: Reservation | null;
  canEdit: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (idx: number) => void;
  onDragEnd: () => void;
  onDrop: (idx: number) => void;
  onNightsDelta: (delta: number) => void;
  onDelete: () => void;
  onAddHotel: (title: string) => void;
  onAddTransport: (title: string) => void;
  onAskKimHotel: () => void;
  onAskKimTransport: () => void;
  onAskKimActivities: () => void;
  t: (k: string, o?: Record<string, unknown>) => string;
}) {
  const d = destination;
  const nights = nightsFromDates(d);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      draggable={canEdit}
      onDragStart={(e) => {
        if (!canEdit) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(index));
        onDragStart();
      }}
      onDragOver={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        onDragOver(before ? index : index + 1);
      }}
      onDragEnd={onDragEnd}
      onDrop={(e) => {
        if (!canEdit) return;
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const before = e.clientY < rect.top + rect.height / 2;
        onDrop(before ? index : index + 1);
      }}
      className={cn(
        "group grid grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))_36px] items-center gap-2 border-b border-border/50 py-2.5",
        dragging && "opacity-40",
      )}
    >
      {/* Destination cell */}
      <div className="flex items-center gap-2 min-w-0">
        {canEdit && (
          <button
            type="button"
            className="cursor-grab text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={t("drag_to_reorder")}
            tabIndex={-1}
          >
            <GripVertical size={12} />
          </button>
        )}
        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border text-[11px] font-mono font-semibold tabular-nums">
          {index + 1}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{d.name}</div>
          {(d.country || d.region) && (
            <div className="truncate text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
              {[d.region, d.country].filter(Boolean).join(", ")}
            </div>
          )}
        </div>
      </div>

      {/* Nights stepper */}
      <NightsStepper
        value={nights}
        disabled={!canEdit}
        onDelta={onNightsDelta}
        ariaLabel={t("route_nights_aria", { destination: d.name })}
      />

      {/* Sleeping */}
      <InlinePill
        filled={!!hotel}
        filledLabel={hotel?.title ?? ""}
        filledIcon={<Hotel size={12} />}
        emptyLabel={t("route_add_hotel")}
        onSubmit={onAddHotel}
        onAskKim={onAskKimHotel}
        disabled={!canEdit}
        placeholder="Hotel"
      />

      {/* Activities */}
      <InlinePill
        filled={activitiesCount > 0}
        filledLabel={t("route_activities_count_other", { count: activitiesCount })}
        emptyLabel="+ Add"
        onAskKim={onAskKimActivities}
        disabled={!canEdit}
        askKimOnly
      />

      {/* Transport */}
      <InlinePill
        filled={!!transport}
        filledLabel={transport?.title ?? ""}
        filledIcon={<Plane size={12} />}
        emptyLabel={t("route_transport_none")}
        onSubmit={onAddTransport}
        onAskKim={onAskKimTransport}
        disabled={!canEdit}
        placeholder="Transport"
      />

      {/* Menu */}
      <div className="relative">
        {canEdit && (
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            className="h-7 w-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={t("route_menu")}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
        {menuOpen && (
          <div
            className="absolute right-0 top-8 z-20 w-36 rounded-md border border-border bg-popover p-1 shadow-md"
            onMouseLeave={() => setMenuOpen(false)}
          >
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
            >
              <Trash2 size={12} /> {t("delete_destination")}
            </button>
          </div>
        )}
      </div>
      {/* unused binding kept for ref stability while future columns land */}
      <span hidden aria-hidden>
        {trip.id}
      </span>
    </div>
  );
}

// ─── Nights stepper ───────────────────────────────────────────────────────────

function NightsStepper({
  value,
  disabled,
  onDelta,
  ariaLabel,
}: {
  value: number;
  disabled?: boolean;
  onDelta: (delta: number) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="inline-flex h-7 items-center rounded-md border border-border bg-background text-xs"
    >
      <button
        type="button"
        disabled={disabled || value <= 0}
        onClick={() => onDelta(-1)}
        className="h-full w-7 text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="-"
      >
        −
      </button>
      <span className="w-6 text-center font-mono tabular-nums">{value}</span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDelta(1)}
        className="h-full w-7 text-muted-foreground hover:text-foreground disabled:opacity-40"
        aria-label="+"
      >
        +
      </button>
    </div>
  );
}

// ─── Inline pill (dual-mode: filled readonly | empty → inline input + ask-kim) ──

function InlinePill({
  filled,
  filledLabel,
  filledIcon,
  emptyLabel,
  onSubmit,
  onAskKim,
  disabled,
  askKimOnly,
  placeholder,
}: {
  filled: boolean;
  filledLabel: string;
  filledIcon?: React.ReactNode;
  emptyLabel: string;
  onSubmit?: (value: string) => void;
  onAskKim: () => void;
  disabled?: boolean;
  askKimOnly?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");

  if (filled) {
    return (
      <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-md travel-accent travel-accent-bg ring-1 ring-inset travel-accent-border px-2 py-1 text-[11px]">
        {filledIcon}
        <span className="truncate">{filledLabel}</span>
      </span>
    );
  }

  if (askKimOnly) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onAskKim}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:travel-accent hover:travel-accent-border disabled:opacity-50"
        >
          <Sparkles size={11} /> {emptyLabel}
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = value.trim();
          if (!v) {
            setEditing(false);
            return;
          }
          onSubmit?.(v);
          setValue("");
          setEditing(false);
        }}
        className="flex items-center gap-1"
      >
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => {
            if (!value.trim()) setEditing(false);
          }}
          placeholder={placeholder}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
      </form>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Plus size={11} /> {emptyLabel.replace(/^\+\s*/, "")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onAskKim}
        title="kim"
        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:travel-accent disabled:opacity-50"
      >
        <Sparkles size={11} />
      </button>
    </div>
  );
}

// ─── Inline adder ─────────────────────────────────────────────────────────────

function InlineAdder({
  tripId,
  onAdded,
  onAskKim,
}: {
  tripId: string;
  onAdded: (d: Destination) => void;
  onAskKim: () => void;
}) {
  const { t } = useTranslation("travel");
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = name.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const created = await addDestination(tripId, {
        name: trimmed,
        country: country.trim() || undefined,
      });
      onAdded(created);
      setName("");
      setCountry("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="mt-3 flex items-center gap-2 rounded-md border border-dashed border-border bg-background p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Plus size={14} className="shrink-0 text-muted-foreground" />
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("route_add_inline_placeholder")}
        disabled={submitting}
        className="h-7 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
      />
      <input
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        placeholder={t("route_add_inline_country")}
        disabled={submitting}
        className="h-7 w-36 bg-transparent text-xs text-muted-foreground focus:outline-none"
      />
      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {t("route_search_hint")}
      </span>
      <button
        type="button"
        onClick={onAskKim}
        title={t("route_ask_kim_chip")}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:travel-accent"
      >
        <Sparkles size={13} />
      </button>
    </form>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function DropLine() {
  return <div className="my-0.5 h-0.5 w-full rounded-full travel-accent-fill" aria-hidden />;
}

function nightsFromDates(d: Destination): number {
  if (!d.arriveAt || !d.departAt) return 0;
  const a = new Date(d.arriveAt).getTime();
  const b = new Date(d.departAt).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

function deriveArriveFor(
  d: Destination,
  all: Destination[],
  trip: Trip,
): string | null {
  if (!trip.startDate) return null;
  let cursor = new Date(trip.startDate + "T00:00:00").getTime();
  for (const other of all) {
    if (other.id === d.id) return new Date(cursor).toISOString();
    const n = nightsFromDates(other);
    cursor += Math.max(0, n) * 86_400_000;
  }
  return new Date(cursor).toISOString();
}
