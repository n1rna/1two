"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Sun, CalendarDays, Repeat, Dumbbell, Utensils } from "lucide-react";
import { PageShell, Card, EmptyState } from "@/components/page-shell";
import { Selectable } from "@/components/kim";
import {
  listLifeActionables,
  listGCalEvents,
  listLifeRoutines,
  type LifeActionable,
  type GCalEvent,
  type LifeRoutine,
} from "@/lib/life";
import { routes } from "@/lib/routes";

export default function LifeDashboard() {
  const [actionables, setActionables] = useState<LifeActionable[]>([]);
  const [events, setEvents] = useState<GCalEvent[]>([]);
  const [routines, setRoutines] = useState<LifeRoutine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [a, e, r] = await Promise.allSettled([
        listLifeActionables("pending"),
        listGCalEvents(undefined, undefined, 1),
        listLifeRoutines(),
      ]);
      if (a.status === "fulfilled") setActionables(a.value);
      if (e.status === "fulfilled") setEvents(e.value);
      if (r.status === "fulfilled") setRoutines(r.value);
      setLoading(false);
    })();
  }, []);

  const today = new Date();
  const dayLabel = today.toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <PageShell title="Today" subtitle={dayLabel}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <SectionHeading icon={<Sun size={13} />}>Actionables</SectionHeading>
          {loading ? (
            <Skeleton rows={2} />
          ) : actionables.length === 0 ? (
            <EmptyState title="Nothing pending" hint="Kim will nudge you when something needs attention." />
          ) : (
            <ul className="flex flex-col gap-2">
              {actionables.slice(0, 6).map((a) => (
                <Selectable
                  key={a.id}
                  kind="actionable"
                  id={a.id}
                  label={a.title}
                  snapshot={{ type: a.type, status: a.status, description: a.description }}
                >
                  <li className="border border-border rounded-md px-3 py-2.5">
                    <div className="font-medium text-sm">{a.title}</div>
                    {a.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {a.description}
                      </div>
                    )}
                  </li>
                </Selectable>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <SectionHeading icon={<CalendarDays size={13} />}>
            Today's events
          </SectionHeading>
          {loading ? (
            <Skeleton rows={3} />
          ) : events.length === 0 ? (
            <EmptyState title="Nothing scheduled" />
          ) : (
            <ul className="flex flex-col gap-2">
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="border border-border rounded-md px-3 py-2">
                  <div className="text-xs text-muted-foreground font-mono">
                    {e.allDay
                      ? "all day"
                      : new Date(e.start).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                  </div>
                  <div className="text-sm">{e.summary}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="lg:col-span-3">
          <SectionHeading icon={<Repeat size={13} />}>Active routines</SectionHeading>
          {loading ? (
            <Skeleton rows={2} />
          ) : routines.length === 0 ? (
            <EmptyState
              title="No routines yet"
              hint="Open Kim (⌘K) and ask it to create one."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {routines.filter((r) => r.active).map((r) => (
                <Link
                  key={r.id}
                  href={routes.routine(r.id)}
                  className="border border-border rounded-md px-3 py-3 hover:bg-accent/40 transition-colors"
                >
                  <div className="font-medium text-sm">{r.name}</div>
                  {r.description && (
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {r.description}
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionHeading icon={<Utensils size={13} />}>meals</SectionHeading>
          <Link
            href={routes.meals}
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            manage meal plans →
          </Link>
        </Card>
        <Card>
          <SectionHeading icon={<Dumbbell size={13} />}>gym</SectionHeading>
          <Link
            href={routes.sessions}
            className="block text-sm text-muted-foreground hover:text-foreground"
          >
            manage sessions →
          </Link>
        </Card>
        <Card>
          <SectionHeading icon={<Plus size={13} />}>ask kim</SectionHeading>
          <p className="text-sm text-muted-foreground">
            press ⌘K to open Kim on any page.
          </p>
        </Card>
      </div>
    </PageShell>
  );
}

function SectionHeading({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 mb-3 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
      {icon}
      {children}
    </div>
  );
}

function Skeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-md bg-muted animate-pulse" />
      ))}
    </div>
  );
}
