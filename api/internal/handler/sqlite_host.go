package handler

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/n1rna/1two/api/internal/middleware"
	"github.com/n1rna/1two/api/internal/turso"
)

// sqliteMagic is the first 16 bytes of every valid SQLite database file.
var sqliteMagic = []byte("SQLite format 3\x00")

// HostedSqliteRecord is the JSON representation of a hosted_sqlite row.
type HostedSqliteRecord struct {
	ID            string `json:"id"`
	UserID        string `json:"userId"`
	Name          string `json:"name"`
	APIKey        string `json:"apiKey,omitempty"` // only included on creation and GetSqliteDB
	FileSize      int64  `json:"fileSize"`
	Status        string `json:"status"`
	ReadOnly      bool   `json:"readOnly"`
	CreatedAt     string `json:"createdAt"`
	UpdatedAt     string `json:"updatedAt"`
	Endpoint      string `json:"endpoint,omitempty"`
	TursoDbName   string `json:"tursoDbName,omitempty"`
	TursoHostname string `json:"tursoHostname,omitempty"`
}

// UploadSqliteDB handles POST /sqlite — upload a SQLite file, provision a Turso
// database, seed it, and register the record.
func UploadSqliteDB(db *sql.DB, tursoClient *turso.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		if tursoClient == nil {
			http.Error(w, `{"error":"SQLite hosting not configured"}`, http.StatusServiceUnavailable)
			return
		}

		r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)
		if err := r.ParseMultipartForm(maxUploadSize); err != nil {
			http.Error(w, `{"error":"file too large (max 50MB)"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"no file provided"}`, http.StatusBadRequest)
			return
		}
		defer file.Close()

		// Validate SQLite magic bytes (first 16 bytes).
		magic := make([]byte, 16)
		if _, err := file.Read(magic); err != nil {
			http.Error(w, `{"error":"could not read file"}`, http.StatusBadRequest)
			return
		}
		for i, b := range sqliteMagic {
			if magic[i] != b {
				http.Error(w, `{"error":"file is not a valid SQLite database"}`, http.StatusBadRequest)
				return
			}
		}
		// Seek back to start so the full file can be written to disk.
		if _, err := file.Seek(0, 0); err != nil {
			http.Error(w, `{"error":"could not read file"}`, http.StatusInternalServerError)
			return
		}

		// Determine display name: use form field "name" or fall back to filename.
		name := strings.TrimSpace(r.FormValue("name"))
		if name == "" {
			name = header.Filename
		}

		dbID := generateID()

		// Turso DB name must start with a letter and contain only lowercase
		// alphanumerics and hyphens. Prefix with "u" to satisfy the constraint.
		tursoDbName := "u" + strings.ToLower(dbID)

		// Write uploaded file to a temp path for DumpToSQL.
		tmpFile, err := os.CreateTemp("", "sqlite-upload-*.db")
		if err != nil {
			log.Printf("sqlite upload: create temp file: %v", err)
			http.Error(w, `{"error":"internal error"}`, http.StatusInternalServerError)
			return
		}
		tmpPath := tmpFile.Name()
		defer os.Remove(tmpPath)

		if _, err := tmpFile.ReadFrom(file); err != nil {
			tmpFile.Close()
			log.Printf("sqlite upload: write temp file: %v", err)
			http.Error(w, `{"error":"failed to process database file"}`, http.StatusInternalServerError)
			return
		}
		tmpFile.Close()

		// Provision the Turso database.
		tursoDB, err := tursoClient.CreateDatabase(r.Context(), tursoDbName)
		if err != nil {
			log.Printf("sqlite upload: turso create database: %v", err)
			http.Error(w, `{"error":"failed to provision database"}`, http.StatusInternalServerError)
			return
		}

		// Create a full-access token for seeding and future queries.
		jwtToken, err := tursoClient.CreateToken(r.Context(), tursoDbName, false)
		if err != nil {
			log.Printf("sqlite upload: turso create token: %v", err)
			// Best-effort cleanup.
			tursoClient.DeleteDatabase(r.Context(), tursoDbName) //nolint:errcheck
			http.Error(w, `{"error":"failed to create database token"}`, http.StatusInternalServerError)
			return
		}

		// Dump uploaded file to SQL statements.
		statements, err := turso.DumpToSQL(r.Context(), tmpPath)
		if err != nil {
			log.Printf("sqlite upload: dump to sql: %v", err)
			tursoClient.DeleteDatabase(r.Context(), tursoDbName) //nolint:errcheck
			http.Error(w, `{"error":"failed to read database content"}`, http.StatusInternalServerError)
			return
		}
		log.Printf("sqlite upload: dumped %d SQL statements from %s", len(statements), header.Filename)

		// Wait briefly for the Turso database to become ready.
		time.Sleep(2 * time.Second)

		// Seed the Turso database.
		if len(statements) > 0 {
			log.Printf("sqlite upload: seeding turso db %s at %s with %d statements", tursoDbName, tursoDB.Hostname, len(statements))
			for i, s := range statements {
				if i < 10 {
					if len(s) > 300 {
						log.Printf("sqlite upload: stmt[%d]: %s...", i, s[:300])
					} else {
						log.Printf("sqlite upload: stmt[%d]: %s", i, s)
					}
				}
			}
			if err := tursoClient.ExecuteStatements(r.Context(), tursoDB.Hostname, jwtToken, statements); err != nil {
				log.Printf("sqlite upload: turso seed: %v", err)
				tursoClient.DeleteDatabase(r.Context(), tursoDbName) //nolint:errcheck
				http.Error(w, `{"error":"failed to seed database"}`, http.StatusInternalServerError)
				return
			}
		}

		const insertQ = `
			INSERT INTO hosted_sqlite (id, user_id, name, api_key, file_size, turso_db_name, turso_hostname)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
			RETURNING created_at, updated_at`

		var createdAt, updatedAt time.Time
		if err := db.QueryRowContext(r.Context(), insertQ,
			dbID, userID, name, jwtToken, header.Size, tursoDbName, tursoDB.Hostname,
		).Scan(&createdAt, &updatedAt); err != nil {
			log.Printf("sqlite upload: db insert error: %v", err)
			// Best-effort Turso cleanup.
			tursoClient.DeleteDatabase(r.Context(), tursoDbName) //nolint:errcheck
			http.Error(w, `{"error":"failed to register database"}`, http.StatusInternalServerError)
			return
		}

		rec := HostedSqliteRecord{
			ID:            dbID,
			UserID:        userID,
			Name:          name,
			APIKey:        jwtToken,
			FileSize:      header.Size,
			Status:        "active",
			ReadOnly:      false,
			CreatedAt:     createdAt.UTC().Format(time.RFC3339),
			UpdatedAt:     updatedAt.UTC().Format(time.RFC3339),
			Endpoint:      fmt.Sprintf("libsql://%s", tursoDB.Hostname),
			TursoDbName:   tursoDbName,
			TursoHostname: tursoDB.Hostname,
		}

		w.WriteHeader(http.StatusCreated)
		json.NewEncoder(w).Encode(rec) //nolint:errcheck
	}
}

