"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { createTrip, type Trip } from "@1tt/api-client/travel";
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
import { routes } from "@/lib/routes";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (trip: Trip) => void;
}

const COMMON_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "CAD", "AUD", "CHF"];

export function CreateTripModal({ open, onOpenChange, onCreated }: Props) {
  const { t } = useTranslation("travel");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setSummary("");
    setStartDate("");
    setEndDate("");
    setCurrency("USD");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const trip = await createTrip({
        title: trimmed,
        summary: summary.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        budgetCurrency: currency,
      });
      reset();
      if (onCreated) {
        onCreated(trip);
      } else {
        onOpenChange(false);
      }
      router.push(routes.trip(trip.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("create_error"));
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
          <DialogTitle>{t("create_title")}</DialogTitle>
          <p className="text-xs text-muted-foreground">{t("create_subtitle")}</p>
        </DialogHeader>

        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1">
            <Label htmlFor="trip-title">{t("field_title")}</Label>
            <Input
              id="trip-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("field_title_placeholder")}
              autoFocus
              required
              disabled={submitting}
            />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="trip-summary">{t("field_summary")}</Label>
            <Textarea
              id="trip-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("field_summary_placeholder")}
              rows={2}
              disabled={submitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="trip-start">{t("field_start_date")}</Label>
              <Input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={submitting}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="trip-end">{t("field_end_date")}</Label>
              <Input
                id="trip-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="trip-currency">{t("field_currency")}</Label>
            <select
              id="trip-currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              disabled={submitting}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              {COMMON_CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              {tCommon("cancel")}
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? tCommon("creating") : t("create_submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
