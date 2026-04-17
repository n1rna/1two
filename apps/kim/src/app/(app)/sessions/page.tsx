"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Dumbbell,
  Plus,
  RefreshCw,
  Store,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ListShell, ListRows } from "@/components/list-shell";
import { routes } from "@/lib/routes";
import { ActiveToggle } from "@/components/active-toggle";
import { SelectCheckbox } from "@/components/kim";
import {
  listHealthSessions,
  deleteHealthSession,
  updateHealthSession,
  type HealthSession,
} from "@/lib/health";
import { useTranslation } from "react-i18next";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  intermediate: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
  advanced: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
};

function difficultyColor(level?: string): string {
  return DIFFICULTY_COLORS[level ?? ""] ?? "bg-muted text-muted-foreground";
}

export default function SessionsPage() {
  const { t } = useTranslation("sessions");
  const router = useRouter();
  const [sessions, setSessions] = useState<HealthSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setSessions(await listHealthSessions());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string) {
    if (!confirm(t("confirm_delete"))) return;
    await deleteHealthSession(id);
    setSessions((cur) => cur.filter((s) => s.id !== id));
  }
  async function setActive(id: string, active: boolean) {
    const updated = await updateHealthSession(id, { active });
    setSessions((cur) => cur.map((s) => (s.id === id ? updated : s)));
  }

  const activeCount = sessions.filter((s) => s.active).length;

  return (
    <ListShell
      title={t("list_title")}
      subtitle={
        sessions.length > 0
          ? t("list_subtitle_with_count", { activeCount, totalCount: sessions.length })
          : t("list_subtitle_empty")
      }
      toolbar={
        <>
          <button
            onClick={load}
            className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </button>
          <div className="flex-1" />
          <Link
            href={routes.marketplace({ kind: "gym_session" })}
            className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
            title={t("browse_templates_tooltip")}
          >
            <Store className="h-3.5 w-3.5" />
            {t("browse_templates", { ns: "common" })}
          </Link>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-7"
            onClick={() => router.push(routes.sessionNew)}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("new_session", { ns: "common" })}
          </Button>
        </>
      }
    >
      <div>
        {error && (
          <div className="flex items-center gap-2 mx-3 mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            {error}
            <button onClick={load} className="ml-auto text-xs underline">
              Retry
            </button>
          </div>
        )}

        {loading && (
          <div className="px-3 py-2 space-y-1">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="h-4 w-4 rounded bg-muted animate-pulse shrink-0" />
                <div className="h-8 w-8 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
                  <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && sessions.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <Dumbbell className="h-10 w-10 text-muted-foreground/20" />
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                {t("empty_title")}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {t("empty_hint")}
              </p>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs"
                onClick={() => router.push(routes.sessionNew)}
              >
                <Plus className="h-3.5 w-3.5" />
                New Session
              </Button>
              <Link
                href={routes.marketplace({ kind: "gym_session" })}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
              >
                <Store className="h-3.5 w-3.5" />
                Browse Templates
              </Link>
            </div>
          </div>
        )}

        {!loading && sessions.length > 0 && (
          <ListRows>
            {sessions.map((s) => (
              <SessionRow
                key={s.id}
                session={s}
                onOpen={() => router.push(routes.session(s.id))}
                onToggleActive={(next) => setActive(s.id, next)}
                onDelete={() => remove(s.id)}
              />
            ))}
          </ListRows>
        )}
      </div>
    </ListShell>
  );
}

function SessionRow({
  session,
  onOpen,
  onToggleActive,
  onDelete,
}: {
  session: HealthSession;
  onOpen: () => void;
  onToggleActive: (active: boolean) => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation("sessions");
  const color = difficultyColor(session.difficultyLevel);
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors cursor-pointer hover:bg-muted/50",
        !session.active && "opacity-60",
      )}
      onClick={onOpen}
    >
      <SelectCheckbox
        kind="session"
        id={session.id}
        label={session.title}
        snapshot={{
          title: session.title,
          active: session.active,
          difficulty: session.difficultyLevel,
          duration: session.estimatedDuration,
          muscleGroups: session.targetMuscleGroups,
          exerciseCount: session.exerciseCount,
        }}
      />

      <div
        className={cn(
          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
          color,
        )}
      >
        <Dumbbell className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {session.title}
        </p>
        <p className="text-[11px] text-muted-foreground truncate">
          {session.difficultyLevel || "intermediate"}
          {session.estimatedDuration ? ` · ${session.estimatedDuration} min` : ""}
          {` · ${session.exerciseCount ?? 0} exercise${session.exerciseCount === 1 ? "" : "s"}`}
          {session.targetMuscleGroups?.length
            ? ` · ${session.targetMuscleGroups.join(", ")}`
            : ""}
        </p>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <ActiveToggle
          active={session.active}
          onChange={onToggleActive}
          label={session.active ? t("disable_session") : t("enable_session")}
        />
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
          title="Delete"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}
