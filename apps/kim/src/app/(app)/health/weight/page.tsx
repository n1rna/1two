"use client";

import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import {
  listWeightEntries,
  createWeightEntry,
  deleteWeightEntry,
  type WeightEntry,
} from "@/lib/health";
import { routes } from "@/lib/routes";

export default function WeightPage() {
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [weight, setWeight] = useState("");
  const [note, setNote] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setEntries(await listWeightEntries());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function add() {
    const kg = Number(weight);
    if (!kg) return;
    const e = await createWeightEntry(kg, note || undefined);
    setEntries((cur) => [e, ...cur]);
    setWeight("");
    setNote("");
  }
  async function remove(id: string) {
    await deleteWeightEntry(id);
    setEntries((cur) => cur.filter((e) => e.id !== id));
  }

  return (
    <PageShell
      title="Weight"
      subtitle="Recent weight entries"
      backHref={routes.health}
    >
      <div className="max-w-xl space-y-4">
        <Card>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                weight (kg)
              </label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm outline-none"
              />
            </div>
            <div className="flex-[2]">
              <label className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                note
              </label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full bg-transparent border border-border rounded-md px-3 py-1.5 text-sm outline-none"
              />
            </div>
            <Button onClick={add}>log</Button>
          </div>
        </Card>

        {loading ? (
          <Card>
            <div className="h-20 rounded bg-muted animate-pulse" />
          </Card>
        ) : entries.length === 0 ? (
          <EmptyState title="No entries yet" />
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {entries.map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono">{e.weightKg.toFixed(1)} kg</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.recordedAt).toLocaleDateString()}
                    </span>
                    {e.note && (
                      <span className="text-xs italic text-muted-foreground">
                        · {e.note}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => remove(e.id)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={13} />
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </PageShell>
  );
}
