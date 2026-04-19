"use client";

import { Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  defaultArrayItem,
  defaultFieldValue,
  type RoutineConfigSchema,
  type RoutineConfigValues,
  type RoutineField,
} from "./routine-schema";

interface Props {
  schema: RoutineConfigSchema;
  values: RoutineConfigValues;
  onChange: (next: RoutineConfigValues) => void;
  disabled?: boolean;
}

/**
 * Renders a full config form from a RoutineConfigSchema. Handles strings,
 * numbers, booleans, enums, and arrays (both scalar and nested-object items).
 */
export function RoutineConfigForm({ schema, values, onChange, disabled }: Props) {
  if (!schema.fields.length) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
        This routine has no configuration fields. Edit the schema to add some,
        or ask Kim to define what shape the config should have.
      </div>
    );
  }

  const setField = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div className="space-y-4">
      {schema.fields.map((field) => (
        <FieldView
          key={field.key}
          field={field}
          value={values[field.key]}
          onChange={(v) => setField(field.key, v)}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

// ─── Top-level field rendering ───────────────────────────────────────────────

function FieldView({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RoutineField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <FieldLabel field={field} />
      <FieldInput
        field={field}
        value={value}
        onChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}

function FieldLabel({ field }: { field: RoutineField }) {
  return (
    <div className="mb-1.5">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </label>
      {field.description && (
        <p className="text-[11px] text-muted-foreground/70 mt-0.5">
          {field.description}
        </p>
      )}
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RoutineField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  switch (field.type) {
    case "string":
      return (
        <Input
          type="text"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
        />
      );
    case "text":
      return (
        <Textarea
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={disabled}
          rows={3}
          className="resize-y"
        />
      );
    case "number":
      return (
        <Input
          type="number"
          value={typeof value === "number" ? value : value == null ? "" : Number(value as string)}
          onChange={(e) =>
            onChange(e.target.value === "" ? null : Number(e.target.value))
          }
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          step={field.step ?? 1}
          disabled={disabled}
          className="w-32"
        />
      );
    case "boolean":
      return (
        <div className="inline-flex items-center gap-3 text-sm">
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <span className="text-muted-foreground">{field.placeholder ?? "Enabled"}</span>
        </div>
      );
    case "enum":
      return (
        <Select
          value={typeof value === "string" ? value : (field.options?.[0]?.value ?? "")}
          onValueChange={(v) => onChange(v as string)}
          disabled={disabled}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {field.options?.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "array":
      return (
        <ArrayField
          field={field}
          value={value}
          onChange={onChange}
          disabled={disabled}
        />
      );
  }
}

// ─── Array field ─────────────────────────────────────────────────────────────

function ArrayField({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RoutineField;
  value: unknown;
  onChange: (v: unknown) => void;
  disabled?: boolean;
}) {
  const items = Array.isArray(value) ? (value as unknown[]) : [];
  const isNested = !!field.itemFields;
  const itemLabel = field.itemLabel ?? "item";

  const setItem = (i: number, next: unknown) => {
    const copy = items.slice();
    copy[i] = next;
    onChange(copy);
  };

  const removeItem = (i: number) => {
    onChange(items.filter((_, j) => j !== i));
  };

  const addItem = () => {
    onChange([...items, defaultArrayItem(field)]);
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <div className="text-xs text-muted-foreground italic px-3 py-2 rounded-md border border-dashed border-border">
          No {itemLabel}s yet.
        </div>
      )}

      {items.map((item, i) =>
        isNested ? (
          <NestedArrayItem
            key={i}
            index={i}
            itemFields={field.itemFields!}
            item={item as Record<string, unknown>}
            onChange={(next) => setItem(i, next)}
            onRemove={() => removeItem(i)}
            disabled={disabled}
          />
        ) : (
          <ScalarArrayItem
            key={i}
            value={typeof item === "string" ? item : String(item ?? "")}
            onChange={(next) => setItem(i, next)}
            onRemove={() => removeItem(i)}
            disabled={disabled}
          />
        ),
      )}

      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline disabled:opacity-50"
      >
        <Plus className="h-3 w-3" />
        Add {itemLabel}
      </button>
    </div>
  );
}

function ScalarArrayItem({
  value,
  onChange,
  onRemove,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="flex-1"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive disabled:opacity-50"
        title="Remove"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function NestedArrayItem({
  index,
  itemFields,
  item,
  onChange,
  onRemove,
  disabled,
}: {
  index: number;
  itemFields: RoutineField[];
  item: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onRemove: () => void;
  disabled?: boolean;
}) {
  const setItemField = (key: string, value: unknown) => {
    onChange({ ...(item ?? {}), [key]: value });
  };
  const safeItem = item ?? {};
  return (
    <div className="rounded-md border border-border bg-muted/10 p-3 space-y-3 relative group">
      <div className="absolute top-2 right-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span>#{index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="p-1 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      {itemFields.map((sub) => {
        const v = safeItem[sub.key] ?? defaultFieldValue(sub);
        return (
          <div key={sub.key}>
            <FieldLabel field={sub} />
            <FieldInput
              field={sub}
              value={v}
              onChange={(next) => setItemField(sub.key, next)}
              disabled={disabled}
            />
          </div>
        );
      })}
    </div>
  );
}
