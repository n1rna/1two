"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Code2, Edit2, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PublishDialog } from "@/components/marketplace/PublishDialog";
import { ForkedFromBadge } from "@/components/marketplace/ForkedFromBadge";
import { useKimAutoContext } from "@/components/kim";
import {
  getLifeRoutine,
  updateLifeRoutine,
  type LifeRoutine,
} from "@/lib/life";
import { formatSchedule } from "./routines-view";
import { RoutineConfigForm } from "./routine-config-form";
import { RoutineConfigReadonly } from "./routine-config-readonly";
import {
  defaultSchema,
  isRoutineConfigSchema,
  type RoutineConfigSchema,
  type RoutineConfigValues,
} from "./routine-schema";

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function asSchema(raw: unknown): RoutineConfigSchema {
  if (isRoutineConfigSchema(raw)) return raw;
  return defaultSchema();
}

function asValues(raw: unknown): RoutineConfigValues {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as RoutineConfigValues;
  }
  return {};
}

export function RoutineDetailView({ routineId }: { routineId: string }) {
  const [routine, setRoutine] = useState<LifeRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);

  // Draft state while editing. Seeded from routine on load/cancel.
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduleStr, setScheduleStr] = useState("{}");
  const [configValues, setConfigValues] = useState<RoutineConfigValues>({});
  const [configSchemaDraft, setConfigSchemaDraft] = useState<RoutineConfigSchema>({
    fields: [],
  });
  const [schemaEditorOpen, setSchemaEditorOpen] = useState(false);
  const [schemaStr, setSchemaStr] = useState("{}");

  const seedFromRoutine = useCallback((r: LifeRoutine) => {
    const schema = asSchema(r.configSchema);
    setName(r.name);
    setDescription(r.description);
    setScheduleStr(JSON.stringify(r.schedule, null, 2));
    setConfigSchemaDraft(schema);
    setConfigValues(asValues(r.config));
    setSchemaStr(JSON.stringify(schema, null, 2));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await getLifeRoutine(routineId);
      setRoutine(r);
      seedFromRoutine(r);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [routineId, seedFromRoutine]);

  useEffect(() => {
    load();
  }, [load]);

  useKimAutoContext(
    routine
      ? {
          kind: "routine",
          id: routine.id,
          label: routine.name,
          snapshot: {
            name: routine.name,
            description: routine.description,
            active: routine.active,
            schedule: routine.schedule,
            config: routine.config,
            configSchema: routine.configSchema,
          },
        }
      : null,
  );

  const handleSave = async () => {
    if (!routine) return;
    setSaving(true);
    try {
      let schedule: unknown = {};
      try {
        schedule = JSON.parse(scheduleStr);
      } catch {
        /* keep {} */
      }

      let schemaToSave: RoutineConfigSchema = configSchemaDraft;
      if (schemaEditorOpen) {
        try {
          const parsed = JSON.parse(schemaStr);
          if (isRoutineConfigSchema(parsed)) schemaToSave = parsed;
        } catch {
          /* ignore — keep form schema */
        }
      }

      const updated = await updateLifeRoutine(routine.id, {
        name,
        description,
        schedule,
        config: configValues,
        configSchema: schemaToSave,
      } as Partial<LifeRoutine>);
      setRoutine(updated);
      seedFromRoutine(updated);
      setEditing(false);
      setSchemaEditorOpen(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const activeSchema = useMemo(() => {
    if (editing) return configSchemaDraft;
    if (routine) return asSchema(routine.configSchema);
    return { fields: [] };
  }, [editing, configSchemaDraft, routine]);

  const displayedValues = useMemo(() => {
    if (editing) return configValues;
    return routine ? asValues(routine.config) : {};
  }, [editing, configValues, routine]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !routine) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
        <AlertCircle className="h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">{error ?? "Routine not found"}</p>
        <Button variant="ghost" size="sm" onClick={load}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 py-5 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-xl font-semibold bg-transparent border-b border-primary/50 focus:outline-none focus:border-primary w-full"
            />
          ) : (
            <h2 className="text-xl font-semibold text-foreground">{routine.name}</h2>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              {routine.active ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {editing ? (
            <>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setEditing(false);
                  setSchemaEditorOpen(false);
                  seedFromRoutine(routine);
                }}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => setEditing(true)}
              >
                <Edit2 className="h-3 w-3" /> Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs gap-1"
                onClick={() => setPublishOpen(true)}
              >
                <Upload className="h-3 w-3" /> Publish
              </Button>
            </>
          )}
        </div>
      </div>

      {routine.forkedFromMpId && <ForkedFromBadge mpId={routine.forkedFromMpId} />}

      {/* Description */}
      <section className="rounded-xl border bg-card px-5 py-4">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Description
        </label>
        {editing ? (
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        ) : (
          <p className="mt-1.5 text-sm text-foreground leading-relaxed">
            {routine.description || (
              <span className="text-muted-foreground/50 italic">No description</span>
            )}
          </p>
        )}
      </section>

      {/* Schedule */}
      <section className="rounded-xl border bg-card px-5 py-4">
        <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          Schedule
        </label>
        {editing ? (
          <textarea
            value={scheduleStr}
            onChange={(e) => setScheduleStr(e.target.value)}
            rows={4}
            className="mt-1.5 w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
          />
        ) : (
          <div className="mt-1.5">
            <p className="text-sm">{formatSchedule(routine.schedule)}</p>
            <pre className="text-[11px] font-mono text-muted-foreground mt-1 whitespace-pre-wrap">
              {JSON.stringify(routine.schedule, null, 2)}
            </pre>
          </div>
        )}
      </section>

      {/* Configuration — schema-driven */}
      <section className="rounded-xl border bg-card px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Configuration
          </label>
          {editing && (
            <button
              type="button"
              onClick={() => setSchemaEditorOpen((o) => !o)}
              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider"
              title="Edit the field schema"
            >
              <Code2 className="h-3 w-3" />
              {schemaEditorOpen ? "close schema" : "edit schema"}
            </button>
          )}
        </div>

        {editing && schemaEditorOpen && (
          <div className="mb-4 space-y-1.5">
            <p className="text-[10px] text-muted-foreground/70">
              Raw JSON schema — defines which fields the configuration form shows.
            </p>
            <textarea
              value={schemaStr}
              onChange={(e) => setSchemaStr(e.target.value)}
              onBlur={() => {
                try {
                  const parsed = JSON.parse(schemaStr);
                  if (isRoutineConfigSchema(parsed)) {
                    setConfigSchemaDraft(parsed);
                  }
                } catch {
                  /* ignore — keep raw for user to fix */
                }
              }}
              rows={10}
              spellCheck={false}
              className="w-full rounded-md border bg-background px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary/50 resize-y"
            />
          </div>
        )}

        {editing ? (
          <RoutineConfigForm
            schema={activeSchema}
            values={configValues}
            onChange={setConfigValues}
          />
        ) : (
          <RoutineConfigReadonly
            schema={activeSchema}
            values={displayedValues}
          />
        )}
      </section>

      <div className="border-t pt-3 space-y-1 text-[11px] text-muted-foreground/60">
        <p>
          Last triggered:{" "}
          {routine.lastTriggered ? relativeTime(routine.lastTriggered) : "Never"}
        </p>
        <p>Updated: {relativeTime(routine.updatedAt)}</p>
        <p>Created: {relativeTime(routine.createdAt)}</p>
      </div>

      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        kind="routine"
        sourceId={routine.id}
        defaultTitle={routine.name}
      />
    </div>
  );
}

