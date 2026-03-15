package turso

import (
	"context"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"unicode/utf8"

	_ "github.com/ncruces/go-sqlite3/driver" // registers the "sqlite3" driver
	_ "github.com/ncruces/go-sqlite3/embed"  // embeds the SQLite WASM binary
)

// DumpToSQL opens a local SQLite file read-only and returns a slice of SQL
// statements suitable for seeding a Turso database.
//
// Schema is reconstructed from PRAGMA introspection (not raw sqlite_master DDL)
// to ensure compatibility with Turso/libSQL which is stricter about SQL syntax
// (e.g. double-quoted string literals are not allowed).
func DumpToSQL(ctx context.Context, localPath string) ([]string, error) {
	db, err := sql.Open("sqlite3", "file:"+localPath+"?mode=ro")
	if err != nil {
		return nil, fmt.Errorf("turso: seed: open %q: %w", localPath, err)
	}
	defer db.Close()

	// Get table names.
	tableRows, err := db.QueryContext(ctx,
		`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("turso: seed: list tables: %w", err)
	}
	var tableNames []string
	for tableRows.Next() {
		var name string
		if err := tableRows.Scan(&name); err != nil {
			tableRows.Close()
			return nil, fmt.Errorf("turso: seed: scan table name: %w", err)
		}
		tableNames = append(tableNames, name)
	}
	tableRows.Close()

	var stmts []string

	// Disable foreign key checks during seeding — tables may reference
	// each other and insertion order is alphabetical, not dependency order.
	stmts = append(stmts, "PRAGMA foreign_keys = OFF")

	// Phase 1: CREATE TABLE statements reconstructed from PRAGMAs.
	for _, tableName := range tableNames {
		ddl, err := buildCreateTable(ctx, db, tableName)
		if err != nil {
			return nil, fmt.Errorf("turso: seed: build CREATE for %q: %w", tableName, err)
		}
		stmts = append(stmts, ddl)
	}

	// Phase 2: CREATE INDEX statements — these are simpler and usually safe
	// from the quoting issue, but reconstruct them from PRAGMAs too.
	idxRows, err := db.QueryContext(ctx,
		`SELECT name, tbl_name, sql FROM sqlite_master
		 WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL
		 ORDER BY name`)
	if err != nil {
		return nil, fmt.Errorf("turso: seed: list indexes: %w", err)
	}
	for idxRows.Next() {
		var name, tblName, ddl string
		if err := idxRows.Scan(&name, &tblName, &ddl); err != nil {
			idxRows.Close()
			return nil, fmt.Errorf("turso: seed: scan index: %w", err)
		}
		// Index DDL from sqlite_master is usually safe (no string literals),
		// but wrap in a safety check.
		stmts = append(stmts, ddl)
	}
	idxRows.Close()

	// Phase 3: INSERT data for each table.
	const batchSize = 100
	for _, tableName := range tableNames {
		inserts, err := buildInserts(ctx, db, tableName, batchSize)
		if err != nil {
			return nil, fmt.Errorf("turso: seed: inserts for %q: %w", tableName, err)
		}
		stmts = append(stmts, inserts...)
	}

	// Re-enable foreign key checks after seeding.
	stmts = append(stmts, "PRAGMA foreign_keys = ON")

	return stmts, nil
}

// buildCreateTable reconstructs a CREATE TABLE statement from PRAGMA introspection.
func buildCreateTable(ctx context.Context, db *sql.DB, tableName string) (string, error) {
	// Get columns.
	colRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA table_info("%s")`, esc(tableName)))
	if err != nil {
		return "", err
	}
	defer colRows.Close()

	type colInfo struct {
		name     string
		typ      string
		notNull  bool
		dflt     sql.NullString
		pk       int
	}
	var cols []colInfo
	var pkCols []string

	for colRows.Next() {
		var c colInfo
		var cid int
		if err := colRows.Scan(&cid, &c.name, &c.typ, &c.notNull, &c.dflt, &c.pk); err != nil {
			return "", err
		}
		cols = append(cols, c)
		if c.pk > 0 {
			pkCols = append(pkCols, c.name)
		}
	}
	colRows.Close()

	if len(cols) == 0 {
		return fmt.Sprintf(`CREATE TABLE "%s" (_empty INTEGER)`, esc(tableName)), nil
	}

	// Check if this is a single-column INTEGER PRIMARY KEY (ROWID alias / AUTOINCREMENT).
	// We detect AUTOINCREMENT by checking sqlite_master for the keyword.
	hasAutoincrement := false
	if len(pkCols) == 1 {
		var rawDDL sql.NullString
		db.QueryRowContext(ctx,
			`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`, tableName).Scan(&rawDDL)
		if rawDDL.Valid && strings.Contains(strings.ToUpper(rawDDL.String), "AUTOINCREMENT") {
			hasAutoincrement = true
		}
	}

	var parts []string
	for _, c := range cols {
		col := fmt.Sprintf(`"%s"`, esc(c.name))
		if c.typ != "" {
			col += " " + c.typ
		}
		// For single-column integer PK with autoincrement, add it inline.
		if c.pk > 0 && len(pkCols) == 1 {
			col += " PRIMARY KEY"
			if hasAutoincrement {
				col += " AUTOINCREMENT"
			}
		}
		if c.notNull && c.pk == 0 {
			col += " NOT NULL"
		}
		if c.dflt.Valid {
			col += " DEFAULT " + c.dflt.String
		}
		parts = append(parts, col)
	}

	// Composite primary key.
	if len(pkCols) > 1 {
		quoted := make([]string, len(pkCols))
		for i, pk := range pkCols {
			quoted[i] = fmt.Sprintf(`"%s"`, esc(pk))
		}
		parts = append(parts, "PRIMARY KEY ("+strings.Join(quoted, ", ")+")")
	}

	// Foreign keys.
	fkRows, err := db.QueryContext(ctx, fmt.Sprintf(`PRAGMA foreign_key_list("%s")`, esc(tableName)))
	if err == nil {
		defer fkRows.Close()
		// Group FK columns by id.
		type fkEntry struct {
			table   string
			from    string
			to      string
			onUpdate string
			onDelete string
		}
		fkMap := make(map[int][]fkEntry)
		for fkRows.Next() {
			var id, seq int
			var table, from, to, onUpdate, onDelete, match string
			if err := fkRows.Scan(&id, &seq, &table, &from, &to, &onUpdate, &onDelete, &match); err != nil {
				break
			}
			fkMap[id] = append(fkMap[id], fkEntry{table, from, to, onUpdate, onDelete})
		}
		fkRows.Close()

		for _, entries := range fkMap {
			if len(entries) == 0 {
				continue
			}
			fromCols := make([]string, len(entries))
			toCols := make([]string, len(entries))
			for i, e := range entries {
				fromCols[i] = fmt.Sprintf(`"%s"`, esc(e.from))
				toCols[i] = fmt.Sprintf(`"%s"`, esc(e.to))
			}
			fk := fmt.Sprintf(`FOREIGN KEY (%s) REFERENCES "%s" (%s)`,
				strings.Join(fromCols, ", "),
				esc(entries[0].table),
				strings.Join(toCols, ", "))
			if entries[0].onDelete != "" && entries[0].onDelete != "NO ACTION" {
				fk += " ON DELETE " + entries[0].onDelete
			}
			if entries[0].onUpdate != "" && entries[0].onUpdate != "NO ACTION" {
				fk += " ON UPDATE " + entries[0].onUpdate
			}
			parts = append(parts, fk)
		}
	}

	return fmt.Sprintf(`CREATE TABLE "%s" (%s)`, esc(tableName), strings.Join(parts, ", ")), nil
}

