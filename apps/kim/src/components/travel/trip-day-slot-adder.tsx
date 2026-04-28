"use client";

import { useState, type ReactNode } from "react";
import {
  addReservation,
  type Reservation,
  type ReservationKind,
} from "@1tt/api-client/travel";

/**
 * Compact dashed "+ Add X" button that, on click, swaps in a one-field
 * inline form for adding a reservation pinned to a specific day. Used by
 * every lens to surface clickable per-day placeholders for transport and
 * accommodation.
 */
export function DaySlotAdder({
  tripId,
  kind,
  date,
  destinationId,
  label,
  placeholder,
  icon,
  onAdded,
  className,
}: {
  tripId: string;
  kind: ReservationKind;
  date: Date;
  destinationId: string | null;
  label: string;
  placeholder: string;
  icon: ReactNode;
  onAdded: (r: Reservation) => void;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const iso = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0),
      ).toISOString();
      const created = await addReservation(tripId, {
        kind,
        title: trimmed,
        startAt: iso,
        destinationId: destinationId ?? undefined,
        status: "planned",
      });
      onAdded(created);
      setTitle("");
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted-foreground hover:travel-accent hover:travel-accent-border hover:travel-accent-bg"
        }
      >
        {icon}
        <span>+ {label}</span>
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-border bg-background px-2 py-1"
    >
      <span className="travel-accent">{icon}</span>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim()) setEditing(false);
        }}
        placeholder={placeholder}
        disabled={submitting}
        className="h-6 w-44 min-w-0 bg-transparent text-xs focus:outline-none"
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="inline-flex h-6 items-center rounded-md border border-border px-2 text-[11px] disabled:opacity-50"
      >
        {submitting ? "…" : "Add"}
      </button>
    </form>
  );
}