// ListSqliteDBs handles GET /sqlite — list all active databases for the user.
func ListSqliteDBs(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		const q = `
			SELECT id, user_id, name, file_size, status, read_only,
			       turso_db_name, turso_hostname, created_at, updated_at
			FROM hosted_sqlite
			WHERE user_id = $1 AND status = 'active'
			ORDER BY created_at DESC`

		rows, err := db.QueryContext(r.Context(), q, userID)
		if err != nil {
			http.Error(w, `{"error":"failed to list databases"}`, http.StatusInternalServerError)
			return
		}
		defer rows.Close()

		records := make([]HostedSqliteRecord, 0)
		for rows.Next() {
			var rec HostedSqliteRecord
			var createdAt, updatedAt time.Time
			if err := rows.Scan(
				&rec.ID, &rec.UserID, &rec.Name,
				&rec.FileSize, &rec.Status, &rec.ReadOnly,
				&rec.TursoDbName, &rec.TursoHostname,
				&createdAt, &updatedAt,
			); err != nil {
				http.Error(w, `{"error":"failed to read records"}`, http.StatusInternalServerError)
				return
			}
			rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
			rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
			if rec.TursoHostname != "" {
				rec.Endpoint = fmt.Sprintf("libsql://%s", rec.TursoHostname)
			}
			records = append(records, rec)
		}
		if err := rows.Err(); err != nil {
			http.Error(w, `{"error":"failed to iterate records"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"databases": records}) //nolint:errcheck
	}
}

// GetSqliteDB handles GET /sqlite/{id} — return a single record with its API key.
func GetSqliteDB(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		const q = `
			SELECT id, user_id, name, api_key, file_size, status, read_only,
			       turso_db_name, turso_hostname, created_at, updated_at
			FROM hosted_sqlite
			WHERE id = $1 AND user_id = $2`

		var rec HostedSqliteRecord
		var createdAt, updatedAt time.Time
		err := db.QueryRowContext(r.Context(), q, id, userID).Scan(
			&rec.ID, &rec.UserID, &rec.Name, &rec.APIKey,
			&rec.FileSize, &rec.Status, &rec.ReadOnly,
			&rec.TursoDbName, &rec.TursoHostname,
			&createdAt, &updatedAt,
		)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}
		rec.CreatedAt = createdAt.UTC().Format(time.RFC3339)
		rec.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)
		if rec.TursoHostname != "" {
			rec.Endpoint = fmt.Sprintf("libsql://%s", rec.TursoHostname)
		}

		json.NewEncoder(w).Encode(rec) //nolint:errcheck
	}
}

// DeleteSqliteDB handles DELETE /sqlite/{id} — delete from Turso and soft-delete the record.
func DeleteSqliteDB(db *sql.DB, tursoClient *turso.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		userID := middleware.GetUserID(r.Context())
		if userID == "" {
			http.Error(w, `{"error":"unauthorized"}`, http.StatusUnauthorized)
			return
		}

		id := chi.URLParam(r, "id")

		var tursoDbName string
		err := db.QueryRowContext(r.Context(),
			`SELECT turso_db_name FROM hosted_sqlite WHERE id = $1 AND user_id = $2`,
			id, userID).Scan(&tursoDbName)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"database not found"}`, http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		// Delete from Turso (best-effort — proceed even if it fails).
		if tursoClient != nil && tursoDbName != "" {
			if err := tursoClient.DeleteDatabase(r.Context(), tursoDbName); err != nil {
				log.Printf("sqlite delete: turso delete error for %s: %v", tursoDbName, err)
			}
		}

		if _, err := db.ExecContext(r.Context(),
			`UPDATE hosted_sqlite SET status = 'deleted', updated_at = NOW() WHERE id = $1`,
			id); err != nil {
			http.Error(w, `{"error":"failed to delete database"}`, http.StatusInternalServerError)
			return
		}

		w.WriteHeader(http.StatusNoContent)
	}
}

// QuerySqliteDB handles POST /sqlite/{id}/query — execute SQL via API key auth,
// proxied through the Turso HTTP query API.
func QuerySqliteDB(db *sql.DB, tursoClient *turso.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if tursoClient == nil {
			http.Error(w, `{"error":"SQLite hosting not configured"}`, http.StatusServiceUnavailable)
			return
		}

		id := chi.URLParam(r, "id")
		apiKey := extractBearerToken(r)

		if apiKey == "" {
			http.Error(w, `{"error":"missing API key"}`, http.StatusUnauthorized)
			return
		}

		var tursoHostname, storedToken string
		err := db.QueryRowContext(r.Context(),
			`SELECT turso_hostname, api_key FROM hosted_sqlite
			 WHERE id = $1 AND api_key = $2 AND status = 'active'`,
			id, apiKey).Scan(&tursoHostname, &storedToken)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"invalid database ID or API key"}`, http.StatusUnauthorized)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		var req struct {
			SQL    string        `json:"sql"`
			Params []interface{} `json:"params"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request body"}`, http.StatusBadRequest)
			return
		}
		if strings.TrimSpace(req.SQL) == "" {
			http.Error(w, `{"error":"sql is required"}`, http.StatusBadRequest)
			return
		}

		result, err := tursoClient.ExecuteQuery(r.Context(), tursoHostname, storedToken, req.SQL)
		if err != nil {
			log.Printf("sqlite query: turso error for %s: %v", id, err)
			http.Error(w, `{"error":"query execution failed"}`, http.StatusInternalServerError)
			return
		}

		if result.Error != "" {
			w.WriteHeader(http.StatusBadRequest)
		}
		json.NewEncoder(w).Encode(result) //nolint:errcheck
	}
}