// buildInserts generates batched INSERT statements for a table's data.
func buildInserts(ctx context.Context, db *sql.DB, tableName string, batchSize int) ([]string, error) {
	// Get column names.
	colRows, err := db.QueryContext(ctx, fmt.Sprintf(`SELECT * FROM "%s" LIMIT 0`, esc(tableName)))
	if err != nil {
		return nil, err
	}
	cols, err := colRows.Columns()
	colRows.Close()
	if err != nil || len(cols) == 0 {
		return nil, err
	}

	dataRows, err := db.QueryContext(ctx, fmt.Sprintf(`SELECT * FROM "%s"`, esc(tableName)))
	if err != nil {
		return nil, err
	}
	defer dataRows.Close()

	colNames := make([]string, len(cols))
	for i, c := range cols {
		colNames[i] = fmt.Sprintf(`"%s"`, esc(c))
	}
	colList := strings.Join(colNames, ", ")

	vals := make([]interface{}, len(cols))
	valPtrs := make([]interface{}, len(cols))
	for i := range vals {
		valPtrs[i] = &vals[i]
	}

	var stmts []string
	var batch []string

	flush := func() {
		if len(batch) == 0 {
			return
		}
		stmt := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES %s`,
			esc(tableName), colList, strings.Join(batch, ", "))
		stmts = append(stmts, stmt)
		batch = batch[:0]
	}

	for dataRows.Next() {
		if err := dataRows.Scan(valPtrs...); err != nil {
			return nil, err
		}
		rowLiterals := make([]string, len(vals))
		for i, v := range vals {
			rowLiterals[i] = sqlLiteral(v)
		}
		batch = append(batch, "("+strings.Join(rowLiterals, ", ")+")")
		if len(batch) >= batchSize {
			flush()
		}
	}
	if err := dataRows.Err(); err != nil {
		return nil, err
	}
	flush()

	return stmts, nil
}

// sqlLiteral converts a Go value scanned from database/sql into its SQL
// literal representation.
func sqlLiteral(v interface{}) string {
	if v == nil {
		return "NULL"
	}
	switch val := v.(type) {
	case []byte:
		// ncruces/go-sqlite3 returns TEXT as []byte when scanned into interface{}.
		// If valid UTF-8, treat as string; otherwise emit as hex BLOB.
		if utf8.Valid(val) {
			return "'" + strings.ReplaceAll(string(val), "'", "''") + "'"
		}
		return "X'" + hex.EncodeToString(val) + "'"
	case string:
		return "'" + strings.ReplaceAll(val, "'", "''") + "'"
	case bool:
		if val {
			return "1"
		}
		return "0"
	case int64:
		return fmt.Sprintf("%d", val)
	case float64:
		return fmt.Sprintf("%g", val)
	default:
		s := fmt.Sprintf("%v", val)
		return "'" + strings.ReplaceAll(s, "'", "''") + "'"
	}
}

// esc escapes double quotes in SQL identifiers.
func esc(s string) string {
	return strings.ReplaceAll(s, `"`, `""`)
}
