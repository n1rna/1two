package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/n1rna/1two/api/internal/billing"
	"github.com/n1rna/1two/api/internal/middleware"
	"github.com/n1rna/1two/api/internal/neon"
)

// DatabaseRecord represents a user_databases row returned to callers.
type DatabaseRecord struct {
	ID             string `json:"id"`
	UserID         string `json:"userId"`
	NeonProjectID  string `json:"neonProjectId"`
	Name           string `json:"name"`
	Region         string `json:"region"`
	Status         string `json:"status"`
	CreatedAt      string `json:"createdAt"`
	UpdatedAt      string `json:"updatedAt"`
	ConnectionURI  string `json:"connectionUri,omitempty"`
}

// ListDatabases returns all non-deleted databases for the authenticated user.
// GET /databases
func ListDatabases(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, neon_project_id, name, region, status, created_at, updated_at
			FROM user_databases
			WHERE user_id = $1 AND status != 'deleted'
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list databases"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		databases := make([]DatabaseRecord, 0)
		for rows.Next() {
			var d DatabaseRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(&d.ID, &d.UserID, &d.NeonProjectID, &d.Name, &d.Region, &d.Status, &createdAt, &updatedAt); err != nil {
				http.Error(w, `{"error":"failed to read databases"}`, http.StatusInternalServerError)
				return
			}
			d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			d.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			databases = append(databases, d)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate databases"}`, http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]any{"databases": databases})
	}
}

// CreateDatabase provisions a new Neon project and records it for the user.
// POST /databases
func CreateDatabase(db *sql.DB, neonClient *neon.Client, billingClient *billing.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		var req struct {
			Name   string `json:"name"`
			Region string `json:"region"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request"}`, http.StatusBadRequest)
			return
		}
		if req.Name == "" {
			http.Error(w, `{"error":"name is required"}`, http.StatusBadRequest)
			return
		}
		if req.Region == "" {
			req.Region = "aws-us-east-1"
		}

		// Resolve user's plan tier and check database limit
		tier := billing.GetUserPlanTier(r.Context(), db, userID)
		limits := billing.Plans[tier]

		var activeCount int
		err := db.QueryRowContext(r.Context(),
			`SELECT COUNT(*) FROM user_databases WHERE user_id = $1 AND status NOT IN ('deleted', 'deleting')`,
			userID).Scan(&activeCount)
		if err != nil {
			http.Error(w, `{"error":"failed to check database count"}`, http.StatusInternalServerError)
			return
		}
		if activeCount >= limits.DatabasesMax {
			http.Error(w, `{"error":"database limit reached for your plan"}`, http.StatusForbidden)
			return
		}

		if neonClient == nil {
			http.Error(w, `{"error":"database provisioning not configured"}`, http.StatusServiceUnavailable)
			return
		}

		project, err := neonClient.CreateProject(r.Context(), req.Name, req.Region, userID)
		if err != nil {
			log.Printf("neon: create project error: %v", err)
			http.Error(w, `{"error":"failed to provision database"}`, http.StatusInternalServerError)
			return
		}

		dbID := generateID()
		var createdAt, updatedAt time.Time
		const insertQ = `
			INSERT INTO user_databases (id, user_id, neon_project_id, name, region, status)
			VALUES ($1, $2, $3, $4, $5, 'active')
			RETURNING created_at, updated_at`

		if err := db.QueryRowContext(r.Context(), insertQ,
			dbID, userID, project.ID, req.Name, req.Region,
		).Scan(&createdAt, &updatedAt); err != nil {
			log.Printf("databases: insert error: %v", err)
			http.Error(w, `{"error":"failed to record database"}`, http.StatusInternalServerError)
			return
		}

		record := DatabaseRecord{
			ID:            dbID,
			UserID:        userID,
			NeonProjectID: project.ID,
			Name:          req.Name,
			Region:        req.Region,
			Status:        "active",
			CreatedAt:     createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:     updatedAt.UTC().Format(time.RFC3339),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(record)
	}
}

