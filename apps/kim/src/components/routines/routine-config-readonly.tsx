"use client";

import type {
  RoutineConfigSchema,
  RoutineConfigValues,
  RoutineField,
} from "./routine-schema";

/**
 * Read-only rendering of a routine's config given its schema. Mirrors the
 * shape of `<RoutineConfigForm>` but without editable inputs — used on the
 * routine detail page and the marketplace item detail page.
 */
export function RoutineConfigReadonly({
  schema,
  values,
}: {
  schema: RoutineConfigSchema;
  values: RoutineConfigValues;
}) {
  if (!schema.fields.length) {
    const empty = Object.keys(values).length === 0;
    if (empty) {
      return (
        <p className="text-sm text-muted-foreground italic">
          No configuration for this routine.
        </p>
      );
    }
    return (
      <pre className="text-[11px] font-mono text-foreground whitespace-pre-wrap">
        {JSON.stringify(values, null, 2)}
      </pre>
    );
  }

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => (
        <ReadonlyField
          key={field.key}
          field={field}
          value={values[field.key]}
        />
      ))}
    </div>
  );
}

function ReadonlyField({
  field,
  value,
}: {
  field: RoutineField;
  value: unknown;
}) {
  return (
    <div>
      <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1">
        {field.label}
      </div>
      <ReadonlyValue field={field} value={value} />
    </div>
  );
}

function ReadonlyValue({
  field,
  value,
}: {
  field: RoutineField;
  value: unknown;
}) {
  if (value == null || value === "") {
    return <p className="text-sm text-muted-foreground/50 italic">—</p>;
  }

  switch (field.type) {
    case "string":
    case "text":
      return (
        <p className="text-sm text-foreground whitespace-pre-wrap">
          {String(value)}
        </p>
      );
    case "number":
      return <p className="text-sm font-mono">{String(value)}</p>;
    case "boolean":
      return <p className="text-sm">{value === true ? "Yes" : "No"}</p>;
    case "enum": {
      const label =
        field.options?.find((o) => o.value === value)?.label ?? String(value);
      return <p className="text-sm text-foreground">{label}</p>;
    }
    case "array": {
      const items = Array.isArray(value) ? value : [];
      if (items.length === 0) {
        return <p className="text-sm text-muted-foreground/50 italic">None</p>;
      }
      if (field.itemFields) {
        return (
          <div className="space-y-2">
            {items.map((item, i) => (
              <div
                key={i}
                className="rounded-md border border-border/60 bg-muted/20 p-3"
              >
                <div className="text-[10px] text-muted-foreground mb-1.5">
                  #{i + 1}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                  {field.itemFields!.map((sub) => (
                    <div key={sub.key}>
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        {sub.label}
                      </div>
                      <ReadonlyValue
                        field={sub}
                        value={(item as Record<string, unknown>)?.[sub.key]}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        );
      }
      return (
        <ul className="text-sm list-disc list-inside space-y-0.5">
          {items.map((item, i) => (
            <li key={i}>{String(item)}</li>
          ))}
        </ul>
      );
    }
  }
}
