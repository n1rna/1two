"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import {
  deleteDestination as apiDeleteDestination,
  reorderDestinations,
  type Destination,
} from "@1tt/api-client/travel";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/page-shell";
import { cn } from "@/lib/utils";
import { DestinationModal } from "./destination-modal";

interface Props {
  tripId: string;
  destinations: Destination[];
  canEdit: boolean;
  onChange: (next: Destination[]) => void;
}

export function DestinationsEditor({ tripId, destinations, canEdit, onChange }: Props) {
  const { t } = useTranslation("travel");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Destination | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const dragEnterCountRef = useRef(0);

  const handleAdded = useCallback(
    (dest: Destination) => onChange([...destinations, dest]),
    [destinations, onChange],
  );

  const handleUpdated = useCallback(
    (dest: Destination) =>
      onChange(destinations.map((d) => (d.id === dest.id ? dest : d))),
    [destinations, onChange],
  );

  async function handleDelete(dest: Destination) {
    if (typeof window !== "undefined" && !window.confirm(t("confirm_delete_destination"))) return;
    try {
      await apiDeleteDestination(dest.id);
      onChange(destinations.filter((d) => d.id !== dest.id));
    } catch {
      // Refresh-on-fail is the caller's job; leave list as-is.
    }
  }

  async function commitReorder(fromIdx: number, toIdx: number) {
    if (fromIdx === toIdx) return;
    const next = [...destinations];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    const renumbered = next.map((d, i) => ({ ...d, ordinal: i }));
    onChange(renumbered);
    try {
      await reorderDestinations(
        tripId,
        renumbered.map((d) => d.id),
      );
    } catch {
      // Server rejected — revert by handing back the original list.
      onChange(destinations);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {destinations.length === 0 ? (
          <EmptyState
            title={t("empty_destinations_title")}
            hint={canEdit ? t("empty_destinations_hint_editable") : t("empty_destinations_hint")}
          />
        ) : (
          <ul className="flex flex-col gap-1.5">
            {destinations.map((d, i) => {
              const showTopLine = dropIndex === i && dragIndex != null && dragIndex !== i && dragIndex !== i - 1;
              return (
                <li key={d.id} className="relative">
                  {showTopLine && <DropLine />}
                  <DestinationRow
                    destination={d}
                    index={i}
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
                        // Dropping "before target" when target > dragIndex means target-1 after splice;
                        // commitReorder already handles that with splice semantics.
                        const resolved = target > dragIndex ? target - 1 : target;
                        void commitReorder(dragIndex, resolved);
                      }
                      setDragIndex(null);
                      setDropIndex(null);
                    }}
                    onEdit={() => setEditing(d)}
                    onDelete={() => void handleDelete(d)}
                    t={t}
                  />
                </li>
              );
            })}
            {/* Drop zone after the last item */}
            {dragIndex != null && dropIndex === destinations.length && (
              <li>
                <DropLine />
              </li>
            )}
          </ul>
        )}

        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            className="self-start mt-2"
            onClick={() => setAddOpen(true)}
          >
            <Plus size={14} /> {t("add_destination")}
          </Button>
        )}
      </div>

      <DestinationModal
        open={addOpen}
        onOpenChange={setAddOpen}
        tripId={tripId}
        onSaved={handleAdded}
      />
      <DestinationModal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        tripId={tripId}
        destination={editing}
        onSaved={handleUpdated}
      />
    </>
  );
}

// ─── Row ──────────────────────────────────────────────────────────────────────

function DestinationRow({
  destination,
  index,
  canEdit,
  dragging,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  onEdit,
  onDelete,
  t,
}: {
  destination: Destination;
  index: number;
  canEdit: boolean;
  dragging: boolean;
  onDragStart: () => void;
  onDragOver: (targetIndex: number) => void;
  onDragEnd: () => void;
  onDrop: (targetIndex: number) => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (k: string) => string;
}) {
  const d = destination;
  const metaBits = [d.region, d.country].filter(Boolean);
  const dateLine = formatDateRange(d.arriveAt, d.departAt);

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
        "flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2.5",
        dragging && "opacity-40",
      )}
    >
      {canEdit && (
        <button
          type="button"
          className="cursor-grab text-muted-foreground hover:text-foreground"
          aria-label={t("drag_to_reorder")}
          tabIndex={-1}
        >
          <GripVertical size={14} />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="text-xs text-muted-foreground tabular-nums">{index + 1}.</span>
          <span className="text-sm font-medium truncate">{d.name}</span>
        </div>
        {(metaBits.length > 0 || dateLine) && (
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            {metaBits.length > 0 && <span className="truncate">{metaBits.join(", ")}</span>}
            {metaBits.length > 0 && dateLine && <span>·</span>}
            {dateLine && <span className="shrink-0">{dateLine}</span>}
          </div>
        )}
      </div>
      {canEdit && (
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={t("edit_destination")}>
            <Pencil size={13} />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            aria-label={t("delete_destination")}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 size={13} />
          </Button>
        </div>
      )}
    </div>
  );
}

function DropLine() {
  return <div className="h-0.5 w-full rounded-full bg-primary my-1" aria-hidden />;
}

function formatDateRange(arrive: string | null, depart: string | null): string {
  const fmt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };
  const a = fmt(arrive);
  const b = fmt(depart);
  if (a && b) return `${a} → ${b}`;
  if (a) return a;
  if (b) return b;
  return "";
}