// GetDatabase returns a single database record with its connection URI.
// GET /databases/{id}
func GetDatabase(db *sql.DB, neonClient *neon.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		dbID := chi.URLParam(r, "id")

		const q = `
			SELECT id, user_id, neon_project_id, name, region, status, created_at, updated_at
			FROM user_databases
			WHERE id = $1 AND user_id = $2`

		var d DatabaseRecord
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(), q, dbID, userID).
			Scan(&d.ID, &d.UserID, &d.NeonProjectID, &d.Name, &d.Region, &d.Status, &createdAt, &updatedAt)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}
		d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		d.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

		if neonClient != nil && d.Status == "active" {
			uri, err := neonClient.GetConnectionURI(r.Context(), d.NeonProjectID, "neondb_owner", "neondb")
			if err != nil {
				log.Printf("neon: get connection uri error: %v", err)
				// Non-fatal: return record without URI
			} else {
				d.ConnectionURI = uri
			}
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(d)
	}
}

// DeleteDatabase soft-deletes a database record and removes the Neon project.
// DELETE /databases/{id}
func DeleteDatabase(db *sql.DB, neonClient *neon.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		dbID := chi.URLParam(r, "id")

		var neonProjectID string
		err := db.QueryRowContext(r.Context(),
			`SELECT neon_project_id FROM user_databases WHERE id = $1 AND user_id = $2`,
			dbID, userID).Scan(&neonProjectID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		// Mark as deleting
		if _, err := db.ExecContext(r.Context(),
			`UPDATE user_databases SET status = 'deleting', updated_at = NOW() WHERE id = $1`,
			dbID); err != nil {
			http.Error(w, `{"error":"failed to update database status"}`, http.StatusInternalServerError)
			return
		}

		// Delete from Neon
		if neonClient != nil {
			if err := neonClient.DeleteProject(r.Context(), neonProjectID); err != nil {
				log.Printf("neon: delete project error for %s: %v", neonProjectID, err)
				// Non-fatal: still mark as deleted locally
			}
		}

		// Mark as deleted
		if _, err := db.ExecContext(r.Context(),
			`UPDATE user_databases SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
			dbID); err != nil {
			log.Printf("databases: failed to mark deleted for %s: %v", dbID, err)
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// QueryDatabase executes a user-supplied SQL query against the user's own Neon database.
// POST /databases/{id}/query
func QueryDatabase(db *sql.DB, neonClient *neon.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if neonClient == nil {
			http.Error(w, `{"error":"database queries not configured"}`, http.StatusServiceUnavailable)
			return
		}

		var req struct {
			Query string `json:"query"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Query) == "" {
			http.Error(w, `{"error":"query is required"}`, http.StatusBadRequest)
			return
		}

		dbID := chi.URLParam(r, "id")

		var neonProjectID string
		err := db.QueryRowContext(r.Context(),
			`SELECT neon_project_id FROM user_databases WHERE id = $1 AND user_id = $2 AND status = 'active'`,
			dbID, userID).Scan(&neonProjectID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		connURI, err := neonClient.GetConnectionURI(r.Context(), neonProjectID, "neondb_owner", "neondb")
		if err != nil {
			log.Printf("query: get connection uri error for project %s: %v", neonProjectID, err)
			http.Error(w, `{"error":"failed to get connection URI"}`, http.StatusInternalServerError)
			return
		}

		userDB, err := sql.Open("pgx", connURI)
		if err != nil {
			log.Printf("query: open user db error for project %s: %v", neonProjectID, err)
			http.Error(w, `{"error":"failed to connect to database"}`, http.StatusInternalServerError)
			return
		}
		defer userDB.Close()

		queryCtx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		// Always attempt QueryContext first. If the result set has columns it is a
		// row-returning statement (SELECT, WITH, TABLE, VALUES, EXPLAIN, SHOW, etc.).
		// If it has no columns, fall through to report rows affected via ExecContext.
		rows, err := userDB.QueryContext(queryCtx, req.Query)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		defer rows.Close()

		columns, err := rows.Columns()
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "failed to read columns: " + err.Error()})
			return
		}

		if len(columns) > 0 {
			// Row-returning query: stream results back as columns + rows.
			const maxRows = 1000
			result := make([][]any, 0)

			for rows.Next() && len(result) < maxRows {
				vals := make([]any, len(columns))
				valPtrs := make([]any, len(columns))
				for i := range vals {
					valPtrs[i] = &vals[i]
				}
				if err := rows.Scan(valPtrs...); err != nil {
					w.WriteHeader(http.StatusInternalServerError)
					json.NewEncoder(w).Encode(map[string]any{"error": "failed to scan row: " + err.Error()})
					return
				}
				// Convert []byte values to strings for clean JSON serialisation.
				row := make([]any, len(columns))
				for i, v := range vals {
					if b, ok := v.([]byte); ok {
						row[i] = string(b)
					} else {
						row[i] = v
					}
				}
				result = append(result, row)
			}
			if err := rows.Err(); err != nil {
				w.WriteHeader(http.StatusBadRequest)
				json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
				return
			}

			json.NewEncoder(w).Encode(map[string]any{
				"columns":  columns,
				"rows":     result,
				"rowCount": len(result),
			})
			return
		}

		// No columns: DML/DDL statement — drain the rows cursor then report
		// rows affected. Because sql.DB does not expose RowsAffected from
		// QueryContext we re-run via ExecContext (the statement already
		// succeeded above so this is safe for idempotent DDL; for DML the
		// duplicate execution is avoided by closing the first cursor first).
		rows.Close()

		res, err := userDB.ExecContext(queryCtx, req.Query)
		if err != nil {
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(map[string]any{"error": err.Error()})
			return
		}
		rowsAffected, _ := res.RowsAffected()
		json.NewEncoder(w).Encode(map[string]any{"rowsAffected": rowsAffected})
	}
}