// GetSqliteSchema handles GET /sqlite/{id}/schema — return schema via API key auth,
// fetched from Turso using the HTTP query API.
func GetSqliteSchema(db *sql.DB, tursoClient *turso.Client) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		if tursoClient == nil {
			http.Error(w, `{"error":"SQLite hosting not configured"}`, http.StatusServiceUnavailable)
			return
		}

		id := chi.URLParam(r, "id")
		apiKey := extractBearerToken(r)

		if apiKey == "" {
			http.Error(w, `{"error":"missing API key"}`, http.StatusUnauthorized)
			return
		}

		var tursoHostname, storedToken string
		err := db.QueryRowContext(r.Context(),
			`SELECT turso_hostname, api_key FROM hosted_sqlite
			 WHERE id = $1 AND api_key = $2 AND status = 'active'`,
			id, apiKey).Scan(&tursoHostname, &storedToken)
		if err == sql.ErrNoRows {
			http.Error(w, `{"error":"invalid database ID or API key"}`, http.StatusUnauthorized)
			return
		}
		if err != nil {
			http.Error(w, `{"error":"failed to look up database"}`, http.StatusInternalServerError)
			return
		}

		tables, err := fetchTursoSchema(r.Context(), tursoClient, tursoHostname, storedToken)
		if err != nil {
			log.Printf("sqlite schema: turso error for %s: %v", id, err)
			http.Error(w, `{"error":"failed to read schema"}`, http.StatusInternalServerError)
			return
		}

		json.NewEncoder(w).Encode(map[string]any{"tables": tables}) //nolint:errcheck
	}
}

