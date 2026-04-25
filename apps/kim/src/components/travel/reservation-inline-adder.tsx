"use client";

import { useState } from "react";
import { Plus, Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  addReservation,
  type Reservation,
  type ReservationKind,
} from "@1tt/api-client/travel";
import { useKim } from "@/components/kim";

interface Props {
  tripId: string;
  tripTitle: string;
  kind: ReservationKind;
  kindLabel: string;
  onAdded: (r: Reservation) => void;
}

/**
 * Inline "+ Add reservation" control used at the bottom of each reservations
 * group. Expands to a compact form (title + optional cost) and delegates to
 * kim via the spark button when the user wants the agent to handle booking.
 */
export function ReservationInlineAdder({
  tripId,
  tripTitle,
  kind,
  kindLabel,
  onAdded,
}: Props) {
  const { t } = useTranslation("travel");
  const { askKim } = useKim();
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [cost, setCost] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = title.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const parsedCost = cost ? Number(cost) : undefined;
      const created = await addReservation(tripId, {
        kind,
        title: trimmed,
        costAmount: Number.isFinite(parsedCost) ? parsedCost : undefined,
        status: "planned",
      });
      onAdded(created);
      setTitle("");
      setCost("");
      setEditing(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <Plus size={11} /> {t("reservations_add_cta")}
        </button>
        <button
          type="button"
          onClick={() =>
            askKim(
              t("reservations_ask_kim") + `: ${kindLabel.toLowerCase()} for ${tripTitle}`,
            )
          }
          title={t("route_ask_kim_chip")}
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:travel-accent"
        >
          <Sparkles size={11} />
        </button>
      </div>
    );
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-background p-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => {
          if (!title.trim() && !cost.trim()) setEditing(false);
        }}
        placeholder={`${kindLabel} title`}
        disabled={submitting}
        className="h-7 min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
      />
      <input
        value={cost}
        onChange={(e) => setCost(e.target.value)}
        placeholder="Cost"
        inputMode="decimal"
        disabled={submitting}
        className="h-7 w-20 bg-transparent text-xs font-mono tabular-nums focus:outline-none"
      />
      <button
        type="submit"
        disabled={submitting || !title.trim()}
        className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs disabled:opacity-50"
      >
        Add
      </button>
    </form>
  );
}
