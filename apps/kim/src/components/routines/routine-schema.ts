/**
 * Routine config schema — a lightweight declarative format that lets each
 * routine describe the shape of its own configuration values. The routine
 * record holds the schema (shared across forks), and per-user `config` holds
 * the actual values conforming to that schema.
 *
 * Deliberately smaller and more opinionated than JSON Schema: just enough to
 * drive a good form UI and let the agent reason about updates.
 */

export type RoutineFieldType =
  | "string"   // single-line text
  | "text"     // multi-line text
  | "number"
  | "boolean"
  | "enum"
  | "array";   // repeating items — either scalar strings or nested objects

export interface RoutineEnumOption {
  value: string;
  label: string;
}

export interface RoutineField {
  key: string;
  label: string;
  description?: string;
  type: RoutineFieldType;
  required?: boolean;
  placeholder?: string;
  // enum
  options?: RoutineEnumOption[];
  // number defaults
  min?: number;
  max?: number;
  step?: number;
  // array: if present, items are objects with these fields.
  // otherwise items are plain strings.
  itemFields?: RoutineField[];
  // array: label for a single item (shown on "Add X" buttons etc.)
  itemLabel?: string;
}

export interface RoutineConfigSchema {
  fields: RoutineField[];
}

export type RoutineConfigValues = Record<string, unknown>;

export function isRoutineConfigSchema(
  raw: unknown,
): raw is RoutineConfigSchema {
  return (
    !!raw &&
    typeof raw === "object" &&
    Array.isArray((raw as RoutineConfigSchema).fields)
  );
}

/**
 * An empty starting schema. Routines no longer have a "type" to key defaults
 * off of — users start with a blank form and build their own schema (or
 * inherit one by forking from the marketplace).
 */
export function defaultSchema(): RoutineConfigSchema {
  return { fields: [] };
}

/**
 * Produce a sensible starting value for a schema — empty strings, 0, false,
 * empty arrays as appropriate. Useful when seeding config for a new routine.
 */
export function defaultValuesFor(
  schema: RoutineConfigSchema,
): RoutineConfigValues {
  const out: RoutineConfigValues = {};
  for (const f of schema.fields) {
    out[f.key] = defaultFieldValue(f);
  }
  return out;
}

export function defaultFieldValue(field: RoutineField): unknown {
  switch (field.type) {
    case "string":
    case "text":
      return "";
    case "number":
      return null;
    case "boolean":
      return false;
    case "enum":
      return field.options?.[0]?.value ?? "";
    case "array":
      return [];
  }
}

export function defaultArrayItem(field: RoutineField): unknown {
  if (field.type !== "array") return null;
  if (!field.itemFields) return "";
  const out: Record<string, unknown> = {};
  for (const f of field.itemFields) out[f.key] = defaultFieldValue(f);
  return out;
}