// fetchTursoSchema retrieves table/column/index info from a Turso database.
func fetchTursoSchema(ctx context.Context, c *turso.Client, hostname, token string) ([]turso.TableInfo, error) {
	// Get all tables and their DDL.
	masterResult, err := c.ExecuteQuery(ctx, hostname, token,
		`SELECT name, type, sql FROM sqlite_master
		 WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%'
		 ORDER BY type DESC, name`)
	if err != nil {
		return nil, fmt.Errorf("fetchTursoSchema: sqlite_master: %w", err)
	}
	if masterResult.Error != "" {
		return nil, fmt.Errorf("fetchTursoSchema: sqlite_master query error: %s", masterResult.Error)
	}

	var tableNames []string
	for _, row := range masterResult.Rows {
		if len(row) < 2 {
			continue
		}
		objType, _ := row[1].(string)
		name, _ := row[0].(string)
		if objType == "table" && name != "" {
			tableNames = append(tableNames, name)
		}
	}

	tables := make([]turso.TableInfo, 0, len(tableNames))
	for _, tableName := range tableNames {
		info, err := fetchTableInfo(ctx, c, hostname, token, tableName)
		if err != nil {
			return nil, err
		}
		tables = append(tables, info)
	}
	return tables, nil
}

// fetchTableInfo fetches column and index metadata for one table.
func fetchTableInfo(ctx context.Context, c *turso.Client, hostname, token, tableName string) (turso.TableInfo, error) {
	colResult, err := c.ExecuteQuery(ctx, hostname, token,
		fmt.Sprintf(`PRAGMA table_info("%s")`, strings.ReplaceAll(tableName, `"`, `""`)))
	if err != nil {
		return turso.TableInfo{}, fmt.Errorf("fetchTableInfo: table_info %q: %w", tableName, err)
	}
	if colResult.Error != "" {
		return turso.TableInfo{}, fmt.Errorf("fetchTableInfo: table_info %q error: %s", tableName, colResult.Error)
	}

	var columns []turso.ColumnInfo
	for _, row := range colResult.Rows {
		if len(row) < 6 {
			continue
		}
		col := turso.ColumnInfo{}
		if v, ok := toInt(row[0]); ok {
			col.CID = v
		}
		col.Name, _ = row[1].(string)
		col.Type, _ = row[2].(string)
		if v, ok := toInt64(row[3]); ok {
			col.NotNull = v != 0
		}
		if row[4] != nil {
			s := fmt.Sprintf("%v", row[4])
			col.DefaultValue = &s
		}
		if v, ok := toInt(row[5]); ok {
			col.PrimaryKey = v
		}
		columns = append(columns, col)
	}

	idxResult, err := c.ExecuteQuery(ctx, hostname, token,
		fmt.Sprintf(`PRAGMA index_list("%s")`, strings.ReplaceAll(tableName, `"`, `""`)))
	if err != nil {
		return turso.TableInfo{}, fmt.Errorf("fetchTableInfo: index_list %q: %w", tableName, err)
	}
	if idxResult.Error != "" {
		return turso.TableInfo{}, fmt.Errorf("fetchTableInfo: index_list %q error: %s", tableName, idxResult.Error)
	}

	var indexes []turso.IndexInfo
	for _, row := range idxResult.Rows {
		if len(row) < 4 {
			continue
		}
		idx := turso.IndexInfo{}
		idx.Name, _ = row[1].(string)
		if v, ok := toInt64(row[2]); ok {
			idx.Unique = v != 0
		}
		idx.Origin, _ = row[3].(string)
		indexes = append(indexes, idx)
	}

	return turso.TableInfo{
		Name:    tableName,
		Columns: columns,
		Indexes: indexes,
	}, nil
}

// toInt attempts to convert an interface{} to int, handling JSON number types.
func toInt(v interface{}) (int, bool) {
	switch n := v.(type) {
	case int64:
		return int(n), true
	case float64:
		return int(n), true
	case string:
		var i int
		_, err := fmt.Sscanf(n, "%d", &i)
		return i, err == nil
	}
	return 0, false
}

// toInt64 attempts to convert an interface{} to int64, handling JSON number types.
func toInt64(v interface{}) (int64, bool) {
	switch n := v.(type) {
	case int64:
		return n, true
	case float64:
		return int64(n), true
	case string:
		var i int64
		_, err := fmt.Sscanf(n, "%d", &i)
		return i, err == nil
	}
	return 0, false
}

// extractBearerToken returns the token portion of an "Authorization: Bearer <token>" header.
func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if !strings.HasPrefix(auth, "Bearer ") {
		return ""
	}
	return strings.TrimPrefix(auth, "Bearer ")
}
