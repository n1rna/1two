"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Coins,
  CreditCard,
  Droplet,
  HandCoins,
  Languages,
  Plug,
  Train,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  listDestinations,
  type Destination,
  type Trip,
} from "@1tt/api-client/travel";
import { Card, EmptyState } from "@/components/page-shell";
import { routes } from "@/lib/routes";
import { TripHeader } from "./trip-header";
import { TripPageLoader } from "./trip-page-loader";

export function TripTipsView({ tripId }: { tripId: string }) {
  return (
    <TripPageLoader tripId={tripId}>
      {(trip, setTrip) => <TipsBody trip={trip} setTrip={setTrip} />}
    </TripPageLoader>
  );
}

// Static local-intel fixtures keyed by lowercased country. Real implementation
// should source from a content CMS or Kim-generated memory; this stub keeps
// the visual design working until QBL-165 lands the backing table.
const INTEL: Record<string, {
  plug: string;
  currency: string;
  tipping: string;
  water: string;
  phrases: string;
  emergency: string;
  transport: string;
}> = {
  japan: {
    plug: "Type A · 100V",
    currency: "JPY (¥)",
    tipping: "Not expected",
    water: "Safe to drink",
    phrases: "Konnichiwa · Arigatou",
    emergency: "110 police · 119 fire/amb",
    transport: "Suica / Pasmo IC cards",
  },
  france: {
    plug: "Type E · 230V",
    currency: "EUR (€)",
    tipping: "Round up; service included",
    water: "Safe to drink",
    phrases: "Bonjour · Merci",
    emergency: "112 (EU)",
    transport: "Navigo pass in Paris",
  },
};

const LABELS: { key: keyof (typeof INTEL)["japan"]; labelKey: string; icon: typeof Plug }[] = [
  { key: "plug", labelKey: "tips_label_plug", icon: Plug },
  { key: "currency", labelKey: "tips_label_currency", icon: Coins },
  { key: "tipping", labelKey: "tips_label_tipping", icon: HandCoins },
  { key: "water", labelKey: "tips_label_water", icon: Droplet },
  { key: "phrases", labelKey: "tips_label_phrases", icon: Languages },
  { key: "emergency", labelKey: "tips_label_emergency", icon: AlertTriangle },
  { key: "transport", labelKey: "tips_label_transport", icon: Train },
];

function TipsBody({ trip, setTrip }: { trip: Trip; setTrip: (t: Trip) => void }) {
  const { t } = useTranslation("travel");
  const [destinations, setDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    listDestinations(trip.id).then(setDestinations).catch(() => setDestinations([]));
  }, [trip.id]);

  const primary = destinations[0];
  const country = primary?.country?.toLowerCase() ?? "";
  const intel = INTEL[country] ?? null;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TripHeader
        trip={trip}
        onTripChange={setTrip}
        variant="compact"
        pageTitle={t("tips_title")}
        pageSubtitle={primary ? t("tips_subtitle", { destination: primary.name }) : undefined}
        backHref={routes.trip(trip.id)}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 sm:px-8 sm:py-6 max-w-4xl">
          {!intel ? (
            <EmptyState title={t("tips_empty_title")} hint={t("tips_empty_hint")} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {LABELS.map(({ key, labelKey, icon: Icon }) => (
                <Card key={key} className="flex flex-col gap-1 p-4">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wide text-muted-foreground">
                    <Icon size={11} /> {t(labelKey)}
                  </div>
                  <div className="text-sm font-medium truncate">{intel[key]}</div>
                </Card>
              ))}
            </div>
          )}

          <p className="mt-6 text-[11px] font-mono uppercase tracking-wide text-muted-foreground/70">
            * Reference data. Verify with local sources before travel.
          </p>
        </div>
      </div>
    </div>
  );
}
