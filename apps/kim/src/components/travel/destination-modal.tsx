"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  addDestination,
  updateDestination,
  type Destination,
} from "@1tt/api-client/travel";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  /** When set, edits this destination. When undefined, creates a new one. */
  destination?: Destination | null;
  onSaved?: (d: Destination) => void;
}

export function DestinationModal({ open, onOpenChange, tripId, destination, onSaved }: Props) {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const isEdit = !!destination;

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [region, setRegion] = useState("");
  const [arriveAt, setArriveAt] = useState("");
  const [departAt, setDepartAt] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(destination?.name ?? "");
    setCountry(destination?.country ?? "");
    setRegion(destination?.region ?? "");
    setArriveAt(toDateInput(destination?.arriveAt));
    setDepartAt(toDateInput(destination?.departAt));
    setNotes(destination?.notes ?? "");
    setError(null);
  }, [open, destination]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const arriveIso = toRfc3339(arriveAt);
      const departIso = toRfc3339(departAt);
      let saved: Destination;
      if (isEdit && destination) {
        saved = await updateDestination(destination.id, {
          name: trimmed,
          country: country.trim(),
          region: region.trim(),
          arriveAt: arriveIso ?? null,
          departAt: departIso ?? null,
          notes: notes.trim(),
        });
      } else {
        saved = await addDestination(tripId, {
          name: trimmed,
          country: country.trim() || undefined,
          region: region.trim() || undefined,
          arriveAt: arriveIso ?? undefined,
          departAt: departIso ?? undefined,
          notes: notes.trim() || undefined,
        });
      }
      if (onSaved) onSaved(saved);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("destination_save_error"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!submitting) onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? t("edit_destination_title") : t("add_destination_title")}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {isEdit ? t("edit_destination_subtitle") : t("add_destination_subtitle")}
          </p>
        </DialogHeader>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="dest-name">{t("field_destination_name")}</Label>
            <Input
              id="dest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("field_destination_name_placeholder")}
              required
              autoFocus
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dest-country">{t("field_country")}</Label>
              <Input
                id="dest-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder={t("field_country_placeholder")}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dest-region">{t("field_region")}</Label>
              <Input
                id="dest-region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={t("field_region_placeholder")}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="dest-arrive">{t("field_arrive_at")}</Label>
              <Input
                id="dest-arrive"
                type="date"
                value={arriveAt}
                onChange={(e) => setArriveAt(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="dest-depart">{t("field_depart_at")}</Label>
              <Input
                id="dest-depart"
                type="date"
                value={departAt}
                min={arriveAt || undefined}
                onChange={(e) => setDepartAt(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="dest-notes">{t("field_notes")}</Label>
            <Textarea
              id="dest-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("field_notes_placeholder")}
              rows={2}
              disabled={submitting}
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()}>
              {submitting ? tCommon("saving") : isEdit ? tCommon("save") : tCommon("add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a YYYY-MM-DD date from an RFC3339 string for the native date input. */
function toDateInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

/** Convert a YYYY-MM-DD date input back to RFC3339 UTC midnight. */
function toRfc3339(date: string): string | null {
  if (!date) return null;
  return `${date}T00:00:00Z`;
}