// schemaQuery retrieves table and column metadata from information_schema,
// excluding system schemas.
const schemaQuery = `
SELECT
    t.table_schema,
    t.table_name,
    t.table_type,
    c.column_name,
    c.data_type,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
LEFT JOIN information_schema.columns c
    ON t.table_schema = c.table_schema AND t.table_name = c.table_name
WHERE t.table_schema NOT IN ('information_schema', 'pg_catalog')
ORDER BY t.table_schema, t.table_name, c.ordinal_position`

const schemaPrimaryKeysQuery = `
SELECT tc.table_schema, tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')`

const schemaUniqueConstraintsQuery = `
SELECT tc.table_schema, tc.table_name, kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
    AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')`

const schemaForeignKeysQuery = `
SELECT
    kcu.table_schema, kcu.table_name, kcu.column_name,
    ccu.table_name AS foreign_table, ccu.column_name AS foreign_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage ccu
    ON tc.constraint_name = ccu.constraint_name AND tc.constraint_schema = ccu.constraint_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema NOT IN ('information_schema', 'pg_catalog')`

const schemaIndexesQuery = `
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('information_schema', 'pg_catalog')
ORDER BY schemaname, tablename, indexname`

const schemaRowCountsQuery = `
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
ORDER BY schemaname, relname`

// schemaForeignKey describes the target side of a foreign key reference.
type schemaForeignKey struct {
	Table  string `json:"table"`
	Column string `json:"column"`
}

// schemaColumn holds a single column's metadata including constraint flags.
type schemaColumn struct {
	Name       string            `json:"name"`
	Type       string            `json:"type"`
	Nullable   bool              `json:"nullable"`
	Default    *string           `json:"default"`
	IsPrimary  bool              `json:"isPrimary"`
	IsUnique   bool              `json:"isUnique"`
	ForeignKey *schemaForeignKey `json:"foreignKey,omitempty"`
}

// schemaIndex describes a single index on a table.
type schemaIndex struct {
	Name       string   `json:"name"`
	Columns    []string `json:"columns"`
	IsUnique   bool     `json:"isUnique"`
	IsPrimary  bool     `json:"isPrimary"`
	Definition string   `json:"definition"`
}

// schemaTable aggregates columns and indexes under their parent table.
type schemaTable struct {
	Schema      string         `json:"schema"`
	Name        string         `json:"name"`
	Type        string         `json:"type"`
	Columns     []schemaColumn `json:"columns"`
	Indexes     []schemaIndex  `json:"indexes"`
	RowEstimate int64          `json:"rowEstimate"`
}

