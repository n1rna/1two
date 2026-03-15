import type { CellValue, PendingEdit, SqlDialect } from "./types";

export function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

export function escapeValue(value: CellValue): string {
  if (value === null) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  // String: double up single quotes
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function quoteTableRef(
  schema: string,
  table: string,
  dialect: SqlDialect = "postgres"
): string {
  if (dialect === "sqlite") return quoteIdent(table);
  return `${quoteIdent(schema)}.${quoteIdent(table)}`;
}

export function buildUpdateSQL(
  schema: string,
  table: string,
  primaryKeys: string[],
  edit: PendingEdit,
  rowData: Record<string, CellValue>,
  dialect: SqlDialect = "postgres"
): string {
  const target = quoteTableRef(schema, table, dialect);
  const set = `${quoteIdent(edit.column)} = ${escapeValue(edit.newValue)}`;
  const where = primaryKeys
    .map((pk) => `${quoteIdent(pk)} = ${escapeValue(rowData[pk] ?? null)}`)
    .join(" AND ");
  return `UPDATE ${target} SET ${set} WHERE ${where};`;
}

export function buildInsertSQL(
  schema: string,
  table: string,
  columns: string[],
  newRow: Record<string, CellValue>,
  dialect: SqlDialect = "postgres"
): string {
  const target = quoteTableRef(schema, table, dialect);
  const cols = columns.map(quoteIdent).join(", ");
  const vals = columns.map((c) => escapeValue(newRow[c] ?? null)).join(", ");
  return `INSERT INTO ${target} (${cols}) VALUES (${vals});`;
}

export function buildDeleteSQL(
  schema: string,
  table: string,
  primaryKeys: string[],
  rows: Record<string, CellValue>[],
  dialect: SqlDialect = "postgres"
): string {
  const target = quoteTableRef(schema, table, dialect);
  if (primaryKeys.length === 1) {
    const pk = primaryKeys[0];
    const values = rows.map((r) => escapeValue(r[pk] ?? null)).join(", ");
    return `DELETE FROM ${target} WHERE ${quoteIdent(pk)} IN (${values});`;
  }
  // composite PK
  const conditions = rows
    .map(
      (r) =>
        `(${primaryKeys
          .map((pk) => `${quoteIdent(pk)} = ${escapeValue(r[pk] ?? null)}`)
          .join(" AND ")})`
    )
    .join(" OR ");
  return `DELETE FROM ${target} WHERE ${conditions};`;
}

export function buildTransaction(statements: string[]): string {
  return `BEGIN;\n${statements.join("\n")}\nCOMMIT;`;
}