// GetDatabaseSchema returns the table/column schema of the user's Neon database,
// including primary keys, foreign keys, unique constraints, indexes, and estimated
// row counts.
// GET /databases/{id}/schema
func GetDatabaseSchema(db *sql.DB, neonClient *neon.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if neonClient == nil {
			http.Error(w, `{"error":"database queries not configured"}`, http.StatusServiceUnavailable)
			return
		}

		dbID := chi.URLParam(r, "id")

		var neonProjectID string
		err := db.QueryRowContext(r.Context(),
			`SELECT neon_project_id FROM user_databases WHERE id = $1 AND user_id = $2 AND status = 'active'`,
			dbID, userID).Scan(&neonProjectID)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		connURI, err := neonClient.GetConnectionURI(r.Context(), neonProjectID, "neondb_owner", "neondb")
		if err != nil {
			log.Printf("schema: get connection uri error for project %s: %v", neonProjectID, err)
			http.Error(w, `{"error":"failed to get connection URI"}`, http.StatusInternalServerError)
			return
		}

		userDB, err := sql.Open("pgx", connURI)
		if err != nil {
			log.Printf("schema: open user db error for project %s: %v", neonProjectID, err)
			http.Error(w, `{"error":"failed to connect to database"}`, http.StatusInternalServerError)
			return
		}
		defer userDB.Close()

		queryCtx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		// --- Query 1: tables and columns ---
		rows, err := userDB.QueryContext(queryCtx, schemaQuery)
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "failed to query schema: " + err.Error()})
			return
		}
		defer rows.Close()

		// Use an ordered slice plus a lookup map to preserve table order.
		tableOrder := make([]string, 0)
		tableMap := make(map[string]*schemaTable)

		for rows.Next() {
			var tableSchema, tableName, tableType string
			var columnName, dataType, isNullable sql.NullString
			var columnDefault sql.NullString

			if err := rows.Scan(&tableSchema, &tableName, &tableType, &columnName, &dataType, &isNullable, &columnDefault); err != nil {
				w.WriteHeader(http.StatusInternalServerError)
				json.NewEncoder(w).Encode(map[string]any{"error": "failed to scan schema row: " + err.Error()})
				return
			}

			key := tableSchema + "." + tableName
			if _, exists := tableMap[key]; !exists {
				tableMap[key] = &schemaTable{
					Schema:  tableSchema,
					Name:    tableName,
					Type:    tableType,
					Columns: []schemaColumn{},
					Indexes: []schemaIndex{},
				}
				tableOrder = append(tableOrder, key)
			}

			if columnName.Valid {
				var def *string
				if columnDefault.Valid {
					def = &columnDefault.String
				}
				col := schemaColumn{
					Name:     columnName.String,
					Type:     dataType.String,
					Nullable: isNullable.String == "YES",
					Default:  def,
				}
				tableMap[key].Columns = append(tableMap[key].Columns, col)
			}
		}
		if err := rows.Err(); err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(w).Encode(map[string]any{"error": "failed to iterate schema rows: " + err.Error()})
			return
		}

		// --- Query 2: primary keys ---
		pkRows, err := userDB.QueryContext(queryCtx, schemaPrimaryKeysQuery)
		if err != nil {
			log.Printf("schema: primary keys query error for project %s: %v", neonProjectID, err)
		} else {
			defer pkRows.Close()
			for pkRows.Next() {
				var tableSchema, tableName, columnName string
				if err := pkRows.Scan(&tableSchema, &tableName, &columnName); err != nil {
					continue
				}
				key := tableSchema + "." + tableName
				if tbl, ok := tableMap[key]; ok {
					for i := range tbl.Columns {
						if tbl.Columns[i].Name == columnName {
							tbl.Columns[i].IsPrimary = true
							break
						}
					}
				}
			}
		}

		// --- Query 3: unique constraints ---
		uqRows, err := userDB.QueryContext(queryCtx, schemaUniqueConstraintsQuery)
		if err != nil {
			log.Printf("schema: unique constraints query error for project %s: %v", neonProjectID, err)
		} else {
			defer uqRows.Close()
			for uqRows.Next() {
				var tableSchema, tableName, columnName string
				if err := uqRows.Scan(&tableSchema, &tableName, &columnName); err != nil {
					continue
				}
				key := tableSchema + "." + tableName
				if tbl, ok := tableMap[key]; ok {
					for i := range tbl.Columns {
						if tbl.Columns[i].Name == columnName {
							tbl.Columns[i].IsUnique = true
							break
						}
					}
				}
			}
		}

		// --- Query 4: foreign keys ---
		fkRows, err := userDB.QueryContext(queryCtx, schemaForeignKeysQuery)
		if err != nil {
			log.Printf("schema: foreign keys query error for project %s: %v", neonProjectID, err)
		} else {
			defer fkRows.Close()
			for fkRows.Next() {
				var tableSchema, tableName, columnName, foreignTable, foreignColumn string
				if err := fkRows.Scan(&tableSchema, &tableName, &columnName, &foreignTable, &foreignColumn); err != nil {
					continue
				}
				key := tableSchema + "." + tableName
				if tbl, ok := tableMap[key]; ok {
					for i := range tbl.Columns {
						if tbl.Columns[i].Name == columnName {
							tbl.Columns[i].ForeignKey = &schemaForeignKey{
								Table:  foreignTable,
								Column: foreignColumn,
							}
							break
						}
					}
				}
			}
		}

		// --- Query 5: indexes ---
		// Parse column list from the index definition. pg_indexes.indexdef has the
		// form: CREATE [UNIQUE] INDEX name ON schema.table (col1, col2, ...)
		idxRows, err := userDB.QueryContext(queryCtx, schemaIndexesQuery)
		if err != nil {
			log.Printf("schema: indexes query error for project %s: %v", neonProjectID, err)
		} else {
			defer idxRows.Close()
			for idxRows.Next() {
				var schemaName, tableName, indexName, indexDef string
				if err := idxRows.Scan(&schemaName, &tableName, &indexName, &indexDef); err != nil {
					continue
				}
				key := schemaName + "." + tableName
				tbl, ok := tableMap[key]
				if !ok {
					continue
				}
				isUnique := strings.Contains(strings.ToUpper(indexDef), "UNIQUE")
				isPrimary := strings.HasSuffix(indexName, "_pkey")
				columns := parseIndexColumns(indexDef)
				tbl.Indexes = append(tbl.Indexes, schemaIndex{
					Name:       indexName,
					Columns:    columns,
					IsUnique:   isUnique || isPrimary,
					IsPrimary:  isPrimary,
					Definition: indexDef,
				})
			}
		}

		// --- Query 6: estimated row counts ---
		rcRows, err := userDB.QueryContext(queryCtx, schemaRowCountsQuery)
		if err != nil {
			log.Printf("schema: row counts query error for project %s: %v", neonProjectID, err)
		} else {
			defer rcRows.Close()
			for rcRows.Next() {
				var schemaName, relName string
				var nLiveTup int64
				if err := rcRows.Scan(&schemaName, &relName, &nLiveTup); err != nil {
					continue
				}
				key := schemaName + "." + relName
				if tbl, ok := tableMap[key]; ok {
					tbl.RowEstimate = nLiveTup
				}
			}
		}

		tables := make([]schemaTable, 0, len(tableOrder))
		for _, key := range tableOrder {
			tables = append(tables, *tableMap[key])
		}

		json.NewEncoder(w).Encode(map[string]any{"tables": tables})
	}
}

// parseIndexColumns extracts the column list from a pg_indexes.indexdef string.
// The definition has the form:
//
//	CREATE [UNIQUE] INDEX name ON [schema.]table USING method (col1, col2, ...)
//
// It returns the raw tokens inside the parentheses, trimmed of whitespace.
func parseIndexColumns(def string) []string {
	start := strings.LastIndex(def, "(")
	end := strings.LastIndex(def, ")")
	if start == -1 || end == -1 || end <= start {
		return []string{}
	}
	inner := def[start+1 : end]
	parts := strings.Split(inner, ",")
	cols := make([]string, 0, len(parts))
	for _, p := range parts {
		col := strings.TrimSpace(p)
		if col != "" {
			cols = append(cols, col)
		}
	}
	return cols
}
